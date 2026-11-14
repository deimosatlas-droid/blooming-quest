/* Amaal's attack timing drives both the artwork and the actual contact frame. */
(function(global){
  'use strict';
  const DIR={down:[0,1],right:[1,0],up:[0,-1],left:[-1,0]};
  const ROW={down:0,right:1,up:2,left:3};
  const MOVES=[
    {id:'sweep',name:'Sweep',anticipation:.12,active:.16,recovery:.26,damage:1,range:40,arc:1.45,knockback:7,lunge:10},
    {id:'return',name:'Return cut',anticipation:.08,active:.14,recovery:.26,damage:1,range:42,arc:1.35,knockback:9,lunge:6},
    {id:'thrust',name:'Thrust',anticipation:.16,active:.10,recovery:.38,damage:2,range:56,arc:.5,knockback:14,lunge:16}
  ].map(move=>({...move,duration:move.anticipation+move.active+move.recovery}));
  let image=null,layout={},walkImage=null,images={},attack=null,queued=0,lastCombo=-1,idleAge=10,serial=0;
  let dust=[],stepAge=0,runBlend=0;
  function configure(config={}){image=config.image||null;layout=config.layout||{};walkImage=config.walkImage||walkImage;images=config.images||{};}
  function reset(){attack=null;queued=0;lastCombo=-1;idleAge=10;dust=[];stepAge=0;runBlend=0;}
  function begin(hero,index){const move=MOVES[index];attack={...move,index,face:hero.face||'down',elapsed:0,fired:false,activationId:'amaal-'+(++serial)};hero.face=attack.face;idleAge=0;}
  function requestAttack(hero){
    if(attack){if(queued>=2)return false;queued++;return true;}
    begin(hero,idleAge<.8?(lastCombo+1)%MOVES.length:0);return true;
  }
  function phase(current=attack){return !current?'idle':current.elapsed<current.anticipation?'anticipation':current.elapsed<current.anticipation+current.active?'active':'recovery';}
  function update(dt,context={}){
    const hero=context.hero;if(!hero)return;
    dust=dust.filter(p=>(p.life-=dt)>0);
    runBlend+=((context.moving&&context.running?1:0)-runBlend)*Math.min(1,dt*9);
    if(context.moving&&!attack){
      stepAge+=dt;
      if(stepAge>(context.running?.15:.25)){
        stepAge=0;const terrain=context.tile||'g';
        if(['g','d','a','f'].includes(terrain))for(let i=0;i<(context.running?2:1);i++)dust.push({x:hero.x+(i?3:-3),y:hero.y+1,life:.34,color:terrain==='g'?'#8eb06a':'#c9b48a'});
      }
    }else stepAge=0;
    let remaining=Math.max(0,dt),turns=0;
    while(remaining>0&&turns++<12){
      if(!attack){idleAge+=remaining;break;}
      const current=attack,before=current.elapsed,hitAt=current.anticipation+current.active*.35;
      let step=Math.min(remaining,current.duration-current.elapsed);
      if(!current.fired&&before<hitAt&&before+step>hitAt)step=hitAt-before;
      current.elapsed+=step;remaining-=step;hero.face=current.face;
      const activeStart=current.anticipation,activeEnd=activeStart+current.active;
      const overlap=Math.max(0,Math.min(current.elapsed,activeEnd)-Math.max(before,activeStart));
      const vector=DIR[current.face]||DIR.down;
      let distance=overlap/current.active*current.lunge;
      // Substeps prevent a thrust from tunnelling through a fence or a dummy.
      while(distance>1e-6){
        const amount=Math.min(2,distance),x=hero.x+vector[0]*amount,y=hero.y+vector[1]*amount;
        if(!context.canStand||context.canStand(x,y)){hero.x=x;hero.y=y;}
        distance-=amount;
      }
      if(!current.fired&&current.elapsed>=hitAt){current.fired=true;context.onActive?.(hero,{...current});}
      if(attack!==current)return; // A defeat or map transition can reset the attack.
      if(current.elapsed>=current.duration-1e-8){
        lastCombo=current.index;attack=null;idleAge=0;
        if(queued){queued--;if(DIR[context.intentFace])hero.face=context.intentFace;begin(hero,(lastCombo+1)%MOVES.length);}
      }
    }
  }
  function status(){return attack?{id:attack.id,name:attack.name,phase:phase(),elapsed:attack.elapsed,duration:attack.duration,combo:attack.index+1,activationId:attack.activationId,active:phase()==='active',queued:Boolean(queued),queuedCount:queued}:
    {id:'idle',phase:'idle',elapsed:idleAge,combo:0,active:false,queued:false};}
  function framesFor(clip,face){
    const frames=clip?.directions?.[face]||clip?.frames?.[face]||(Array.isArray(clip?.frames)?clip.frames:[]);
    return frames.map(frame=>Array.isArray(frame)?frame:frame.rect).filter(Boolean);
  }
  function artFrame(clip,frames,clock){
    if(!attack){
      const durations=clip.durations||clip.frameDurations;
      if(Array.isArray(durations)&&durations.length>=frames.length){
        const times=durations.slice(0,frames.length).map(value=>Math.max(.04,Number(value)||.2));
        let moment=clock%times.reduce((a,b)=>a+b,0);
        for(let i=0;i<times.length;i++){if(moment<times[i])return i;moment-=times[i];}
      }
      return Math.floor(clock*(clip.fps||3))%frames.length;
    }
    if(frames.length<=1)return 0;
    if(frames.length===2)return phase()==='anticipation'?0:1;
    if(phase()==='anticipation')return 0;
    if(phase()==='recovery')return frames.length-1;
    return Math.min(frames.length-2,1+Math.floor((attack.elapsed-attack.anticipation)/attack.active*(frames.length-2)));
  }
  function trails(ctx,x,y,hasArt){
    if(!attack||phase()==='anticipation')return;
    const direction=DIR[attack.face]||DIR.down,angle=Math.atan2(direction[1],direction[0]);
    const progress=Math.min(1,Math.max(0,(attack.elapsed-attack.anticipation)/attack.active));
    const fade=phase()==='recovery'?Math.max(0,1-(attack.elapsed-attack.anticipation-attack.active)/.13):1;
    if(!fade)return;
    ctx.save();ctx.globalAlpha*=fade;const cy=y-13;
    if(attack.id==='thrust'){
      const length=28+progress*25;
      for(let i=-1;i<=1;i++){
        const side=i*2;ctx.strokeStyle=i?'#eed39a70':'#fff0c8';ctx.lineWidth=i?1:2;
        ctx.beginPath();ctx.moveTo(x+direction[0]*11-direction[1]*side,cy+direction[1]*11+direction[0]*side);
        ctx.lineTo(x+direction[0]*length-direction[1]*side,cy+direction[1]*length+direction[0]*side);ctx.stroke();
      }
      if(progress>.35){const tx=x+direction[0]*length,ty=cy+direction[1]*length;ctx.fillStyle='#fff3ce';ctx.fillRect(Math.round(tx)-1,Math.round(ty)-3,2,6);ctx.fillRect(Math.round(tx)-3,Math.round(ty)-1,6,2);}
    }else{
      const reverse=attack.id==='return',sweep=reverse?1.2-progress*2.5:-1.3+progress*2.7;
      for(let i=0;i<3;i++){
        const tip=angle+sweep+(reverse?i:-i)*.16,start=tip+(reverse?.65:-.65);
        ctx.strokeStyle=i?'#eedda45c':'#fff1ca';ctx.lineWidth=i?3:1;
        ctx.beginPath();ctx.arc(x,cy,27+i*2,start,tip,reverse);ctx.stroke();
      }
      if(!hasArt){ctx.strokeStyle='#b78d55';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x+Math.cos(angle)*6,cy+Math.sin(angle)*6);ctx.lineTo(x+Math.cos(angle+sweep)*30,cy+Math.sin(angle+sweep)*30);ctx.stroke();}
    }
    ctx.restore();
  }
  function draw(ctx,x,y,hero,options={}){
    const face=attack?.face||hero.face||'down',clipId=attack?.id||(!options.moving?'idle':null),clip=layout.clips?.[clipId]||layout[clipId];
    const frames=framesFor(clip,face),art=images[clipId]||image;
    let hasArt=false;
    if(clipId&&art&&frames.length){
      const rect=frames[artFrame(clip,frames,options.clock||0)],anchor=clip.anchor||layout.anchor||[32,52],scale=clip.scale||layout.scale||1;
      ctx.drawImage(art,...rect,Math.round(x-anchor[0]*scale),Math.round(y-anchor[1]*scale),rect[2]*scale,rect[3]*scale);hasArt=true;
    }else{
      const picture=options.walkImage||walkImage;if(!picture)return;
      const frame=options.moving&&!options.speaking?Math.floor((options.walkTime||0)*(options.running?12:9))%4:0;
      let ox=0,oy=0;
      if(attack){const vector=DIR[face],windup=phase()==='anticipation';ox=vector[0]*(windup?-2:1);oy=windup?1:0;}
      else if(!options.moving)oy=Math.round(Math.sin((options.clock||0)*2)*.55);
      if(options.moving&&!attack){
        // Pixel-aligned bands lean into a run without rotating or blurring art.
        const stride=Math.sin((options.walkTime||0)*12),lean=Math.round((DIR[face]?.[0]||0)*runBlend*2),sway=Math.round(stride*.55*runBlend);
        const dx=Math.round(x)-20,dy=Math.round(y)-40,sourceX=frame*40,sourceY=ROW[face]*48;
        ctx.drawImage(picture,sourceX,sourceY,40,25,dx+lean,dy+Math.round(stride*.6*runBlend),40,25);
        ctx.drawImage(picture,sourceX,sourceY+25,40,7,dx+Math.round(lean/2)+sway,dy+25,40,7);
        ctx.drawImage(picture,sourceX,sourceY+32,40,16,dx,dy+32,40,16);
      }else ctx.drawImage(picture,frame*40,ROW[face]*48,40,48,Math.round(x)-20+ox,Math.round(y)-40+oy,40,48);
    }
    trails(ctx,x,y,hasArt);
  }
  function drawGround(ctx,camera){
    ctx.save();for(const p of dust){ctx.globalAlpha=p.life/.34*.55;ctx.fillStyle=p.color;ctx.fillRect(Math.round(p.x-camera.x),Math.round(p.y-camera.y-(.34-p.life)*5),1,1);}ctx.restore();
  }
  global.BloomHero={configure,requestAttack,update,draw,drawGround,status,reset,busy:()=>Boolean(attack),moves:()=>MOVES.map(move=>({...move}))};
})(window);
