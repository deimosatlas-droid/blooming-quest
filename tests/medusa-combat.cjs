'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../dist'),read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const legacy=read('assets/road-monsters.json');
const regional=read('assets/lavender-creatures.json');
const regionalTypes=['lavender_imp','violet_brambleback','amethyst_wisp','medusa'];
const near=(actual,expected,label)=>assert(Math.abs(actual-expected)<.025,label+': '+actual+' versus '+expected);
const plain=value=>JSON.parse(JSON.stringify(value));
function fixture({type='medusa',hero={x:180,y:100,face:'left'},state={},canStand=()=>true,canStrike=()=>true,defend,onClear,regionalImage={id:'regional'},legacyImage={id:'legacy'},legacyLayout=legacy,campExtra={}}={}){
 const C={window:{},Math,JSON};vm.createContext(C);
 for(const file of ['spell-catalog.js','progression.js','abilities.js','combat.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),C,{filename:file});
 const combat=C.window.BloomCombat,abilities=C.window.BloomAbilities,progression=C.window.BloomProgression;
 const story=type==='medusa',camp={id:'one',x:100,y:100,monster:type,totalSpawns:1,maxAlive:1,spawnPoints:[[100,100]],health:4,leash:1000,
  ...(story?{guardianId:'medusa',storyGuardian:true,boss:true,hidden:true,clearOnDefeat:true,monsterHealth:34,monsterDamage:2,monsterSpeed:25,rewardXp:1}:{}),...campExtra};
 const key='medusa-test:one';state.campProgress??={};state.campProgress[key]??={hp:4,spawned:1,cleared:false};
 const events={damage:0,defences:[],rewards:[],clears:[],feedback:[],saves:0};progression.migrate(state);
 abilities.configure({getState:()=>state,getHero:()=>hero,canAct:()=>true,canStand});abilities.reset({refill:true});
 combat.configure({image:legacyImage,layout:legacyLayout,regionalImage,regionalLayout:regional});
 const area={id:'medusa-test',kind:'dungeon',safe:false,camps:[camp]},config={id:area.id,hero,state,canStand,canStrike,
  defend:attack=>{events.defences.push(plain(attack));return defend?defend(attack):abilities.defend(attack);},
  onDamage:amount=>events.damage+=amount,onReward:reward=>{events.rewards.push(reward);progression.grant(state,reward.id,reward.xp);},
  onProgress:()=>events.saves++,onClear:actor=>{events.clears.push(plain(actor));onClear?.(actor);},onFeedback:event=>events.feedback.push(event)};
 combat.enter(area,config);return{C,combat,abilities,progression,hero,state,area,camp,config,events,legacyImage,regionalImage};
}
const first=run=>run.combat.snapshot().monsters[0];
function tick(run,dt=.01,input={}){run.abilities.update(dt,input);run.combat.update(dt);}
function advance(run,seconds,input={}){for(let age=0;age<seconds-1e-8;age+=.01)tick(run,Math.min(.01,seconds-age),input);}
function until(run,test,label,seconds=10,step){for(let age=0;age<seconds;age+=.01){if(test())return;step?.();tick(run);}assert(test(),label);}
function attack(run,name,seconds=12){
 until(run,()=>first(run)?.attackState==='windup'&&first(run)?.attackName===name,'reached '+name,seconds,()=>{
  const monster=first(run);if(monster&&monster.attackState!=='windup'){run.hero.x=monster.x+40;run.hero.y=monster.y;run.hero.face='right';}
 });return first(run);
}
function nextAttack(run){
 until(run,()=>first(run)?.attackState!=='windup','previous warning resolved');
 until(run,()=>first(run)?.attackState==='windup','next warning begins',12,()=>{
  const monster=first(run);if(monster&&monster.attackState!=='windup'){run.hero.x=monster.x+40;run.hero.y=monster.y;run.hero.face='right';}
 });return first(run);
}
function context(){
 const calls=[];const ctx=new Proxy({drawImage:(...args)=>calls.push(['drawImage',...args])},{get:(obj,key)=>obj[key]??((...args)=>calls.push([key,...args])),set:(obj,key,value)=>{calls.push(['set',key,value]);obj[key]=value;return true;}});
 return{ctx,calls};
}

// Every original species still draws the existing atlas; the approved regional
// profiles win over duplicate legacy names and draw their separate sheet.
assert.equal(Object.keys(legacy.types).length,16);
assert.deepEqual(Object.keys(regional.types).sort(),[...regionalTypes].sort());
for(const type of [...Object.keys(legacy.types),...regionalTypes]){
 const run=fixture({type}),entry=run.combat.actors().find(actor=>actor.kind==='monster'),draw=context();assert(entry,type+' spawns with approved art');
 run.combat.draw(entry,draw.ctx,{x:0,y:0});const call=draw.calls.find(call=>call[0]==='drawImage');assert(call,type+' draws a visible source sprite');
 assert.equal(call[1],regionalTypes.includes(type)?run.regionalImage:run.legacyImage,type+' selects the correct image');
 const profile=(regionalTypes.includes(type)?regional:legacy).types[type],sourceRect=call.slice(2,6);
 assert([...Object.values(profile.directions||{}).flat(),...(profile.frames||[])].some(frame=>JSON.stringify(frame)===JSON.stringify(sourceRect)),type+' uses one of its authored facings');
}
{
 const wrong={...legacy,types:{...legacy.types,lavender_imp:{...legacy.types.orc,name:'Wrong atlas',health:99}}};
 const run=fixture({type:'lavender_imp',legacyLayout:wrong});assert.equal(first(run).maxHp,regional.types.lavender_imp.health,'regional profile takes priority over duplicate old-atlas keys');
}
{
 const chosen=fixture({type:'orc',campExtra:{regionalMonster:'lavender_imp'}});assert.equal(first(chosen).type,'lavender_imp','camp metadata selects its approved regional species');
 const fallback=fixture({type:'orc',campExtra:{regionalMonster:'not-installed'}});assert.equal(first(fallback).type,'orc','unknown regional metadata preserves the existing legacy species');
}
for(const type of regionalTypes){
 const p=regional.types[type];assert.equal(p.sheet,'lavender-creatures');assert.equal(Object.keys(p.directions).length,4);assert(Object.values(p.directions).every(frames=>frames.length===1),'the four facings are not advertised as invented attack frames');assert.match(p.artStatus,/runtime-articulated/);
 const run=fixture({type,hero:{x:122,y:100,face:'right'}});until(run,()=>first(run)?.attackState==='windup',type+' shows a readable warning');
 const entry=()=>run.combat.actors().find(actor=>actor.kind==='monster'),draw=context();run.combat.draw(entry(),draw.ctx,{x:0,y:0});const before=draw.calls.findLast(call=>call[0]==='drawImage');
 advance(run,first(run).warningRemaining*.55);run.combat.draw(entry(),draw.ctx,{x:0,y:0});const after=draw.calls.findLast(call=>call[0]==='drawImage');
 assert.deepEqual(after.slice(2,6),before.slice(2,6),type+' retains its actual drawn facing during anticipation');
 assert.notDeepEqual(after.slice(6),before.slice(6),type+' animates the runtime windup pose');
 until(run,()=>first(run)?.attackState==='recovery',type+' reaches visible recovery');run.combat.draw(entry(),draw.ctx,{x:0,y:0});const recovered=draw.calls.findLast(call=>call[0]==='drawImage');assert.deepEqual(recovered.slice(2,6),before.slice(2,6));assert.notDeepEqual(recovered.slice(6),after.slice(6),type+' returns from its windup into a runtime recovery pose');
}
{
 const run=fixture({regionalImage:null});assert.equal(first(run),undefined,'a missing regional image cannot spawn invisible approved creatures');
 const old=fixture({type:'orc',regionalImage:null});assert(first(old),'the existing atlas works without the optional regional atlas');
}

// The three attacks lock their warning targets and expose distinct, measurable
// ranges, timings and colours. The gaze tests the hero's facing at resolution.
{
 const run=fixture();until(run,()=>first(run)?.attackName==='gaze','initial distant gaze');const gaze=first(run);near(gaze.attackWarning,1.15,'gaze warning');near(gaze.attackReach,110,'gaze range');assert.equal(gaze.attackParryable,false);
 assert.equal(run.combat.target(),null,'ordinary melee targeting remains short range');assert.equal(run.combat.bossTarget()?.type,'medusa','boss HUD can retain the encounter beyond melee range');
 const aim=plain(gaze.attackAim);run.hero.y+=24;advance(run,.3);assert.deepEqual(plain(first(run).attackAim),aim,'gaze aim never follows the hero during its warning');
 const lash=nextAttack(run);assert.equal(lash.attackName,'serpent_lash');near(lash.attackWarning,.7,'lash warning');near(lash.attackReach,65,'lash lunge');assert.equal(lash.attackParryable,true);
 const crystal=nextAttack(run);assert.equal(crystal.attackName,'crystal_trap');near(crystal.attackWarning,.95,'crystal warning');assert.equal(crystal.attackParryable,false);
 assert.equal(new Set([gaze.attackColor,lash.attackColor,crystal.attackColor]).size,3,'each danger has a distinct telegraph colour');
 const frozen=plain(crystal.attackAim),before=run.events.damage;run.hero.x+=85;run.hero.y+=80;advance(run,.6);assert.deepEqual(plain(first(run).attackAim),frozen,'crystal mark remains at the original target position');advance(run,.6);assert.equal(run.events.damage,before,'moving out of the frozen crystal target avoids damage');
}
{
 const run=fixture();attack(run,'gaze');run.hero.face='right';advance(run,1.4);assert.equal(run.events.damage,0,'looking away avoids the gaze while standing in its cone');assert.equal(run.events.defences.length,0,'an avoided gaze does not spend defence resources');
 const hit=fixture();attack(hit,'gaze');hit.hero.face='left';advance(hit,1.3);assert.equal(hit.events.damage,2,'facing Medusa inside the fixed cone takes real damage');assert.equal(hit.events.defences[0].parryable,false,'gaze cannot be parried');assert(!Object.keys(hit.hero).some(key=>/stun|petrif|bound/i.test(key)),'gaze never silently locks the phone movement controls');
}
{
 const guarded=fixture();attack(guarded,'gaze');guarded.hero.face='left';advance(guarded,1.08);guarded.abilities.update(.01,{guarding:true});advance(guarded,.13,{guarding:true});assert.equal(guarded.events.damage,2,'guarding does not parry an explicitly unparryable gaze');
 const dodged=fixture();attack(dodged,'gaze');dodged.hero.face='left';advance(dodged,1.08);assert(dodged.abilities.requestDodge(0,1));advance(dodged,.15);assert.equal(dodged.events.damage,0,'actual dodge invulnerability counters the gaze');assert(dodged.events.feedback.some(event=>event.kind==='dodge'),'successful dodge produces readable feedback');
 const parried=fixture();attack(parried,'serpent_lash');parried.hero.face='left';advance(parried,.63);parried.abilities.update(.01,{guarding:true});advance(parried,.2,{guarding:true});assert.equal(parried.events.damage,0,'a timed directional guard parries the serpent lash');assert(first(parried).stun>.65,'parry opens a real recovery window');assert(parried.events.feedback.some(event=>event.kind==='parry'));
}
{
 let wall=false;const canStand=(x,y)=>!wall||x<121||x>130,canStrike=(from,to)=>!wall||Math.max(from.x,to.x)<121||Math.min(from.x,to.x)>130;
 const run=fixture({canStand,canStrike});attack(run,'serpent_lash');run.hero.x=150;wall=true;const before=run.events.damage;advance(run,1);assert(first(run).x<121,'serpent lunge respects an obstacle introduced after its warning');assert.equal(run.events.damage,before,'the lash never hits through that obstacle');
}
{
 const run=fixture();attack(run,'gaze');const m=first(run);run.combat.swing({x:m.x+12,y:m.y,face:'left'},{activationId:'phase-two',damage:18,knockback:.1});
 until(run,()=>first(run)?.phaseTwo,'half health enters phase two',12,()=>{const m=first(run);run.hero.x=m.x+40;run.hero.y=m.y;run.hero.face='right';});
 attack(run,'gaze');const names=[];
 for(let index=0;index<5;index++){const m=first(run);names.push(m.attackName);near(m.attackWarning,({gaze:1.15,serpent_lash:.7,crystal_trap:.95}[m.attackName])*.82,'phase two warning '+m.attackName);if(index<4)nextAttack(run);}
 assert.deepEqual(names,['gaze','serpent_lash','crystal_trap','serpent_lash','gaze'],'phase two has an extra lash in a predictable local cycle');
}

// The wisp fires a travelling missile, rather than dealing an invisible remote
// circle hit; its committed vector, collision and defence remain meaningful.
{
 const run=fixture({type:'amethyst_wisp'});until(run,()=>run.combat.snapshot().projectiles.some(bolt=>bolt.enemy),'wisp launches an enemy missile');assert.equal(run.events.damage,0,'a wisp cannot hit before its missile travels');
 const before=plain(run.combat.snapshot().projectiles.find(bolt=>bolt.enemy));run.hero.y+=80;advance(run,.12);const after=run.combat.snapshot().projectiles.find(bolt=>bolt.enemy);assert(after&&after.x>before.x,'wisp missile travels through the game');near(after.y,before.y,'wisp projectile does not track a dodging target');advance(run,1.2);assert.equal(run.events.damage,0,'moving off its fixed trajectory avoids the missile');
 const hit=fixture({type:'amethyst_wisp'});until(hit,()=>hit.events.damage>0,'travelling wisp missile eventually reaches the hero');assert.equal(hit.events.damage,1);assert.equal(hit.events.defences.length,1,'wisp damage passes through the ordinary defence hook');
 let blocked=false;const wall=fixture({type:'amethyst_wisp',canStand:x=>!blocked||x<132,canStrike:(from,to)=>!blocked||Math.max(from.x,to.x)<132});until(wall,()=>wall.combat.snapshot().projectiles.some(bolt=>bolt.enemy),'wall fixture launches a missile');blocked=true;advance(wall,1.2);assert.equal(wall.events.damage,0,'wisp missile cannot pass a solid collision boundary');assert.equal(wall.combat.snapshot().projectiles.filter(bolt=>bolt.enemy).length,0);
}
{
 const run=fixture({type:'amethyst_wisp',campExtra:{totalSpawns:2,maxAlive:2},state:{campProgress:{'medusa-test:one':{hp:4,spawned:2,cleared:false}}}});
 until(run,()=>run.combat.snapshot().projectiles.filter(bolt=>bolt.enemy).length===2,'two live wisps launch simultaneous real missiles');
 let damageCallbacks=0;const home={id:'home',kind:'home',safe:true,camps:[]};
 const returnHome=()=>{damageCallbacks++;run.combat.enter(home,{id:'home',hero:run.hero,state:run.state,onDamage:returnHome});};run.config.onDamage=returnHome;
 until(run,()=>damageCallbacks>0,'the first missile triggers the actual scene-changing damage callback');
 assert.equal(damageCallbacks,1,'the old second missile cannot deal a late hit after damage enters safe home');
 advance(run,.3);assert.equal(damageCallbacks,1);assert.equal(run.combat.snapshot().monsters.length,0);assert.equal(run.combat.snapshot().projectiles.length,0,'scene entry clears the complete old encounter');
}
{
 const run=fixture({type:'lavender_imp',hero:{x:220,y:100,face:'left'}}),normal=fixture({type:'lavender_imp',hero:{x:220,y:100,face:'left'}});advance(run,.55);advance(normal,.55);
 const before=first(run).x;assert.equal(run.combat.slowNearby({x:before,y:first(run).y,radius:30,duration:.5,amount:.55}),1,'parry blessing affects a nearby actual enemy');
 assert.equal(first(run).slow,.55);assert(first(run).slowTime>.49);const moved=first(run).x,normalBefore=first(normal).x;advance(run,.2);advance(normal,.2);const slowedDistance=first(run).x-moved,normalDistance=first(normal).x-normalBefore;
 near(normalDistance,regional.types.lavender_imp.speed*.2,'the control enemy actually pursues at full speed');near(slowedDistance/normalDistance,.45,'the blessing reduces actual pursuit to45 percent');advance(run,.4);assert.equal(first(run).slow,0,'blessing expires without a permanent movement penalty');
 assert.equal(run.combat.slowNearby({x:-1000,y:-1000,radius:20,duration:2,amount:.55}),0,'a distant actor receives no blessing slow');
}

// Story encounter cleanup preserves IDs and exposes through the actual campaign
// callback. The only core XP belongs to explicit, one-time purification.
{
 const C={window:{},Math,JSON};vm.createContext(C);for(const file of ['spell-catalog.js','progression.js','combat.js','guardian-campaign.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),C,{filename:file});
 const combat=C.window.BloomCombat,campaign=C.window.BloomCampaign,progression=C.window.BloomProgression,state={hp:100,journey:{stage:7},campaign:{guardians:{medusa:{status:'bound',battleStarted:true}}}},hero={x:288,y:210,face:'up'},combatRewards=[],storyRewards=[],clears=[];
 const maps=read('fixed-maps.json'),world=read('world.json'),atlas=read('assets/world-v05.json');
 campaign.configure({getState:()=>state,getArea:()=>campaign.arenaId,getHero:()=>hero,approvedMedusaAsset:true,onReward:reward=>{storyRewards.push(reward);progression.grant(state,reward.id,reward.xp);}});campaign.install(maps,world,atlas);
 combat.configure({image:{},layout:legacy,regionalImage:{},regionalLayout:regional});const area=maps[campaign.arenaId],camp=area.camps[0];assert(camp?.storyGuardian,'actual campaign installs the approved story encounter');
 const config={id:campaign.arenaId,hero,state,canStand:()=>true,canStrike:()=>true,onReward:reward=>combatRewards.push(reward),onClear:actor=>{clears.push(actor);campaign.onCampClear(actor,campaign.arenaId);}};
 combat.enter(area,config);for(let age=0;age<.6;age+=.01)combat.update(.01);const m=combat.snapshot().monsters[0];assert(m,'actual campaign guardian spawns');Object.assign(hero,{x:m.x,y:m.y+20,face:'up'});
 combat.swing(hero,{activationId:'story-defeat',damage:40,knockback:.1});assert.equal(combat.snapshot().monsters.length,0);assert.equal(clears.length,1);assert.equal(clears[0].guardianId,'medusa');assert.equal(state.campaign.guardians.medusa.status,'exposed','defeat exposes the heart through the actual campaign callback');
 assert.equal(state.campaign.powers.medusa_blessing,undefined,'defeat does not automatically purify or grant the blessing');assert.deepEqual(combatRewards,[],'story combat grants no standard kill or camp XP');assert.deepEqual(storyRewards,[],'heart exposure grants no purification XP');
 const key=campaign.arenaId+':'+camp.id;assert(state.defeatedMonsters[key+':monster:1']);assert(state.clearedCamps[key]);assert(state.campProgress[key].cleared);assert.equal(state.campMastery[key],undefined,'story encounter has no standard camp mastery credit');
 const copy=plain(state);combat.enter({...area,camps:[camp]},{...config,state:copy});for(let age=0;age<2;age+=.02)combat.update(.02);assert.equal(combat.snapshot().monsters.length,0,'a saved story defeat never respawns');assert.deepEqual(combatRewards,[],'reloading a cleared guardian grants no mastery backfill');
 assert.deepEqual(plain(combat.reconcileCamps({[campaign.arenaId]:{...area,camps:[camp]}},copy,reward=>combatRewards.push(reward))),[],'global camp reconciliation skips story encounters');assert.equal(copy.campMastery[key],undefined);
 Object.assign(hero,{x:288,y:208});assert(campaign.purify().ok,'purification remains an explicit action after actual combat');assert.equal(storyRewards.length,1);assert.equal(storyRewards[0].xp,180);assert.equal(state.campaign.guardians.medusa.status,'purified');assert(state.campaign.powers.medusa_blessing);
 campaign.purify();campaign.install(maps,world,atlas);assert.equal(storyRewards.length,1,'repeated purification cannot duplicate the core reward');assert.equal(maps[campaign.arenaId].camps.length,0,'the purified guardian never reinstalls a combat camp');
}
(async()=>{
 const {fixture:fullGame,settle}=require('./helpers/full-game.cjs'),g=fullGame();await settle();assert(g.evaluate('ready'),g.find('loadtext').textContent);g.find('start').click();
 g.evaluate("enter('lavenderway');hero.x=424;hero.y=320;hero.face='up';heroAnim.reset();resetInput()");assert(g.evaluate('canStand(hero.x,hero.y)'),'the integration position is actual passable road');g.step(36);
 const actor=g.evaluate("combat.snapshot().monsters.find(monster=>monster.campKey==='lavenderway:camp-1')");assert.equal(actor?.type,'lavender_imp','the actual fully booted Lavenderway camp spawns its authored regional species');
 g.evaluate('render()');const runtimeImage=g.evaluate('creaturePicture');assert(g.draws.some(args=>args[0]===runtimeImage),'the actual renderer draws that encounter from the loaded approved regional PNG');
 console.log('PASS: approved regional atlas and all sixteen retained species, runtime directional poses, Medusa gaze/look-away/lash/crystal warnings and phase cycle, actual dodge/parry/collision, travelling wisp missiles, temporary parry slow, zero-extra-XP durable story defeat/purification and full-game regional loading/spawn/render.');
})().catch(error=>{console.error(error);process.exitCode=1;});
