'use strict';
const assert=require('node:assert/strict');
const {game}=require('./helpers/arpg-game.cjs');
function openGround(){const g=game();g.evaluate("area.objects=[];hero.x=280;hero.y=180;motion.reset({camera:true});hero.face='down'");return g;}
const endpoints=[];
for(const fps of [20,30,60,120]){
 const g=openGround();g.evaluate('keys.arrowright=true');
 for(let i=0;i<=fps;i++)g.evaluate('frame('+(1000+i*1000/fps)+')');
 endpoints.push(g.evaluate('hero.x'));assert(g.evaluate('hero.x')>340,'movement advances in actual animation frame loop');
 g.evaluate('keys.arrowright=false');const stop=g.evaluate('hero.x');g.evaluate('frame(2100)');assert.equal(g.evaluate('hero.x'),stop,'release stops movement without drift');
 g.evaluate('render()');assert(g.evaluate('cam.x')>=0&&g.evaluate('cam.x')<=256,'render camera remains within map');
}
assert(Math.max(...endpoints)-Math.min(...endpoints)<.04,'bounded frame stepping keeps travel consistent at20/30/60/120Hz');
{
 const g=openGround(),r=g.evaluate;
 r("keys.arrowright=true;keyAction(' ')");assert.equal(r('hero.face'),'right','same-frame direction plus attack uses new aim');assert.equal(r('heroAnim.status().phase'),'anticipation');
 r('keys.arrowright=false;keys[" "]=true');g.step(34);assert(r('state.hp')===5);assert(r('abilities.snapshot().stamina')<80,'held attack chains several paid strikes');
 r('resetInput()');const attacks=r('heroAnim.status().activationId');g.step(40);assert(!r('heroAnim.busy()'),'releasing hold finishes the short pending chain');
 r("progression.learn(state,'petal_sweep');heroAnim.reset();keyAction(' ')");g.step(3);r("keyAction('1')");assert(r('abilities.snapshot().queued'),'spell input is briefly buffered during attack anticipation');assert.equal(r('abilities.snapshot().stamina')<100,true);g.step(6);assert(r('abilities.snapshot().casting'),'queued spell starts as attack recovery opens');g.step(12);assert(!r('abilities.snapshot().casting'),'cast recovery completes');
 r("keyAction('k')");const before=r('JSON.stringify(abilities.snapshot().cooldowns)');g.step(20);assert.equal(r('JSON.stringify(abilities.snapshot().cooldowns)'),before,'tree freezes spell cooldowns');r("keyAction('escape')");
}
{
 const g=openGround(),r=g.evaluate;
 r("progression.grant(state,'spell-integration:xp',2000);for(const node of window.BloomSpells.spells)progression.learn(state,node.id);progression.upgrade(state,'healing_bloom');progression.upgrade(state,'healing_bloom');progression.equip(state,'healing_bloom',4);state.hp=1;keyAction('5')");assert.equal(r('state.hp'),1,'healing fifth-slot spell has a real windup');g.step(10);assert.equal(r('state.hp'),5,'rank-three healing applies on release');assert.equal(r('state.food'),3,'spells do not consume noodles');
 r("progression.equip(state,'winter_ward',4);abilities.reset({refill:true});keyAction('5')");g.step(10);assert.equal(r('abilities.snapshot().wardCharges'),2,'ward charges reach actual defensive engine');
 r("progression.equip(state,'gale_step',4);abilities.reset({refill:true});hero.x=180;hero.y=150;hero.face='right';area.objects=[{hit:[201,0,1,480]}];keyAction('5')");g.step(20);assert(r('hero.x')<198,'Gale Step cannot cross a one-pixel fence');
 r("progression.equip(state,'seed_bolt',4);abilities.reset({refill:true});keyAction('5');enter('lavenderway')");g.step(12);assert.equal(r('combat.snapshot().missiles.length'),0,'scene transition cancels unreleased spell');
 r('save()');const saved=JSON.parse(g.storage['blooming-world-v05']);assert.equal(saved.progression.ranks.healing_bloom,3);assert.equal(saved.progression.loadout.length,5);assert.equal(saved.inventory.apple,7);
}
console.log('PASS: actual20–120Hz frame pacing/movement, immediate aiming, held combos, recovery spell buffer, pause guards, fifth-slot rank-three healing/wards, fence-safe Gale Step and lifecycle/save persistence.');
