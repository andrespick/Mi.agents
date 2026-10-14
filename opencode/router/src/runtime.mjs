import {AsyncLocalStorage} from 'node:async_hooks';
import {randomUUID} from 'node:crypto';
import {readFile,realpath} from 'node:fs/promises';
import path from 'node:path';
import {StateStore} from './state.mjs';
import {POLICY,createRun,modelFor,modelString,roleOf,taskFor,qualityFailure,providerFailure,classifyError,assertAuthorization,admit,note} from './policy.mjs';

export class RouterRuntime {
  constructor(ctx,binding) {
    this.ctx=ctx;this.binding=binding;this.store=new StateStore(ctx.storage);
    this.local=new AsyncLocalStorage();this.registrations=[];this.boot=randomUUID();
    this.providerErrors=new Map();this.active=new Set();this.fallbacks=new Set();
  }
  async bindingFor(id) {
    let b=await this.ctx.storage.get(`session:${id}`);
    if(b) return b;
    const info=await this.ctx.session.get({sessionID:id});
    const parent=info.parentID && await this.ctx.storage.get(`session:${info.parentID}`);
    if(parent) return await this.bind(id,parent.root,[],roleOf(info.agent));
    return {root:id,tasks:[],role:roleOf(info.agent),directory:info.location?.directory};
  }
  async bind(id,root,tasks=[],role='coder',directory) {
    const previous=await this.ctx.storage.get(`session:${id}`);
    const b={...previous,root,tasks:tasks.length?tasks:previous?.tasks??[],role};
    if(directory??previous?.directory) b.directory=directory??previous.directory;
    b.epoch=await this.store.transact(root,r=>{
      for(const task of b.tasks) taskFor(r,task);
      if(id!==root) r.children[id]={...r.children[id],role,tasks:b.tasks,status:r.children[id]?.status??'registered'};
      return r.epoch;
    });
    await this.ctx.storage.set(`session:${id}`,b);
    return b;
  }
  async select(id,role,ids=[]) {
    const b=await this.bindingFor(id);
    let selected=await this.store.transact(b.root,r=>{
      if(b.epoch && b.epoch!==r.epoch) throw new Error('Stale run child');
      const choices=(ids.length?ids:b.tasks.length?b.tasks:['direct']).map(t=>modelFor(r,t,role));
      const rank=m=>m.id===POLICY.models.astra.id?2:m.id===POLICY.models.sol.id?1:0;
      return choices.reduce((a,c)=>rank(c)>rank(a)?c:a);
    });
    if(selected.providerID==='anthropic') {
      try {await this.connection('anthropic');}
      catch {
        await this.store.transact(b.root,r=>{r.haikuDisabled=true;note(r,'haiku-unavailable');});
        selected=await this.store.transact(b.root,r=>modelFor(r,(ids.length?ids:b.tasks)[0]??'direct',role,'luna'));
      }
    }
    return selected;
  }
  async connection(provider) {
    const c=await this.ctx.integration.connection.active(provider);
    const expected=this.binding[provider];
    if(!c || c.id!==expected || c.method!==(provider==='openai'?'oauth':'key')) throw new Error(provider==='openai'?'SUBSCRIPTION_ONLY: pinned OAuth subscription not selected':'Haiku API connection unavailable');
    const credential=await this.ctx.integration.connection.resolve(c);
    return {connection:c,credential,binding:expected};
  }
  async guardHTTP(event) {
    const provider=event.model.providerID;
    if(!['openai','anthropic'].includes(provider)) return;
    const sessionBinding=await this.bindingFor(event.sessionID),sessionRun=await this.store.read(sessionBinding.root);
    if(sessionBinding.epoch && sessionRun?.epoch!==sessionBinding.epoch) throw new Error('Stale run request');
    if(provider==='anthropic' && event.model.id!==POLICY.models.haiku.id) throw new Error('HAIKU_ONLY: Anthropic restricted to configured Haiku');
    if(provider==='anthropic') {
      const b=await this.bindingFor(event.sessionID),run=await this.store.read(b.root);
      if(run?.haikuDisabled) {await this.recordProviderError(event.sessionID,'quota circuit open','anthropic');throw new Error('Haiku quota circuit open; resume on Luna');}
    }
    const credentials=await this.connection(provider);
    assertAuthorization({...credentials,provider,url:event.request.url,authorization:event.request.headers.get('authorization'),apiKey:event.request.headers.get('x-api-key')});
    if(event.request.body && !event.request.headers.get('content-encoding')) {
      const payload=await event.request.clone().json();
      const b=await this.bindingFor(event.sessionID);
      if(event.kind==='primary' && roleOf(event.agent)==='mi-router') {
        if(!(payload.tools??[]).some(t=>t.name==='router_route')) throw new Error('Router classifier tool unavailable; refusing an unclassified answer');
        payload.tool_choice={type:'function',name:'router_route'};
        payload.parallel_tool_calls=false;
        const headers=new Headers(event.request.headers);headers.delete('content-length');
        event.request=new Request(event.request,{headers,body:JSON.stringify(payload)});
      }
      await this.store.transact(b.root,r=>note(r,'wire-request',{session:event.sessionID,kind:event.kind,model:payload.model??'',effort:payload.reasoning?.effort??payload.output_config?.effort??'',toolChoice:payload.tool_choice??'auto',tools:(payload.tools??[]).map(t=>t.name??t.type)}));
    }
    // Refuse redirects: a later credential switch cannot redirect this immutable
    // authenticated request to an API-key billed route or a third-party host.
    event.request=new Request(event.request,{redirect:'error'});
  }
  async guardSocket(event) {
    if(event.model.providerID!=='openai') throw new Error('Router only supports HTTP for Haiku');
    const credentials=await this.connection('openai');
    const headers=new Headers(event.headers);
    assertAuthorization({...credentials,url:event.url,authorization:headers.get('authorization')});
  }
  async recordProviderError(id,error,provider) {
    const kind=classifyError(error,provider),b=await this.bindingFor(id);
    this.providerErrors.set(id,kind);
    await this.ctx.storage.set(`provider-error:${id}`,{kind,at:Date.now()});
    if(this.providerErrors.size>512) this.providerErrors.delete(this.providerErrors.keys().next().value);
    await this.store.transact(b.root,r=>{if(b.epoch && r.epoch!==b.epoch) return;for(const t of b.tasks.length?b.tasks:['direct']) providerFailure(r,t,kind);});
    return kind;
  }
  async providerErrorFor(id) {return (await this.ctx.storage.get(`provider-error:${id}`))?.kind??this.providerErrors.get(id);}
  async claimFallback(id) {
    const b=await this.bindingFor(id);
    return this.store.transact(b.root,r=>{
      const child=r.children[id];
      if(child?.haikuFallback) return false;
      if(child) child.haikuFallback=true;
      return true;
    });
  }
  async clearProviderError(id) {this.providerErrors.delete(id);await this.ctx.storage.set(`provider-error:${id}`,null);}
  async waitSession(input,raw=this.ctx.session.wait.bind(this.ctx.session)) {
    const id=input.sessionID;
    let result=await raw(input);
    if(await this.providerErrorFor(id)==='haiku-quota' && await this.claimFallback(id)) {
      this.fallbacks.add(id);await this.clearProviderError(id);await this.account(id);
      const b=await this.bindingFor(id);
      const m=await this.select(id,b.role,b.tasks);
      await this.ctx.session.switchModel({sessionID:id,model:m});
      await this.ctx.session.prompt({sessionID:id,text:'Continúa exactamente la tarea pendiente desde el código y contexto actuales. Haiku agotó saldo/cuota; ahora usas Luna de suscripción. Este cambio no consume un intento QA. No repitas acciones ya realizadas.'});
      result=await raw(input);
    }
    await this.account(id);
    return result;
  }
  async account(id) {
    const b=await this.bindingFor(id), info=await this.ctx.session.get({sessionID:id});
    await this.store.transact(b.root,r=>{
      if(b.epoch && r.epoch!==b.epoch) return;
      const totals=info.tokens??{},current=Object.values(totals).filter(v=>typeof v==='number').reduce((a,v)=>a+v,0)+(totals.cache?.read??0)+(totals.cache?.write??0);
      r.accounting??={}; const old=r.accounting[id]??{tokens:0,cost:0};
      r.tokens+=Math.max(0,current-old.tokens);
      if(info.model?.providerID==='anthropic') r.haikuUSD+=Math.max(0,(info.cost??0)-old.cost);
      r.accounting[id]={tokens:current,cost:info.cost??0};
      if(r.haikuUSD>=r.limits.haikuUSD) r.haikuDisabled=true;
    });
  }
  async observeEvidence(root,task,evidence) {
    const w=evidence.workflow;if(!w || !Number.isInteger(w.generation)) return;
    await this.store.transact(root,r=>{
      const t=taskFor(r,task);
      const outcome=w.lastOutcome;
      if(['stage_a_failed','stage_b_failed'].includes(outcome)) qualityFailure(r,task,`${w.retryEpoch??0}:${w.generation}`,outcome==='stage_b_failed'?'review':'test',outcome);
      if(w.state==='complete' && !w.forcedCompletion) t.status='complete';
      t.workflow={generation:w.generation,state:w.state,lastOutcome:outcome};
    });
  }
  async readEvidence(root,directory) {
    const run=await this.store.read(root);if(!run) return;
    for(const task of Object.keys(run.tasks)) {
      const target=path.join(directory,'.swarm','evidence',`${task}.json`);
      try {
        // Refuse linked evidence outside the project; malformed evidence is not a pass.
        const resolved=await realpath(target),base=await realpath(directory);
        if(!resolved.toLowerCase().startsWith((base+path.sep).toLowerCase())) throw new Error('Evidence escapes project');
        const bytes=await readFile(resolved);
        if(bytes.length>512000) throw new Error('Evidence too large');
        const data=JSON.parse(bytes.toString('utf8'));
        if(data.taskId===task) await this.observeEvidence(root,task,data);
      } catch(e) {if(e.code!=='ENOENT') throw e;}
    }
  }
  async tasksInPrompt(text,directory) {
    // Bind only task IDs that actually exist in Swarm's current plan. A repository
    // snippet cannot mint a task or a filesystem scope by naming one.
    let plan;
    try {plan=JSON.parse(await readFile(path.join(directory,'.swarm','plan.json'),'utf8'));}
    catch(e) {if(e.code==='ENOENT') return [];throw e;}
    const ids=[];
    for(const phase of plan.phases??[]) for(const task of phase.tasks??[]) {
      const id=String(task.id??'');
      if(id && new RegExp(`(?:TASK(?:_ID)?\\s*[:=]\\s*|Task\\s+|^\\s*-\\s*)${id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?=\\s|:|$)`,'im').test(text)) ids.push(id);
    }
    return ids;
  }
  async control(root,action,args=[]) {
    if(action==='new') {
      await this.control(root,'cancel');
      const old=await this.store.read(root);
      await this.ctx.storage.set(`archive:${root}:${Date.now()}`,old);
      await this.store.transact(root,r=>{for(const key of Object.keys(r)) delete r[key];Object.assign(r,createRun(root));});
      await this.bind(root,root,[],'router');
      await this.ctx.session.switchAgent({sessionID:root,agent:'mi-router'});
      await this.ctx.session.switchModel({sessionID:root,model:POLICY.models.router});
    } else if(['pause','cancel','cancel-if-running'].includes(action)) {
      const ids=await this.store.transact(root,r=>{
        if(action==='cancel-if-running' && (r.status!=='running'||args[0] && args[0]!==r.epoch)) return [];
        r.status=action==='pause'?'paused':'cancelled';r.reason=action;
        return [...Object.keys(r.children).filter(id=>!['removed','succeeded','idle'].includes(r.children[id].status)),root];
      });
      const results=await Promise.allSettled(ids.map(sessionID=>this.ctx.session.interrupt({sessionID,continue:false})));
      const failed=results.map((v,i)=>v.status==='rejected'?ids[i]:null).filter(Boolean);
      if(failed.length) throw new Error(`Interruption failed for ${failed.join(', ')}`);
    } else if(action==='resume') {
      const state=await this.store.read(root);
      if(state?.status==='cancelled') throw new Error('Cancelled run cannot resume; start a new session');
      if(Object.values(state?.calls??{}).some(c=>c.status==='uncertain')) throw new Error('Uncertain operations: inspect status and reconcile explicitly');
      await this.connection('openai');
      await this.store.transact(root,r=>{r.status='running';delete r.reason;r.owner=this.boot;});
    } else if(action==='pin') {
      const [task,model]=args;
      if(!['luna','haiku','sol','astra','auto'].includes(model)) throw new Error('pin TASK luna|haiku|sol|astra|auto');
      await this.store.transact(root,r=>{const t=taskFor(r,task);if(model==='auto') delete t.pin;else t.pin=model;});
    } else if(action==='reconcile') {
      const [call]=args;
      await this.store.transact(root,r=>{if(!r.calls[call]) throw new Error('Unknown operation');r.calls[call].status='reconciled';note(r,'manual-reconciliation',{call});});
    } else if(!['status','explain','simulate'].includes(action)) throw new Error('Commands: status, explain, simulate, pause, resume, cancel, pin, reconcile, new');
    const r=await this.store.read(root);
    if(action==='simulate') {
      const copy=structuredClone(r);copy.status='running';
      return Object.fromEntries(Object.keys(copy.tasks).map(id=>[id,modelString(modelFor(copy,id,'coder'))]));
    }
    return r??{status:'not-started'};
  }
  async route(sessionID,route,reason,readOnly=false) {
    const b=await this.bind(sessionID,sessionID,[],'router');
    const selected=await this.store.transact(b.root,r=>{
      if(readOnly) r.readOnly=true;
      if(r.route && r.route!=='ambiguous') throw new Error('Already classified; continue the active task');
      if(route==='ambiguous') {
        if(r.clarified) route='complex'; else r.clarified=true;
      }
      r.route=route; note(r,'route',{route,reason:String(reason).slice(0,500)});
      const agent=route==='ambiguous'?'mi-router':route==='query'?'mi-answer':route==='small'?'mi-worker':'architect';
      const role=route==='ambiguous'?'clarify':route==='query'?'router':route==='small'?'coder':'architect';
      return {agent,model:modelFor(r,'direct',role,'luna')};
    });
    await this.ctx.session.switchAgent({sessionID,agent:selected.agent});
    await this.ctx.session.switchModel({sessionID,model:selected.model});
    return {route,reason,selected,policy:'Initial + two corrections, then Sol; native Swarm gates remain required.'};
  }
}
