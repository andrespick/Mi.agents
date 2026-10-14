import test from 'node:test';
import assert from 'node:assert/strict';
import {RouterRuntime} from '../src/runtime.mjs';
import {executeManaged,swarmContext,installGuards,installRouting} from '../src/adapter.mjs';
import {roleOf} from '../src/policy.mjs';
import {host} from './fixtures/host.mjs';
const binding={openai:'oauth',anthropic:'haiku'};
const context=id=>({id,sessionID:'root',agent:'architect',signal:new AbortController().signal,progress:async()=>{}});
test('Swarm compound role names retain test_engineer and medium effort',()=>{
  assert.equal(roleOf('test_engineer'),'test_engineer');assert.equal(roleOf('fast_test_engineer'),'test_engineer');
});
test('native subagent quota fallback keeps actual child session and context',async()=>{
  const h=host(),rt=new RouterRuntime(h.ctx,binding);let attempts=0;
  const original=async(input,c)=>{
    if(attempts++===0) {await rt.bind('child','root',['1.1'],'coder');await c.progress({sessionID:'child'});await rt.recordProviderError('child','credit balance too low','anthropic');throw new Error('provider failed');}
    assert.equal(input.sessionID,'child');assert.equal(input.model,'openai/gpt-6-luna#high');
    return {content:'passed'};
  };
  const result=await executeManaged(rt,'subagent',original,{agent:'coder',prompt:'TASK: 1.1'},context('call'));
  assert.equal(attempts,2);assert.equal(result.content,'passed');
  await assert.rejects(executeManaged(rt,'subagent',original,{},context('call')),/uncertain|duplicate/i);
});
test('parentless lane session inherits parent denies and cancellation ownership',async()=>{
  const h=host(),rt=new RouterRuntime(h.ctx,binding);
  h.sessions.set('root',{id:'root',agent:'architect',permissions:[{action:'edit',resource:'secret/*',effect:'deny'}]});
  let created;
  h.ctx.session.create=async v=>{created=v;return {id:'lane',location:v.location};};
  const proxy=swarmContext(rt);
  await rt.local.run({parent:'root',root:'root'},()=>proxy.session.create({location:{directory:'C:/project-lane'}}));
  assert.ok(created.permissions.some(p=>p.resource==='secret/*'&&p.effect==='deny'));
  assert.equal((await rt.bindingFor('lane')).root,'root');
});
test('an uncertain side effect is paused; resume requires explicit reconciliation',async()=>{
  const h=host(),rt=new RouterRuntime(h.ctx,binding);
  await assert.rejects(executeManaged(rt,'shell',async()=>{throw new Error('lost connection');},{command:'x'},context('call')));
  assert.equal((await rt.store.read('root')).status,'paused');
  await assert.rejects(rt.control('root','resume'),/Uncertain/);
  await rt.control('root','reconcile',['tool:call']);await rt.control('root','resume');
  assert.equal((await rt.store.read('root')).status,'running');
});
test('router route switches native session agent AND model',async()=>{
  const h=host(),rt=new RouterRuntime(h.ctx,binding);
  const result=await rt.route('root','complex','feature with dependent tasks');
  assert.equal(result.selected.model.id,'gpt-6.1-sol');assert.equal(result.selected.model.variant,'high');
  assert.ok(h.switches.some(x=>x.agent==='architect'));
});
test('entry and read-only restrictions remove mutation tools, plus permission backstop',async()=>{
  const h=host(),rt=new RouterRuntime(h.ctx,binding);await installGuards(rt);await installRouting(rt);
  await rt.bind('root','root',[],'router');
  const e={sessionID:'root',agent:{id:'mi-router'},model:{providerID:'openai',id:'gpt-6-luna',variant:'none'},system:[],messages:[],options:{},tools:{router_route:{},shell:{},subagent:{}}};
  await h.hooks.context[0](e);
  assert.deepEqual(Object.keys(e.tools),['router_route']);
  await rt.store.transact('root',r=>{r.readOnly=true;});
  await assert.rejects(executeManaged(rt,'shell',async()=>({}),{command:'x'},context('shell')),/Read-only/);
});
