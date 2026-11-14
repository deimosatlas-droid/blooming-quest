/* Local spell casting, input buffering, stamina and defensive timing. */
(function(global){
  'use strict';
  const VECTORS={right:[1,0],down:[0,1],left:[-1,0],up:[0,-1]};
  let options={},stamina=100,regenDelay=0,guarding=false,guardAge=0,guardLock=0,dodge=null,dodgeCooldown=0;
  let costSignature='',costCache={},cooldowns={},effects=[],serial=0,haste=0,ward=0,wardCharges=0,feedback='',feedbackAge=0,casting=null,queued=null;
  const state=()=>options.getState?.()||{};
  const hero=()=>options.getHero?.();
  const mods=()=>global.BloomProgression?.modifiers(state())||{maxStamina:100,parryReturn:0,bindDuration:2.5,gustHaste:0,windWard:false};
  const maxStamina=()=>mods().maxStamina||100;
  const canAct=()=>options.canAct?Boolean(options.canAct()):true;
  const face=()=>VECTORS[hero()?.face]||VECTORS.down;
  function tell(text){feedback=text;feedbackAge=1.3;options.onMessage?.(text);options.onFeedback?.({kind:/stamina|breath/i.test(text)?'stamina':/parry/i.test(text)?'parry':/guard broken/i.test(text)?'guard-break':/recover|learn and equip/i.test(text)?'unavailable':'ability',text});}
  function configure(config={}){options=config;stamina=Math.min(stamina,maxStamina());}
  function cancelUnreleased(refund=true){
    const cancelled=casting;
    if(cancelled&&!cancelled.released&&refund){stamina=Math.min(maxStamina(),stamina+cancelled.spell.stamina);cooldowns[cancelled.spell.id]=0;regenDelay=0;}
    casting=null;queued=null;return Boolean(cancelled&&!cancelled.released);
  }
  function reset(config={}){cancelUnreleased();guarding=false;guardAge=0;guardLock=0;dodge=null;dodgeCooldown=0;haste=0;ward=0;wardCharges=0;effects=[];regenDelay=0;feedback='';feedbackAge=0;if(config.refill)stamina=maxStamina();}
  function release(config={}){const refunded=cancelUnreleased(config.refund!==false);guarding=false;guardAge=0;dodge=null;if(refunded){feedback='Unreleased spell cancelled · stamina returned';feedbackAge=1.3;}}
  function spend(amount,quiet=false){
    if(stamina+1e-8<amount){if(!quiet)tell('Catch your breath—stamina is too low.');return false;}
    stamina=Math.max(0,stamina-amount);regenDelay=.65;return true;
  }
  const attackCost=()=>8;
  function canAttack(){return canAct()&&!dodge&&!guarding&&!casting&&stamina>=attackCost();}
  function commitAttack(){return spend(attackCost());}
  function requestDodge(dx=0,dy=0){
    if(!canAct()||dodge||dodgeCooldown>0||!spend(20))return false;
    const length=Math.hypot(dx,dy),vector=length?[dx/length,dy/length]:face();
    options.onCancelAttack?.();casting=null;queued=null;guarding=false;guardLock=.22;
    dodge={x:vector[0],y:vector[1],age:0,duration:.23,distance:50.6,protect:.19};dodgeCooldown=.62;
    const h=hero();if(h)effects.push({kind:'dodge',x:h.x,y:h.y,age:0,duration:.36,color:'#d8e8c0'});
    return true;
  }
  function resolvedSpell(slot){
    const progression=global.BloomProgression,snapshot=progression?.snapshot(state()),id=snapshot?.loadout?.[slot];
    return id&&snapshot.skills[id]?progression.spell(state(),id):null;
  }
  function requestSkill(slot,fromBuffer=false){
    if(!canAct()||!Number.isInteger(slot)||slot<0||slot>=5)return false;
    const spell=resolvedSpell(slot);
    if(!spell){if(!fromBuffer)tell('Open Skills [K] to learn and equip a spell.');return false;}
    if(dodge||casting||guarding||options.canSkill?.()===false){if(!fromBuffer)queued={slot,remaining:.65,name:spell.name};return false;}
    if(cooldowns[spell.id]>0){if(!fromBuffer)tell(spell.name+' is recovering.');return false;}
    if(!spend(spell.stamina))return false;
    options.onPrepareCast?.();queued=null;
    cooldowns[spell.id]=spell.cooldown;
    const h=hero(),vector=face();
    casting={spell,age:0,duration:Math.max(.06,spell.castTime||.16)+.14,releaseAt:Math.max(.06,spell.castTime||.16),released:false,
      spec:{...spell,spellId:spell.id,id:'skill-'+(++serial),origin:{x:h?.x||0,y:h?.y||0},face:h?.face||'down',direction:[...vector]}};
    tell(spell.name+'…');options.onChange?.();return true;
  }
  function dispatchCast(current){
    if(current.released)return;current.released=true;
    const spell=current.spell,h=hero();if(!h)return;
    current.spec.origin={x:h.x,y:h.y};
    if(spell.id==='gale_step'){
      const v=current.spec.direction;
      dodge={x:v[0],y:v[1],age:0,duration:.24,distance:spell.range||64,protect:.16,cast:current};
      options.onCancelAttack?.();
    }else options.onCast?.(spell.id,current.spec);
    if(spell.heal)options.onHeal?.(Math.max(1,Math.floor(spell.heal)));
    if(spell.id==='winter_ward'){ward=Math.max(ward,spell.duration||5);wardCharges=Math.max(wardCharges,spell.charges||2);}
    if(spell.id==='stormy_gust'){haste=spell.gustHaste?2.5:0;if(spell.windWard){ward=Math.max(ward,3);wardCharges=Math.max(wardCharges,1);}}
    effects.push({kind:spell.id,branch:spell.branch,x:h.x,y:h.y,vector:current.spec.direction,age:0,duration:Math.min(1,spell.id==='healing_bloom'?.85:.5),color:spell.color||'#dce9b6'});
    if(effects.length>48)effects.splice(0,effects.length-48);
    tell(spell.name+'!');options.onChange?.();
  }
  function defend(attack={}){
    const h=hero();if(!h)return{blocked:false};
    if(dodge&&dodge.age<=dodge.protect){tell('Dodged');return{blocked:true,damage:0,kind:'dodge'};}
    if(ward>0&&wardCharges>0){wardCharges--;if(!wardCharges)ward=0;tell('Ward absorbed the hit.');return{blocked:true,damage:0,kind:'ward'};}
    const vector=face(),dx=(attack.source?.x??h.x)-h.x,dy=(attack.source?.y??h.y)-h.y,length=Math.hypot(dx,dy);
    if(!guarding||length>0&&(dx*vector[0]+dy*vector[1])/length<.2)return{blocked:false};
    if(attack.parryable!==false&&guardAge<=.2&&stamina>=10){
      spend(10,true);stamina=Math.min(maxStamina(),stamina+(mods().parryReturn||0));
      effects.push({kind:'parry',x:h.x,y:h.y,age:0,duration:.45,color:'#fff1ac'});tell('Parry!');options.onParry?.();return{blocked:true,parried:true,damage:0};
    }
    if(attack.heavy||attack.parryable===false){tell('Heavy attack—dodge the warning!');return{blocked:false};}
    if(!spend(16,true)){guarding=false;guardLock=.65;tell('Guard broken—recover stamina.');return{blocked:false};}
    effects.push({kind:'block',x:h.x,y:h.y,age:0,duration:.25,color:'#b4d5bd'});tell('Guarded');return{blocked:true,damage:0,kind:'guard'};
  }
  function update(dt,input={}){
    dt=Math.max(0,Math.min(.1,Number(dt)||0));
    dodgeCooldown=Math.max(0,dodgeCooldown-dt);guardLock=Math.max(0,guardLock-dt);regenDelay=Math.max(0,regenDelay-dt);
    haste=Math.max(0,haste-dt);ward=Math.max(0,ward-dt);if(!ward)wardCharges=0;feedbackAge=Math.max(0,feedbackAge-dt);
    for(const id of Object.keys(cooldowns))cooldowns[id]=Math.max(0,cooldowns[id]-dt);
    for(const effect of effects)effect.age+=dt;effects=effects.filter(effect=>effect.age<effect.duration);
    if(queued){queued.remaining-=dt;if(queued.remaining<=0)queued=null;}
    const wantsGuard=Boolean(input.guarding)&&canAct()&&!dodge&&!input.attacking&&guardLock===0;
    if(wantsGuard){if(!guarding)guardAge=0;else guardAge+=dt;if(casting){casting=null;queued=null;}}
    else{if(guarding)guardLock=Math.max(guardLock,.2);guardAge=0;}
    guarding=wantsGuard;
    if(casting){const current=casting;current.age+=dt;if(current.age>=current.releaseAt)dispatchCast(current);if(casting===current&&current.age>=current.duration)casting=null;}
    const h=hero();
    if(dodge&&h){
      const current=dodge,movement=Math.max(0,Math.min(dt,current.duration-current.age))*current.distance/current.duration;let remaining=movement;
      while(remaining>1e-8){const step=Math.min(2,remaining),nx=h.x+current.x*step,ny=h.y+current.y*step;if(options.canStand?.(nx,ny)!==false){h.x=nx;h.y=ny;}remaining-=step;}
      current.age+=dt;
      if(current.age>=current.duration){
        dodge=null;
        if(current.cast){const origin=current.cast.spec.origin,end={x:h.x,y:h.y};options.onCast?.('gale_step',{...current.cast.spec,end,range:Math.hypot(end.x-origin.x,end.y-origin.y)});options.onChange?.();}
      }
    }
    const sprinting=Boolean(input.running&&input.moving&&!input.attacking&&!guarding&&!dodge&&!casting&&stamina>0);
    if(sprinting){stamina=Math.max(0,stamina-12*dt);regenDelay=.65;}
    else if(!regenDelay&&!dodge&&!casting&&!input.attacking)stamina=Math.min(maxStamina(),stamina+dt*(guarding?4:23));
    stamina=Math.min(maxStamina(),Math.max(0,stamina));
    if(queued&&!casting&&!dodge&&!guarding&&options.canSkill?.()!==false){const slot=queued.slot;queued=null;requestSkill(slot,true);}
  }
  function movementMultiplier(running=false){return(guarding?.38:casting?(casting.released?.75:.4):1)*(haste>0?1+(mods().gustHaste||0):1)*(running&&stamina<=0?62/105:1);}
  function snapshot(){
    const spells=global.BloomSpells?.spells||[],ranks=state().progression?.ranks||{},signature=JSON.stringify(ranks);if(signature!==costSignature){costSignature=signature;costCache=Object.fromEntries(spells.map(spell=>[spell.id,global.BloomSpells.resolve(spell.id,ranks[spell.id]||1).stamina]));}
    return{stamina,maxStamina:maxStamina(),guarding,guardAge,dodging:Boolean(dodge),dodgeProgress:dodge?Math.min(1,dodge.age/dodge.duration):0,dodgeCooldown,
      casting:Boolean(casting),castProgress:casting?Math.min(1,casting.age/casting.duration):0,castReleased:Boolean(casting?.released),castKind:casting?.spell.branch,castFace:casting?.spec.face,castColor:casting?.spell.color,currentSpell:casting?.spell.id||'',queued:queued?.name||'',
      cooldowns:{...cooldowns},costs:{...costCache},
      status:queued?'Queued: '+queued.name:casting?casting.spell.name:feedbackAge>0?feedback:guarding?(guardAge<=.2?'Parry window':'Guarding'):dodge?'Dodging':ward>0?'Ward ×'+wardCharges:'',
      ward:ward>0&&wardCharges>0,wardCharges,haste:haste>0};
  }
  function draw(ctx,camera={x:0,y:0}){
    const h=hero();if(!h)return;ctx.save();
    for(const effect of effects){
      const age=effect.age/effect.duration,x=effect.x-camera.x,y=effect.y-camera.y-10;ctx.globalAlpha=1-age;ctx.strokeStyle=effect.color;ctx.fillStyle=effect.color;ctx.lineWidth=effect.branch==='stormy'?2:1;
      if(effect.kind==='dodge'){ctx.fillRect(Math.round(x)-6,Math.round(y)+7,12,2);continue;}
      if(effect.kind==='parry'||effect.kind==='block'){ctx.beginPath();ctx.arc(x,y,8+age*20,0,Math.PI*2);ctx.stroke();continue;}
      const count=effect.branch==='frost'?6:effect.branch==='bloomcraft'?8:5;
      for(let i=0;i<count;i++){
        const angle=i*Math.PI*2/count+age*(effect.branch==='stormy'?3:1),r=8+age*27,px=x+Math.cos(angle)*r,py=y+Math.sin(angle)*r*.6;
        if(effect.branch==='frost'){ctx.beginPath();ctx.moveTo(px,py-3);ctx.lineTo(px+2,py);ctx.lineTo(px,py+3);ctx.lineTo(px-2,py);ctx.closePath();ctx.stroke();}
        else if(effect.branch==='ember')ctx.fillRect(Math.round(px),Math.round(py-age*10),2,3);
        else if(effect.branch==='bloomcraft'){ctx.beginPath();ctx.moveTo(px,py+4);ctx.lineTo(px-2,py-3);ctx.lineTo(px+2,py-1);ctx.stroke();}
        else if(effect.branch==='stormy'){ctx.beginPath();ctx.arc(px,py,4+age*6,angle-.8,angle+.8);ctx.stroke();}
        else{ctx.fillRect(Math.round(px),Math.round(py),2,2);}
      }
    }
    ctx.globalAlpha=1;
    if(casting){const x=h.x-camera.x,y=h.y-camera.y-2,progress=Math.min(1,casting.age/casting.releaseAt);ctx.strokeStyle=casting.spell.color;ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(x,y,9+progress*4,4+progress,0,0,Math.PI*2);ctx.stroke();}
    if(guarding||ward>0){const v=face(),x=h.x-camera.x+v[0]*13,y=h.y-camera.y-13+v[1]*8;ctx.strokeStyle=guarding&&guardAge<=.2?'#fff0a8':ward>0?'#bcebf0':'#c8d4ad';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,10,Math.atan2(v[1],v[0])-.9,Math.atan2(v[1],v[0])+.9);ctx.stroke();}
    ctx.restore();
  }
  global.BloomAbilities={configure,reset,release,update,requestDodge,requestSkill,canAttack,commitAttack,attackCost,defend,snapshot,movementMultiplier,draw};
})(window);
