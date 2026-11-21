/* Roadside camps and the katana share one simulation; safe areas never run it. */
(function(global){
  'use strict';
  let image=null,layout={},regionalImage=null,regionalLayout={},area=null,options={},hero=null,progress=null;
  let camps=[],monsters=[],effects=[],missiles=[],zones=[],time=0,invulnerable=0,attackLock=0,session=0,attackSequence=0,persistentDirty=false,activations=new Set();
  const DIRECTIONS={right:[1,0],down:[0,1],left:[-1,0],up:[0,-1]};
  const clamp=(value,low,high)=>Math.max(low,Math.min(high,value));
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const activeArea=()=>Boolean(area&&['road','dungeon'].includes(area.kind)&&area.safe!==true);
  // Species share approved art, but their pace and movement have a personality.
  const TEMPERAMENTS={
    orc:{warning:.48,recovery:.30,poise:2},skeleton:{warning:.40,recovery:.25,poise:2},
    beetle:{warning:.34,recovery:.22,poise:2},crow:{warning:.32,recovery:.22,poise:2,orbit:true},
    goblin:{warning:.44,recovery:.30,poise:3,orbit:true},maggot:{warning:.50,recovery:.34,poise:2},
    mimic:{warning:.56,recovery:.36,poise:3},minotaur:{warning:.78,recovery:.52,poise:5,heavy:true},
    boar:{warning:.48,recovery:.34,poise:3},horned_rabbit:{warning:.36,recovery:.24,poise:2},
    mantis:{warning:.46,recovery:.30,poise:3},spectre:{warning:.44,recovery:.30,poise:3},
    shaman:{warning:.64,recovery:.36,poise:3,ranged:true},witchdoctor:{warning:.70,recovery:.42,poise:3,ranged:true},
    pumpkin:{warning:.66,recovery:.42,poise:3},slime:{warning:.50,recovery:.30,poise:2},
    lavender_imp:{warning:.36,recovery:.24,poise:2,orbit:true},violet_brambleback:{warning:.70,recovery:.46,poise:5,heavy:true},
    amethyst_wisp:{warning:.70,recovery:.40,poise:2,ranged:true},medusa:{warning:1.15,recovery:.55,poise:7,ranged:true}
  };
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
    if(!['road','dungeon'].includes(currentArea?.kind)||currentArea.safe===true)return null;
    return (currentArea.camps||[]).find((camp,index)=>{
      if(camp.hidden||isCleared(camp,id,state,index))return false;
      const [hx,hy,w,h]=footprint(camp,sprites);
      return x+4>hx&&x-4<hx+w&&y+2>hy&&y-2<hy+h;
    })||null;
  }
  function dictionary(value){
    if(Array.isArray(value))return Object.fromEntries(value.map(key=>[key,true]));
    return value&&typeof value==='object'?value:{};
  }
  function reconcileCamps(records,state={},onReward){
    state.campMastery=dictionary(state.campMastery);const credits=[],claims=state.progression?.claimedRewards||{};
    for(const [mapId,map]of Object.entries(records||{})){
      if(!['road','dungeon'].includes(map.kind)||map.safe===true)continue;
      for(const [index,source]of (map.camps||[]).entries()){
        if(source.storyGuardian)continue;
        const key=mapId+':'+String(source.id||'camp-'+index);
        if(!isCleared(source,mapId,state,index)||state.campMastery[key])continue;
        let missing=0;for(let slot=1;slot<=clamp(Number(source.totalSpawns??8),0,30);slot++)if(!claims['monster:'+key+':monster:'+slot])missing++;
        state.campMastery[key]=true;
        if(missing){const credit={id:'camp-mastery:'+key,xp:missing*12,kind:'camp-mastery'};credits.push(credit);if(onReward)onReward(credit);else global.BloomProgression?.grant?.(state,credit.id,credit.xp);}
      }
    }
    return credits;
  }
  function profileFor(type){return regionalLayout.types?.[type]||regionalLayout.monsters?.[type]||layout.types?.[type]||layout.monsters?.[type]||null;}
  function profileImage(profile){return profile?.sheet?regionalImage:image;}
  function framesFor(profile,direction,attack=false){
    if(!profile)return [];
    return ((attack&&profile.attackDirections?.[direction])||(attack&&profile.attackFrames)||profile.directions?.[direction]||profile.frames||[profile.rect]).filter(Boolean).map(frame=>Array.isArray(frame)?frame:frame.rect).filter(Boolean);
  }
  function configure(config={}){image=config.image||null;layout=config.layout||{};regionalImage=config.regionalImage||null;regionalLayout=config.regionalLayout||{};}
  function canStand(x,y){return options.canStand?options.canStand(x,y):true;}
  function safePoint(x,y){
    if(canStand(x,y))return [x,y];
    for(let r=8;r<=72;r+=8)for(const [dx,dy]of[[r,0],[-r,0],[0,r],[0,-r],[r,r],[-r,r],[r,-r],[-r,-r]])if(canStand(x+dx,y+dy))return [x+dx,y+dy];
    return null;
  }
  function changed(){if(persistentDirty){persistentDirty=false;options.onProgress?.();}}
  function reward(id,xp,kind){options.onReward?.({id,xp,kind});}
  function attackKind(type,profile={}){
    if(['cone','lunge','circle'].includes(profile.attackKind))return profile.attackKind;
    if(['boar','horned_rabbit','mantis','spectre'].includes(type))return 'lunge';
    if(['shaman','witchdoctor','pumpkin','slime'].includes(type))return 'circle';
    return 'cone';
  }
  function monsterId(camp,slot){return camp.key+':monster:'+slot;}
  function spawn(camp,slot,restore=false){
    const type=profileFor(camp.regionalMonster)?camp.regionalMonster:camp.monster,profile=profileFor(type);
    if(!profileImage(profile)||!framesFor(profile).length)return false;
    const points=camp.spawnPoints?.length?camp.spawnPoints:[[camp.x-24,camp.y+20],[camp.x+24,camp.y+20]];
    let spawnAt=null;
    for(let i=0;i<points.length;i++){
      const point=points[(slot-1+i)%points.length],safe=safePoint(point[0],point[1]);
      if(safe){spawnAt=safe;break;}
    }
    if(!spawnAt)return false;
    const health=clamp(Number(camp.monsterHealth??profile.health)||2,1,120),temperament={...(TEMPERAMENTS[type]||{}),...(profile.combat||{})};
    monsters.push({id:monsterId(camp,slot),campKey:camp.key,type,name:camp.monsterName||profile.name||type,
      x:spawnAt[0],y:spawnAt[1],homeX:spawnAt[0],homeY:spawnAt[1],hp:health,maxHp:health,
      speed:clamp(Number(camp.monsterSpeed??profile.speed)||25,10,65),damage:clamp(Number(camp.monsterDamage??profile.damage)||(temperament.heavy?2:1),1,3),
      phase:slot*1.73,face:1,direction:'down',walking:false,stun:restore?.5:.4,attack:0,striking:0,
      bound:0,attackState:'idle',attackKind:attackKind(type,profile),attackTimer:0,attackData:null,profile,temperament,
      poise:camp.boss?7:temperament.poise||2,poiseMax:camp.boss?7:temperament.poise||2,poiseAge:0,staggerGuard:0,recoil:0,boss:Boolean(camp.boss),phaseTwo:false,attackCycle:0});
    return true;
  }
  function enter(nextArea,config={}){
    session++;area=nextArea;options=config;hero=config.hero;
    camps=[];monsters=[];effects=[];missiles=[];zones=[];time=0;invulnerable=0;attackLock=0;attackSequence=0;persistentDirty=false;activations.clear();
    if(!hero||!activeArea()||config.id==='petalferry')return;
    const state=config.state||{};
    state.clearedCamps=dictionary(state.clearedCamps);
    state.defeatedMonsters=dictionary(state.defeatedMonsters);
    state.campProgress=dictionary(state.campProgress);
    state.campMastery=dictionary(state.campMastery);
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
        timer:.35,hit:0,...(source.storyGuardian&&cleared?{exposed:true}:{})};
      state.campProgress[key]={hp:camp.hp,spawned:camp.spawned,cleared,...(camp.exposed?{exposed:true}:{})};
      return camp;
    });
    // Older cleared saves receive the same complete encounter budget once.
    for(const camp of camps)if(camp.cleared&&!camp.storyGuardian&&!state.campMastery[camp.key]){
      const credit=unearnedCampXP(camp);state.campMastery[camp.key]=true;persistentDirty=true;
      if(credit)reward('camp-mastery:'+camp.key,credit,'camp-mastery');changed();
    }
    for(const camp of camps)if(!camp.cleared)for(let slot=1;slot<=Math.min(camp.spawned,camp.totalSpawns);slot++){
      if(!state.defeatedMonsters[monsterId(camp,slot)])spawn(camp,slot,true);
    }
  }
  function move(monster,tx,ty,dt){
    const dx=tx-monster.x,dy=ty-monster.y,length=Math.hypot(dx,dy);
    monster.walking=false;
    if(length<3)return;
    const step=Math.min(length,monster.speed*(1-(monster.slow||0))*dt),nx=monster.x+dx/length*step,ny=monster.y+dy/length*step;
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
    const direction=length?[dx/length,dy/length]:fallback;
    if(monster.boss&&monster.hp<=monster.maxHp*.5&&!monster.phaseTwo){monster.phaseTwo=true;if(monster.type==='medusa')monster.attackCycle=0;effects.push({x:monster.x,y:monster.y-38,text:'GUARDIAN AWAKENS',life:1.1,color:'#f3c581'});}
    const medusa=monster.type==='medusa',cycle=monster.phaseTwo?['gaze','serpent_lash','crystal_trap','serpent_lash']:['gaze','serpent_lash','crystal_trap'];
    const name=medusa?cycle[monster.attackCycle++%cycle.length]:monster.type==='amethyst_wisp'?'amethyst_orb':null;
    const kind=medusa?{gaze:'cone',serpent_lash:'lunge',crystal_trap:'circle'}[name]:name==='amethyst_orb'?'projectile':monster.boss&&monster.phaseTwo?['lunge','cone','circle'][attackSequence%3]:monster.attackKind;
    const temperament=monster.temperament||{},warning=monster.boss?(kind==='circle'?.88:.70):(Number(temperament.warning)||{cone:.65,lunge:.75,circle:.85}[kind]);
    const tell=medusa?({gaze:1.15,serpent_lash:.70,crystal_trap:.95}[name])*(monster.phaseTwo?.82:1):warning;
    const travel=name==='serpent_lash'?65:kind==='projectile'?150:clamp(length,18,monster.boss?64:52);
    monster.direction=Math.abs(direction[0])>Math.abs(direction[1])?(direction[0]>0?'right':'left'):(direction[1]>0?'down':'up');
    monster.face=direction[0]<0?-1:1;monster.walking=false;monster.attackState='windup';monster.attackTimer=tell;
    monster.attackData={id:'enemy:'+session+':'+monster.id+':'+(++attackSequence),kind,name:name||kind,origin:{x:monster.x,y:monster.y},
      aim:kind==='circle'?{x:hero.x,y:hero.y}:{x:monster.x+direction[0]*travel,y:monster.y+direction[1]*travel},
      direction,warning:tell,reach:name==='gaze'?110:kind==='cone'?(monster.boss?39:27):travel,radius:kind==='circle'?(medusa?28:monster.boss?31:23):kind==='projectile'?4:11,arc:name==='gaze'?.48:1.03,
      parryable:name==='gaze'?false:kind!=='circle',color:medusa?{gaze:'#b4e0cc',serpent_lash:'#eab878',crystal_trap:'#c49deb'}[name]:kind==='projectile'?'#c49deb':null,
      active:kind==='lunge'?.24:.19,recovery:medusa?.60:monster.boss?.48:Number(temperament.recovery)||(kind==='cone'?.65:.85),spent:false};
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
    if(attack.name==='gaze'){
      const facing=DIRECTIONS[hero.face]||DIRECTIONS.down,dx=attack.origin.x-hero.x,dy=attack.origin.y-hero.y;
      if(facing[0]*dx+facing[1]*dy<=0)return;
    }
    applyEnemyHit(monster,attack);
  }
  function applyEnemyHit(monster,attack){
    if(attack.spent||invulnerable>0)return;
    attack.spent=true;
    const damage=monster?.damage||attack.damage||1;
    const defended=options.defend?.({source:{x:attack.origin.x,y:attack.origin.y},damage,
      parryable:attack.parryable??attack.kind!=='circle',heavy:attack.kind==='circle'||monster?.type==='minotaur',id:attack.id,kind:attack.name||attack.kind})||{};
    if(defended.parried){
      if(monster){monster.stun=.9;monster.striking=0;monster.attackState='recovery';monster.attackTimer=.9;monster.attackData=null;monster.staggerGuard=1.2;}invulnerable=.12;
      const source=monster||attack.origin;effects.push({x:source.x,y:source.y-29,text:'PARRY',life:.8,color:'#e8d79d'});options.onFeedback?.({kind:'parry',text:'Parry!',target:{x:source.x,y:source.y}});return;
    }
    if(defended.blocked){invulnerable=.12;const label=defended.kind==='dodge'?'DODGE':defended.kind==='ward'?'WARD':'BLOCK';effects.push({x:hero.x,y:hero.y-29,text:label,life:.55,color:'#b9ded8'});options.onFeedback?.({kind:defended.kind||'block',text:label,target:{x:hero.x,y:hero.y}});return;}
    const amount=defended.damage===undefined?damage:clamp(Math.floor(Number(defended.damage)||0),0,10);
    if(amount<=0)return;
    invulnerable=.95;effects.push({x:hero.x,y:hero.y-29,text:'−'+amount,life:.65,color:'#ffb5aa'});
    if(attack.name==='gaze'){effects.push({x:hero.x,y:hero.y-39,text:'STONE GAZE',life:.8,color:'#b4e0cc'});options.onFeedback?.({kind:'stone',text:'Stone gaze',target:{x:hero.x,y:hero.y}});}
    options.onDamage?.(amount,{kind:attack.name||attack.kind});
  }
  function updateAttack(monster,dt){
    const data=monster.attackData;
    monster.walking=false;monster.attackTimer=Math.max(0,monster.attackTimer-dt);
    if(monster.attackState==='windup'){
      if(monster.attackTimer>0)return;
      monster.attackState='active';monster.attackTimer=data.active;monster.striking=data.active;monster.strikeDuration=data.active;
      if(data.kind==='projectile'){
        missile('amethyst_orb',{activationId:data.id,enemy:true,ownerId:monster.id,damage:monster.damage,direction:data.direction,range:data.reach,speed:105,radius:4,color:data.color,parryable:true},data.origin);data.spent=true;
      }
    }
    if(monster.attackState==='active'){
      const previous={x:monster.x,y:monster.y};
      if(data.kind==='lunge'&&monster.bound<=0){
        const remaining=distance(monster,data.aim),step=Math.min(remaining,data.reach*dt/data.active*(1-(monster.slow||0)));
        push(monster,data.direction[0],data.direction[1],step);
      }
      resolveAttack(monster,previous);
      if(monster.attackState==='active'&&monster.attackTimer<=0){monster.attackState='recovery';monster.attackTimer=data.recovery;monster.striking=0;}
      return;
    }
    if(monster.attackState==='recovery'){
      // Recovery remains readable while the creature shuffles back or circles.
      if(data&&monster.bound<=0){
        const side=monster.temperament?.orbit?(Math.sin(monster.phase)>0?1:-1):0,back=monster.temperament?.ranged?1.1:.35;
        const dx=-data.direction[0]*back-data.direction[1]*side*.6,dy=-data.direction[1]*back+data.direction[0]*side*.6;
        push(monster,dx,dy,monster.speed*dt*(monster.temperament?.ranged?.7:.3)*(1-(monster.slow||0)));monster.walking=true;
      }
      if(monster.attackTimer<=0){monster.attackState='idle';monster.attackData=null;monster.attack=.12;}
    }
  }
  function update(dt){
    if(!activeArea()||!hero)return;
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
        if(spawn(camp,slot)){camp.spawned=slot;progress.campProgress[camp.key].spawned=slot;persistentDirty=true;changed();}
        camp.timer=camp.spawnEvery;
      }
    }
    updateMagic(dt);
    if(currentSession!==session)return;
    for(const monster of monsters){
      if(monster.frozen>0){monster.walking=false;continue;}
      monster.attack=Math.max(0,monster.attack-dt);monster.stun=Math.max(0,monster.stun-dt);monster.striking=Math.max(0,monster.striking-dt);monster.bound=Math.max(0,monster.bound-dt);
      monster.recoil=Math.max(0,(monster.recoil||0)-dt);monster.staggerGuard=Math.max(0,(monster.staggerGuard||0)-dt);monster.resistNotice=Math.max(0,(monster.resistNotice||0)-dt);monster.poiseAge+=dt;
      if(monster.poiseAge>1.4)monster.poise=monster.poiseMax;
      if(monster.stun>0){monster.walking=false;if(monster.attackState==='recovery'){monster.attackTimer=Math.max(0,monster.attackTimer-dt);if(!monster.attackTimer){monster.attackState='idle';monster.attackData=null;}}continue;}
      const camp=camps.find(c=>c.key===monster.campKey);
      if(!camp||camp.cleared)continue;
      const heroDistance=distance(monster,hero),campDistance=distance(camp,hero),leash=Number(camp.leash)||230;
      const pursuing=heroDistance<140&&campDistance<leash;
      if(monster.attackState!=='idle'){
        updateAttack(monster,dt);if(currentSession!==session)return;continue;
      }
      const reach=monster.type==='medusa'?110:monster.temperament?.ranged?90:monster.boss?68:{cone:25,lunge:54,circle:58}[monster.attackKind];
      if(pursuing&&!monster.attack&&heroDistance<=reach&&clearLine(monster,hero)){beginAttack(monster);continue;}
      if(monster.bound>0){monster.walking=false;continue;}
      if(pursuing&&monster.attack&&monster.temperament?.orbit){const dx=(hero.x-monster.x)/(heroDistance||1),dy=(hero.y-monster.y)/(heroDistance||1),side=Math.sin(monster.phase)>0?1:-1;move(monster,monster.x-dy*side*16,monster.y+dx*side*16,dt*.6);}
      else if(pursuing)move(monster,hero.x,hero.y,dt);
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
    progress.defeatedMonsters[monster.id]=true;persistentDirty=true;
    monsters=monsters.filter(m=>m.id!==monster.id);
    const camp=camps.find(camp=>camp.key===monster.campKey);
    if(earned&&!camp?.storyGuardian)reward('monster:'+monster.id,12,'monster');
    if(earned&&camp&&!camp.cleared&&(camp.boss||camp.clearOnDefeat)&&camp.spawned>=camp.totalSpawns&&!monsters.some(actor=>actor.campKey===camp.key))clear(camp);
  }
  function unearnedCampXP(camp){
    if(camp.storyGuardian)return 0;
    const claims=(options.getState?.()||progress)?.progression?.claimedRewards;
    let unearned=0;for(let slot=1;slot<=camp.totalSpawns;slot++){
      // Live camps have never performed cleanup; their defeated flags are exact.
      // Cleared legacy camps need the XP ledger to distinguish kills from cleanup.
      const id=monsterId(camp,slot),claimed=camp.cleared&&claims?claims['monster:'+id]:progress?.defeatedMonsters?.[id];
      if(!claimed)unearned++;
    }
    return unearned*12;
  }
  function clear(camp){
    if(camp.cleared)return;
    const mastery=unearnedCampXP(camp);if(!camp.storyGuardian)progress.campMastery[camp.key]=true;
    camp.cleared=true;camp.hp=0;
    progress.clearedCamps[camp.key]=true;
    if(camp.storyGuardian)camp.exposed=true;
    progress.campProgress[camp.key]={hp:0,spawned:camp.spawned,cleared:true,...(camp.storyGuardian?{exposed:true}:{})};persistentDirty=true;
    for(const monster of monsters.filter(m=>m.campKey===camp.key))defeat(monster,false);
    effects.push({x:camp.x,y:camp.y-27,text:camp.storyGuardian?'THORNHEART EXPOSED':'CAMP CLEARED',life:1.4,color:'#f5e4a6'});
    // Completing a camp credits its full encounter, even when waves are skipped.
    if(!camp.storyGuardian)reward('camp:'+camp.key,(Number(camp.rewardXp)||35)+mastery,camp.boss?'boss':'camp');
    options.onClear?.(camp);
  }
  function swing(attacker=hero,spec={}){
    const result={hits:0,kills:0,camps:0};
    if(!attacker||!activeArea()||(!spec.activationId&&attackLock>0)||spec.activationId&&activations.has(spec.activationId))return result;
    if(spec.activationId){activations.add(spec.activationId);if(activations.size>200)activations.delete(activations.values().next().value);}else attackLock=.30;
    const damage=Math.max(1,Number(spec.damage)||1),knockback=Number(spec.knockback)||5;
    for(const monster of [...monsters])if(inArc(monster,attacker,6,spec)&&(!options.canStrike||options.canStrike(attacker,monster))){
      monster.hp-=damage;recoil(monster,damage,{heavy:damage>1||spec.id==='thrust'});result.hits++;
      effects.push({x:monster.x,y:monster.y-24,text:'−'+damage,life:.6,color:'#fff0be'});
      const fallback=DIRECTIONS[attacker.face]||DIRECTIONS.down;
      push(monster,monster.x===attacker.x&&monster.y===attacker.y?fallback[0]:monster.x-attacker.x,monster.x===attacker.x&&monster.y===attacker.y?fallback[1]:monster.y-attacker.y,knockback);
      const killed=monster.hp<=0;options.onImpact?.({kind:'melee',spellId:spec.spellId||spec.id||'katana',damage,killed,target:{x:monster.x,y:monster.y}});if(killed){defeat(monster);result.kills++;}
    }
    for(const camp of camps)if(spec.camps!==false&&!camp.hidden&&!camp.cleared&&inArc(camp,attacker,13,spec)&&(!options.canStrike||options.canStrike(attacker,camp))){
      const campDamage=Math.max(1,Number(spec.campDamage)||damage);
      camp.hp=Math.max(0,camp.hp-campDamage);camp.hit=.22;result.hits++;
      progress.campProgress[camp.key].hp=camp.hp;persistentDirty=true;
      effects.push({x:camp.x,y:camp.y-29,text:'−'+campDamage,life:.6,color:'#fff0be'});
      options.onImpact?.({kind:'melee',damage:campDamage,killed:camp.hp<=0,target:{x:camp.x,y:camp.y}});
      if(camp.hp<=0){clear(camp);result.camps++;}
    }
    if(result.hits)changed();
    return result;
  }
  const SPELL_DEFAULTS={
    petal_sweep:{damage:2,range:52,force:8,arc:1.65,color:'#f2b1c0'},
    rose_lance:{damage:3,range:130,speed:220,pierce:2,radius:4,color:'#f2b1c0'},
    crescent_return:{damage:2,range:104,speed:180,pierce:6,radius:6,color:'#e9c09d'},
    thorn_dance:{damage:1,radius:34,duration:3,tick:.65,color:'#f2b1c0'},
    briar_bind:{damage:0,radius:56,duration:2.5,color:'#b4d68c'},
    seed_bolt:{damage:1,range:150,speed:175,rootDuration:1.2,radius:4,color:'#b4d68c'},
    healing_bloom:{damage:0,radius:30,duration:.8,color:'#c6e0a4'},
    thorn_wall:{damage:1,range:38,radius:30,duration:4,tick:.6,slow:.5,slowDuration:1,color:'#b4d68c'},
    stormy_gust:{damage:1,range:70,force:22,arc:1.12,color:'#bde6e2'},
    gale_step:{damage:2,range:72,duration:.22,force:10,color:'#bde6e2'},
    cyclone:{damage:1,radius:64,duration:1.4,tick:.45,force:22,color:'#bde6e2'},
    thunder_call:{damage:3,range:96,radius:36,delay:.55,color:'#ece3a0'},
    frost_shard:{damage:2,range:160,speed:210,slow:.5,slowDuration:2,radius:5,color:'#aad9f1'},
    ice_ring:{damage:1,radius:48,duration:1.8,color:'#aad9f1'},
    winter_ward:{damage:0,radius:18,duration:5,color:'#ccebf4'},
    glacial_path:{damage:1,range:90,radius:12,duration:4,tick:.6,slow:.55,slowDuration:2,color:'#aad9f1'},
    ember_bolt:{damage:3,range:145,speed:200,burnDamage:1,burnDuration:3,burnTick:1,radius:5,color:'#eeac73'},
    flame_fan:{damage:2,range:58,arc:1.1,burnDamage:1,burnDuration:2,color:'#eeac73'},
    cinder_trap:{damage:3,range:60,radius:28,duration:8,armTime:.45,triggerRadius:23,color:'#eeac73'},
    phoenix_pulse:{damage:2,radius:58,force:6,color:'#f0bd83'}
  };
  function remember(id){activations.add(id);if(activations.size>512)activations.delete(activations.values().next().value);}
  function interrupt(monster,seconds=.2){monster.stun=Math.max(monster.stun,seconds);monster.attackState='idle';monster.attackData=null;monster.striking=0;}
  function recoil(monster,damage,spec={}){
    monster.recoil=.14;monster.poiseAge=0;
    if(monster.staggerGuard>0)return;
    monster.poise-=Math.max(1,Number(spec.poiseDamage)||Number(damage)||1);
    if(monster.poise<=0||spec.forceInterrupt){
      interrupt(monster,monster.boss?.22:spec.heavy?.28:.18);monster.poise=monster.poiseMax;monster.staggerGuard=monster.boss?1.5:1.0;
      effects.push({x:monster.x,y:monster.y-31,text:'STAGGER',life:.55,color:'#e7ce91'});options.onFeedback?.({kind:'stagger',text:'Stagger',target:{x:monster.x,y:monster.y}});
    }
  }
  function status(monster,spec={}){
    const resistance=monster.boss?.45:1;
    if(Number(spec.rootDuration)>0)monster.bound=Math.max(monster.bound,clamp(Number(spec.rootDuration)*resistance,.1,12));
    if(Number(spec.freezeDuration)>0){monster.frozen=Math.max(monster.frozen||0,clamp(Number(spec.freezeDuration)*resistance,.1,8));interrupt(monster,.1);}
    if(monster.boss&&(Number(spec.rootDuration)>0||Number(spec.freezeDuration)>0)&&!monster.resistNotice){effects.push({x:monster.x,y:monster.y-31,text:'RESISTS CONTROL',life:.7,color:'#bdd9e4'});monster.resistNotice=.8;}
    if(Number(spec.slow)>0){monster.slow=Math.max(monster.slow||0,clamp(Number(spec.slow),0,.85));monster.slowTime=Math.max(monster.slowTime||0,clamp(Number(spec.slowDuration)||1,.1,10));}
    if(Number(spec.burnDamage)>0&&Number(spec.burnDuration)>0){
      const previous=monster.burning,damage=clamp(Math.floor(Number(spec.burnDamage)),1,8),duration=clamp(Number(spec.burnDuration),.1,10);
      // Reapplication refreshes duration but never creates parallel DoT stacks.
      monster.burning={remaining:Math.max(previous?.remaining||0,duration),damage:Math.max(previous?.damage||0,damage),tick:clamp(Number(spec.burnTick)||1,.3,3),timer:previous?.timer??clamp(Number(spec.burnTick)||1,.3,3)};
    }
  }
  function slowNearby(config={}){
    if(!activeArea()||!hero)return 0;
    const point={x:Number(config.x??hero.x),y:Number(config.y??hero.y)};
    if(!Number.isFinite(point.x)||!Number.isFinite(point.y))return 0;
    const radius=clamp(Number(config.radius)||100,1,240),duration=clamp(Number(config.duration)||2.1,.1,10),amount=clamp(Number(config.amount??.55)||0,0,.85);
    let affected=0;for(const monster of monsters)if(distance(point,monster)<=radius&&clearLine(point,monster)){status(monster,{slow:amount,slowDuration:duration});affected++;}
    return affected;
  }
  function damageMonster(monster,amount,source,spec={},result={hits:0,kills:0,camps:0}){
    if(!monsters.includes(monster)||monster.hp<=0||!spec.ignoreOcclusion&&!clearLine(source,monster))return false;
    const damage=clamp(Math.floor(Number(amount)||0),0,20);
    if(damage){
      monster.hp=Math.max(0,monster.hp-damage);result.hits++;
      effects.push({x:monster.x,y:monster.y-24,text:'−'+damage,life:.6,color:spec.color||'#fff0be'});
      if(spec.interrupt!==false)recoil(monster,damage,{heavy:damage>1});
      const force=clamp(Number(spec.force)||0,0,48);
      if(force)push(monster,monster.x-source.x,monster.y-source.y,force);
    }
    status(monster,spec);
    const killed=monster.hp<=0;
    if(damage)options.onImpact?.({kind:spec.impactKind||(spec.spellId==='burn'?'burn':'burst'),spellId:spec.spellId,damage,killed,target:{x:monster.x,y:monster.y}});
    if(killed){defeat(monster);result.kills++;}
    return true;
  }
  function spellVector(config={}){
    const source=Array.isArray(config.direction)?config.direction:DIRECTIONS[config.face||hero.face]||DIRECTIONS.down;
    const length=Math.hypot(Number(source[0])||0,Number(source[1])||0)||1;
    return[(Number(source[0])||0)/length,(Number(source[1])||0)/length];
  }
  function endpoint(origin,vector,range){
    let point={x:origin.x,y:origin.y};
    for(let remaining=range;remaining>1e-6;){
      const step=Math.min(3,remaining),next={x:point.x+vector[0]*step,y:point.y+vector[1]*step};
      if(!canStand(next.x,next.y)||!clearLine(point,next))break;
      point=next;remaining-=step;
    }
    return point;
  }
  function newZone(spellId,spec,origin,extra={}){
    const zone={id:spec.activationId,spellId,x:origin.x,y:origin.y,origin:{...origin},vector:spellVector(spec),
      age:0,duration:clamp(Number(spec.duration)||.65,.1,12),radius:clamp(Number(spec.radius)||24,4,100),
      tick:clamp(Number(spec.tick)||.6,.15,3),timer:0,triggered:false,hits:new Set(),spec:{...spec},...extra};
    zones.push(zone);if(zones.length>24)zones.shift();return zone;
  }
  function missile(spellId,spec,origin){
    const vector=spellVector(spec),range=clamp(Number(spec.range)||130,16,320),speed=clamp(Number(spec.speed)||190,60,360);
    missiles.push({id:spec.activationId,spellId,x:origin.x,y:origin.y,origin:{...origin},vector,range,speed,
      radius:clamp(Number(spec.radius)||4,2,12),leg:0,travelled:0,age:0,life:range/speed*(spellId==='crescent_return'?2:1)+.7,
      pierce:clamp(Math.floor(Number(spec.pierce)||1),1,12),hits:new Set(),spec:{...spec},enemy:Boolean(spec.enemy),done:false});
    if(missiles.length>32)missiles.shift();
  }
  function cast(kind,config={}){
    const result={hits:0,kills:0,camps:0,scheduled:false};
    if(!hero||!activeArea()||!Object.prototype.hasOwnProperty.call(SPELL_DEFAULTS,kind))return result;
    const activationId='ability:'+kind+':'+String(config.id??(++attackSequence));
    if(activations.has(activationId))return result;
    const supplied=global.BloomSpells?.resolve?.(kind,Number(config.rank)||1)||{};
    const spec={...SPELL_DEFAULTS[kind],...supplied,...config,activationId,spellId:kind};
    const source=config.origin&&Number.isFinite(config.origin.x)&&Number.isFinite(config.origin.y)&&distance(config.origin,hero)<=180?config.origin:hero;
    const origin={x:source.x,y:source.y},vector=spellVector(spec),face=spec.face||hero.face;
    if(kind==='petal_sweep'||kind==='stormy_gust'){
      const hit=swing({...origin,face},{activationId,damage:spec.damage,campDamage:1,range:spec.range,arc:spec.arc,knockback:spec.force,camps:kind==='petal_sweep'});
      newZone(kind,spec,origin,{duration:.4,shape:'cone',radius:spec.range});return{...hit,scheduled:false};
    }
    remember(activationId);
    if(['rose_lance','crescent_return','seed_bolt','frost_shard','ember_bolt'].includes(kind)){
      missile(kind,spec,origin);result.scheduled=true;return result;
    }
    if(kind==='briar_bind'||kind==='ice_ring'||kind==='phoenix_pulse'){
      const radius=clamp(Number(spec.radius)||Number(spec.range)||48,4,100);
      for(const monster of [...monsters])if(distance(monster,origin)<=radius&&clearLine(origin,monster)){
        const adjusted={...spec,rootDuration:kind==='briar_bind'?spec.duration:spec.rootDuration,freezeDuration:kind==='ice_ring'?spec.duration:0};
        if(damageMonster(monster,spec.damage,origin,adjusted,result)&&!spec.damage){interrupt(monster,.2);result.hits++;}
      }
      newZone(kind,spec,origin,{duration:.7,shape:'ring',radius});return result;
    }
    if(kind==='flame_fan'){
      for(const monster of [...monsters])if(inArc(monster,{...origin,face},6,spec))damageMonster(monster,spec.damage,origin,spec,result);
      newZone(kind,spec,origin,{duration:.5,shape:'cone',radius:spec.range});return result;
    }
    if(kind==='gale_step'){
      const suppliedEnd=config.end&&Number.isFinite(config.end.x)&&Number.isFinite(config.end.y)&&distance(origin,config.end)<=150?config.end:null;
      const travel=suppliedEnd?distance(origin,suppliedEnd):clamp(Number(spec.range)||72,0,140),dashVector=suppliedEnd&&travel?[(suppliedEnd.x-origin.x)/travel,(suppliedEnd.y-origin.y)/travel]:vector;
      const end=endpoint(origin,dashVector,travel);
      for(const monster of [...monsters])if(segmentDistance(monster,origin,end)<=11&&clearLine(origin,monster))damageMonster(monster,spec.damage,origin,spec,result);
      newZone(kind,spec,origin,{end,shape:'line',duration:.35,radius:10});return result;
    }
    if(kind==='healing_bloom'||kind==='winter_ward'){
      newZone(kind,spec,origin,{shape:'ring',follow:kind==='winter_ward',duration:kind==='healing_bloom'?.8:spec.duration});return result;
    }
    if(kind==='thorn_dance'){
      newZone(kind,spec,origin,{shape:'orbit',follow:true});result.scheduled=true;return result;
    }
    if(kind==='cyclone'){
      newZone(kind,spec,origin,{shape:'vortex'});result.scheduled=true;return result;
    }
    if(kind==='thunder_call'){
      const candidates=monsters.filter(monster=>inArc(monster,{...origin,face},0,{range:spec.range,arc:1.25})&&clearLine(origin,monster)).sort((a,b)=>distance(a,origin)-distance(b,origin));
      const aim=candidates[0]?{x:candidates[0].x,y:candidates[0].y}:endpoint(origin,vector,clamp(Number(spec.range)||96,16,240));
      newZone(kind,spec,origin,{...aim,shape:'lightning',delay:clamp(Number(spec.delay)||.55,.15,2),duration:clamp(Number(spec.delay)||.55,.15,2)+.42});result.scheduled=true;return result;
    }
    if(kind==='cinder_trap'){
      const aim=endpoint(origin,vector,clamp(Number(spec.range)||60,16,140));
      newZone(kind,spec,origin,{...aim,shape:'trap',armTime:clamp(Number(spec.armTime)||.45,.1,2)});result.scheduled=true;return result;
    }
    const end=endpoint(origin,vector,clamp(Number(spec.range)||60,12,180));
    if(kind==='thorn_wall'){
      const width=clamp(Number(spec.radius)||30,10,60),a=endpoint(end,[-vector[1],vector[0]],width),b=endpoint(end,[vector[1],-vector[0]],width);
      newZone(kind,spec,origin,{x:end.x,y:end.y,a,b,shape:'wall',radius:8});
    }else newZone(kind,spec,origin,{end,shape:'trail'});
    result.scheduled=true;return result;
  }
  function tickStatuses(dt){
    for(const monster of [...monsters]){
      monster.frozen=Math.max(0,(monster.frozen||0)-dt);monster.slowTime=Math.max(0,(monster.slowTime||0)-dt);if(!monster.slowTime)monster.slow=0;
      const burn=monster.burning;if(!burn)continue;
      burn.remaining=Math.max(0,burn.remaining-dt);burn.timer-=dt;
      if(burn.timer<=0){burn.timer+=burn.tick;damageMonster(monster,burn.damage,monster,{ignoreOcclusion:true,interrupt:false,force:0,spellId:'burn',color:'#efb079'});changed();}
      if(!burn.remaining)monster.burning=null;
    }
  }
  function updateMissiles(dt){
    const currentSession=session;
    for(const bolt of missiles){
      bolt.age+=dt;if(bolt.age>bolt.life){bolt.done=true;continue;}
      let travel=Math.min(bolt.speed*dt,bolt.range-bolt.travelled);
      while(travel>1e-6&&!bolt.done){
        const step=Math.min(3,travel),previous={x:bolt.x,y:bolt.y},next={x:bolt.x+bolt.vector[0]*step,y:bolt.y+bolt.vector[1]*step};
        if(!canStand(next.x,next.y)||!clearLine(previous,next)){
          if(bolt.spellId==='crescent_return'&&bolt.leg===0){bolt.leg=1;bolt.vector=[-bolt.vector[0],-bolt.vector[1]];bolt.range=bolt.travelled;bolt.travelled=0;break;}
          bolt.done=true;break;
        }
        bolt.x=next.x;bolt.y=next.y;bolt.travelled+=step;travel-=step;
        if(bolt.enemy){
          if(segmentDistance(hero,previous,next)<=bolt.radius+4&&clearLine(previous,hero)){
            applyEnemyHit(monsters.find(monster=>monster.id===bolt.spec.ownerId),{id:bolt.id,kind:'projectile',name:bolt.spellId,origin:previous,damage:bolt.spec.damage,parryable:bolt.spec.parryable,spent:false});bolt.done=true;
            if(currentSession!==session)return;
          }
          continue;
        }
        for(const monster of [...monsters]){
          const key=monster.id+':'+bolt.leg;if(bolt.hits.has(key)||segmentDistance(monster,previous,next)>bolt.radius+6||!clearLine(bolt.origin,monster))continue;
          if(damageMonster(monster,bolt.spec.damage,bolt.origin,{...bolt.spec,force:bolt.spec.force||0,impactKind:'projectile'},undefined)){
            bolt.hits.add(key);changed();
            const hitsInLeg=[...bolt.hits].filter(key=>key.endsWith(':'+bolt.leg)).length;
            if(hitsInLeg>=bolt.pierce){if(bolt.spellId==='crescent_return'&&bolt.leg===0){bolt.leg=1;bolt.vector=[-bolt.vector[0],-bolt.vector[1]];bolt.range=bolt.travelled;bolt.travelled=0;}else bolt.done=true;break;}
          }
        }
      }
      if(!bolt.done&&bolt.travelled>=bolt.range-1e-6){
        if(bolt.spellId==='crescent_return'&&bolt.leg===0){bolt.leg=1;bolt.vector=[-bolt.vector[0],-bolt.vector[1]];bolt.travelled=0;}else bolt.done=true;
      }
    }
    missiles=missiles.filter(bolt=>!bolt.done);
  }
  function zoneContains(zone,monster){
    if(zone.shape==='wall')return segmentDistance(monster,zone.a,zone.b)<=zone.radius+5;
    if(zone.shape==='trail')return segmentDistance(monster,zone.origin,zone.end)<=zone.radius+5;
    return distance(zone,monster)<=zone.radius+5;
  }
  function zoneBurst(zone,freeze=false){
    let hit=false;for(const monster of [...monsters])if(zoneContains(zone,monster)&&clearLine(zone.origin,monster))hit=damageMonster(monster,zone.spec.damage,zone.origin,{...zone.spec,freezeDuration:freeze?zone.spec.duration:0})||hit;
    if(hit)changed();
  }
  function updateZones(dt){
    for(const zone of zones){
      zone.age+=dt;if(zone.follow){zone.x=hero.x;zone.y=hero.y;zone.origin={x:hero.x,y:hero.y};}
      if(zone.shape==='lightning'){
        if(!zone.triggered&&zone.age>=zone.delay){zone.triggered=true;zoneBurst(zone);}
        continue;
      }
      if(zone.shape==='trap'){
        if(zone.triggered){zone.duration=Math.min(zone.duration,zone.age+.42-dt);continue;}
        if(zone.age>=zone.armTime&&monsters.some(monster=>distance(zone,monster)<=clamp(Number(zone.spec.triggerRadius)||23,8,60)&&clearLine(zone.origin,monster))){zone.triggered=true;zone.duration=zone.age+.42;zoneBurst(zone);}
        continue;
      }
      if(!['orbit','vortex','wall','trail'].includes(zone.shape))continue;
      if(zone.shape==='vortex')for(const monster of monsters)if(zoneContains(zone,monster)&&clearLine(zone.origin,monster))push(monster,zone.x-monster.x,zone.y-monster.y,clamp(Number(zone.spec.force)||22,0,60)*dt*1.5);
      zone.timer-=dt;if(zone.timer>0)continue;zone.timer+=zone.tick;
      let hit=false;for(const monster of [...monsters])if(zoneContains(zone,monster)&&clearLine(zone.origin,monster))hit=damageMonster(monster,zone.spec.damage,zone.origin,{...zone.spec,force:0,interrupt:zone.shape==='orbit',impactKind:'field'})||hit;
      if(hit)changed();
    }
    zones=zones.filter(zone=>zone.age<zone.duration);
  }
  function updateMagic(dt){
    // Fixed small work bounds keep lag spikes from tunnelling missiles or
    // replaying an unbounded number of delayed pulses in a single frame.
    for(let remaining=Math.min(.4,Math.max(0,dt));remaining>1e-7;){const step=Math.min(.025,remaining);tickStatuses(step);updateMissiles(step);updateZones(step);remaining-=step;}
    if(effects.length>160)effects=effects.slice(-160);
  }
  function actors(camera={x:0,y:0}){
    return [...camps.filter(camp=>!camp.hidden).map(camp=>({combat:true,kind:'camp',camp,sort:camp.y-6})),...monsters.map(monster=>({combat:true,kind:'monster',monster,sort:monster.y}))]
      .filter(entry=>{const actor=entry.camp||entry.monster;return actor.x>camera.x-90&&actor.x<camera.x+474&&actor.y>camera.y-20&&actor.y<camera.y+336;});
  }
  function magicFlare(ctx,x,y,color,size=1){ctx.fillStyle=color;ctx.fillRect(Math.round(x)-size,Math.round(y),size*2+1,1);ctx.fillRect(Math.round(x),Math.round(y)-size,1,size*2+1);}
  function drawZoneFlourish(ctx,zone,camera){
    const x=zone.x-camera.x,y=zone.y-camera.y,age=zone.age,ratio=Math.min(1,age/.3),color=zone.spec.color||'#cfe3b3',angle=Math.atan2(zone.vector[1],zone.vector[0]);
    ctx.strokeStyle=color;ctx.lineWidth=1;ctx.fillStyle=color;
    if(zone.spellId==='petal_sweep'){
      for(let trail=0;trail<3;trail++){const r=zone.radius*(.45+ratio*.45)-trail*4,start=angle-1.6+ratio*.7;ctx.beginPath();ctx.arc(x,y-10,r,start,start+1.3+ratio*.9);ctx.stroke();}
      for(let petal=0;petal<7;petal++){const a=angle-1.3+petal*.4+age*2,r=zone.radius*(.3+ratio*.7);ctx.fillRect(Math.round(x+Math.cos(a)*r),Math.round(y-10+Math.sin(a)*r),3,2);}
    }else if(zone.spellId==='briar_bind'){
      for(let vine=0;vine<7;vine++){const a=vine*Math.PI*2/7,r=zone.radius*(.3+ratio*.6),px=x+Math.cos(a)*r,py=y+Math.sin(a)*r;ctx.beginPath();ctx.moveTo(x+Math.cos(a)*r*.45,y+Math.sin(a)*r*.45);ctx.lineTo(px-3,py+2);ctx.lineTo(px+2,py-5-ratio*4);ctx.lineTo(px+5,py-2);ctx.stroke();}
    }else if(zone.spellId==='healing_bloom'){
      const r=6+ratio*8;for(let petal=0;petal<5;petal++){const a=petal*Math.PI*2/5+age*.8,px=x+Math.cos(a)*r,py=y-16+Math.sin(a)*r;ctx.beginPath();ctx.ellipse(px,py,4,7,a,0,Math.PI*2);ctx.stroke();}magicFlare(ctx,x,y-16,'#f2edb7',3);
      for(let mote=0;mote<6;mote++){const a=mote*2.4;magicFlare(ctx,x+Math.cos(a)*20,y-8-Math.sin(a)*6-age*25,color,1);}
    }else if(zone.spellId==='stormy_gust'){
      for(let stream=-1;stream<=1;stream++){const travel=age*90,px=x+zone.vector[0]*travel-zone.vector[1]*stream*10,py=y-10+zone.vector[1]*travel+zone.vector[0]*stream*10;ctx.beginPath();ctx.arc(px,py,8+ratio*6,angle-.85,angle+.85);ctx.stroke();magicFlare(ctx,px+zone.vector[0]*10,py+zone.vector[1]*10,'#e9f5e4');}
    }else if(zone.spellId==='gale_step'){
      for(let ribbon=-1;ribbon<=1;ribbon++){ctx.beginPath();ctx.moveTo(x-zone.vector[1]*ribbon*4,y-11+zone.vector[0]*ribbon*4);ctx.lineTo(zone.end.x-camera.x-zone.vector[1]*ribbon*4,zone.end.y-camera.y-11+zone.vector[0]*ribbon*4);ctx.stroke();}
    }else if(zone.spellId==='cyclone'){
      for(let mote=0;mote<10;mote++){const a=mote*2.4-age*5,r=zone.radius*(.2+.7*((mote*.17+age*.35)%1));magicFlare(ctx,x+Math.cos(a)*r,y-5+Math.sin(a)*r*.65,color);}
    }else if(zone.spellId==='thunder_call'&&!zone.triggered){
      for(let spark=0;spark<4;spark++){const a=spark*Math.PI/2+age*2,px=x+Math.cos(a)*zone.radius*.7,py=y+Math.sin(a)*zone.radius*.7;magicFlare(ctx,px,py,'#f2edb7',2);}
    }else if(zone.spellId==='ice_ring'){
      const r=zone.radius*(.35+ratio*.65);for(let shard=0;shard<10;shard++){const a=shard*Math.PI/5,px=x+Math.cos(a)*r,py=y+Math.sin(a)*r;ctx.beginPath();ctx.moveTo(px-3,py);ctx.lineTo(px,py-10-ratio*4);ctx.lineTo(px+3,py);ctx.closePath();ctx.stroke();}
    }else if(zone.spellId==='winter_ward'){
      const r=17+Math.sin(age*4);ctx.beginPath();for(let point=0;point<7;point++){const a=point*Math.PI/3-Math.PI/6,px=x+Math.cos(a)*r,py=y-18+Math.sin(a)*r;(point?ctx.lineTo:ctx.moveTo).call(ctx,px,py);}ctx.stroke();magicFlare(ctx,x,y-18,color,3);
    }else if(zone.spellId==='flame_fan'){
      for(let flame=0;flame<9;flame++){const a=angle-(zone.spec.arc||1.1)+(zone.spec.arc||1.1)*2*flame/8,r=zone.radius*(.25+ratio*.65),px=x+Math.cos(a)*r,py=y-7+Math.sin(a)*r;ctx.beginPath();ctx.moveTo(x+Math.cos(a)*r*.4,y-7+Math.sin(a)*r*.4);ctx.lineTo(px-2,py+2);ctx.lineTo(px+Math.cos(a)*7,py+Math.sin(a)*7-3);ctx.stroke();magicFlare(ctx,px,py,'#ffe1a6');}
    }else if(zone.spellId==='cinder_trap'){
      ctx.beginPath();for(let point=0;point<=5;point++){const a=point*Math.PI*4/5-Math.PI/2,px=x+Math.cos(a)*zone.radius*.5,py=y+Math.sin(a)*zone.radius*.5;(point?ctx.lineTo:ctx.moveTo).call(ctx,px,py);}ctx.stroke();
      if(zone.triggered)for(let ember=0;ember<8;ember++){const a=ember*Math.PI/4,travel=10+(zone.age-(zone.duration-.42))*75;magicFlare(ctx,x+Math.cos(a)*travel,y+Math.sin(a)*travel,color,2);}
    }else if(zone.spellId==='phoenix_pulse'){
      const r=zone.radius*(.35+ratio*.65);for(let feather=0;feather<12;feather++){const a=feather*Math.PI/6,px=x+Math.cos(a)*r,py=y-10+Math.sin(a)*r;ctx.beginPath();ctx.moveTo(px-Math.cos(a)*10,py-Math.sin(a)*10);ctx.lineTo(px-Math.sin(a)*3,py+Math.cos(a)*3);ctx.lineTo(px+Math.cos(a)*5,py+Math.sin(a)*5);ctx.stroke();magicFlare(ctx,px,py,'#ffe0ad');}
    }
  }
  function drawSpellGround(ctx,camera){
    for(const zone of zones){
      const x=zone.x-camera.x,y=zone.y-camera.y,origin={x:zone.origin.x-camera.x,y:zone.origin.y-camera.y},fade=Math.min(1,(zone.duration-zone.age)*3),color=zone.spec.color||'#cfe3b3';
      ctx.globalAlpha=.6*fade;ctx.strokeStyle=color;ctx.fillStyle=color+'25';ctx.lineWidth=1;
      if(['line','trail'].includes(zone.shape)){
        const end={x:zone.end.x-camera.x,y:zone.end.y-camera.y},dx=-zone.vector[1]*zone.radius,dy=zone.vector[0]*zone.radius;
        ctx.beginPath();ctx.moveTo(origin.x+dx,origin.y+dy);ctx.lineTo(end.x+dx,end.y+dy);ctx.lineTo(end.x-dx,end.y-dy);ctx.lineTo(origin.x-dx,origin.y-dy);ctx.closePath();ctx.fill();ctx.stroke();
        if(zone.shape==='trail')for(let part=0;part<8;part++){const t=(part+.5)/8,px=origin.x+(end.x-origin.x)*t,py=origin.y+(end.y-origin.y)*t;ctx.beginPath();ctx.moveTo(px-3,py+3);ctx.lineTo(px+3,py-3);ctx.moveTo(px-3,py-3);ctx.lineTo(px+3,py+3);ctx.stroke();}
      }else if(zone.shape==='wall'){
        const a={x:zone.a.x-camera.x,y:zone.a.y-camera.y},b={x:zone.b.x-camera.x,y:zone.b.y-camera.y};ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.lineWidth=1;
        const width=distance(a,b),count=Math.max(1,Math.floor(width/7));
        for(let part=0;part<=count;part++){const t=part/count,px=a.x+(b.x-a.x)*t,py=a.y+(b.y-a.y)*t;ctx.beginPath();ctx.moveTo(px-3,py+2);ctx.lineTo(px,py-7);ctx.lineTo(px+3,py+1);ctx.stroke();}
      }else if(zone.shape==='cone'){
        const angle=Math.atan2(zone.vector[1],zone.vector[0]),arc=Number(zone.spec.arc)||1.2,radius=zone.radius*(.35+Math.min(1,zone.age/.22)*.65);
        ctx.beginPath();ctx.moveTo(x,y);ctx.arc(x,y,radius,angle-arc,angle+arc);ctx.closePath();ctx.fill();ctx.stroke();
      }else{
        const pending=zone.shape==='lightning'&&!zone.triggered,trap=zone.shape==='trap',radius=trap?zone.radius*.65:zone.radius;
        ctx.beginPath();ctx.ellipse(x,y,radius,zone.shape==='ring'&&zone.spellId==='winter_ward'?radius*.35:radius,0,0,Math.PI*2);ctx.fill();ctx.stroke();
        if(pending||trap){
          ctx.beginPath();ctx.moveTo(x-5,y);ctx.lineTo(x+5,y);ctx.moveTo(x,y-5);ctx.lineTo(x,y+5);ctx.stroke();
          ctx.beginPath();ctx.arc(x,y,Math.max(6,radius-4),-Math.PI/2,-Math.PI/2+Math.PI*2*Math.min(1,zone.age/(zone.delay||zone.armTime||.45)));ctx.stroke();
        }
        if(zone.shape==='vortex')for(let ring=0;ring<3;ring++){ctx.beginPath();ctx.arc(x,y,9+ring*12+(zone.age*15)%9,zone.age*4+ring,zone.age*4+ring+3.2);ctx.stroke();}
        if(zone.shape==='orbit')for(let petal=0;petal<5;petal++){const angle=zone.age*4+petal*Math.PI*2/5,px=x+Math.cos(angle)*zone.radius,py=y+Math.sin(angle)*zone.radius;ctx.fillStyle=color;ctx.fillRect(Math.round(px)-2,Math.round(py)-4,4,8);}
      }
      drawZoneFlourish(ctx,zone,camera);
    }
    ctx.globalAlpha=1;
    for(const monster of monsters){
      const x=Math.round(monster.x-camera.x),y=Math.round(monster.y-camera.y);
      if(monster.frozen>0){ctx.strokeStyle='#b6e7f1';ctx.fillStyle='#b6e7f133';ctx.beginPath();ctx.moveTo(x-9,y+2);ctx.lineTo(x-7,y-21);ctx.lineTo(x,y-28);ctx.lineTo(x+7,y-21);ctx.lineTo(x+9,y+2);ctx.closePath();ctx.fill();ctx.stroke();}
      else if(monster.slowTime>0){ctx.strokeStyle='#b6e7f1';ctx.beginPath();ctx.ellipse(x,y+1,9,3,0,0,Math.PI*2);ctx.stroke();}
      if(monster.burning){ctx.fillStyle='#edaa71';for(let flame=0;flame<3;flame++)ctx.fillRect(x-6+flame*5,y-5-Math.round(Math.sin(time*8+flame)*3),2,5);}
    }
  }
  function drawEffects(ctx,camera={x:0,y:0}){
    if(!activeArea())return;
    ctx.save();
    for(const bolt of missiles){
      const x=Math.round(bolt.x-camera.x),y=Math.round(bolt.y-camera.y-10),color=bolt.spec.color||'#e3dba4';ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=2;
      ctx.globalAlpha=.4;ctx.beginPath();ctx.moveTo(x-bolt.vector[0]*14,y-bolt.vector[1]*14);ctx.lineTo(x,y);ctx.stroke();ctx.globalAlpha=1;magicFlare(ctx,x-bolt.vector[0]*9+Math.sin(time*19)*3,y-bolt.vector[1]*9+Math.cos(time*19)*3,color);magicFlare(ctx,x,y,'#fff2cf',2);
      if(bolt.spellId==='crescent_return'){const angle=time*12;ctx.beginPath();ctx.arc(x,y,bolt.radius,angle,angle+Math.PI*1.3);ctx.stroke();}
      else if(bolt.spellId==='rose_lance'){ctx.beginPath();ctx.moveTo(x-bolt.vector[0]*7,y-bolt.vector[1]*7);ctx.lineTo(x+bolt.vector[0]*8,y+bolt.vector[1]*8);ctx.stroke();}
      else if(bolt.spellId==='frost_shard'){ctx.beginPath();ctx.moveTo(x+bolt.vector[0]*8,y+bolt.vector[1]*8);ctx.lineTo(x-bolt.vector[1]*4,y+bolt.vector[0]*4);ctx.lineTo(x-bolt.vector[0]*5,y-bolt.vector[1]*5);ctx.lineTo(x+bolt.vector[1]*4,y-bolt.vector[0]*4);ctx.closePath();ctx.fill();}
      else{ctx.fillRect(x-3,y-3,6,6);ctx.fillStyle='#fff4d1';ctx.fillRect(x-1,y-1,2,2);}
    }
    for(const zone of zones)if(zone.shape==='lightning'&&zone.triggered){
      const x=Math.round(zone.x-camera.x),y=Math.round(zone.y-camera.y);ctx.strokeStyle=zone.spec.color||'#f3e7ad';ctx.lineWidth=2;ctx.globalAlpha=Math.max(0,1-(zone.age-zone.delay)/.42);ctx.beginPath();ctx.moveTo(x-7,y-100);ctx.lineTo(x+5,y-70);ctx.lineTo(x-4,y-70);ctx.lineTo(x+8,y-40);ctx.lineTo(x,y-40);ctx.lineTo(x,y);ctx.stroke();ctx.strokeStyle='#fff7d5';ctx.lineWidth=1;ctx.stroke();magicFlare(ctx,x,y,'#fff7d5',6);
    }
    ctx.restore();
  }
  function drawGround(ctx,camera={x:0,y:0}){
    if(!activeArea())return;
    ctx.save();
    for(const monster of monsters){
      const data=monster.attackData;if(!data||!['windup','active'].includes(monster.attackState))continue;
      const active=monster.attackState==='active',origin={x:data.origin.x-camera.x,y:data.origin.y-camera.y},aim={x:data.aim.x-camera.x,y:data.aim.y-camera.y};
      ctx.strokeStyle=data.color||(active?'#ffe2b5':'#eaa382');ctx.fillStyle=data.color?data.color+(active?'66':'2e'):active?'#d86b4d66':'#b653492e';ctx.lineWidth=1.5;
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
        if(monster.type==='medusa'){ctx.fillStyle=data.color;ctx.font='8px monospace';ctx.textAlign='center';ctx.fillText({gaze:'GAZE · LOOK AWAY',serpent_lash:'SERPENT LASH',crystal_trap:'CRYSTAL MARK'}[data.name]||'',monster.x-camera.x,monster.y-camera.y-35);}
      }
    }
    for(const monster of monsters)if(monster.bound>0){
      const x=monster.x-camera.x,y=monster.y-camera.y;ctx.strokeStyle='#b2cd83';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(x,y,10,4,0,0,Math.PI*2);ctx.moveTo(x-7,y+2);ctx.lineTo(x-6,y-9);ctx.moveTo(x+7,y+2);ctx.lineTo(x+5,y-10);ctx.stroke();
    }
    drawSpellGround(ctx,camera);ctx.restore();
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
    const monster=entry.monster,acting=['windup','active','recovery'].includes(monster.attackState),frames=framesFor(monster.profile,monster.direction,acting);
    const spriteImage=profileImage(monster.profile);if(!spriteImage||!frames.length)return;
    const data=monster.attackData,anticipation=monster.attackState==='windup'?clamp(1-monster.attackTimer/(data?.warning||.65),0,1):0;
    const recovery=monster.attackState==='recovery'?clamp(1-monster.attackTimer/(data?.recovery||.9),0,1):0;
    const pose=monster.attackState==='windup'?anticipation*.3:monster.attackState==='active'?.3+.6*(1-monster.striking/(monster.strikeDuration||.22)):.9+recovery*.1;
    const frame=acting?Math.min(frames.length-1,Math.floor(pose*frames.length)):
      Math.floor(time*(monster.walking?(monster.profile.fps||5):Math.min(3,monster.profile.fps||3))+monster.phase)%frames.length;
    const [sx,sy,w,h]=frames[frame];
    const scale=monster.profile.scale||1,anchor=monster.profile.anchor||[w/2,h];
    const vector=data?.direction||DIRECTIONS[monster.direction]||DIRECTIONS.down;
    const bob=monster.walking?Math.round(Math.sin(time*10+monster.phase)):Math.round(Math.sin(time*3+monster.phase)*.65);
    const crouch=Math.round(anticipation*2+(monster.recoil>0?Math.sin(monster.recoil/.14*Math.PI)*2:0)),lean=Math.round(vector[0]*(anticipation*-3+(monster.attackState==='active'?3:0)));
    ctx.fillStyle='#21392855';ctx.beginPath();ctx.ellipse(x,y+1,Math.min(10,w*scale*.26),2,0,0,Math.PI*2);ctx.fill();
    ctx.save();
    if(monster.stun>0)ctx.globalAlpha=Math.floor(time*25)%2?.5:1;
    ctx.translate(x,y);if(monster.face<0&&!monster.profile.directions&&monster.profile.flip!==false)ctx.scale(-1,1);
    ctx.drawImage(spriteImage,sx,sy,w,h,Math.round(-anchor[0]*scale+lean),Math.round(-anchor[1]*scale+bob+crouch),Math.round(w*scale),Math.max(1,Math.round(h*scale-crouch)));
    ctx.restore();
  }
  function target(attacker=hero){
    if(!attacker||!activeArea())return null;
    const choices=[...monsters.filter(m=>distance(m,attacker)<55).map(monster=>({...monster,kind:'monster',d:distance(monster,attacker)})),
      ...camps.filter(c=>!c.hidden&&!c.cleared&&distance(c,attacker)<72).map(camp=>({...camp,kind:'camp',d:distance(camp,attacker)+8}))];
    return choices.sort((a,b)=>a.d-b.d)[0]||null;
  }
  function bossTarget(attacker=hero){
    if(!attacker||!activeArea())return null;
    const monster=monsters.filter(actor=>actor.boss).sort((a,b)=>distance(a,attacker)-distance(b,attacker))[0];
    return monster?{...monster,kind:'monster',d:distance(monster,attacker),attackName:monster.attackData?.name||null,warningRemaining:monster.attackState==='windup'?monster.attackTimer:0}:null;
  }
  function hint(attacker=hero){const selected=target(attacker);return selected?.kind==='camp'?'Attack · Break '+selected.name:null;}
  function hud(ctx,camera){
    if(!activeArea())return;
    ctx.save();ctx.textAlign='left';ctx.font='8px monospace';
    for(const monster of monsters)if(monster.hp<monster.maxHp||distance(monster,hero)<55){
      const profile=monster.profile,frame=framesFor(profile)[0];
      const height=(profile.bodyHeight||profile.anchor?.[1]||frame?.[3]||24)*(profile.scale||1);
      const x=Math.round(monster.x-camera.x)-9,y=Math.round(monster.y-camera.y-height)-5;
      if(x<-18||x>384||y<-4||y>256)continue;
      ctx.fillStyle='#17352de8';ctx.fillRect(x-1,y-1,20,5);ctx.fillStyle='#cd7160';ctx.fillRect(x,y,18*monster.hp/monster.maxHp,3);
    }
    for(const effect of effects){
      const x=Math.round(effect.x-camera.x),y=Math.round(effect.y-camera.y-Math.max(0,1-effect.life/.65)*8);
      ctx.fillStyle=effect.color;ctx.fillText(effect.text,x-effect.text.length*2.3,y);
    }
    ctx.restore();
  }
  function snapshot(){
    return {camps:camps.map(({id,key,hp,cleared,spawned,totalSpawns,maxAlive})=>({id,key,hp,cleared,spawned,totalSpawns,maxAlive})),
      monsters:monsters.map(({id,campKey,x,y,hp,maxHp,type,name,attackState,attackKind,attackTimer,attackData,bound,stun,slow,slowTime,burning,frozen,poise,poiseMax,boss,phaseTwo})=>({id,campKey,x,y,hp,maxHp,type,name,attackState,attackKind,
        attackAim:attackData?{...attackData.aim}:null,attackName:attackData?.name||null,attackReach:attackData?.reach||0,attackWarning:attackData?.warning||0,attackParryable:attackData?.parryable??true,attackColor:attackData?.color||null,
        warningRemaining:attackState==='windup'?attackTimer:0,bound,stun,slow:slow||0,slowTime:slowTime||0,burn:burning?.remaining||0,frozen:frozen||0,poise,poiseMax,boss,phaseTwo})),
      missiles:missiles.map(({id,spellId,x,y,leg,travelled,range,enemy})=>({id,spellId,x,y,leg,travelled,range,enemy})),
      projectiles:missiles.map(({id,spellId,x,y,leg,travelled,range,enemy})=>({id,spellId,x,y,leg,travelled,range,enemy})),
      zones:zones.map(({id,spellId,x,y,age,duration,triggered,shape})=>({id,spellId,x,y,age,duration,triggered,shape})),invulnerable,target:target()};
  }
  global.BloomCombat={configure,enter,update,actors,draw,drawGround,drawEffects,swing,cast,hud,hint,snapshot,target,bossTarget,slowNearby,footprint,blockingCamp,isCleared,reconcileCamps,hurt:()=>invulnerable>0};
})(window);
