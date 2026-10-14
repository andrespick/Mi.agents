import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, modelFor, qualityFailure, providerFailure, assertAuthorization, admit, classifyError } from '../src/policy.mjs';

test('initial plus two corrections; peer switch never resets attempts; Sol then Astra then pause', () => {
  const r = createRun('r');
  assert.equal(modelFor(r, '1.1', 'coder').id, 'gpt-6-luna');
  for (let n=1;n<=3;n++) qualityFailure(r,'1.1',`g${n}`,'test');
  assert.equal(modelFor(r,'1.1','coder').id,'gpt-6.1-sol');
  for (let n=4;n<=6;n++) qualityFailure(r,'1.1',`g${n}`,'review');
  assert.equal(modelFor(r,'1.1','coder').id,'gpt-6-astra');
  for (let n=7;n<=8;n++) qualityFailure(r,'1.1',`g${n}`,'test');
  assert.throws(()=>modelFor(r,'1.1','coder'),/paused/i);
});
test('quality evidence is idempotent and does not count expected red or infrastructure', () => {
  const r=createRun('r');
  qualityFailure(r,'1.1','g1','test'); qualityFailure(r,'1.1','g1','review');
  qualityFailure(r,'1.1','g2','tdd-red'); qualityFailure(r,'1.1','g3','baseline');
  providerFailure(r,'1.1','transient');
  assert.equal(r.tasks['1.1'].failures.length,1);
});
test('Haiku empty balance opens run circuit and hands off without quality penalty', () => {
  const r=createRun('r'); r.worker='haiku';
  assert.equal(modelFor(r,'1.1','coder').id,'claude-haiku-5-5');
  providerFailure(r,'1.1','haiku-quota');
  assert.equal(modelFor(r,'1.1','coder').id,'gpt-6-luna');
  assert.equal(modelFor(r,'1.2','coder').id,'gpt-6-luna');
  assert.equal(r.tasks['1.1'].failures.length,0);
});
test('no OpenAI API fallback, actual bearer must match pinned OAuth, not just URL', () => {
  const conn={type:'credential',method:'oauth',id:'selected'};
  const credential={type:'oauth',access:'oauth-secret',methodID:'chatgpt-token-sharing'};
  const input={connection:conn,binding:'selected',credential,url:'https://api.openai.com/v1/responses',authorization:'Bearer oauth-secret'};
  assert.doesNotThrow(()=>assertAuthorization(input));
  for(const bad of [{connection:{...conn,method:'key'}},{binding:'other'},{authorization:'Bearer sk-api'},{url:'https://attacker.example/responses'},{credential:{type:'key',key:'sk-api'}}]) {
    assert.throws(()=>assertAuthorization({...input,...bad}),/subscription|oauth|authorization|endpoint/i);
  }
});
test('admission is bounded and uncertain calls are not replayed after recovery', () => {
  const r=createRun('r');
  admit(r,'call1',1); assert.throws(()=>admit(r,'call1',2),/duplicate|uncertain/);
  r.requests=300; assert.throws(()=>admit(r,'call2',3),/budget/);
});
test('provider classification keeps billing, rate limits and code quality separate', () => {
  assert.equal(classifyError('Credit balance is too low','anthropic'),'haiku-quota');
  assert.equal(classifyError('subscription_sharing_usage_limit_exceeded','openai'),'subscription-quota');
  assert.equal(classifyError('overloaded_error 503','anthropic'),'transient');
  assert.equal(classifyError('assertion failed','openai'),'other');
});
