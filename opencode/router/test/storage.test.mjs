import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {FileStorage} from '../src/storage.mjs';
import {StateStore} from '../src/state.mjs';
test('independent plugin instances atomically share state across worktree locations',async()=>{
  const base=new URL('../.local/test-storage/',import.meta.url);await mkdir(base,{recursive:true});
  const dir=await mkdtemp(new URL('run-',base).pathname.replace(/^\/([A-Z]:)/i,'$1'));
  try {
    const a=new StateStore(new FileStorage(dir)),b=new StateStore(new FileStorage(dir));
    await Promise.all(Array.from({length:30},(_,i)=>(i%2?a:b).transact('root',r=>{r.requests++;})));
    assert.equal((await a.read('root')).requests,30);
    await a.storage.set('session:child',{root:'root',tasks:['1.1']});
    assert.equal((await b.storage.get('session:child')).root,'root');
  } finally {await rm(dir,{recursive:true,force:true});}
});
