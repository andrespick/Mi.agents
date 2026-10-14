import {mkdir,readFile,writeFile,rename,lstat,unlink} from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import lockfile from 'proper-lockfile';
import {setTimeout as delay} from 'node:timers/promises';

// Cross-location storage: a lane plugin instance must see its controller's
// circuit breaker/cancellation. Atomic files + interprocess lock prevent lost
// increments even if OpenCode hosts locations in separate workers/processes.
export class FileStorage {
  constructor(directory){this.directory=directory;}
  async prepare(){
    for(let current=path.resolve(this.directory);;current=path.dirname(current)) {
      try {if((await lstat(current)).isSymbolicLink()) throw new Error('Linked router state directory refused');}
      catch(e){if(e.code!=='ENOENT') throw e;}
      if(path.dirname(current)===current) break;
    }
    await mkdir(this.directory,{recursive:true});
  }
  file(key){return path.join(this.directory,createHash('sha256').update(key).digest('hex')+'.json');}
  async get(key){try{return JSON.parse(await readFile(this.file(key),'utf8')).value;}catch(e){if(e.code==='ENOENT') return;throw e;}}
  async set(key,value){
    await this.prepare();const dest=this.file(key),tmp=dest+'.'+randomUUID()+'.tmp';
    try {
      await writeFile(tmp,JSON.stringify({key,value}),{flag:'wx',mode:0o600});
      for(let attempt=0;;attempt++) {
        try {await rename(tmp,dest);break;}
        catch(e) {if(!['EPERM','EBUSY','EACCES'].includes(e.code)||attempt>=8) throw e;await delay(25*(attempt+1));}
      }
    }
    finally{await unlink(tmp).catch(e=>{if(e.code!=='ENOENT') throw e;});}
  }
  async withLock(fn){
    await this.prepare();
    const release=await lockfile.lock(this.directory,{retries:{retries:80,minTimeout:20,maxTimeout:75},stale:30000,update:10000});
    try{return await fn();}finally{await release();}
  }
}
