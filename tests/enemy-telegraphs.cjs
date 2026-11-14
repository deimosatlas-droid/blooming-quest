'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../dist/combat.js'),'utf8');
const profile={name:'Approved test monster',frames:[[0,0,24,24]],attackFrames:[[24,0,24,24],[48,0,24,24]],health:5,speed:20,damage:1};
function runtime({kind='cone',hero={x:114,y:100,face:'left'},state={},campHealth=6,canStand=()=>true,canStrike=()=>true,defend}={}){
  const C={window:{},Math,JSON};vm.createContext(C);vm.runInContext(source,C);const combat=C.window.BloomCombat;
  const events={damage:0,defences:[],rewards:[],saved:[]};
  combat.configure({image:{},layout:{types:{existing:{...profile,attackKind:kind}}}});
  const camp={id:'one',x:200,y:100,type:'wood',monster:'existing',health:campHealth,maxAlive:1,totalSpawns:1,spawnPoints:[[100,100]]};
  const area={id:'warning-road',kind:'road',safe:false,camps:[camp]};
  const config={id:area.id,hero,state,canStand,canStrike,onDamage:n=>{events.damage+=n;},
    onReward:event=>{events.rewards.push(event);events.saved.push(JSON.parse(JSON.stringify(state)));},
    defend:attack=>{events.defences.push(attack);return defend?.(attack)||{};}};
  combat.enter(area,config);
  return {combat,hero,state,events,area,config};
}
function advance(combat,seconds){for(let t=0;t<seconds-.00001;t+=.02)combat.update(Math.min(.02,seconds-t));}
function until(combat,predicate,limit=5){for(let t=0;t<limit;t+=.02){if(predicate())return;combat.update(.02);}assert(predicate(),'expected combat state reached within '+limit+' seconds');}
const monster=run=>run.combat.snapshot().monsters[0];
function warning(run){until(run.combat,()=>monster(run)?.attackState==='windup');return monster(run);}

// All attack styles announce a locked shape before damage, so repositioning works.
for(const kind of ['cone','lunge','circle']){
  const run=runtime({kind});const first=warning(run),aim={...first.attackAim};
  assert(first.warningRemaining>=.64,kind+' gives at least a readable .65-second warning');
  assert.equal(run.events.damage,0,kind+' contact/windup has not caused damage');
  run.hero.x=250;run.hero.y=250;advance(run.combat,.4);
  assert.equal(JSON.stringify(monster(run).attackAim),JSON.stringify(aim),kind+' never tracks a dodging player during warning');
  advance(run.combat,.7);assert.equal(run.events.damage,0,kind+' can be escaped before the active window');
}

// A cone is frontal, and attacks only connect once during their short active phase.
{
  const run=runtime();warning(run);until(run.combat,()=>run.events.damage>0);
  assert.equal(run.events.damage,1);const packet=run.events.defences[0];
  assert.equal(packet.parryable,true);assert.equal(packet.heavy,false);assert.match(packet.id,/^enemy:/);
  advance(run.combat,.18);assert.equal(run.events.damage,1,'one attack activation damages only once');
  until(run.combat,()=>monster(run)?.attackState==='windup');
  run.hero.x=monster(run).x-20;advance(run.combat,.9);
  assert.equal(run.events.damage,1,'moving behind the frozen frontal cone avoids a second attack');
}

// Defence hooks are evaluated at impact rather than during the warning.
for(const response of [{blocked:true},{parried:true}]){
  const run=runtime({defend:()=>response});warning(run);assert.equal(run.events.defences.length,0);
  until(run.combat,()=>run.events.defences.length>0);assert.equal(run.events.damage,0);
  if(response.parried){assert(monster(run).stun>.8,'parry creates a real punish window');assert.equal(monster(run).attackState,'recovery');assert.equal(monster(run).attackAim,null,'parry cancels the pending attack');}
  advance(run.combat,.1);assert.equal(run.events.defences.length,1,'the same blocked/parried attack does not repeatedly drain defence');
}
{
  const run=runtime({kind:'circle',defend:()=>({blocked:true})});warning(run);until(run.combat,()=>run.events.defences.length>0);
  assert.equal(run.events.defences[0].parryable,false,'ground circles explicitly require movement rather than parrying');
  assert.equal(run.events.defences[0].heavy,true);
}

// Walls block both attack activation and a hit if a barrier appears after warning.
{
  let barrier=false;const run=runtime({canStrike:()=>!barrier});warning(run);barrier=true;advance(run.combat,1);
  assert.equal(run.events.damage,0,'an intervening fence blocks the active attack');
  assert.equal(run.events.defences.length,0,'blocked scenery does not consume the player guard');
}
{
  const run=runtime({canStrike:()=>false});advance(run.combat,5);
  assert.equal(run.events.damage,0);assert.equal(monster(run).attackState,'idle','monsters cannot start a warning through a wall');
}

// Lunge movement sweeps collision in two-pixel increments and stops at thin walls.
{
  const run=runtime({kind:'lunge',hero:{x:140,y:100,face:'left'},canStand:(x)=>x<117||x>121});
  warning(run);advance(run.combat,1.1);
  assert(monster(run).x<117,'the warned charge cannot tunnel through a thin collider');
  assert.equal(run.events.damage,0,'a charge stopped by scenery cannot reach its distant target');
}

// Skill effects use the same approved actors, occlusion, collision and activation IDs.
{
  const run=runtime({hero:{x:80,y:100,face:'right'}});until(run.combat,()=>monster(run));
  const initial=monster(run).hp;
  assert.equal(run.combat.cast('petal_sweep',{id:'one-sweep'}).hits,1);
  assert.equal(monster(run).hp,initial-2,'Petal Sweep is a two-damage crowd cut');
  assert.equal(run.combat.cast('petal_sweep',{id:'one-sweep'}).hits,0,'the same cast activation is not reapplied');
  assert.equal(monster(run).hp,initial-2);
  const heldAt={x:monster(run).x,y:monster(run).y};
  assert.equal(run.combat.cast('briar_bind',{id:'one-bind',duration:4.5}).hits,1);
  assert(monster(run).bound>=4.49);advance(run.combat,1);
  assert.equal(monster(run).x,heldAt.x);assert.equal(monster(run).y,heldAt.y,'bound monsters do not chase Amaal');
  advance(run.combat,3.6);assert.equal(monster(run).bound,0,'roots expire in simulation time');
}
{
  let barrier=false;const run=runtime({hero:{x:80,y:100,face:'right'},canStrike:()=>!barrier});until(run.combat,()=>monster(run));barrier=true;
  for(const kind of ['petal_sweep','briar_bind','stormy_gust'])assert.equal(run.combat.cast(kind,{id:kind}).hits,0,kind+' cannot pass through a fence');
  assert.equal(monster(run).hp,5);assert.equal(monster(run).bound,0);
}
{
  const run=runtime({hero:{x:80,y:100,face:'right'},canStand:(x)=>x<112||x>115});until(run.combat,()=>monster(run));
  assert.equal(run.combat.cast('stormy_gust',{id:'gust'}).hits,1);assert.equal(monster(run).hp,4);
  assert(monster(run).x<112,'gust knockback does not teleport through thin scenery');
}

// XP belongs to actual kills and one cleared camp, not camp-cleanup removals.
{
  const run=runtime({hero:{x:80,y:100,face:'right'}});until(run.combat,()=>monster(run));const id=monster(run).id;
  run.combat.swing(run.hero,{activationId:'kill',damage:5});
  assert.equal(run.events.rewards.length,1);assert.equal(run.events.rewards[0].id,'monster:'+id);assert.equal(run.events.rewards[0].xp,12);
  assert.equal(run.events.saved[0].defeatedMonsters[id],true,'kill progress is present before its XP callback can save');
  run.hero.x=180;run.combat.swing(run.hero,{activationId:'camp',damage:6});
  assert.equal(run.events.rewards.length,2);assert.equal(run.events.rewards[1].id,'camp:warning-road:one');assert.equal(run.events.rewards[1].xp,35);
  assert.equal(run.events.saved[1].clearedCamps['warning-road:one'],true,'camp progress is present before its XP callback can save');
  run.combat.enter(run.area,run.config);advance(run.combat,5);
  assert.equal(run.events.rewards.length,2,'reloading a cleared encounter cannot reward again');
}
{
  const run=runtime({hero:{x:180,y:100,face:'right'}});until(run.combat,()=>monster(run));
  run.combat.swing(run.hero,{activationId:'camp-only',damage:6});
  assert.equal(run.combat.snapshot().monsters.length,0);assert.equal(run.events.rewards.length,1,'clearing removes living monsters without awarding cleanup XP');
  assert.equal(run.events.rewards[0].kind,'camp');
}

// Towns, home, interiors and ferry journeys remain safe even if skill input arrives.
for(const kind of ['home','town','interior','ferry']){
  const run=runtime();run.combat.enter({...run.area,kind,safe:true},run.config);
  for(const spell of ['petal_sweep','briar_bind','stormy_gust'])assert.equal(run.combat.cast(spell,{id:'safe'}).hits,0);
  advance(run.combat,5);assert.equal(run.events.damage,0);assert.equal(run.events.rewards.length,0);
}
console.log('PASS: three frozen warned attack shapes, active-only/deduplicated impact, guard/parry hooks, scenery occlusion, swept lunge/gust collision, all three real skills, root expiry, stable kill/camp XP without cleanup rewards, safe scenes.');
