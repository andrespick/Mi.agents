import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {loadSwarm,UPSTREAM_SHA256,adaptSource} from '../src/swarm-compat.mjs';
const require=createRequire(import.meta.url);
test('real pinned Swarm shim preserves enabled lane tools and still denies readonly tools',async()=>{
  const {miRouterCompat:c}=await loadSwarm();
  assert.deepEqual(c.readOnlyToolsToV2Permissions({write:true,edit:true,patch:true}),[]);
  assert.deepEqual(c.readOnlyToolsToV2Permissions({edit:false}),[{action:'tool',resource:'edit',effect:'deny'}]);
  const event={sessionID:'lane',system:[],tools:{write:{},edit:{},patch:{},shell:{}}};
  await c.makeV2SessionContextHandler('lane',undefined,{write:true,edit:true,patch:true,shell:false})(event);
  assert.deepEqual(Object.keys(event.tools),['write','edit','patch']);
  assert.equal(createHash('sha256').update(await readFile(require.resolve('opencode-swarm'))).digest('hex'),UPSTREAM_SHA256);
  assert.throws(()=>adaptSource('unexpected future bundle'),/Unsupported/);
});
test('real Swarm result translation accepts successful Luna turn after old Haiku error',async()=>{
  const {miRouterCompat:c}=await loadSwarm();
  const old={message:'Haiku credit balance too low'};
  const classification={outcome:'succeeded',needsErrorLookup:false,texts:['Luna completed task'],model:{providerID:'openai',modelID:'gpt-6-luna'}};
  const success=c.buildTranslatedPromptData(classification,old);
  assert.equal(success.info.error,undefined);assert.equal(success.parts[0].text,'Luna completed task');
  assert.ok(c.buildTranslatedPromptData({...classification,outcome:'failed',needsErrorLookup:true},old).info.error);
  assert.ok(c.buildTranslatedPromptData({...classification,outcome:undefined},old).info.error);
  const partial=c.classifyContextEntries([{role:'user',content:'A'},{role:'assistant',content:'A done'},{type:'idle',outcome:'succeeded'},{role:'user',content:'B'},{role:'assistant',content:'partial B'}]);
  assert.equal(partial.outcome,undefined);
  assert.ok(c.buildTranslatedPromptData(partial,old).info.error);
});
