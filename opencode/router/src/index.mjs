import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import swarm from 'opencode-swarm';
import {RouterRuntime} from './runtime.mjs';
import {FileStorage} from './storage.mjs';
import {startEvents} from './events.mjs';
import {installGuards,installRouting,swarmContext} from './adapter.mjs';

// Native V2 plugin shape. No V1 task API, dynamic global coder rewrite, or
// second controller: the upstream setup receives the guarded session adapter.
export default {
  id:'mi-opencode-router',
  async setup(ctx) {
    const binding=JSON.parse(await readFile(new URL('../.local/binding.json',import.meta.url),'utf8'));
    const shared={...ctx,storage:new FileStorage(fileURLToPath(new URL('../.local/state/',import.meta.url)))};
    const rt=new RouterRuntime(shared,binding);
    // Security hooks register first. Any initialization error keeps these guards
    // for this lifecycle; deployments validate readiness before use.
    await installGuards(rt);
    const cleanupSwarm=await swarm.setup(swarmContext(rt));
    await installRouting(rt);
    const stopEvents=startEvents(rt);
    await ctx.storage.set('router:ready',{version:'0.1.0',swarm:'7.197.1',host:ctx.app.version});
    return async()=>{
      await ctx.storage.set('router:ready',null);
      await stopEvents();
      if(cleanupSwarm) await cleanupSwarm();
      for(const registration of rt.registrations.reverse()) await registration.dispose();
    };
  },
};
