// Cancellation and accounting events include parentless lane sessions too.
export async function handleEvent(rt,e) {
  const id=e.data?.sessionID;
  if(!id) return;
  const b=await rt.ctx.storage.get(`session:${id}`);
  if(!b) return; // Global bus: never operate on unrelated sessions.
  const run=await rt.store.read(b.root);
  if(!run) return;
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
        await handleEvent(rt,event);
      }
    } catch(error) {
      if(!abort.signal.aborted) await rt.ctx.storage.set('router:event-error',{at:Date.now(),type:error.name??'Error'});
    }
  })();
  return async()=>{abort.abort();await Promise.race([finished,new Promise(resolve=>setTimeout(resolve,1000))]);};
}
