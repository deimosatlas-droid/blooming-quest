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
    listen(win,'blur',reset);listen(win,'pagehide',reset);
    listen(root,'visibilitychange',()=>{if(root.hidden||root.visibilityState==='hidden')reset();});
    return {reset,snapshot:()=>({pointers:pointers.size,held:[...counts.keys()]}),destroy(){reset();for(const[target,type,handler]of listeners)target?.removeEventListener?.(type,handler);}};
  }
  function bindViewport(options={}){
    const container=options.container,button=options.button,doc=options.doc||document,win=options.win||global;
    if(!container||!button)return null;
    let expanded=false,oldOverflow='',busy=false;
    function set(value){
      if(expanded===value)return;
      expanded=value;container.classList?.toggle('is-expanded',value);
      if(doc.body?.style){if(value){oldOverflow=doc.body.style.overflow;doc.body.style.overflow='hidden';}else doc.body.style.overflow=oldOverflow;}
      button.textContent=value?'Exit expanded view':'Expand game';button.setAttribute?.('aria-pressed',String(value));
      options.onChange?.(value);
    }
    async function exit(){
      if(busy)return;busy=true;
      try{if(doc.fullscreenElement===container)await doc.exitFullscreen?.();}catch{}
      finally{set(false);busy=false;button.focus?.({preventScroll:true});}
    }
    async function toggle(){
      if(expanded)return exit();if(busy)return;busy=true;set(true);
      // iPhone Safari has no element fullscreen API. The same layout still
      // expands inside the browser viewport and keeps every action reachable.
      try{if(doc.fullscreenEnabled!==false&&container.requestFullscreen)await container.requestFullscreen();}catch{}
      finally{busy=false;}
    }
    button.textContent='Expand game';button.setAttribute?.('aria-pressed','false');button.onclick=toggle;
    doc.addEventListener?.('fullscreenchange',()=>{if(expanded&&!doc.fullscreenElement)set(false);});
    doc.addEventListener?.('keydown',event=>{if(event.key==='Escape'&&expanded){event.preventDefault();exit();}});
    win.addEventListener?.('pagehide',()=>{if(expanded)set(false);});
    return{toggle,exit,expanded:()=>expanded};
  }
  global.BloomMobile={bindHolds,bindViewport};
})(window);
