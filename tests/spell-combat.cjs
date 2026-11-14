'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../dist');
const SPELL_IDS=['petal_sweep','rose_lance','crescent_return','thorn_dance','briar_bind','seed_bolt','healing_bloom','thorn_wall','stormy_gust','gale_step','cyclone','thunder_call','frost_shard','ice_ring','winter_ward','glacial_path','ember_bolt','flame_fan','cinder_trap','phoenix_pulse'];
function runtime({positions=[[120,120]],health=20,canStand=()=>true,canStrike=()=>true}={}){
 const sandbox={window:{},Math,JSON};vm.createContext(sandbox);
 for(const file of['spell-catalog.js','combat.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),sandbox,{filename:file});
 const combat=sandbox.window.BloomCombat,spells=sandbox.window.BloomSpells,hero={x:80,y:120,face:'right'},events={damage:0,rewards:[],saves:[]},state={campProgress:{},clearedCamps:{},defeatedMonsters:{}};
 const camps=positions.map((at,i)=>({id:'camp-'+(i+1),x:200+i*70,y:60,health:20,monster:'approved',maxAlive:1,totalSpawns:1,spawnPoints:[at]}));
 for(const camp of camps)state.campProgress['spell-road:'+camp.id]={hp:20,spawned:1,cleared:false};
 combat.configure({image:{},layout:{types:{approved:{name:'Approved test monster',health,speed:10,damage:1,frames:[[0,0,24,24]],attackFrames:[[24,0,24,24]],attackKind:'cone'}}}});
 const area={id:'spell-road',kind:'road',safe:false,camps},config={id:area.id,hero,state,canStand,canStrike,drawSprite(){},onDamage:value=>events.damage+=value,onReward:reward=>{events.rewards.push(reward);events.saves.push(JSON.parse(JSON.stringify(state)));}};
 combat.enter(area,config);let serial=0;
 const cast=(id,overrides={})=>combat.cast(id,{...spells.resolve(id,overrides.rank||1),id:'test-cast-'+(++serial),...overrides});
 return{combat,spells,hero,events,state,area,config,cast};
}
function advance(combat,seconds){for(let time=0;time<seconds-1e-8;time+=.02)combat.update(Math.min(.02,seconds-time));}
const monsters=run=>run.combat.snapshot().monsters,totalHP=run=>monsters(run).reduce((sum,actor)=>sum+actor.hp,0);
const first=run=>monsters(run)[0];

// Every listed spell is a real resolved ability, not an empty UI entry.
{
 const run=runtime();assert.equal(run.spells.spells.length,20);assert.deepEqual([...run.spells.spells.map(spell=>spell.id)].sort(),[...SPELL_IDS].sort());
 for(const id of SPELL_IDS){const resolved=run.spells.resolve(id,1);assert(resolved&&resolved.id===id,id+' resolves a real spell definition');}
 const before=totalHP(run);assert.equal(run.combat.cast('missing-spell',{id:'bad'}).hits,0);assert.equal(totalHP(run),before,'unknown IDs cannot produce combat effects');
}

// Close strikes, gusts, roots, lines and rings produce their distinct advertised effects.
for(const id of['petal_sweep','gale_step','flame_fan','ice_ring','phoenix_pulse']){
 const run=runtime(),before=totalHP(run);run.cast(id);advance(run.combat,.1);
 assert(totalHP(run)<before,id+' damages an enemy within its own attack shape');
}
{
 const run=runtime();run.cast('briar_bind',{duration:2.5});assert(first(run).bound>2.4,'Briar Bind really stops pursuit');const x=first(run).x;advance(run.combat,1);assert.equal(first(run).x,x,'roots hold position rather than just showing text');advance(run.combat,1.6);assert.equal(first(run).bound,0,'root duration expires');
}
{
 const run=runtime(),x=first(run).x;run.cast('stormy_gust');assert(first(run).x>x+10,'Stormy’s Gust physically pushes enemies away');
}
{
 const run=runtime();run.cast('ice_ring');assert((first(run).frozen||first(run).bound)>0,'Ice Ring applies a real freeze');
}

// Ranged spells travel over time and cannot cause instant remote damage.
for(const id of['seed_bolt','frost_shard','ember_bolt','rose_lance','crescent_return']){
 const run=runtime(),before=totalHP(run);run.cast(id);assert.equal(totalHP(run),before,id+' does not hit before its projectile travels');assert(run.combat.snapshot().missiles.length>0,id+' launches a visible missile');advance(run.combat,.7);assert(totalHP(run)<before,id+' projectile eventually reaches its target');
}
{
 const run=runtime({positions:[[115,120],[145,120]]});run.cast('rose_lance');advance(run.combat,.65);assert(monsters(run).every(monster=>monster.hp<20),'Rose Lance pierces multiple enemies on the same line');
}
{
 const run=runtime();run.cast('crescent_return',{damage:1,range:100});advance(run.combat,1.5);assert(first(run).hp<=18,'the returning crescent can hit once outbound and once returning');assert(first(run).hp>=18,'each leg is deduplicated while the crescent overlaps an enemy');
}
{
 const run=runtime();run.cast('frost_shard');advance(run.combat,.35);assert((first(run).slow||0)>0,'Frost Shard slows the actual enemy');
}
{
 const run=runtime();run.cast('ember_bolt');advance(run.combat,.35);assert((first(run).burn||0)>0,'Ember Bolt applies a timed burn');const afterImpact=first(run).hp;advance(run.combat,1.5);assert(first(run).hp<afterImpact,'burn continues dealing damage after the initial bolt');
}

// Persistent spells retain a bounded field and resolve actual timed attacks.
for(const id of['thorn_dance','thorn_wall','cyclone','thunder_call','glacial_path','cinder_trap']){
 const run=runtime(id==='thunder_call'?{positions:[[176,120]]}:{}),before=totalHP(run);run.cast(id);assert(run.combat.snapshot().zones.some(zone=>zone.spellId===id),id+' creates its own visible timed field');advance(run.combat,2.4);assert(totalHP(run)<before,id+' field hits a valid nearby enemy');advance(run.combat,12.1);assert.equal(run.combat.snapshot().zones.length,0,id+' field eventually expires');
}
{
 const run=runtime({positions:[[176,120]]});run.cast('thunder_call');assert.equal(totalHP(run),20,'Thunder Call warns before the lightning arrives');advance(run.combat,.15);assert.equal(totalHP(run),20,'its warned strike has an actual delay');advance(run.combat,1);assert(totalHP(run)<20,'the delayed lightning resolves after its warning');
}
{
 const run=runtime();run.cast('thorn_wall');advance(run.combat,.25);assert((first(run).slow||0)>0,'thorn wall hinders enemies instead of creating permanent map collision');
}

// Upgrading a learned spell changes the actual attack rather than only its label.
{
 const novice=runtime(),master=runtime();novice.cast('seed_bolt',{rank:1});master.cast('seed_bolt',{rank:3});advance(novice.combat,.4);advance(master.combat,.4);assert(first(master).hp<first(novice).hp,'Seed Bolt rank III really deals more damage');assert(first(master).bound>first(novice).bound,'its upgraded root really lasts longer');
}

// The combat module does not invent healing or shield damage; the abilities
// controller owns the two player buffs and the healing part of Phoenix Pulse.
for(const id of['healing_bloom','winter_ward']){
 const run=runtime(),before=totalHP(run);run.cast(id);advance(run.combat,.3);assert.equal(totalHP(run),before,id+' never harms nearby targets or camps');
}

// Scenery occludes every damaging spell, not just ordinary sword attacks.
for(const id of SPELL_IDS.filter(id=>!['healing_bloom','winter_ward'].includes(id))){
 const run=runtime({canStrike:()=>false}),before=totalHP(run);run.cast(id);advance(run.combat,3);assert.equal(totalHP(run),before,id+' cannot damage through a fence');assert.equal(first(run).bound,0,id+' cannot apply roots through a fence');
}
{
 const run=runtime({positions:[[150,120]],canStand:x=>x<112||x>116});run.cast('seed_bolt');advance(run.combat,1);assert.equal(first(run).hp,20,'a fast projectile cannot tunnel through thin solid scenery');
}

// A repeated activation, stacked damage-over-time and camp cleanup each have
// a deliberate reward policy and cannot repeatedly award an already dead foe.
{
 const run=runtime({health:2});run.cast('ember_bolt',{damage:2,id:'same-cast'});run.cast('ember_bolt',{damage:2,id:'same-cast'});advance(run.combat,4);assert.equal(monsters(run).length,0);assert.equal(run.events.rewards.length,1,'a real projectile kill grants XP once despite repeat cast/burn processing');assert.equal(run.events.rewards[0].xp,12);assert.equal(run.events.saves[0].defeatedMonsters['spell-road:camp-1:monster:1'],true,'defeat is saved before the XP callback');
}
{
 const run=runtime();run.cast('seed_bolt');run.hero.x=180;run.hero.y=60;run.hero.face='right';run.combat.swing(run.hero,{activationId:'cleanup',damage:20,range:40,arc:1});advance(run.combat,4);assert.equal(monsters(run).length,0);assert.equal(run.events.rewards.length,1);assert.equal(run.events.rewards[0].kind,'camp','missiles cannot turn a camp cleanup removal into kill XP');
}

// The whole arsenal remains safe in towns/home/interiors/ferries and cannot
// carry delayed spells or projectiles across a map transition.
for(const kind of['home','town','interior','ferry']){
 const run=runtime();run.cast('seed_bolt');run.cast('cinder_trap');run.combat.enter({...run.area,kind,safe:true},run.config);
 for(const id of SPELL_IDS)assert.equal(run.cast(id).hits,0,id+' stays harmless in '+kind);
 advance(run.combat,3);assert.equal(run.combat.snapshot().missiles.length,0);assert.equal(run.combat.snapshot().zones.length,0);assert.equal(run.events.rewards.length,0);
}
// Short burns expire before a later scheduled tick, and returning blades
// stop when new scenery cuts their return path.
{
 const run=runtime();run.cast('ember_bolt',{damage:1,burnDuration:.1,burnTick:.5});advance(run.combat,.5);const hp=first(run).hp;assert.equal(first(run).burn,0);advance(run.combat,1);assert.equal(first(run).hp,hp,'expired burns never tick late');
}
{
 let barrier=false;const run=runtime({positions:[[150,120]],canStrike:()=>!barrier});run.cast('crescent_return',{damage:1,range:100});advance(run.combat,.6);const hp=first(run).hp;barrier=true;advance(run.combat,.8);assert.equal(first(run).hp,hp,'a returning crescent cannot hit through newly intervening scenery');assert.equal(run.combat.snapshot().missiles.length,0);
}
{
 const run=runtime();for(let i=0;i<70;i++){run.cast('seed_bolt');run.cast('cinder_trap');}assert(run.combat.snapshot().missiles.length<=32,'missile population has a fixed rendering/simulation bound');assert(run.combat.snapshot().zones.length<=24,'persistent zones have a fixed rendering/simulation bound');advance(run.combat,13);assert.equal(run.combat.snapshot().missiles.length,0);assert.equal(run.combat.snapshot().zones.length,0,'bounded fields still clean up after their normal lifetime');
}
const ctx=new Proxy({globalAlpha:1},{get:(target,key)=>target[key]??(()=>{})});
{
 const run=runtime();for(const id of SPELL_IDS)run.cast(id);run.combat.drawGround(ctx,{x:0,y:0});run.combat.drawEffects(ctx,{x:0,y:0});advance(run.combat,.1);run.combat.drawEffects(ctx,{x:0,y:0});
}
console.log('PASS: 20 resolved spell IDs, real melee/projectiles/returning pierce/status/fields, delayed lightning, scenery occlusion, bounded expiry, one-time XP, safe scenes and effect rendering.');

if(process.argv.includes('--render')){
 const {createCanvas}=require('@napi-rs/canvas'),output=path.join(require('node:os').tmpdir(),'blooming-spell-effects-contact.png');
 const canvas=createCanvas(1000,5*174),context=canvas.getContext('2d');context.imageSmoothingEnabled=false;
 for(let index=0;index<SPELL_IDS.length;index++){
  const id=SPELL_IDS[index],run=runtime({positions:[[120,120]]}),x=index%4*250,y=Math.floor(index/4)*174;
  run.cast(id);advance(run.combat,['rose_lance','crescent_return','seed_bolt','frost_shard','ember_bolt'].includes(id)?.08:id==='thunder_call'?.6:.2);
  context.save();context.beginPath();context.rect(x,y,250,174);context.clip();context.fillStyle='#193826';context.fillRect(x,y,250,174);context.translate(x,y);
  context.fillStyle='#c5c8ab';context.font='12px sans-serif';context.fillText(run.spells.resolve(id,1).name,10,18);
  context.fillStyle='#223e2d';for(let row=0;row<11;row++)for(let col=0;col<16;col++)if((row+col)%2)context.fillRect(col*16,row*16+24,16,16);
  run.combat.drawGround(context,{x:0,y:35});run.combat.drawEffects(context,{x:0,y:35});context.restore();
 }
 fs.writeFileSync(output,canvas.toBuffer('image/png'));console.log('Native Canvas effect render: '+output);
}
