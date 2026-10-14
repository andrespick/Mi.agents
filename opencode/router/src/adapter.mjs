import {createHash,randomUUID} from 'node:crypto';
import {POLICY,roleOf,modelString,taskFor,note,admit} from './policy.mjs';
import {ROUTER,COORDINATOR,WORKER} from './prompts.mjs';

const content=v=>({content:JSON.stringify(v,null,2)});
const isNativeSubagent=id=>id==='subagent'||id.endsWith('.subagent');
const noDelegate={action:'subagent',resource:'*',effect:'deny'};
const readTools=new Set(['read','glob','grep','webfetch','websearch','question','router_status','router_route']);
const safeRead=id=>readTools.has(id.split('.').at(-1));

export async function installGuards(rt) {
  const {ctx}=rt;
  const hook=async(name,fn,scope)=>rt.registrations.push(await ctx.session.hook(name,fn,scope));
  await hook('http.request',e=>rt.guardHTTP(e));
  await hook('experimental.ws.handshake',e=>rt.guardSocket(e));
  // Check every outbound socket frame too: an existing socket can survive a
  // credential switch. HTTP is the configured transport, sockets remain guarded.
  await hook('experimental.ws.send',async e=>{await rt.connection(e.model.providerID);});
  await hook('model.request',async e=>{
    const b=await rt.bindingFor(e.sessionID);
    if(['openai','anthropic'].includes(e.model.providerID)) await rt.connection(e.model.providerID);
    const key=`request:${randomUUID()}`;
    await rt.store.transact(b.root,r=>{
      admit(r,key); r.calls[key].status='admitted';
      note(r,'request',{session:e.sessionID,kind:e.kind,model:modelString(e.model),oauth:e.model.providerID==='openai'});
    });
  });
  await hook('http.response',async e=>{
    if(e.response.status>=400) {
      // Parse only error bodies; never store raw bodies, headers or credentials.
      const text=(await e.response.clone().text()).slice(0,4000);
      await rt.recordProviderError(e.sessionID,`${e.response.status} ${text}`,e.model.providerID);
    }
  });
  await hook('retry',async e=>{
    const kind=await rt.recordProviderError(e.sessionID,e.error,e.model.providerID);
    if(kind!=='transient' || e.attempt>POLICY.limits.transientRetries) e.decision={retry:false};
    else e.decision={retry:true,delay:Math.min(2000,500*e.attempt)};
  });
  // Native title generation can select an unrelated default model. Skip that
  // auxiliary call deterministically; compaction stays on the selected session.
  await hook('title',e=>{e.result='Mi.router · desarrollo';});
  rt.registrations.push(await ctx.provider.transform(editor=>{
    if(editor.get('openai')) editor.update('openai',p=>{p.settings={...p.settings,transport:'http',encoding:'none'};});
  }));
}

export function swarmContext(rt) {
  const {ctx}=rt;
  return {...ctx,
    // Swarm's shared core uses this exact V2 session shim for lanes/QA. Wrap
    // those calls, including parentless worktree children, without cache patches.
    session:{...ctx.session,
      create:async input=>{
        const owner=rt.local.getStore();
        let permissions=input.permissions??[];
        if(owner?.parent) {
          const parent=await ctx.session.get({sessionID:owner.parent});
          const agent=parent.agent?await ctx.agent.get({agentID:parent.agent}):undefined;
          // Only copy restrictions, never propagate broad allow rules to children.
          permissions=[...(agent?.permissions??[]).filter(p=>p.effect!=='allow'),...(parent.permissions??[]).filter(p=>p.effect!=='allow'),...permissions,noDelegate];
        }
        const child=await ctx.session.create({...input,permissions});
        if(owner) await rt.bind(child.id,owner.root,[],'pending',child.location?.directory??input.location?.directory);
        return child;
      },
      switchModel:async input=>{
        const b=await rt.bindingFor(input.sessionID);
        if(b.role==='pending') return; // The upcoming prompt supplies role/task IDs.
        const model=await rt.select(input.sessionID,b.role,b.tasks);
        return ctx.session.switchModel({...input,model});
      },
      wait:input=>rt.waitSession(input),
    },
    generate:{...ctx.generate,text:async()=>{throw new Error('Router requires session-bound generation for authorization guards');}},
  };
}

export async function installRouting(rt) {
  const {ctx}=rt;
  rt.registrations.push(await ctx.session.hook('prompt',async e=>{
    const info=await ctx.session.get({sessionID:e.sessionID});
    let b=await rt.bindingFor(e.sessionID);
    const current=await rt.store.read(b.root);
    if(b.epoch && current?.epoch!==b.epoch) throw new Error('Stale run prompt');
    const role=roleOf(info.agent);
    const directory=(await ctx.session.get({sessionID:b.root})).location?.directory??ctx.location.directory;
    const ids=await rt.tasksInPrompt(e.prompt.text,directory);
    if(b.root!==e.sessionID || info.parentID) {
      b=await rt.bind(e.sessionID,b.root,ids,role,info.location?.directory);
      if(role==='coder' && b.tasks.length===0) throw new Error('Coder requires TASK: ID from current Swarm plan');
    } else if(['mi-router','mi-worker','mi-answer','architect'].includes(info.agent)) {
      b=await rt.bind(e.sessionID,e.sessionID,[],info.agent==='mi-router'?'router':info.agent==='mi-worker'?'coder':info.agent==='mi-answer'?'router':'architect',directory);
    } else return;
    await rt.store.transact(b.root,r=>{
      if(b.root===e.sessionID) {
        if(r.owner && r.owner!==rt.boot && Object.values(r.calls).some(c=>c.status==='uncertain')) {r.status='paused';r.reason='Recovery: reconcile uncertain operations';}
        r.owner=rt.boot;
      }
      if(b.root===e.sessionID && /\b(?:no\s+(?:modifiques|modificar|escribas|edites|hagas?\s+cambios)|solo\s+(?:lee|lectura)|read[ -]only|do not (?:modify|edit))\b/i.test(e.prompt.text)) r.readOnly=true;
      if(b.root!==e.sessionID) {
        const running=Object.entries(r.children).filter(([id,c])=>id!==e.sessionID && c.role==='coder' && c.status==='active');
        if(role==='coder' && running.length>=r.limits.parallel) throw new Error('Parallel coder limit reached; queue this task');
        r.children[e.sessionID].status='active';
      }
    });
    await rt.readEvidence(b.root,directory);
    const model=await rt.select(e.sessionID,b.role,b.tasks);
    await rt.store.transact(b.root,r=>{
      if(role==='coder') for(const id of b.tasks) taskFor(r,id).dispatches++;
      note(r,'dispatch',{session:e.sessionID,role:b.role,tasks:b.tasks,model:modelString(model)});
    });
    await ctx.session.switchModel({sessionID:e.sessionID,model});
  }));
  // Registered after Swarm: its execute.after hook settles Stage A/B, so read
  // workflow evidence here as well, not only inside the tool implementation.
  rt.registrations.push(await ctx.tool.hook('execute.after',async e=>{
    const b=await rt.bindingFor(e.sessionID);
    const directory=(await ctx.session.get({sessionID:b.root})).location?.directory??ctx.location.directory;
    await rt.readEvidence(b.root,directory);
  }));
  for(const name of ['context','generate','compaction']) rt.registrations.push(await ctx.session.hook(name,async e=>{
    const b=await rt.bindingFor(e.sessionID),run=await rt.store.read(b.root);
    if(!run) return;
    if(b.epoch && b.epoch!==run.epoch) throw new Error('Stale run context');
    if(run.status!=='running') throw new Error(`Router ${run.status}: ${run.reason??''}`);
    if(!Object.values(POLICY.models).some(m=>m.id===e.model.id && m.providerID===e.model.providerID)) throw new Error('Model outside approved router policy');
    await rt.account(e.sessionID);
    if(e.model.providerID==='openai') e.options.reasoningEffort=e.model.variant??'high';
    const role=roleOf(e.agent);
    if(role==='mi-router') {
      for(const key of Object.keys(e.tools)) if(key!=='router_route') delete e.tools[key];
      e.system.push({type:'text',text:ROUTER});
    } else if(role==='architect') e.system.push({type:'text',text:COORDINATOR});
    else if(role==='coder' || role==='mi-worker') {
      for(const key of Object.keys(e.tools)) if(isNativeSubagent(key)||/dispatch_lanes|lean_turbo_run_phase|epic_dispatch/.test(key)) delete e.tools[key];
      e.system.push({type:'text',text:WORKER});
    }
    if(run.readOnly) {
      for(const key of Object.keys(e.tools)) if(!safeRead(key)) delete e.tools[key];
      e.system.push({type:'text',text:'Esta ejecución es SOLO LECTURA por instrucción del usuario. No edites archivos ni ejecutes shell, tampoco mediante otro agente.'});
    }
  }));
  rt.registrations.push(await ctx.permission.hook('evaluate',async e=>{
    const b=await rt.bindingFor(e.sessionID),r=await rt.store.read(b.root);
    if(!r) return;
    if(r.status!=='running' || (r.readOnly && ['edit','shell'].includes(e.action)) || (b.root!==e.sessionID && e.action==='subagent')) {
      e.effect='deny';e.message='Mi.router policy: no permission escalation';
    }
  }));
  rt.registrations.push(await ctx.tool.transform(editor=>{
    for(const existing of editor.list()) {
      editor.update(existing.id,tool=>{
        const execute=tool.execute;
        tool.execute=(input,context)=>executeManaged(rt,existing.id,execute,input,context);
      });
    }
    editor.add({name:'router_route',options:{codemode:false},description:'Clasifica y selecciona agente/modelo. Solo router de entrada.',input:{type:'object',properties:{route:{enum:['query','small','complex','security','ambiguous']},reason:{type:'string'},readOnly:{type:'boolean'}},required:['route','reason','readOnly'],additionalProperties:false},execute:async(input,c)=>{
      if(roleOf(c.agent)!=='mi-router') throw new Error('Only entry router can classify');
      if(c.signal?.aborted) throw new Error('Router classification cancelled');
      return content(await rt.route(c.sessionID,input.route,input.reason,input.readOnly));
    }});
    editor.add({name:'router_status',options:{codemode:false},description:'Estado durable, decisiones y escalamiento actual; lectura.',input:{type:'object',properties:{},additionalProperties:false},execute:async(_,c)=>content(await rt.control((await rt.bindingFor(c.sessionID)).root,'status'))});
  }));
  rt.registrations.push(await ctx.command.transform(editor=>{
    editor.add({name:'router',description:'status|explain|simulate|pause|resume|cancel|pin TASK MODEL|reconcile CALL|new',execute:async inv=>{
      const [action='status',...args]=inv.prompt.text.trim().split(/\s+/);
      const b=await rt.bindingFor(inv.sessionID),result=await rt.control(b.root,action,args);
      await ctx.session.synthetic({sessionID:inv.sessionID,text:JSON.stringify(result,null,2),description:'Mi.router: '+action,resume:false});
    }});
  }));
}

export async function executeManaged(rt,name,execute,input,context) {
  const {ctx}=rt,b=await rt.bindingFor(context.sessionID);
  let child;
  const key=`tool:${context.id}`;
  const epoch=await rt.store.transact(b.root,r=>{
    if(r.status!=='running') throw new Error(`Router ${r.status}`);
    if(r.readOnly && !safeRead(name)) throw new Error('Read-only execution');
    if(b.root!==context.sessionID && isNativeSubagent(name)) throw new Error('Workers cannot delegate');
    const hash=createHash('sha256').update(name+JSON.stringify(input)).digest('hex');
    r.repetitions??={};r.repetitions[hash]=(r.repetitions[hash]??0)+1;
    if(r.repetitions[hash]>8) {r.status='paused';r.reason='Repeated tool loop';throw new Error('Repeated tool loop');}
    admit(r,key);r.calls[key].tool=name;
    return r.epoch;
  });
  const wrappedContext={...context,progress:async v=>{if(v.sessionID) child=v.sessionID;await context.progress(v);}};
  const run=async()=>execute(input,wrappedContext);
  const onAbort=()=>{void rt.control(b.root,'cancel-if-running',[epoch]).catch(()=>{});};
  context.signal?.addEventListener('abort',onAbort,{once:true});
  try {
    let result;
    try {result=await rt.local.run({root:b.root,parent:context.sessionID,call:key},run);}
    catch(error) {
      if(child && await rt.providerErrorFor(child)==='haiku-quota' && isNativeSubagent(name) && await rt.claimFallback(child)) {
        rt.fallbacks.add(child);await rt.clearProviderError(child);await rt.account(child);
        const cb=await rt.bindingFor(child),model=await rt.select(child,cb.role,cb.tasks);
        result=await rt.local.run({root:b.root,parent:context.sessionID,call:key},()=>execute({...input,sessionID:child,model:modelString(model),prompt:'Continúa la misma tarea con el estado actual; Haiku sin saldo. '+input.prompt},wrappedContext));
      } else throw error;
    }
    await rt.store.transact(b.root,r=>{if(r.epoch!==epoch) return;r.calls[key].status='completed';if(child && r.children[child]) r.children[child].status='idle';});
    if(child) await rt.account(child);
    const directory=(await ctx.session.get({sessionID:b.root})).location?.directory??ctx.location.directory;
    await rt.readEvidence(b.root,directory);
    return result;
  } catch(error) {
    await rt.store.transact(b.root,r=>{
      if(r.epoch!==epoch) return;
      r.calls[key].status=r.status==='cancelled'?'cancelled':'uncertain';
      if(r.status==='running') {r.status='paused';r.reason=`Operation ${key} failed; inspect before reconcile`;}
      if(child && r.children[child]) r.children[child].status='failed';
    });
    throw error;
  } finally {context.signal?.removeEventListener('abort',onAbort);}
}
