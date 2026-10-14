import test from 'node:test';
import assert from 'node:assert/strict';
import {RouterRuntime} from '../src/runtime.mjs';
import {StateStore} from '../src/state.mjs';

import {host} from './fixtures/host.mjs';
const binding={openai:'oauth',anthropic:'haiku'};
test('state mutations serialize and persist a pause even when enforcement throws',async()=>{
  const h=host(),s=new StateStore(h.ctx.storage);
  await Promise.all(Array.from({length:20},()=>s.transact('r',async r=>{await Promise.resolve();r.requests++;})));
  assert.equal((await s.read('r')).requests,20);
  await assert.rejects(s.transact('r',r=>{r.status='paused';throw new Error('stop');}));
  assert.equal((await s.read('r')).status,'paused');
});
test('guard blocks real API authorization and accepts pinned OAuth on same API URL',async()=>{
  const h=host(),r=new RouterRuntime(h.ctx,binding);
  const ev={sessionID:'root',model:{providerID:'openai',id:'gpt-6-luna'},kind:'primary',request:new Request('https://api.openai.com/v1/responses',{headers:{authorization:'Bearer secret'}})};
  await r.guardHTTP(ev);
  ev.request=new Request(ev.request.url,{headers:{authorization:'Bearer sk-API'}});
  await assert.rejects(r.guardHTTP(ev),/SUBSCRIPTION_ONLY/);
});
test('concurrent tasks use per-session models and variant, no registry rewrite',async()=>{
  const h=host(),r=new RouterRuntime(h.ctx,binding);
  await r.bind('a','root',['1.1'],'coder');await r.bind('b','root',['1.2'],'coder');
  await r.store.transact('root',s=>{s.tasks['1.1']={failures:[{generation:1},{generation:2},{generation:3}],dispatches:0,status:'rework'};});
  const [a,b]=await Promise.all([r.select('a','coder',['1.1']),r.select('b','coder',['1.2'])]);
  assert.equal(a.id,'gpt-6.1-sol');assert.equal(b.variant,'high');assert.ok(['gpt-6-luna','claude-haiku-5-5'].includes(b.id));
});
test('Haiku quota resumes same child on Luna, preserving quality counter',async()=>{
  const h=host(),r=new RouterRuntime(h.ctx,binding);
  await r.bind('child','root',['1.1'],'coder');
  await r.recordProviderError('child','Credit balance too low','anthropic');
  h.ctx.session.wait=async()=>({outcome:'failed'});
  let calls=0; const raw=async()=>({outcome:++calls===1?'failed':'succeeded'});
  await r.waitSession({sessionID:'child'},raw);
  assert.equal(calls,2);assert.equal(h.prompts[0].sessionID,'child');
  assert.equal(h.switches.find(x=>x.model)?.model.id,'gpt-6-luna');
  const state=await r.store.read('root');assert.equal(state.tasks['1.1'].failures.length,0);assert.equal(state.haikuDisabled,true);
});
test('pause interrupts all managed children including worktree sessions',async()=>{
  const h=host(),r=new RouterRuntime(h.ctx,binding);
  await r.bind('a','root',['1.1'],'coder');await r.bind('b','root',['1.2'],'coder');
  await r.control('root','pause');
  assert.deepEqual(new Set(h.interrupts.map(x=>x.sessionID)),new Set(['a','b','root']));
  await assert.rejects(r.select('a','coder',['1.1']),/paused/);
});
test('quality is counted from Swarm workflow evidence once per generation',async()=>{
  const h=host(),r=new RouterRuntime(h.ctx,binding);
  await r.bind('child','root',['1.1'],'coder');
  await r.observeEvidence('root','1.1',{workflow:{generation:1,lastOutcome:'stage_a_failed',state:'rework'}});
  await r.observeEvidence('root','1.1',{workflow:{generation:1,lastOutcome:'stage_b_failed',state:'rework'}});
  await r.observeEvidence('root','1.1',{workflow:{generation:2,lastOutcome:'dispatch_no_mutation',state:'rework'}});
  assert.equal((await r.store.read('root')).tasks['1.1'].failures.length,1);
});
test('classifier must call route even if the model would otherwise answer directly',async()=>{
  const h=host(),r=new RouterRuntime(h.ctx,binding);
  const e={sessionID:'root',agent:{id:'mi-router'},model:{providerID:'openai',id:'gpt-6-luna',variant:'none'},kind:'primary',request:new Request('https://api.openai.com/v1/responses',{method:'POST',headers:{authorization:'Bearer secret','content-type':'application/json'},body:JSON.stringify({model:'gpt-6-luna',tools:[{type:'function',name:'router_route'}],tool_choice:'auto'})})};
  await r.guardHTTP(e);
  assert.deepEqual((await e.request.json()).tool_choice,{type:'function',name:'router_route'});
});
test('provider quota and fallback ownership survive separate plugin instances',async()=>{
  const h=host(),a=new RouterRuntime(h.ctx,binding),b=new RouterRuntime(h.ctx,binding);
  await a.bind('lane','root',['1.1'],'coder');
  await b.recordProviderError('lane','Credit balance too low','anthropic');
  assert.equal(await a.providerErrorFor('lane'),'haiku-quota');
  assert.equal(await a.claimFallback('lane'),true);
  assert.equal(await b.claimFallback('lane'),false);
});
test('new run archives old counters and returns to entry router explicitly',async()=>{
  const h=host(),r=new RouterRuntime(h.ctx,binding);
  await r.bind('root','root',[],'architect');
  await r.store.transact('root',s=>{s.route='complex';s.requests=99;});
  await r.control('root','new');
  const current=await r.store.read('root');assert.equal(current.requests,0);assert.equal(current.route,undefined);
  assert.ok([...h.data.keys()].some(k=>k.startsWith('archive:root:')));
  assert.ok(h.switches.some(s=>s.agent==='mi-router'));
});
