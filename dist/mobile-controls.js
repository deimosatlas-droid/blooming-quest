/* Pointer controls work alongside the keyboard, including several fingers. */
(function(global){
  'use strict';
  const DIRECTIONS=new Set(['arrowup','arrowdown','arrowleft','arrowright']);
  function bindHolds(options={}){
    const root=options.root||document,win=options.win||global;
    const buttons=[...root.querySelectorAll('[data-key]')],allowed=new Set(buttons),pointers=new Map(),counts=new Map(),listeners=[];
    const padFor=button=>DIRECTIONS.has(button?.dataset?.key)?button.closest?.('.touch-pad')||null:null;
    const pads=new Set(buttons.map(padFor).filter(pad=>typeof pad?.getBoundingClientRect==='function'));
    const listen=(target,type,handler)=>{target?.addEventListener?.(type,handler);listeners.push([target,type,handler]);};
    function paint(button){
      const down=[...pointers.values()].some(pointer=>pointer.keys.has(button.dataset.key));
      button.classList?.toggle('is-held',down);button.setAttribute?.('aria-pressed',String(down));
    }
    function change(key,amount){
      const before=counts.get(key)||0,after=Math.max(0,before+amount);
      if(after)counts.set(key,after);else counts.delete(key);
      if(Boolean(before)!==Boolean(after))options.onHeld?.(key,after>0);
    }
    function release(id){
      const pointer=pointers.get(id);if(!pointer)return;
      pointers.delete(id);for(const key of pointer.keys)change(key,-1);for(const button of buttons)paint(button);
    }
    function setKeys(id,keys,details){
      let pointer=pointers.get(id);
      if(!pointer){pointer={...details,keys:new Set()};pointers.set(id,pointer);}
      else if(details)Object.assign(pointer,details);
      const next=new Set(keys);
      // Apply one transition at a time: onHeld is allowed to reset the whole
      // controller synchronously when a menu or dialogue owns input.
      for(const key of [...pointer.keys])if(!next.has(key)){pointer.keys.delete(key);change(key,-1);}
      for(const key of next){
        if(pointers.get(id)!==pointer)break;
        if(!pointer.keys.has(key)){pointer.keys.add(key);change(key,1);}
      }
      for(const button of buttons)paint(button);
      return pointers.get(id)===pointer;
    }
    const press=(id,button)=>setKeys(id,[button.dataset.key],{button,pad:null,captureTarget:pointers.get(id)?.captureTarget||button,directional:DIRECTIONS.has(button.dataset.key)});
    function reset(settings={}){for(const [id,pointer]of [...pointers]){if(settings.preserveMovement&&[...pointer.keys].every(key=>DIRECTIONS.has(key)||key==='shift'))continue;release(id);}}
    function padDirections(pad,event,insideOnly=false){
      const rect=pad.getBoundingClientRect?.(),x=Number(event.clientX),y=Number(event.clientY);
      if(!rect||!Number.isFinite(x)||!Number.isFinite(y)||!(rect.width>0)||!(rect.height>0))return null;
      if(insideOnly&&(x<rect.left||x>rect.left+rect.width||y<rect.top||y>rect.top+rect.height))return null;
      const dx=(x-rect.left-rect.width/2)/(rect.width/2),dy=(y-rect.top-rect.height/2)/(rect.height/2);
      if(Math.hypot(dx,dy)<.22)return[];
      const keys=[],ratio=Math.tan(Math.PI/8);
      if(Math.abs(dx)>Math.abs(dy)*ratio)keys.push(dx<0?'arrowleft':'arrowright');
      if(Math.abs(dy)>Math.abs(dx)*ratio)keys.push(dy<0?'arrowup':'arrowdown');
      return keys;
    }
    function padEnabled(pad){return buttons.some(button=>padFor(button)===pad&&!button.disabled);}
    function capture(id,target,event){
      const pointer=pointers.get(id);if(!pointer)return;
      const implicit=event.target||target;pointer.captureTarget=implicit;
      try{if(typeof target.setPointerCapture==='function'){pointer.captureTarget=target;target.setPointerCapture(id);}}
      catch{pointer.captureTarget=implicit;}
    }
    function beginPad(pad,event,button=null){
      if(pointers.has(event.pointerId)||!padEnabled(pad)||event.pointerType==='mouse'&&event.button!==0)return;
      const keys=padDirections(pad,event,true);if(keys===null)return;
      event.preventDefault();if(!setKeys(event.pointerId,keys,{button,pad,captureTarget:pad,directional:true}))return;
      capture(event.pointerId,pad,event);
    }
    function movePad(event){
      const pointer=pointers.get(event.pointerId);if(!pointer?.pad)return;
      event.preventDefault?.();const keys=padEnabled(pointer.pad)?padDirections(pointer.pad,event):[];
      if(keys!==null)setKeys(event.pointerId,keys);
    }
    function captureLost(event){
      // Capture-transfer notifications bubble from the previous descendant.
      // Only loss from this hold's capture owner ends the current gesture.
      if(pointers.get(event.pointerId)?.captureTarget===event.target)release(event.pointerId);
    }
    for(const button of buttons){
      button.setAttribute?.('aria-pressed','false');
      listen(button,'pointerdown',event=>{
        if(button.disabled||event.pointerType==='mouse'&&event.button!==0)return;
        const pad=padFor(button);if(pads.has(pad)&&padDirections(pad,event)!==null){beginPad(pad,event,button);return;}
        event.preventDefault();if(!press(event.pointerId,button))return;
        capture(event.pointerId,button,event);
      });
      listen(button,'pointermove',event=>{
        const pointer=pointers.get(event.pointerId);if(!pointer?.directional)return;
        if(pointer.pad){movePad(event);return;}
        // Pointer capture keeps release events reliable while a thumb can slide
        // between adjacent D-pad buttons without lifting off the screen.
        const under=root.elementFromPoint?.(event.clientX,event.clientY)?.closest?.('[data-key]');
        if(allowed.has(under)&&!under.disabled&&DIRECTIONS.has(under.dataset.key))press(event.pointerId,under);
      });
      for(const type of ['pointerup','pointercancel'])listen(button,type,event=>release(event.pointerId));
      listen(button,'lostpointercapture',captureLost);
      listen(button,'keydown',event=>{
        if(button.disabled||event.key!==' '&&event.key!=='Enter')return;
        event.preventDefault();if(!event.repeat)press('key:'+event.key,button);
      });
      listen(button,'keyup',event=>{if(event.key===' '||event.key==='Enter'){event.preventDefault();release('key:'+event.key);}});
      listen(button,'blur',()=>{for(const [id,pointer]of [...pointers])if(pointer.button===button&&String(id).startsWith('key:'))release(id);});
    }
    for(const pad of pads){
      // Empty corner cells belong to the same control: a thumb can begin on a
      // diagonal, slide through all eight sectors, or rest in the centre.
      listen(pad,'pointerdown',event=>{if(!allowed.has(event.target?.closest?.('[data-key]')))beginPad(pad,event);});listen(pad,'pointermove',movePad);
      // A captured thumb may drift beyond this small pad. Keep steering until
      // the centre deadzone, release or cancellation, including after relayout.
      for(const type of ['pointerup','pointercancel'])listen(pad,type,event=>release(event.pointerId));
      listen(pad,'lostpointercapture',captureLost);
    }
    // Captured events normally reach the button; window listeners also release
    // a finger if a browser interrupts capture during rotation or app switching.
    for(const type of ['pointerup','pointercancel'])listen(win,type,event=>release(event.pointerId));
    listen(win,'pointermove',movePad);
    // Browser address/tool bars resize the viewport during an ordinary hold.
    // Actual rotation and lifecycle interruptions still cancel every input.
    listen(win,'blur',reset);listen(win,'pagehide',reset);listen(win,'orientationchange',reset);listen(win.screen?.orientation,'change',reset);
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
