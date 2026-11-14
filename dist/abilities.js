/* Amaal's stamina, defensive timing and equipped skills; all simulation is local. */
(function(global){
  'use strict';
  const VECTORS={right:[1,0],down:[0,1],left:[-1,0],up:[0,-1]};
  const SKILLS={
    petal_sweep:{cost:26,cooldown:6,name:'Petal Sweep'},
    briar_bind:{cost:24,cooldown:8,name:'Briar Bind'},
    stormy_gust:{cost:22,cooldown:7,name:"Stormy’s Gust"}
  };
  let options={},stamina=100,regenDelay=0,guarding=false,guardAge=0,guardLock=0,dodge=null,dodgeCooldown=0;
  let cooldowns={},effects=[],elapsed=0,serial=0,haste=0,ward=0,feedback='',feedbackAge=0;
  const state=()=>options.getState?.()||{};
  const hero=()=>options.getHero?.();
  const mods=()=>global.BloomProgression?.modifiers(state())||{maxStamina:100,parryReturn:0,bindDuration:2.5,gustHaste:0,windWard:false};
  const maxStamina=()=>mods().maxStamina||100;
  const canAct=()=>options.canAct?Boolean(options.canAct()):true;
  const face=()=>VECTORS[hero()?.face]||VECTORS.down;
  function tell(text){feedback=text;feedbackAge=1.3;options.onMessage?.(text);}
  function configure(config={}){options=config;stamina=Math.min(stamina,maxStamina());}
  function reset(config={}){guarding=false;guardAge=0;guardLock=0;dodge=null;dodgeCooldown=0;haste=0;ward=0;effects=[];regenDelay=0;feedback='';feedbackAge=0;if(config.refill)stamina=maxStamina();}
  function release(){guarding=false;guardAge=0;if(dodge)dodge=null;}
  function spend(amount,quiet=false){
    if(stamina+1e-8<amount){if(!quiet)tell('Catch your breath—stamina is too low.');return false;}
    stamina=Math.max(0,stamina-amount);regenDelay=.65;return true;
  }
  function attackCost(){return 8;}
  function canAttack(){return canAct()&&!dodge&&!guarding&&stamina>=attackCost();}
  function commitAttack(){return spend(attackCost());}
  function requestDodge(dx=0,dy=0){
    if(!canAct()||dodge||dodgeCooldown>0)return false;
    if(!spend(20))return false;
    const length=Math.hypot(dx,dy),vector=length?[dx/length,dy/length]:face();
    options.onCancelAttack?.();guarding=false;guardLock=.22;
    dodge={x:vector[0],y:vector[1],age:0,duration:.23};dodgeCooldown=.62;
    const h=hero();if(h)effects.push({kind:'dodge',x:h.x,y:h.y,age:0,duration:.36});
    return true;
  }
  function requestSkill(slot){
    if(!canAct()||dodge||guarding||options.canSkill?.()===false)return false;
    const progression=global.BloomProgression?.snapshot(state()),id=progression?.loadout?.[slot],skill=SKILLS[id];
    if(!id||!skill||!progression.skills?.[id]){tell('Open Skills [K] to learn and equip an ability.');return false;}
    if(cooldowns[id]>0){tell(skill.name+' is recovering.');return false;}
    if(!spend(skill.cost))return false;
    cooldowns[id]=skill.cooldown;
    const modifier=mods(),h=hero(),activation='skill-'+(++serial);
    options.onCast?.(id,{id:activation,damage:id==='petal_sweep'?2:1,range:id==='petal_sweep'?52:id==='briar_bind'?56:70,duration:modifier.bindDuration,force:22});
    if(id==='stormy_gust'){haste=modifier.gustHaste?2.5:0;ward=modifier.windWard?3:0;}
    if(h)effects.push({kind:id,x:h.x,y:h.y,vector:face(),age:0,duration:id==='briar_bind'?.8:.45});
    tell(skill.name+'!');options.onChange?.();return true;
  }
  function defend(attack={}){
    const h=hero();if(!h)return{blocked:false};
    if(dodge&&dodge.age<=.19){tell('Dodged');return{blocked:true,damage:0};}
    if(ward>0){ward=0;tell('Wind Ward absorbed the hit.');return{blocked:true,damage:0};}
    const vector=face(),dx=(attack.source?.x??h.x)-h.x,dy=(attack.source?.y??h.y)-h.y,length=Math.hypot(dx,dy);
    const frontal=length===0||(dx*vector[0]+dy*vector[1])/length>=.2;
    if(!guarding||!frontal)return{blocked:false};
    if(attack.parryable!==false&&guardAge<=.2&&stamina>=10){
      spend(10,true);stamina=Math.min(maxStamina(),stamina+(mods().parryReturn||0));
      effects.push({kind:'parry',x:h.x,y:h.y,age:0,duration:.45});tell('Parry!');options.onParry?.();return{blocked:true,parried:true,damage:0};
    }
    if(attack.heavy||attack.parryable===false){tell('Heavy attack—dodge the warning!');return{blocked:false};}
    if(!spend(16,true)){guarding=false;guardLock=.65;tell('Guard broken—recover stamina.');return{blocked:false};}
    effects.push({kind:'block',x:h.x,y:h.y,age:0,duration:.25});tell('Guarded');return{blocked:true,damage:0};
  }
  function update(dt,input={}){
    dt=Math.max(0,Math.min(.1,Number(dt)||0));elapsed+=dt;
    dodgeCooldown=Math.max(0,dodgeCooldown-dt);guardLock=Math.max(0,guardLock-dt);regenDelay=Math.max(0,regenDelay-dt);
    haste=Math.max(0,haste-dt);ward=Math.max(0,ward-dt);feedbackAge=Math.max(0,feedbackAge-dt);
    for(const id of Object.keys(cooldowns))cooldowns[id]=Math.max(0,cooldowns[id]-dt);
    for(const effect of effects)effect.age+=dt;effects=effects.filter(effect=>effect.age<effect.duration);
    const wantsGuard=Boolean(input.guarding)&&canAct()&&!dodge&&!input.attacking&&guardLock===0;
    if(wantsGuard){if(!guarding)guardAge=0;else guardAge+=dt;}else{if(guarding)guardLock=Math.max(guardLock,.2);guardAge=0;}
    guarding=wantsGuard;
    const h=hero();
    if(dodge&&h){
      const movement=Math.min(dt,dodge.duration-dodge.age)*220;let remaining=movement;
      while(remaining>1e-8){const step=Math.min(2,remaining),nx=h.x+dodge.x*step,ny=h.y+dodge.y*step;if(options.canStand?.(nx,ny)!==false){h.x=nx;h.y=ny;}remaining-=step;}
      dodge.age+=dt;if(dodge.age>=dodge.duration)dodge=null;
    }
    const sprinting=Boolean(input.running&&input.moving&&!guarding&&!dodge&&stamina>0);
    if(sprinting){stamina=Math.max(0,stamina-12*dt);regenDelay=.65;}
    else if(!regenDelay&&!dodge&&!input.attacking)stamina=Math.min(maxStamina(),stamina+dt*(guarding?4:23));
    stamina=Math.min(maxStamina(),Math.max(0,stamina));
  }
  function movementMultiplier(running=false){return (guarding?.38:1)*(haste>0?1+(mods().gustHaste||0):1)*(running&&stamina<=0?62/105:1);}
  function snapshot(){return{stamina,maxStamina:maxStamina(),guarding,dodging:Boolean(dodge),dodgeCooldown,cooldowns:{...cooldowns},costs:Object.fromEntries(Object.entries(SKILLS).map(([id,skill])=>[id,skill.cost])),status:feedbackAge>0?feedback:guarding?(guardAge<=.2?'Parry window':'Guarding'):dodge?'Dodging':haste>0?'Tailwind':ward>0?'Wind Ward':'',ward:ward>0,haste:haste>0};}
  function draw(ctx,camera={x:0,y:0}){
    const h=hero();if(!h)return;
    ctx.save();
    for(const effect of effects){
      const age=effect.age/effect.duration,x=effect.x-camera.x,y=effect.y-camera.y-10;ctx.globalAlpha=1-age;
      if(effect.kind==='briar_bind'){
        ctx.strokeStyle='#91c474';ctx.lineWidth=1;
        for(let i=0;i<8;i++){const angle=i*Math.PI/4+age*.25,r=10+age*44;ctx.beginPath();ctx.moveTo(x+Math.cos(angle)*r*.7,y+Math.sin(angle)*r*.5);ctx.lineTo(x+Math.cos(angle)*r,y+Math.sin(angle)*r*.65-5);ctx.stroke();}
      }else if(effect.kind==='stormy_gust'){
        ctx.strokeStyle='#d5f1e9';ctx.lineWidth=2;const v=effect.vector||[0,1];
        for(let i=-1;i<=1;i++){ctx.beginPath();ctx.arc(x+v[0]*age*45-v[1]*i*8,y+v[1]*age*45+v[0]*i*8,8+age*7,-1+Math.atan2(v[1],v[0]),1+Math.atan2(v[1],v[0]));ctx.stroke();}
      }else if(effect.kind==='petal_sweep'){
        ctx.strokeStyle='#f6b7c9';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,20+age*32,0,Math.PI*2);ctx.stroke();
        ctx.fillStyle='#ffe5bd';for(let i=0;i<8;i++){const angle=i*Math.PI/4+age*2;ctx.fillRect(Math.round(x+Math.cos(angle)*(20+age*32)),Math.round(y+Math.sin(angle)*(12+age*23)),2,2);}
      }else if(effect.kind==='parry'||effect.kind==='block'){
        ctx.strokeStyle=effect.kind==='parry'?'#fff1ac':'#b4d5bd';ctx.lineWidth=effect.kind==='parry'?2:1;ctx.beginPath();ctx.arc(x,y,8+age*20,0,Math.PI*2);ctx.stroke();
      }else{ctx.fillStyle='#d8e8c0';ctx.fillRect(Math.round(x)-6,Math.round(y)+7,12,2);}
    }
    ctx.globalAlpha=1;
    if(guarding||ward>0){const v=face(),x=h.x-camera.x+v[0]*13,y=h.y-camera.y-13+v[1]*8;ctx.strokeStyle=guarding&&guardAge<=.2?'#fff0a8':ward>0?'#c4f2e1':'#c8d4ad';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,10,Math.atan2(v[1],v[0])-.9,Math.atan2(v[1],v[0])+.9);ctx.stroke();}
    ctx.restore();
  }
  global.BloomAbilities={configure,reset,release,update,requestDodge,requestSkill,canAttack,commitAttack,attackCost,defend,snapshot,movementMultiplier,draw};
})(window);
