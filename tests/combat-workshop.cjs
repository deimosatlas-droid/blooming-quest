'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../dist'),approved=JSON.parse(fs.readFileSync(path.join(root,'assets/road-monsters.json')));
const advance=(api,seconds)=>{for(let age=0;age<seconds-1e-8;age+=1/60)api.update(Math.min(1/60,seconds-age));};
function fixture({type='orc',health=14,hero={x:114,y:100,face:'left'},state={},kind='road',boss=false,total=1,defend=()=>({})}={}){
  const C={window:{},Math,JSON};vm.createContext(C);
  for(const file of ['spell-catalog.js','progression.js','combat.js','abilities.js','hero-animation.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),C,{filename:file});
  const combat=C.window.BloomCombat,p=C.window.BloomProgression,abilities=C.window.BloomAbilities,animation=C.window.BloomHero,rewards=[],events={saves:0,clears:0,defences:0};
  p.migrate(state);combat.configure({image:{},layout:{...approved,types:{...approved.types,[type]:{...approved.types[type],health}}}});
  const camp={id:'one',x:200,y:100,monster:type,totalSpawns:total,maxAlive:1,spawnEvery:1,health:4,spawnPoints:[[100,100]],boss,hidden:boss,monsterHealth:health,rewardXp:boss?120:35};
  const area={id:'workshop',kind,safe:false,camps:[camp]},config={id:area.id,hero,state,canStand:()=>true,canStrike:()=>true,onProgress:()=>events.saves++,onReward:reward=>{rewards.push(reward);p.grant(state,reward.id,reward.xp);},onClear:()=>events.clears++,defend:attack=>{events.defences++;return defend(attack);}};
  combat.enter(area,config);return{C,combat,p,abilities,animation,hero,state,area,config,rewards,events};
}
const first=run=>run.combat.snapshot().monsters[0];
function until(run,test,limit=5){for(let age=0;age<limit;age+=1/60){if(test())return;run.combat.update(1/60);}assert(test(),'encounter reached the expected state');}
{
  const run=fixture();until(run,()=>first(run)?.attackState==='windup');assert(first(run).warningRemaining>=.45&&first(run).warningRemaining<=.49,'orc has a readable faster species-specific tell');
  const draws=[],ctx=new Proxy({drawImage:(...args)=>draws.push(args)},{get:(obj,key)=>obj[key]??(()=>{})}),entry=()=>run.combat.actors().find(actor=>actor.kind==='monster');
  run.combat.draw(entry(),ctx,{x:0,y:0});const before=JSON.stringify(draws.at(-1));advance(run.combat,.24);run.combat.draw(entry(),ctx,{x:0,y:0});assert.notEqual(JSON.stringify(draws.at(-1)),before,'warning pose changes rather than holding one standing frame');
  const attacker={x:first(run).x+12,y:first(run).y,face:'left'};run.combat.swing(attacker,{activationId:'light-1',damage:1,knockback:0.1});assert.equal(first(run).attackState,'windup','an ordinary hit does not unconditionally cancel a warning');
  run.combat.swing(attacker,{activationId:'light-2',damage:1,knockback:0.1});assert(first(run).stun>0,'poise break creates a punishable stagger');
  advance(run.combat,.25);until(run,()=>first(run)?.attackState==='windup');const aim=first(run).attackAim;
  run.combat.swing({x:first(run).x+12,y:first(run).y,face:'left'},{activationId:'light-3',damage:1,knockback:0.1});assert.equal(first(run).attackState,'windup','stagger resistance prevents a perpetual reset chain');assert.deepEqual(first(run).attackAim,aim);
}
{
  const run=fixture({defend:()=>({blocked:true,parried:true})});until(run,()=>run.events.defences>0);assert(first(run).stun>.8);
  let elapsed=0;while(first(run).attackState==='recovery'&&elapsed<2){run.combat.update(1/60);elapsed+=1/60;}
  assert(elapsed>=.85&&elapsed<=1,'parry stun and recovery overlap instead of adding to1.8 seconds');
}
{
  const run=fixture(),a=run.abilities,p=run.p;let canCast=false,casts=0;
  p.learn(run.state,'petal_sweep');a.configure({getState:()=>run.state,getHero:()=>run.hero,canAct:()=>true,canSkill:()=>canCast,onCast:()=>casts++});a.reset({refill:true});
  assert.equal(a.requestSkill(0),false);advance(a,.30);canCast=true;a.update(1/60);assert(a.snapshot().casting,'a first-frame spell input survives until the basic attack cancel window');advance(a,.5);assert.equal(casts,1);
  a.reset({refill:true});for(let age=0;age<.2;age+=.02)a.update(.02,{moving:true,running:true,attacking:true});assert.equal(a.snapshot().stamina,100,'attack-locked sprint intent costs no stamina');
  advance(a,8);assert(a.requestSkill(0));assert.equal(a.snapshot().stamina,74);a.release();assert.equal(a.snapshot().stamina,100,'menu/lifecycle release refunds an unreleased spell');assert.equal(a.snapshot().cooldowns.petal_sweep,0);advance(a,1);assert.equal(casts,1,'refunded spell cannot fire late');
  assert(a.requestSkill(0));advance(a,.2);const paid=a.snapshot().stamina,cooldown=a.snapshot().cooldowns.petal_sweep;a.release();assert.equal(a.snapshot().stamina,paid,'released magic stays paid');assert.equal(a.snapshot().cooldowns.petal_sweep,cooldown,'released cooldown cannot be removed by menus');
}
{
  const run=fixture(),hero=run.hero,animation=run.animation;let paid=0;
  animation.requestAttack(hero);animation.requestAttack(hero);animation.requestAttack(hero);assert.equal(paid,0);
  animation.update(.37,{hero,onQueuedAttack:()=>{paid++;return true;}});assert.equal(paid,1,'queued attack payment occurs at its start');animation.reset();assert.equal(paid,1,'discarding a queued move does not spend its resources');
}
{
  const quick=fixture({total:8,hero:{x:180,y:100,face:'right'}});advance(quick.combat,.4);quick.combat.swing(quick.hero,{activationId:'clear',damage:4});
  assert.equal(quick.p.snapshot(quick.state).xp,131,'quick completion grants the entire encounter XP budget');assert.equal(quick.rewards.filter(reward=>reward.kind==='monster').length,0,'cleanup does not fabricate kills');
  quick.combat.enter(quick.area,quick.config);assert.equal(quick.p.snapshot(quick.state).xp,131,'mastery credit is saved before reload');
  const state={clearedCamps:{'workshop:one':true},campProgress:{'workshop:one':{hp:0,spawned:1,cleared:true}},defeatedMonsters:{'workshop:one:monster:1':true},progression:{xp:47,claimedRewards:{'camp:workshop:one':true,'monster:workshop:one:monster:1':true}}};
  const old=fixture({state,total:8});assert.equal(old.p.snapshot(state).xp,131,'an old cleared save receives only its missing wave credit');old.combat.enter(old.area,old.config);assert.equal(old.p.snapshot(state).xp,131,'old-save reconciliation is one-time');
  const distant={clearedCamps:{'elsewhere:one':true},progression:{xp:35,claimedRewards:{'camp:elsewhere:one':true}}},records={elsewhere:{kind:'road',camps:[{id:'one',totalSpawns:8}]}};
  assert.equal(quick.combat.reconcileCamps(records,distant).length,1);assert.equal(quick.p.snapshot(distant).xp,131,'global load reconciliation restores distant cleared-road upgrades immediately');assert.equal(quick.combat.reconcileCamps(records,distant).length,0,'global reconciliation also remains one-time');
}
{
  const run=fixture({kind:'dungeon',boss:true,health:16});until(run,()=>first(run)?.attackState==='windup');assert(first(run).boss);assert.equal(run.combat.actors().filter(actor=>actor.kind==='camp').length,0,'boss controller is not a hittable scenery camp');
  run.combat.cast('ice_ring',{id:'boss-control',damage:0,duration:2});assert(first(run).frozen>0&&first(run).frozen<=.91,'boss shortens control effects with visible resistance');
  run.combat.swing({x:first(run).x+12,y:first(run).y,face:'left'},{activationId:'boss-half',damage:9,knockback:.1});advance(run.combat,1.2);until(run,()=>first(run)?.phaseTwo);assert.equal(first(run).type,'orc','boss uses the existing approved profile without a new art variant');
  run.combat.swing({x:first(run).x+12,y:first(run).y,face:'left'},{activationId:'boss-finish',damage:20,knockback:.1});assert.equal(first(run),undefined);assert.equal(run.events.clears,1);assert(run.combat.snapshot().camps[0].cleared);assert(run.rewards.some(reward=>reward.kind==='boss'&&reward.xp===120));
}
{
  const run=fixture({total:0});for(const id of ['cyclone','thorn_dance','thorn_wall','thunder_call'])run.combat.cast(id,{id:'empty-'+id});advance(run.combat,6);assert.equal(run.events.saves,0,'empty persistent fields never notify a durable progress change');
  for(const kind of ['home','town','interior','ferry']){run.combat.enter({...run.area,kind,safe:true},run.config);assert.equal(run.combat.cast('ember_bolt',{id:kind}).scheduled,false);assert.equal(run.combat.snapshot().monsters.length,0);}
}
console.log('PASS: animated species tells, poise/stagger resistance, overlapping parry clocks, reliable spell buffer and cancellation refunds, locked-sprint resource safety, deferred combo payment, complete/reconciled camp XP, approved-art dungeon boss phases/control resistance and zero-change field persistence.');
