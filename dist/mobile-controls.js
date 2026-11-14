/* Pointer controls work alongside the keyboard, including several fingers. */
(function(global){
  'use strict';
  const DIRECTIONS=new Set(['arrowup','arrowdown','arrowleft','arrowright']);
  function bindHolds(options={}){
    const root=options.root||document,win=options.win||global;
    const buttons=[...root.querySelectorAll('[data-key]')],allowed=new Set(buttons),pointers=new Map(),counts=new Map(),listeners=[];
    const listen=(target,type,handler)=>{target?.addEventListener?.(type,handler);listeners.push([target,type,handler]);};
    function paint(button){
      const down=[...pointers.values()].some(pointer=>pointer.button===button);
      button.classList?.toggle('is-held',down);button.setAttribute?.('aria-pressed',String(down));
    }
    function change(key,amount){
      const before=counts.get(key)||0,after=Math.max(0,before+amount);
      if(after)counts.set(key,after);else counts.delete(key);
      if(Boolean(before)!==Boolean(after))options.onHeld?.(key,after>0);
    }
    function release(id){
      const pointer=pointers.get(id);if(!pointer)return;
      pointers.delete(id);change(pointer.key,-1);paint(pointer.button);
    }
    function press(id,button){
      if(pointers.get(id)?.button===button)return;
      release(id);const key=button.dataset.key;pointers.set(id,{button,key});change(key,1);paint(button);
    }
    function reset(){for(const id of [...pointers.keys()])release(id);}
    for(const button of buttons){
      button.setAttribute?.('aria-pressed','false');
      listen(button,'pointerdown',event=>{
        if(event.pointerType==='mouse'&&event.button!==0)return;
        event.preventDefault();press(event.pointerId,button);
        try{button.setPointerCapture?.(event.pointerId);}catch{}
      });
      listen(button,'pointermove',event=>{
        const pointer=pointers.get(event.pointerId);if(!pointer||!DIRECTIONS.has(pointer.key))return;
        // Pointer capture keeps release events reliable while a thumb can slide
        // between adjacent D-pad buttons without lifting off the screen.
        const under=root.elementFromPoint?.(event.clientX,event.clientY)?.closest?.('[data-key]');
        if(allowed.has(under)&&DIRECTIONS.has(under.dataset.key))press(event.pointerId,under);
      });
      for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(button,type,event=>release(event.pointerId));
      listen(button,'keydown',event=>{
        if(event.key!==' '&&event.key!=='Enter')return;
        event.preventDefault();if(!event.repeat)press('key:'+event.key,button);
      });
      listen(button,'keyup',event=>{if(event.key===' '||event.key==='Enter'){event.preventDefault();release('key:'+event.key);}});
      listen(button,'blur',()=>{for(const [id,pointer]of [...pointers])if(pointer.button===button&&String(id).startsWith('key:'))release(id);});
    }
    // Captured events normally reach the button; window listeners also release
    // a finger if a browser interrupts capture during rotation or app switching.
    for(const type of ['pointerup','pointercancel'])listen(win,type,event=>release(event.pointerId));
    listen(win,'blur',reset);listen(win,'pagehide',reset);listen(win,'orientationchange',reset);listen(win,'resize',reset);
    listen(root,'visibilitychange',()=>{if(root.hidden||root.visibilityState==='hidden')reset();});
    return {reset,snapshot:()=>({pointers:pointers.size,held:[...counts.keys()]}),destroy(){reset();for(const[target,type,handler]of listeners)target?.removeEventListener?.(type,handler);}};
  }
  function bindViewport(options={}){
    const container=options.container,button=options.button,doc=options.doc||document,win=options.win||global;
    if(!container||!button)return null;
    const orientation=win.screen?.orientation||global.screen?.orientation;
    let expanded=false,oldOverflow='',wanted=false,operation=null,reconcilingTarget=null,wasNative=false,orientationOwned=false,orientationAttempted=false,orientationEpoch=0;
    const native=()=>doc.fullscreenElement===container;
    // The game screen is permanent. Native fullscreen only hides browser chrome;
    // leaving it must never return Amaal to the old page-with-a-game layout.
    container.classList?.toggle('is-game-screen',true);
    function paint(){
      const active=native();button.textContent=active?'Leave fullscreen':'Enter fullscreen';
      button.setAttribute?.('aria-pressed',String(active));
      button.setAttribute?.('aria-label',active?'Leave browser fullscreen':'Enter browser fullscreen');
    }
    function set(value){
      if(expanded!==value){
        expanded=value;container.classList?.toggle('is-expanded',value);
        if(doc.body?.style){if(value){oldOverflow=doc.body.style.overflow;doc.body.style.overflow='hidden';}else doc.body.style.overflow=oldOverflow;}
        options.onChange?.(value);
      }
      paint();
    }
    function releaseOrientation(){
      orientationEpoch++;orientationAttempted=false;
      if(orientationOwned){orientationOwned=false;try{orientation?.unlock?.();}catch{}}
    }
    function suggestLandscape(){
      if(!native()||orientationAttempted||typeof orientation?.lock!=='function')return;
      orientationAttempted=true;const epoch=orientationEpoch;
      // Orientation is advisory. Safari/desktop may reject or omit this API;
      // neither a rejected lock nor a pending one can delay the game or Exit.
      try{Promise.resolve(orientation.lock('landscape')).then(()=>{
        if(native()&&epoch===orientationEpoch)orientationOwned=true;
        else if(!native())try{orientation.unlock?.();}catch{}
      }).catch(()=>{});}catch{}
    }
    function browserChanged(){
      if(native()){wasNative=true;set(true);return;}
      if(wasNative){wasNative=false;if(reconcilingTarget!==false)wanted=false;set(false);releaseOrientation();}
      else paint();
    }
    async function reconcile(){
      // There is always an await, including unsupported browsers, so operation
      // is assigned before cleanup; concurrent Enter/Exit calls share one job.
      try{
        let target;
        do{
          target=wanted;reconcilingTarget=target;
          if(target){
            set(true);
            try{if(!native()&&doc.fullscreenEnabled!==false&&typeof container.requestFullscreen==='function')await container.requestFullscreen();else await Promise.resolve();}catch{}
            if(native()){wasNative=true;if(wanted)suggestLandscape();}
            paint();
          }else{
            try{if(native()&&typeof doc.exitFullscreen==='function')await doc.exitFullscreen();else await Promise.resolve();}catch{}
            set(native());if(!native()){wasNative=false;releaseOrientation();}
          }
          await Promise.resolve();
        }while(target!==wanted);
        return{expanded,native:native()};
      }finally{operation=null;reconcilingTarget=null;paint();}
    }
    function request(value){wanted=value;if(!operation)operation=reconcile();return operation;}
    function enter(){return request(true);}
    function exit(){return request(false).then(value=>{button.focus?.({preventScroll:true});return value;});}
    function toggle(){return expanded||native()?exit():enter();}
    button.onclick=()=>native()?exit():enter();paint();
    doc.addEventListener?.('fullscreenchange',browserChanged);
    doc.addEventListener?.('keydown',event=>{if(event.defaultPrevented)return;if(event.key==='Escape'&&(expanded||native())){event.preventDefault();exit();}});
    win.addEventListener?.('pagehide',()=>{request(false);});
    if(native()){wasNative=true;wanted=true;set(true);}
    return{toggle,enter,exit,expanded:()=>expanded,native};
  }
  global.BloomMobile={bindHolds,bindViewport};
})(window);
