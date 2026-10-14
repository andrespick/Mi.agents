import { readFileSync } from 'node:fs';
import { timingSafeEqual,randomUUID } from 'node:crypto';

export const POLICY = JSON.parse(readFileSync(new URL('../policy.json', import.meta.url), 'utf8'));
export const modelString = m => `${m.providerID}/${m.id}#${m.variant}`;
export const roleOf = agent => {
  const id=String(typeof agent === 'object' ? agent.id : agent);
  return ['test_engineer','architect','coder','reviewer','critic','explorer','sme'].find(role=>id===role||id.endsWith('_'+role))??id;
};
export function createRun(id, now=Date.now()) {
  return {version:1,id,epoch:randomUUID(),status:'running',started:now,worker:'balanced',haikuDisabled:false,tasks:{},calls:{},children:{},requests:0,tokens:0,haikuUSD:0,events:[],limits:{...POLICY.limits}};
}
export function taskFor(run,id) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(id) || ['__proto__','constructor','prototype'].includes(id)) throw new Error('Invalid task ID');
  return run.tasks[id] ??= {failures:[],infrastructure:0,dispatches:0,status:'pending'};
}
export function note(run,type,data={}) {
  run.events.push({at:Date.now(),type,...data});
  if(run.events.length>300) run.events.splice(0,run.events.length-300);
}
export function modelFor(run,id,role,preferred) {
  if(run.status!=='running') throw new Error(`Router ${run.status}: ${run.reason??'resume explicitly'}`);
  if(role==='router') return {...POLICY.models.router};
  if(role==='clarify') return {...POLICY.models.clarify};
  if(role==='test_engineer') return {...POLICY.models.test};
  if(role!=='coder') return {...POLICY.models.sol};
  const task=taskFor(run,id), n=task.failures.length;
  const attempts=POLICY.qualityAttempts;
  if(n>=attempts.worker+attempts.sol+attempts.astra) {
    run.status='paused'; run.reason=`Quality attempts exhausted for ${id}`;
    throw new Error(`Router paused: ${run.reason}`);
  }
  const minimum=n>=attempts.worker+attempts.sol?'astra':n>=attempts.worker?'sol':undefined;
  const pin=task.pin;
  const rank={luna:0,haiku:0,sol:1,astra:2};
  if(minimum) return {...POLICY.models[pin && rank[pin]>rank[minimum]?pin:minimum]};
  let worker=pin ?? preferred ?? run.worker;
  if(worker==='balanced') {
    const parity=[...id].reduce((a,c)=>a+c.charCodeAt(0),0)%2;
    worker=parity?'haiku':'luna';
  }
  if(worker==='haiku' && run.haikuDisabled) worker='luna';
  if(!POLICY.models[worker]) worker='luna';
  return {...POLICY.models[worker]};
}
export function qualityFailure(run,id,generation,kind,summary='') {
  const task=taskFor(run,id);
  if(!['test','review'].includes(kind) || task.failures.some(f=>f.generation===generation)) return false;
  task.failures.push({generation,kind,summary:String(summary).slice(0,1200),at:Date.now()});
  task.status='rework'; note(run,'quality-failure',{task:id,generation,failures:task.failures.length});
  return true;
}
export function providerFailure(run,id,kind) {
  const task=taskFor(run,id);
  task.infrastructure++;
  if(kind==='haiku-quota') {run.haikuDisabled=true; note(run,'haiku-circuit-open',{task:id});}
  if(kind==='subscription-quota' || kind==='subscription-auth') {run.status='paused';run.reason=kind;}
}
export function classifyError(value,provider) {
  const text=typeof value==='string'?value:JSON.stringify(value??{});
  if(provider==='anthropic' && /credit.?balance|insufficient.*(?:credit|fund|balance)|billing|payment.required|quota|usage.limit|rate.limit|429|402/i.test(text)) return 'haiku-quota';
  if(provider==='openai' && /subscription.sharing|chatpass|quota|usage.limit|insufficient|429|rate.limit/i.test(text)) return 'subscription-quota';
  if(provider==='openai' && /401|403|unauthori|invalid.*(?:token|auth)|subscription.only/i.test(text)) return 'subscription-auth';
  if(/overload|503|502|504|ECONNRESET|ETIMEDOUT|temporar/i.test(text)) return 'transient';
  return 'other';
}
function secretEqual(a,b) {
  const x=Buffer.from(a??''),y=Buffer.from(b??'');
  return x.length>0 && x.length===y.length && timingSafeEqual(x,y);
}
export function assertAuthorization({connection,binding,credential,url,authorization,provider='openai',apiKey}) {
  const endpoint=new URL(url);
  if(provider==='openai') {
    if(connection?.type!=='credential' || connection.method!=='oauth' || connection.id!==binding || credential?.type!=='oauth') throw new Error('SUBSCRIPTION_ONLY: pinned OAuth subscription unavailable');
    if(!['chatgpt-token-sharing','chatgpt-browser','chatgpt-headless'].includes(credential.methodID)) throw new Error('SUBSCRIPTION_ONLY: unrecognized OAuth method');
    const modern=credential.methodID==='chatgpt-token-sharing';
    const secure=['https:','wss:'].includes(endpoint.protocol) && !endpoint.username && !endpoint.password && !endpoint.port;
    const allowed=modern ? endpoint.hostname==='api.openai.com' && /^\/v1\/(responses|chat\/completions)(?:\/compact)?$/.test(endpoint.pathname) : endpoint.hostname==='chatgpt.com' && /^\/backend-api\/codex\/responses(?:\/compact)?$/.test(endpoint.pathname);
    if(!secure || !allowed) throw new Error('SUBSCRIPTION_ONLY: unexpected endpoint');
    if(!secretEqual(authorization,`Bearer ${credential.access}`)) throw new Error('SUBSCRIPTION_ONLY: request authorization does not match pinned OAuth');
  } else {
    if(connection?.type!=='credential' || connection.id!==binding || connection.method!=='key' || credential?.type!=='key') throw new Error('Haiku API connection unavailable');
    if(endpoint.protocol!=='https:' || endpoint.hostname!=='api.anthropic.com' || endpoint.port || !/^\/v1\/messages$/.test(endpoint.pathname)) throw new Error('Unexpected Haiku endpoint');
    if(!secretEqual(apiKey,credential.key)) throw new Error('Haiku authorization mismatch');
  }
}
export function admit(run,key,now=Date.now()) {
  if(run.status!=='running') throw new Error(`Router ${run.status}`);
  if(run.calls[key]) throw new Error('Duplicate or uncertain operation: reconcile before retry');
  if(run.requests>=run.limits.requests || run.tokens>=run.limits.tokens || now-run.started>run.limits.minutes*60000) {
    run.status='paused';run.reason='budget';throw new Error('Router budget exhausted');
  }
  run.calls[key]={status:'uncertain',at:now}; run.requests++;
}
