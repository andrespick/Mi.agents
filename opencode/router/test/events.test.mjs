import test from 'node:test';
import assert from 'node:assert/strict';
import {RouterRuntime} from '../src/runtime.mjs';
import {handleEvent,startEvents} from '../src/events.mjs';
import {host} from './fixtures/host.mjs';
test('native user interruption cancels parentless worktree peers but ignores unrelated sessions',async()=>{
  const h=host(),r=new RouterRuntime(h.ctx,{openai:'oauth',anthropic:'haiku'});
  await r.bind('root','root',[],'architect');await r.bind('lane','root',['1.1'],'coder');
  await handleEvent(r,{type:'session.execution.interrupted',data:{sessionID:'unrelated',reason:'user'}});
  assert.equal(h.interrupts.length,0);
  await handleEvent(r,{type:'session.execution.interrupted',data:{sessionID:'root',reason:'user'}});
  assert.equal((await r.store.read('root')).status,'cancelled');
  assert.deepEqual(new Set(h.interrupts.map(x=>x.sessionID)),new Set(['root','lane']));
});
test('a deleted child idle event never prevents later root cancellation',async()=>{
  const h=host(),r=new RouterRuntime(h.ctx,{openai:'oauth',anthropic:'haiku'});
  await r.bind('root','root',[],'architect');await r.bind('removed','root',['1.1'],'coder');
  const get=h.ctx.session.get;h.ctx.session.get=async input=>{if(input.sessionID==='removed') throw {_tag:'SessionNotFoundError'};return get(input);};
  h.ctx.event={async *subscribe(){yield {type:'session.idle',data:{sessionID:'removed'}};yield {type:'session.execution.interrupted',data:{sessionID:'root',reason:'user'}};}};
  const stop=startEvents(r);await new Promise(resolve=>setTimeout(resolve,20));await stop();
  assert.equal((await r.store.read('root')).status,'cancelled');
  assert.ok(h.interrupts.some(i=>i.sessionID==='root'));
});
