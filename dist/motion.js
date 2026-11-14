/* Responsive walking and a pixel-aligned camera, without changing collision. */
(function(global){
  'use strict';
  const RESPONSE=.020;
  const finite=value=>typeof value==='number'&&Number.isFinite(value)?value:0;
  const clamp=(value,low,high)=>Math.max(low,Math.min(high,value));
  function cameraBounds(config={}){
    const width=Math.max(1,finite(config.worldWidth)),height=Math.max(1,finite(config.worldHeight));
    const base={minX:0,maxX:Math.max(0,width-384),minY:0,maxY:Math.max(0,height-256)};
    const profile=typeof config.profile==='string'?config.profile:config.profile?.profile;
    if(!['touch','hybrid'].includes(profile))return base;
    const vw=Math.max(1,finite(config.viewWidth)),vh=Math.max(1,finite(config.viewHeight));
    const stageW=Math.min(vw,vh*1.5),stageH=stageW/1.5,left=(vw-stageW)/2,top=(vh-stageH)/2,scale=stageW/384;
    const safeLeft=clamp(finite(config.safeLeft),0,vw),safeRight=clamp(finite(config.safeRight),0,vw),safeBottom=clamp(finite(config.safeBottom),0,vh);
    // Match the input profile's 44px minimum button, spacing and anchors.
    const requested=finite(config.touchScale)||1,effective=Math.max(1,Math.min(requested,vh<360||vw<640?1:1.2)),unit=44*effective;
    const pad=3*unit+8,actions=2*unit+4,controlBottom=vh-safeBottom-64,controlTop=controlBottom-pad;
    const controlsMeetWorld=controlTop<top+stageH&&controlBottom>top;
    const leftWidth=config.leftHanded?actions:pad,rightWidth=config.leftHanded?pad:actions;
    const bodyMargin=30; // 10px half body plus 20px dodge/lunge and follow lag.
    const leftOverlap=controlsMeetWorld?Math.max(0,safeLeft+8+leftWidth-left):0;
    const rightOverlap=controlsMeetWorld?Math.max(0,left+stageW-(vw-safeRight-8-rightWidth)):0;
    const insetLeft=leftOverlap?Math.min(150,Math.ceil(leftOverlap/scale+bodyMargin)):0;
    const insetRight=rightOverlap?Math.min(150,Math.ceil(rightOverlap/scale+bodyMargin)):0;
    const hotbarTop=vh-safeBottom-8-48,hotbarMeetsWorld=hotbarTop<top+stageH&&vh-safeBottom-8>top;
    let bottom=hotbarMeetsWorld?Math.ceil((top+stageH-hotbarTop)/scale+20):0;
    // On exceptionally narrow portrait views, horizontal clearance can be
    // impossible. Keep the hero above any controls that enter the stage.
    if(controlsMeetWorld&&(leftOverlap/scale+bodyMargin>150||rightOverlap/scale+bodyMargin>150))bottom=Math.max(bottom,Math.ceil((top+stageH-controlTop)/scale+20));
    bottom=clamp(bottom,0,150);
    return{minX:insetLeft?-insetLeft:0,maxX:base.maxX+insetRight,minY:-53,maxY:base.maxY+bottom};
  }
  function create(options={}){
    let vx=0,vy=0,camera=null;
    function reset(config={}){vx=0;vy=0;if(config.camera)camera=null;}
    function velocity(){return{x:vx,y:vy};}
    function step(dt,input={}){
      const hero=options.getHero?.(),elapsed=Math.max(0,finite(dt));
      if(!hero||!Number.isFinite(hero.x)||!Number.isFinite(hero.y)){
        reset();return{moved:false,dx:0,dy:0,x:0,y:0};
      }
      const beforeX=hero.x,beforeY=hero.y;
      const dx=finite(input.dx),dy=finite(input.dy),speed=Math.max(0,finite(input.speed));
      if(input.blocked||speed===0||(!dx&&!dy)){
        reset();return{moved:false,dx:0,dy:0,x:hero.x,y:hero.y};
      }
      const length=Math.hypot(dx,dy),targetX=dx/length*speed,targetY=dy/length*speed;
      // Releasing an axis stops it now. Reversing changes direction now, rather
      // than making the player fight momentum before an attack or a fence.
      if(!dx||vx*targetX<0)vx=0;
      if(!dy||vy*targetY<0)vy=0;
      const priorSpeed=Math.hypot(vx,vy);
      if(priorSpeed>speed){vx*=speed/priorSpeed;vy*=speed/priorSpeed;}
      const decay=Math.exp(-elapsed/RESPONSE),integral=RESPONSE*(1-decay);
      const travelX=targetX*elapsed+(vx-targetX)*integral;
      const travelY=targetY*elapsed+(vy-targetY)*integral;
      vx=targetX+(vx-targetX)*decay;
      vy=targetY+(vy-targetY)*decay;
      // Integrating the response exactly keeps acceleration consistent at
      // different frame rates. Small X/Y sweeps preserve natural wall sliding.
      const count=Math.max(1,Math.ceil(Math.max(Math.abs(travelX),Math.abs(travelY))/2));
      let xStep=travelX/count,yStep=travelY/count;
      for(let i=0;i<count;i++){
        if(xStep){
          if(options.canStand?.(hero.x+xStep,hero.y)!==false)hero.x+=xStep;
          else{vx=0;xStep=0;}
        }
        if(yStep){
          if(options.canStand?.(hero.x,hero.y+yStep)!==false)hero.y+=yStep;
          else{vy=0;yStep=0;}
        }
      }
      const movedX=hero.x-beforeX,movedY=hero.y-beforeY;
      return{moved:Math.hypot(movedX,movedY)>1e-8,dx:movedX,dy:movedY,x:hero.x,y:hero.y};
    }
    function followCamera(dt,target={},snap=false){
      const minX=finite(target.minX),minY=finite(target.minY),maxX=Math.max(minX,finite(target.maxX)),maxY=Math.max(minY,finite(target.maxY));
      const x=clamp(finite(target.x),minX,maxX),y=clamp(finite(target.y),minY,maxY);
      if(!camera||snap||target.snap||target.reducedMotion)camera={x,y};
      else{
        const alpha=1-Math.exp(-Math.max(0,finite(dt))*14);
        camera.x=clamp(camera.x,minX,maxX)+(x-clamp(camera.x,minX,maxX))*alpha;
        camera.y=clamp(camera.y,minY,maxY)+(y-clamp(camera.y,minY,maxY))*alpha;
      }
      camera.x=clamp(camera.x,minX,maxX);camera.y=clamp(camera.y,minY,maxY);
      // Retain fractional camera coordinates privately; round only the draw
      // position so slow movement cannot stick at a rounding threshold.
      return{x:clamp(Math.round(camera.x),minX,maxX),y:clamp(Math.round(camera.y),minY,maxY)};
    }
    return{step,reset,velocity,followCamera};
  }
  global.BloomMotion={create,cameraBounds};
})(window);
