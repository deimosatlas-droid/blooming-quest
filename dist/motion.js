/* Responsive walking and a pixel-aligned camera, without changing collision. */
(function(global){
  'use strict';
  const RESPONSE=.020;
  const finite=value=>typeof value==='number'&&Number.isFinite(value)?value:0;
  const clamp=(value,low,high)=>Math.max(low,Math.min(high,value));
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
      const maxX=Math.max(0,finite(target.maxX)),maxY=Math.max(0,finite(target.maxY));
      const x=clamp(finite(target.x),0,maxX),y=clamp(finite(target.y),0,maxY);
      if(!camera||snap)camera={x,y};
      else{
        const alpha=1-Math.exp(-Math.max(0,finite(dt))*14);
        camera.x=clamp(camera.x,0,maxX)+(x-clamp(camera.x,0,maxX))*alpha;
        camera.y=clamp(camera.y,0,maxY)+(y-clamp(camera.y,0,maxY))*alpha;
      }
      camera.x=clamp(camera.x,0,maxX);camera.y=clamp(camera.y,0,maxY);
      // Retain fractional camera coordinates privately; round only the draw
      // position so slow movement cannot stick at a rounding threshold.
      return{x:clamp(Math.round(camera.x),0,maxX),y:clamp(Math.round(camera.y),0,maxY)};
    }
    return{step,reset,velocity,followCamera};
  }
  global.BloomMotion={create};
})(window);
