/* Amaal's attack timing drives both the artwork and the actual contact frame. */
(function(global){
  'use strict';
  const DIR={down:[0,1],right:[1,0],up:[0,-1],left:[-1,0]};
  const ROW={down:0,right:1,up:2,left:3};
  const MOVES=[
    {id:'sweep',name:'Sweep',anticipation:.07,active:.12,recovery:.17,damage:1,range:40,arc:1.45,knockback:7,lunge:10},
    {id:'return',name:'Return cut',anticipation:.06,active:.10,recovery:.18,damage:1,range:42,arc:1.35,knockback:9,lunge:6},
    {id:'thrust',name:'Thrust',anticipation:.10,active:.12,recovery:.24,damage:2,range:56,arc:.5,knockback:14,lunge:16}
  ].map(move=>({...move,duration:move.anticipation+move.active+move.recovery}));
  let image=null,layout={},walkImage=null,images={},attack=null,queued=0,lastCombo=-1,idleAge=10,serial=0;
  let dust=[],ghosts=[],stepAge=0,runBlend=0,ghostAge=0,hurtAge=0,hurtWas=false,poseDefense={};
  function configure(config={}){image=config.image||null;layout=config.layout||{};walkImage=config.walkImage||walkImage;images=config.images||{};}
  function reset(){attack=null;queued=0;lastCombo=-1;idleAge=10;dust=[];ghosts=[];stepAge=0;runBlend=0;ghostAge=0;hurtAge=0;hurtWas=false;poseDefense={};}
  function begin(hero,index){const move=MOVES[index];attack={...move,index,face:hero.face||'down',elapsed:0,fired:false,activationId:'amaal-'+(++serial)};hero.face=attack.face;idleAge=0;}
  function requestAttack(hero){
    if(attack){if(queued>=2)return false;queued++;return true;}
    begin(hero,idleAge<.8?(lastCombo+1)%MOVES.length:0);return true;
  }
  function phase(current=attack){return !current?'idle':current.elapsed<current.anticipation?'anticipation':current.elapsed<current.anticipation+current.active?'active':'recovery';}
  function canMove(){return !attack||(phase()==='recovery'&&attack.elapsed-attack.anticipation-attack.active>=.08);}
  function cancelRecovery(){if(!attack)return true;if(!canMove())return false;lastCombo=attack.index;attack=null;queued=0;idleAge=0;return true;}
  function hit(){hurtAge=.18;}
  function update(dt,context={}){
    const hero=context.hero;if(!hero)return;
    dt=Math.max(0,Math.min(2,Number(dt)||0));
    poseDefense=context.defense||{};hurtAge=Math.max(0,hurtAge-dt);
    if(poseDefense.hurt&&!hurtWas)hit();hurtWas=Boolean(poseDefense.hurt);
    ghosts=ghosts.filter(p=>(p.life-=dt)>0);
    if(poseDefense.dodging){ghostAge+=dt;if(ghostAge>=.025){ghostAge=0;ghosts.push({x:hero.x,y:hero.y,face:hero.face,progress:Number(poseDefense.dodgeProgress)||0,life:.16});if(ghosts.length>6)ghosts.shift();}}else ghostAge=0;
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
  function status(){return attack?{id:attack.id,name:attack.name,phase:phase(),elapsed:attack.elapsed,duration:attack.duration,combo:attack.index+1,activationId:attack.activationId,active:phase()==='active',queued:Boolean(queued),queuedCount:queued,canMove:canMove()}:
    {id:'idle',phase:'idle',elapsed:idleAge,combo:0,active:false,queued:false,canMove:true};}
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
  function rig(ctx,picture,face,frame,x,y,parts={}){
    // Split the existing walking art at the shoulders, hips and arms. Every
    // component remains a nearest-pixel source rectangle; face and glasses
    // stay intact while defence/casting changes the body's silhouette.
    const sx=frame*40,sy=(ROW[face]||0)*48,dx=Math.round(x)-20,dy=Math.round(y)-40;
    const draw=(cx,cy,w,h,ox=0,oy=0,dh=h)=>ctx.drawImage(picture,sx+cx,sy+cy,w,h,dx+cx+Math.round(ox),dy+cy+Math.round(oy),w,Math.max(1,Math.round(dh)));
    draw(0,31,40,17,parts.legsX||0,parts.legsY||0,parts.legsHeight||17);
    draw(16,23,9,8,parts.bodyX||0,parts.bodyY||0,parts.bodyHeight||8);
    draw(0,23,16,8,parts.leftX||0,parts.leftY||0,parts.armHeight||8);
    draw(25,23,15,8,parts.rightX||0,parts.rightY||0,parts.armHeight||8);
    draw(0,0,40,23,parts.headX||0,parts.headY||0,parts.headHeight||23);
  }
  function actionPose(ctx,x,y,hero,options={},ghost=false){
    const defense=options.defense||poseDefense||{},picture=options.walkImage||walkImage;
    if(!picture)return false;
    const face=hero.face||'down',vector=DIR[face]||DIR.down,clock=Number(options.clock)||0;
    const dodging=Boolean(defense.dodging),guarding=Boolean(defense.guarding),casting=Boolean(defense.casting);
    const hurt=ghost?false:(hurtAge>0||(defense.hurt&&Number.isFinite(defense.hurtProgress)));
    if(!dodging&&!guarding&&!casting&&!hurt)return false;
    if(dodging){
      const progress=Math.max(0,Math.min(1,Number(defense.dodgeProgress)||0)),crouch=Math.sin(progress*Math.PI),lean=vector[0]*crouch*4;
      // A low shoulder lead, tucked arms and folded legs read as a directional
      // evasive step without rotating or blurring the pixel face.
      rig(ctx,picture,face,progress>.55?3:1,x,y,{headX:lean,headY:Math.round(crouch*5),headHeight:23-Math.round(crouch*2),bodyX:lean*.6,bodyY:crouch*3,bodyHeight:8-Math.round(crouch),leftX:lean*.5+1,leftY:crouch*3,rightX:lean*.5-1,rightY:crouch*3,armHeight:7,legsX:-lean*.35,legsY:crouch*2,legsHeight:17-Math.round(crouch*2)});
      return true;
    }
    if(hurt){
      const age=hurtAge>0?1-hurtAge/.18:Number(defense.hurtProgress)||0,recoil=Math.sin(age*Math.PI)*3;
      rig(ctx,picture,face,0,x-vector[0]*recoil,y,{headX:-vector[0]*2,headY:1,bodyX:-vector[0],bodyY:1,leftX:-2,rightX:2,leftY:-1,rightY:-1,legsY:1,legsHeight:16});return true;
    }
    if(guarding){
      const opening=(Number(defense.guardAge)||0)<.2,pulse=opening?1:Math.sin(clock*3)*.3;
      rig(ctx,picture,face,0,x,y,{headX:vector[0],headY:1,bodyX:vector[0],bodyY:1,leftX:face==='right'?3:1,leftY:-2-pulse,rightX:face==='left'?-3:-1,rightY:-3-pulse,legsY:1,legsHeight:16});
      // The katana rises into a compact, directional guard across the shoulders.
      const side=face==='left'?-1:1,hx=Math.round(x+vector[0]*7+(!vector[0]?side*7:0)),hy=Math.round(y-14+vector[1]*3);
      ctx.strokeStyle='#4c3628';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(hx-side*2,hy+4);ctx.lineTo(hx+side*4,hy-12);ctx.stroke();
      ctx.strokeStyle=opening?'#fff0bd':'#c3d0bd';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(hx,hy+1);ctx.lineTo(hx+side*4,hy-13);ctx.stroke();
      ctx.fillStyle='#bd9d5c';ctx.fillRect(hx-3,hy+1,6,2);return true;
    }
    if(casting){
      const progress=Math.max(0,Math.min(1,Number(defense.castProgress)||0)),release=typeof defense.castReleased==='boolean'?defense.castReleased:progress>=.5,wave=Math.sin(progress*Math.PI),aimX=vector[0],aimY=vector[1];
      rig(ctx,picture,face,release?3:0,x,y,{headX:aimX*wave,headY:-wave,bodyX:aimX*wave,leftX:release?-3:-1,leftY:-3-wave*2,rightX:release?3:1,rightY:-3-wave*2,legsY:1,legsHeight:16});
      const color=defense.castColor||'#c7e2a9',hx=Math.round(x+aimX*(release?17:10)),hy=Math.round(y-17+aimY*(release?10:5)),r=release?4:2+wave*2;
      ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=1;ctx.beginPath();ctx.arc(hx,hy,r,0,Math.PI*2);ctx.stroke();ctx.fillRect(hx-1,hy-1,2,2);
      for(let i=0;i<4;i++){const angle=clock*3+i*Math.PI/2,rad=6+wave*3;ctx.fillRect(Math.round(hx+Math.cos(angle)*rad),Math.round(hy+Math.sin(angle)*rad),1,1);}return true;
    }
    return false;
  }
  function draw(ctx,x,y,hero,options={}){
    if(actionPose(ctx,x,y,hero,options))return;
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
    ctx.save();for(const p of ghosts){ctx.globalAlpha=p.life/.16*.19;actionPose(ctx,p.x-camera.x,p.y-camera.y,{face:p.face},{walkImage,defense:{dodging:true,dodgeProgress:p.progress}},true);}for(const p of dust){ctx.globalAlpha=p.life/.34*.55;ctx.fillStyle=p.color;ctx.fillRect(Math.round(p.x-camera.x),Math.round(p.y-camera.y-(.34-p.life)*5),1,1);}ctx.restore();
  }
  global.BloomHero={configure,requestAttack,update,draw,drawGround,status,reset,canMove,canCast:canMove,cancelRecovery,hit,busy:()=>Boolean(attack),moves:()=>MOVES.map(move=>({...move}))};
})(window);
