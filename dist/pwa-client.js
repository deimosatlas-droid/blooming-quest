/* Offline support is opt-in; updates always save and ask before reloading. */
(function(global){
  'use strict';
  const $=id=>document.getElementById(id),service=global.navigator?.serviceWorker;
  const button=$('offline-enable'),update=$('game-update'),status=$('offline-status');
  const base=new URL('./',document.baseURI),secure=global.location.protocol==='https:'||['localhost','127.0.0.1','[::1]'].includes(global.location.hostname);
  let registration=null,applying=false;
  const tell=text=>{if(status)status.textContent=text;};
  function waiting(){const ready=Boolean(registration?.waiting);if(update)update.hidden=!ready;const notice=$('system-notice');if(notice){notice.hidden=!ready;notice.textContent='Update ready · Options';notice.setAttribute?.('aria-label','A game update is ready. Open Options to save and apply it.')}}
  function watch(value){
    registration=value;waiting();if(button)button.hidden=true;
    if(value.active)tell('Offline play enabled for this browser.');
    else tell('Downloading the game for offline play…');
    value.addEventListener('updatefound',()=>{const installing=value.installing;installing?.addEventListener('statechange',()=>{
      if(installing.state==='installed'){waiting();if(value.waiting)tell('A game update is ready. Save and apply it when you are ready.');}
      if(installing.state==='redundant'&&!value.active){if(button){button.hidden=false;button.disabled=false;}tell('Offline download did not finish. You can retry while online.');}
    });});
    return value;
  }
  function ask(worker,type){return new Promise((resolve,reject)=>{
    const channel=new MessageChannel(),timer=global.setTimeout(()=>{channel.port1.close();reject(Error('The game update did not respond. Try again.'));},5000);
    channel.port1.onmessage=event=>{global.clearTimeout(timer);channel.port1.close();resolve(event.data);};worker.postMessage({type},[channel.port2]);
  });}
  async function enable(){
    if(!service||!secure)return;tell('Downloading the game for offline play…');if(button)button.disabled=true;
    try{
      const value=watch(await service.register(new URL('sw.js',base).href,{scope:base.href,updateViaCache:'none'}));
      if(!value.active)await new Promise((resolve,reject)=>{
        const worker=value.installing||value.waiting,timer=global.setTimeout(()=>reject(Error('Offline download timed out.')),120000);
        if(!worker){global.clearTimeout(timer);reject(Error('Offline download did not start.'));return;}
        const check=()=>{if(worker.state==='activated'){global.clearTimeout(timer);resolve();}else if(worker.state==='redundant'){global.clearTimeout(timer);reject(Error('Offline download failed.'));}};
        worker.addEventListener('statechange',check);check();
      });
      tell('Offline play is ready. Keep a save backup before changing browsers.');
    }
    catch(error){if(button){button.hidden=false;button.disabled=false;}tell('Offline play could not be enabled. Your online game and save are unchanged.');}
  }
  async function applyUpdate(){
    const worker=registration?.waiting;if(!worker||applying)return;
    try{
      const availability=await ask(worker,'BLOOM_CAN_UPDATE');if(!availability.allowed){tell('Close other Blooming Quest tabs before applying the update.');return;}
      if(!global.BloomSaveTransfer?.prepareReload)throw Error('The world is still loading. Try the update when it is ready.');
      await global.BloomSaveTransfer.prepareReload();applying=true;if(update)update.disabled=true;
      const result=await ask(worker,'BLOOM_APPLY_UPDATE');if(!result.accepted){applying=false;if(update)update.disabled=false;tell('Close other Blooming Quest tabs before applying the update.');}
    }catch(error){applying=false;if(update)update.disabled=false;tell(error.message||'The update was not applied. Your current game is still running.');}
  }
  if(!service||!secure){if(button)button.hidden=true;if(update)update.hidden=true;tell('Offline play is unavailable in this browser or at this address.');return;}
  if(button){button.hidden=false;button.onclick=enable;}
  if(update)update.onclick=applyUpdate;
  service.addEventListener('controllerchange',()=>{if(applying){applying=false;global.location.reload();}});
  service.addEventListener('message',event=>{if(event.data?.type==='BLOOM_OFFLINE_READY')tell('Offline download complete. The game is ready in this browser.');});
  service.getRegistration(base.href).then(value=>{if(value?.scope===base.href){watch(value);value.update().catch(()=>{});}}).catch(()=>{});
  global.BloomOffline={enable,applyUpdate,getRegistration:()=>registration};
})(window);
