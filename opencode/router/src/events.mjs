// Cancellation and accounting events include parentless lane sessions too.
export async function handleEvent(rt,e) {
  const id=e.data?.sessionID;
  if(!id) return;
  const b=await rt.ctx.storage.get(`session:${id}`);
  if(!b) return; // Global bus: never operate on unrelated sessions.
  const run=await rt.store.read(b.root);
  if(!run) return;
  if(b.epoch && b.epoch!==run.epoch || typeof e.created==='number' && e.created<run.started) return;
  if(e.type==='session.execution.interrupted' && run.status==='running' && ['user','shutdown'].includes(e.data.reason)) await rt.control(b.root,'cancel');
  if(e.type==='session.idle') {
    await rt.account(id);
    if(id!==b.root) await rt.store.transact(b.root,r=>{if(r.children[id]) r.children[id].status='idle';});
  }
  if(e.type==='session.execution.failed') {
    const info=await rt.ctx.session.get({sessionID:id});
    const kind=await rt.recordProviderError(id,e.data.error,info.model?.providerID);
    if(kind==='subscription-quota'||kind==='subscription-auth') await rt.control(b.root,'pause');
  }
}
export function startEvents(rt) {
  const abort=new AbortController();
  const finished=(async()=>{
    try {
      for await(const event of rt.ctx.event.subscribe({signal:abort.signal})) {
        if(abort.signal.aborted) break;
        try {await handleEvent(rt,event);}
        catch(error) {
          const id=event.data?.sessionID,b=id && await rt.ctx.storage.get(`session:${id}`);
          const missing=error?._tag==='SessionNotFoundError'||error?.name==='SessionNotFoundError'||/SessionNotFoundError/.test(String(error));
          if(b && missing) await rt.store.transact(b.root,r=>{if(r.children[id]) r.children[id].status='removed';});
          else {
            await rt.ctx.storage.set('router:event-error',{at:Date.now(),type:error.name??'Error',session:id??''});
            if(b) await rt.control(b.root,'pause').catch(()=>{});
          }
        }
      }
    } catch(error) {
      if(!abort.signal.aborted) await rt.ctx.storage.set('router:event-error',{at:Date.now(),type:error.name??'Error'});
    }
  })();
  return async()=>{
    abort.abort();let timer;
    try{await Promise.race([finished,new Promise(resolve=>{timer=setTimeout(resolve,1000);})]);}
    finally{clearTimeout(timer);}
  };
}
