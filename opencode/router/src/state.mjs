import {createRun} from './policy.mjs';
import {randomUUID} from 'node:crypto';
// All location-owned mutations pass through one queue; storage is host-durable.
export class StateStore {
  constructor(storage) {this.storage=storage;this.tail=Promise.resolve();}
  async transact(id,fn) {
    const transaction=async()=>{
      const key=`run:${id}`;
      const state=await this.storage.get(key) ?? createRun(id);
      state.epoch??=randomUUID();
      try {return await fn(state);}
      finally {await this.storage.set(key,state);}
    };
    const work=this.tail.then(()=>this.storage.withLock?this.storage.withLock(transaction):transaction());
    this.tail=work.catch(()=>{});
    return work;
  }
  async read(id) {await this.tail;return await this.storage.get(`run:${id}`);}
}
