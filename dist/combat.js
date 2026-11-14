/* Roadside camps and the katana share one simulation; safe areas never run it. */
(function(global){
  'use strict';
  let image=null,layout={},area=null,options={},hero=null,progress=null;
  let camps=[],monsters=[],effects=[],time=0,invulnerable=0,attackLock=0,session=0,attackSequence=0,activations=new Set();
  const DIRECTIONS={right:[1,0],down:[0,1],left:[-1,0],up:[0,-1]};
  const clamp=(value,low,high)=>Math.max(low,Math.min(high,value));
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  function footprint(camp,sprites={}){
    if(Array.isArray(camp.hit)&&camp.hit.length===4)return camp.hit;
    const type=String(camp.type||'wood').replace(/^camp_/,''),sprite=sprites['camp_'+type],scale=camp.scale||1;
    // The central lower half is the den's ground base, beneath roof and spears.
    const width=Math.round((sprite?.rect?.[2]||64)*.78*scale),height=Math.round(Math.min(28,(sprite?.rect?.[3]||48)*.55)*scale);
    return [camp.x-width/2,camp.y-height,width,height];
  }
  function isCleared(camp,id,state={},index=0){
    const key=id+':'+String(camp.id||'camp-'+index),cleared=state.clearedCamps;
    return Boolean((Array.isArray(cleared)?cleared.includes(key):cleared?.[key])||state.campProgress?.[key]?.cleared);
  }
  function blockingCamp(x,y,currentArea,id,state={},sprites={}){
    if(currentArea?.kind!=='road'||currentArea.safe===true)return null;
    return (currentArea.camps||[]).find((camp,index)=>{
      if(isCleared(camp,id,state,index))return false;
      const [hx,hy,w,h]=footprint(camp,sprites);
      return x+4>hx&&x-4<hx+w&&y+2>hy&&y-2<hy+h;
    })||null;
  }
  function dictionary(value){
    if(Array.isArray(value))return Object.fromEntries(value.map(key=>[key,true]));
    return value&&typeof value==='object'?value:{};
  }
  function profileFor(type){return layout.types?.[type]||layout.monsters?.[type]||null;}
  function framesFor(profile,direction,attack=false){
    if(!profile)return [];
    return ((attack&&profile.attackDirections?.[direction])||(attack&&profile.attackFrames)||profile.directions?.[direction]||profile.frames||[profile.rect]).filter(Boolean).map(frame=>Array.isArray(frame)?frame:frame.rect).filter(Boolean);
  }
  function configure(config={}){image=config.image||null;layout=config.layout||{};}
  function canStand(x,y){return options.canStand?options.canStand(x,y):true;}
  function safePoint(x,y){
    if(canStand(x,y))return [x,y];
    for(let r=8;r<=72;r+=8)for(const [dx,dy]of[[r,0],[-r,0],[0,r],[0,-r],[r,r],[-r,r],[r,-r],[-r,-r]])if(canStand(x+dx,y+dy))return [x+dx,y+dy];
    return null;
  }
  function changed(){options.onProgress?.();}
  function reward(id,xp,kind){options.onReward?.({id,xp,kind});}
  function attackKind(type,profile={}){
    if(['cone','lunge','circle'].includes(profile.attackKind))return profile.attackKind;
    if(['boar','horned_rabbit','mantis','spectre'].includes(type))return 'lunge';
    if(['shaman','witchdoctor','pumpkin','slime'].includes(type))return 'circle';
    return 'cone';
  }
  function monsterId(camp,slot){return camp.key+':monster:'+slot;}
  function spawn(camp,slot,restore=false){
    const profile=profileFor(camp.monster);
    if(!image||!framesFor(profile).length)return false;
    const points=camp.spawnPoints?.length?camp.spawnPoints:[[camp.x-24,camp.y+20],[camp.x+24,camp.y+20]];
    let spawnAt=null;
    for(let i=0;i<points.length;i++){
      const point=points[(slot-1+i)%points.length],safe=safePoint(point[0],point[1]);
      if(safe){spawnAt=safe;break;}
    }
    if(!spawnAt)return false;
    const health=clamp(Number(profile.health)||2,1,20);
    monsters.push({id:monsterId(camp,slot),campKey:camp.key,type:camp.monster,name:profile.name||camp.monster,
      x:spawnAt[0],y:spawnAt[1],homeX:spawnAt[0],homeY:spawnAt[1],hp:health,maxHp:health,
      speed:clamp(Number(profile.speed)||25,10,65),damage:clamp(Number(profile.damage)||1,1,3),
      phase:slot*1.73,face:1,direction:'down',walking:false,stun:restore?.5:.4,attack:0,striking:0,
      bound:0,attackState:'idle',attackKind:attackKind(camp.monster,profile),attackTimer:0,attackData:null,profile});
    return true;
  }
  function enter(nextArea,config={}){
    session++;area=nextArea;options=config;hero=config.hero;
    camps=[];monsters=[];effects=[];time=0;invulnerable=0;attackLock=0;attackSequence=0;activations.clear();
    if(!hero||area.kind!=='road'||area.safe===true||config.id==='petalferry')return;
    const state=config.state||{};
    state.clearedCamps=dictionary(state.clearedCamps);
    state.defeatedMonsters=dictionary(state.defeatedMonsters);
    state.campProgress=dictionary(state.campProgress);
    progress=state;
    const mapId=config.id||area.id||'road';
    camps=(area.camps||[]).filter(c=>Number.isFinite(c.x)&&Number.isFinite(c.y)).map((source,index)=>{
      const id=String(source.id||'camp-'+index),key=mapId+':'+id;
      const health=clamp(Number(source.health)||4,1,20),stored=state.campProgress[key]||{};
      const cleared=Boolean(state.clearedCamps[key]||stored.cleared);
      const type=String(source.type||'wood').replace(/^camp_/,'');
      const camp={...source,id,key,type,name:source.name||({wood:'Bramble camp',rock:'Stone camp',haunt:'Hollow camp'}[type]||'Monster camp'),
        hp:cleared?0:clamp(Number(stored.hp??health),1,health),maxHp:health,cleared,
        maxAlive:clamp(Number(source.maxAlive)||3,1,5),totalSpawns:clamp(Number(source.totalSpawns??8),0,30),
        spawnEvery:clamp(Number(source.spawnEvery)||5,1,20),spawned:Math.max(0,Number(stored.spawned)||0),
        timer:.35,hit:0};
      state.campProgress[key]={hp:camp.hp,spawned:camp.spawned,cleared};
      return camp;
    });
    for(const camp of camps)if(!camp.cleared)for(let slot=1;slot<=Math.min(camp.spawned,camp.totalSpawns);slot++){
      if(!state.defeatedMonsters[monsterId(camp,slot)])spawn(camp,slot,true);
    }
  }
  function move(monster,tx,ty,dt){
    const dx=tx-monster.x,dy=ty-monster.y,length=Math.hypot(dx,dy);
    monster.walking=false;
    if(length<3)return;
    const step=Math.min(length,monster.speed*dt),nx=monster.x+dx/length*step,ny=monster.y+dy/length*step;
    const oldX=monster.x,oldY=monster.y;
    if(canStand(nx,monster.y))monster.x=nx;
    if(canStand(monster.x,ny))monster.y=ny;
    if(Math.hypot(monster.x-oldX,monster.y-oldY)<step*.2){
      // Small turns let monsters pass a tree without crossing its collision box.
      const turn=Math.sin(monster.phase)>0?1:-1;
      const sx=monster.x-dy/length*step*turn,sy=monster.y+dx/length*step*turn;
      if(canStand(sx,sy)){monster.x=sx;monster.y=sy;}
    }
    monster.walking=Math.hypot(monster.x-oldX,monster.y-oldY)>.1;
    if(Math.abs(monster.x-oldX)>.05)monster.face=monster.x>oldX?1:-1;
    if(monster.walking){
      const mx=monster.x-oldX,my=monster.y-oldY;
      monster.direction=Math.abs(mx)>Math.abs(my)?(mx>0?'right':'left'):(my>0?'down':'up');
    }
  }
  function clearLine(from,to){return !options.canStrike||options.canStrike(from,to);}
  function push(monster,dx,dy,length){
    const magnitude=Math.hypot(dx,dy)||1,steps=Math.max(1,Math.ceil(length/2));
    for(let step=0;step<steps;step++){
      const nx=monster.x+dx/magnitude*length/steps,ny=monster.y+dy/magnitude*length/steps;
      if(!canStand(nx,ny))break;
      monster.x=nx;monster.y=ny;
    }
  }
  function segmentDistance(point,a,b){
    const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
    const t=length?clamp(((point.x-a.x)*dx+(point.y-a.y)*dy)/length,0,1):0;
    return Math.hypot(point.x-a.x-dx*t,point.y-a.y-dy*t);
  }
  function beginAttack(monster){
    const dx=hero.x-monster.x,dy=hero.y-monster.y,length=Math.hypot(dx,dy),fallback=DIRECTIONS[monster.direction]||DIRECTIONS.down;
    const direction=length?[dx/length,dy/length]:fallback,kind=monster.attackKind;
    const warning={cone:.65,lunge:.75,circle:.85}[kind];
    const travel=clamp(length,18,46);
    monster.direction=Math.abs(direction[0])>Math.abs(direction[1])?(direction[0]>0?'right':'left'):(direction[1]>0?'down':'up');
    monster.face=direction[0]<0?-1:1;monster.walking=false;monster.attackState='windup';monster.attackTimer=warning;
    monster.attackData={id:'enemy:'+session+':'+monster.id+':'+(++attackSequence),kind,origin:{x:monster.x,y:monster.y},
      aim:kind==='circle'?{x:hero.x,y:hero.y}:{x:monster.x+direction[0]*travel,y:monster.y+direction[1]*travel},
      direction,warning,reach:kind==='cone'?27:travel,radius:kind==='circle'?23:11,arc:1.03,active:.22,recovery:kind==='cone'?.65:.85,spent:false};
  }
  function resolveAttack(monster,previous){
    const attack=monster.attackData;if(!attack||attack.spent||invulnerable>0)return;
    let hit=false;
    if(attack.kind==='circle')hit=distance(hero,attack.aim)<=attack.radius+3;
    else if(attack.kind==='lunge')hit=segmentDistance(hero,previous||monster,monster)<=attack.radius+3;
    else{
      const dx=hero.x-attack.origin.x,dy=hero.y-attack.origin.y,length=Math.hypot(dx,dy);
      hit=length<=attack.reach+4&&(length<8||(dx*attack.direction[0]+dy*attack.direction[1])/length>=Math.cos(attack.arc));
    }
    if(!hit||!clearLine(attack.origin,hero))return;
    attack.spent=true;
    const defended=options.defend?.({source:{x:attack.origin.x,y:attack.origin.y},damage:monster.damage,
      parryable:attack.kind!=='circle',heavy:attack.kind==='circle'||monster.type==='minotaur',id:attack.id})||{};
    if(defended.parried){
      monster.stun=.9;monster.striking=0;monster.attackState='recovery';monster.attackTimer=.9;monster.attackData=null;invulnerable=.12;
      effects.push({x:monster.x,y:monster.y-29,text:'PARRY',life:.8,color:'#e8d79d'});return;
    }
    if(defended.blocked){invulnerable=.12;effects.push({x:hero.x,y:hero.y-29,text:'BLOCK',life:.55,color:'#b9ded8'});return;}
    const amount=defended.damage===undefined?monster.damage:clamp(Math.floor(Number(defended.damage)||0),0,10);
    if(amount<=0)return;
    invulnerable=.95;effects.push({x:hero.x,y:hero.y-29,text:'−'+amount,life:.65,color:'#ffb5aa'});
    options.onDamage?.(amount);
  }
  function updateAttack(monster,dt){
    const data=monster.attackData;
    monster.walking=false;monster.attackTimer=Math.max(0,monster.attackTimer-dt);
    if(monster.attackState==='windup'){
      if(monster.attackTimer>0)return;
      monster.attackState='active';monster.attackTimer=data.active;monster.striking=data.active;monster.strikeDuration=data.active;
    }
    if(monster.attackState==='active'){
      const previous={x:monster.x,y:monster.y};
      if(data.kind==='lunge'&&monster.bound<=0){
        const remaining=distance(monster,data.aim),step=Math.min(remaining,data.reach*dt/data.active);
        push(monster,data.direction[0],data.direction[1],step);
      }
      resolveAttack(monster,previous);
      if(monster.attackState==='active'&&monster.attackTimer<=0){monster.attackState='recovery';monster.attackTimer=data.recovery;monster.striking=0;}
      return;
    }
    if(monster.attackState==='recovery'&&monster.attackTimer<=0){monster.attackState='idle';monster.attackData=null;}
  }
  function update(dt){
    if(!area||area.kind!=='road'||area.safe===true||!hero)return;
    const currentSession=session;
    time+=dt;invulnerable=Math.max(0,invulnerable-dt);attackLock=Math.max(0,attackLock-dt);
    effects=effects.filter(effect=>(effect.life-=dt)>0);
    for(const camp of camps){
      camp.hit=Math.max(0,camp.hit-dt);
      if(camp.cleared||camp.spawned>=camp.totalSpawns||distance(camp,hero)>210)continue;
      const alive=monsters.filter(monster=>monster.campKey===camp.key).length;
      if(alive>=camp.maxAlive)continue;
      camp.timer-=dt;
      if(camp.timer<=0){
        const slot=camp.spawned+1;
        if(spawn(camp,slot)){camp.spawned=slot;progress.campProgress[camp.key].spawned=slot;changed();}
        camp.timer=camp.spawnEvery;
      }
    }
    for(const monster of monsters){
      monster.attack=Math.max(0,monster.attack-dt);monster.stun=Math.max(0,monster.stun-dt);monster.striking=Math.max(0,monster.striking-dt);monster.bound=Math.max(0,monster.bound-dt);
      if(monster.stun>0){monster.walking=false;continue;}
      const camp=camps.find(c=>c.key===monster.campKey);
      if(!camp||camp.cleared)continue;
      const heroDistance=distance(monster,hero),campDistance=distance(camp,hero),leash=Number(camp.leash)||230;
      const pursuing=heroDistance<140&&campDistance<leash;
      if(monster.attackState!=='idle'){
        updateAttack(monster,dt);if(currentSession!==session)return;continue;
      }
      const reach={cone:25,lunge:54,circle:58}[monster.attackKind];
      if(pursuing&&heroDistance<=reach&&clearLine(monster,hero)){beginAttack(monster);continue;}
      if(monster.bound>0){monster.walking=false;continue;}
      if(pursuing)move(monster,hero.x,hero.y,dt);
      else{
        const radius=distance(monster,{x:monster.homeX,y:monster.homeY})>48?0:10;
        move(monster,monster.homeX+Math.sin(time*.35+monster.phase)*radius,monster.homeY+Math.cos(time*.32+monster.phase)*radius,dt*.55);
      }
    }
  }
  function inArc(target,attacker,radius=5,spec={}){
    const dx=target.x-attacker.x,dy=target.y-attacker.y,length=Math.hypot(dx,dy);
    if(length>(Number(spec.range)||34)+radius)return false;
    if(length<10)return true;
    const direction=DIRECTIONS[attacker.face]||DIRECTIONS.down;
    return (dx*direction[0]+dy*direction[1])/length>Math.cos(Number(spec.arc)||Math.acos(.25));
  }
  function defeat(monster,earned=true){
    progress.defeatedMonsters[monster.id]=true;
    monsters=monsters.filter(m=>m.id!==monster.id);
    if(earned)reward('monster:'+monster.id,12,'monster');
  }
  function clear(camp){
    camp.cleared=true;camp.hp=0;
    progress.clearedCamps[camp.key]=true;
    progress.campProgress[camp.key]={hp:0,spawned:camp.spawned,cleared:true};
    for(const monster of monsters.filter(m=>m.campKey===camp.key))defeat(monster,false);
    effects.push({x:camp.x,y:camp.y-27,text:'CAMP CLEARED',life:1.4,color:'#f5e4a6'});
    reward('camp:'+camp.key,35,'camp');
    options.onClear?.(camp);
  }
  function swing(attacker=hero,spec={}){
    const result={hits:0,kills:0,camps:0};
    if(!attacker||!area||area.kind!=='road'||area.safe===true||(!spec.activationId&&attackLock>0)||spec.activationId&&activations.has(spec.activationId))return result;
    if(spec.activationId){activations.add(spec.activationId);if(activations.size>200)activations.delete(activations.values().next().value);}else attackLock=.30;
    const damage=Math.max(1,Number(spec.damage)||1),knockback=Number(spec.knockback)||5;
    for(const monster of [...monsters])if(inArc(monster,attacker,6,spec)&&(!options.canStrike||options.canStrike(attacker,monster))){
      monster.hp-=damage;monster.stun=damage>1?.3:.2;monster.attackState='idle';monster.attackData=null;monster.striking=0;result.hits++;
      effects.push({x:monster.x,y:monster.y-24,text:'−'+damage,life:.6,color:'#fff0be'});
      const fallback=DIRECTIONS[attacker.face]||DIRECTIONS.down;
      push(monster,monster.x===attacker.x&&monster.y===attacker.y?fallback[0]:monster.x-attacker.x,monster.x===attacker.x&&monster.y===attacker.y?fallback[1]:monster.y-attacker.y,knockback);
      if(monster.hp<=0){defeat(monster);result.kills++;}
    }
    for(const camp of camps)if(spec.camps!==false&&!camp.cleared&&inArc(camp,attacker,13,spec)&&(!options.canStrike||options.canStrike(attacker,camp))){
      const campDamage=Math.max(1,Number(spec.campDamage)||damage);
      camp.hp=Math.max(0,camp.hp-campDamage);camp.hit=.22;result.hits++;
      progress.campProgress[camp.key].hp=camp.hp;
      effects.push({x:camp.x,y:camp.y-29,text:'−'+campDamage,life:.6,color:'#fff0be'});
      if(camp.hp<=0){clear(camp);result.camps++;}
    }
    if(result.hits)changed();
    return result;
  }
  function cast(kind,config={}){
    const result={hits:0,kills:0,camps:0};
    if(!hero||area?.kind!=='road'||area.safe===true||!['petal_sweep','briar_bind','stormy_gust'].includes(kind))return result;
    const activationId='ability:'+kind+':'+String(config.id??(++attackSequence));
    if(activations.has(activationId))return result;
    if(kind==='petal_sweep')return swing(hero,{activationId,damage:config.damage||2,campDamage:1,range:config.range||52,arc:1.65,knockback:8});
    if(kind==='stormy_gust')return swing(hero,{activationId,damage:config.damage||1,range:config.range||70,arc:1.12,knockback:config.force||22,camps:false});
    activations.add(activationId);
    const range=Number(config.range)||56,duration=clamp(Number(config.duration)||2.5,.25,10);
    for(const monster of monsters)if(distance(monster,hero)<=range&&clearLine(hero,monster)){
      monster.bound=Math.max(monster.bound,duration);monster.stun=.2;monster.attackState='idle';monster.attackData=null;monster.striking=0;result.hits++;
      effects.push({x:monster.x,y:monster.y-25,text:'ROOTED',life:.65,color:'#c5df99'});
    }
    return result;
  }
  function actors(camera={x:0,y:0}){
    return [...camps.map(camp=>({combat:true,kind:'camp',camp,sort:camp.y-6})),...monsters.map(monster=>({combat:true,kind:'monster',monster,sort:monster.y}))]
      .filter(entry=>{const actor=entry.camp||entry.monster;return actor.x>camera.x-90&&actor.x<camera.x+474&&actor.y>camera.y-20&&actor.y<camera.y+336;});
  }
  function drawGround(ctx,camera={x:0,y:0}){
    if(area?.kind!=='road'||area.safe===true)return;
    ctx.save();
    for(const monster of monsters){
      const data=monster.attackData;if(!data||!['windup','active'].includes(monster.attackState))continue;
      const active=monster.attackState==='active',origin={x:data.origin.x-camera.x,y:data.origin.y-camera.y},aim={x:data.aim.x-camera.x,y:data.aim.y-camera.y};
      ctx.strokeStyle=active?'#ffe2b5':'#eaa382';ctx.fillStyle=active?'#d86b4d66':'#b653492e';ctx.lineWidth=1.5;
      ctx.beginPath();
      if(data.kind==='circle')ctx.arc(aim.x,aim.y,data.radius,0,Math.PI*2);
      else if(data.kind==='cone'){
        const angle=Math.atan2(data.direction[1],data.direction[0]);ctx.moveTo(origin.x,origin.y);ctx.arc(origin.x,origin.y,data.reach,angle-data.arc,angle+data.arc);ctx.closePath();
      }else{
        const dx=-data.direction[1]*data.radius,dy=data.direction[0]*data.radius;
        ctx.moveTo(origin.x+dx,origin.y+dy);ctx.lineTo(aim.x+dx,aim.y+dy);ctx.lineTo(aim.x-dx,aim.y-dy);ctx.lineTo(origin.x-dx,origin.y-dy);ctx.closePath();
      }
      ctx.fill();ctx.stroke();
      if(monster.attackState==='windup'){
        const progress=clamp(1-monster.attackTimer/data.warning,0,1);
        ctx.strokeStyle='#f8dca5';ctx.beginPath();ctx.arc(monster.x-camera.x,monster.y-camera.y,7,-Math.PI/2,-Math.PI/2+progress*Math.PI*2);ctx.stroke();
      }
    }
    for(const monster of monsters)if(monster.bound>0){
      const x=monster.x-camera.x,y=monster.y-camera.y;ctx.strokeStyle='#b2cd83';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(x,y,10,4,0,0,Math.PI*2);ctx.moveTo(x-7,y+2);ctx.lineTo(x-6,y-9);ctx.moveTo(x+7,y+2);ctx.lineTo(x+5,y-10);ctx.stroke();
    }
    ctx.restore();
  }
  function draw(entry,ctx,camera){
    const actor=entry.camp||entry.monster,x=Math.round(actor.x-camera.x),y=Math.round(actor.y-camera.y);
    if(entry.kind==='camp'){
      const camp=entry.camp,ruins=camp.cleared&&options.atlas?.camp_ruins;
      ctx.save();if(camp.cleared&&!ruins)ctx.globalAlpha=.28;
      if(camp.hit>0)ctx.globalAlpha=.65+.35*Math.sin(camp.hit*65);
      options.drawSprite?.(ruins?'camp_ruins':'camp_'+camp.type,x,y,camp.scale||1,ctx);ctx.restore();
      return;
    }
    const monster=entry.monster,frames=framesFor(monster.profile,monster.direction,monster.striking>0);
    if(!image||!frames.length)return;
    const frame=monster.striking>0?Math.min(frames.length-1,Math.floor((1-monster.striking/(monster.strikeDuration||.22))*frames.length)):
      monster.walking?Math.floor(time*(monster.profile.fps||5)+monster.phase)%frames.length:0;
    const [sx,sy,w,h]=frames[frame];
    const scale=monster.profile.scale||1,anchor=monster.profile.anchor||[w/2,h];
    const bob=monster.walking?Math.round(Math.sin(time*10+monster.phase)) : 0;
    ctx.fillStyle='#21392855';ctx.beginPath();ctx.ellipse(x,y+1,Math.min(10,w*scale*.26),2,0,0,Math.PI*2);ctx.fill();
    ctx.save();
    if(monster.stun>0)ctx.globalAlpha=Math.floor(time*25)%2?.5:1;
    if(monster.face<0&&!monster.profile.directions&&monster.profile.flip!==false){ctx.translate(x,y);ctx.scale(-1,1);ctx.drawImage(image,sx,sy,w,h,-anchor[0]*scale,-anchor[1]*scale+bob,w*scale,h*scale);}
    else ctx.drawImage(image,sx,sy,w,h,x-anchor[0]*scale,y-anchor[1]*scale+bob,w*scale,h*scale);
    ctx.restore();
  }
  function target(attacker=hero){
    if(!attacker||area?.kind!=='road'||area.safe===true)return null;
    const choices=[...monsters.filter(m=>distance(m,attacker)<55).map(monster=>({...monster,kind:'monster',d:distance(monster,attacker)})),
      ...camps.filter(c=>!c.cleared&&distance(c,attacker)<72).map(camp=>({...camp,kind:'camp',d:distance(camp,attacker)+8}))];
    return choices.sort((a,b)=>a.d-b.d)[0]||null;
  }
  function hint(attacker=hero){const selected=target(attacker);return selected?'Space · '+selected.name+' · '+selected.hp+'/'+selected.maxHp:null;}
  function hud(ctx,camera){
    if(area?.kind!=='road'||area.safe===true)return;
    ctx.save();ctx.textAlign='left';ctx.font='8px monospace';
    for(const monster of monsters)if(monster.hp<monster.maxHp||distance(monster,hero)<55){
      const profile=monster.profile,frame=framesFor(profile)[0];
      const height=(profile.bodyHeight||profile.anchor?.[1]||frame?.[3]||24)*(profile.scale||1);
      const x=Math.round(monster.x-camera.x)-9,y=Math.round(monster.y-camera.y-height)-5;
      if(x<-18||x>384||y<-4||y>256)continue;
      ctx.fillStyle='#17352de8';ctx.fillRect(x-1,y-1,20,5);ctx.fillStyle='#cd7160';ctx.fillRect(x,y,18*monster.hp/monster.maxHp,3);
    }
    const selected=target();
    if(selected){
      ctx.fillStyle='#17372de8';ctx.fillRect(8,235,Math.min(366,selected.name.length*5+112),15);
      ctx.fillStyle='#f4e8c1';ctx.fillText(selected.name+'  '+selected.hp+'/'+selected.maxHp+'  SPACE · KATANA',13,245);
    }
    for(const effect of effects){
      const x=Math.round(effect.x-camera.x),y=Math.round(effect.y-camera.y-Math.max(0,1-effect.life/.65)*8);
      ctx.fillStyle=effect.color;ctx.fillText(effect.text,x-effect.text.length*2.3,y);
    }
    ctx.restore();
  }
  function snapshot(){
    return {camps:camps.map(({id,key,hp,cleared,spawned,totalSpawns,maxAlive})=>({id,key,hp,cleared,spawned,totalSpawns,maxAlive})),
      monsters:monsters.map(({id,campKey,x,y,hp,maxHp,type,name,attackState,attackKind,attackTimer,attackData,bound,stun})=>({id,campKey,x,y,hp,maxHp,type,name,attackState,attackKind,
        attackAim:attackData?{...attackData.aim}:null,warningRemaining:attackState==='windup'?attackTimer:0,bound,stun})),invulnerable,target:target()};
  }
  global.BloomCombat={configure,enter,update,actors,draw,drawGround,swing,cast,hud,hint,snapshot,footprint,blockingCamp,isCleared,hurt:()=>invulnerable>0};
})(window);
