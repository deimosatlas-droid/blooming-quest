'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../dist');
function game(saved){
 const elements={},storage=saved?{'blooming-world-v05':saved}:{},events={};
 const gradient={addColorStop(){}},context=new Proxy({createRadialGradient:()=>gradient},{get:(o,k)=>o[k]??(()=>{})});
 const element=()=>({style:{},textContent:'',hidden:false,disabled:false,getContext:()=>context,addEventListener(){},focus(){},setAttribute(){}});
 const C={window:{addEventListener:(name,fn)=>(events[name]??=[]).push(fn)},Math,JSON,Image:class{},Promise,URLSearchParams,
  fetch:()=>new Promise(()=>{}),localStorage:{getItem:key=>storage[key]??null,setItem:(key,value)=>storage[key]=value},
  document:{getElementById:id=>elements[id]??=element(),createElement:element,querySelectorAll:()=>[],addEventListener(){}},location:{search:'',href:''},requestAnimationFrame(){},setInterval(){}};
 const tree={opened:false,configure(config){this.config=config;},isOpen(){return this.opened;},open(){if(this.config.onPause()===false)return false;this.opened=true;return true;},close(){if(!this.opened)return;this.opened=false;this.config.onResume();},update(){}};C.window.BloomCombatUI=tree;
 vm.createContext(C);for(const file of ['progression.js','abilities.js','hero-animation.js','training.js','combat.js','adventure.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),C,{filename:file});
 const evaluate=source=>vm.runInContext(source,C);
 evaluate(`const base={name:'Test',kind:'home',safe:true,w:40,h:30,theme:'rose',tiles:Array(30).fill('g'.repeat(40)),spawn:[100,100],portals:[],signs:[],exits:[],objects:[]};
 maps={rosepetal:{...base,id:'rosepetal',objects:[{id:'dummy',sprite:'training_dummy',x:130,y:100,hit:[126,94,8,6],training:{id:'dummy',maxHealth:8,resetSeconds:2}}]},lavenderway:{...base,id:'lavenderway',name:'Test road',kind:'road',safe:false,camps:[{id:'camp-1',x:150,y:80,health:4,monster:'orc',maxAlive:1,totalSpawns:1,spawnPoints:[[120,100]]}]}};
 atlas={training_dummy:{rect:[0,0,16,32],anchor:[8,32]}};texture={};amaal={};ready=true;playing=true;
 combat.configure({image:{},layout:{types:{orc:{name:'Practice Orc',health:2,damage:1,speed:20,frames:[[0,0,16,16]],attackFrames:[[0,0,16,16]],attackKind:'cone'}}}});
 enter('rosepetal');state.inventory.apple=7;`);
 return{C,evaluate,storage,elements,tree,step:(count=1)=>{for(let i=0;i<count;i++)evaluate('update(.04)');}};
}
const g=game(),run=g.evaluate;
assert.equal(run('progression.snapshot(state).points'),1,'first skill is immediately available');assert(g.tree.config.onLearn('petal_sweep').ok);assert.equal(run('progression.snapshot(state).loadout[0]'),'petal_sweep');assert.equal(JSON.parse(g.storage['blooming-world-v05']).inventory.apple,7);
run("enter('lavenderway');hero.face='right'");
for(let i=0;i<100&&run("combat.snapshot().monsters[0]?.attackState")!=='windup';i++)g.step();
assert.equal(run('state.hp'),5,'enemy approach and windup cannot deal contact damage');assert.equal(run('combat.snapshot().monsters[0].attackState'),'windup');
for(let i=0;i<40&&run('combat.snapshot().monsters[0].warningRemaining')>.1;i++)g.step();
run('keys.c=true');g.step(3);assert.equal(run('state.hp'),5,'timed directional guard in actual update parries the active attack');assert(run('combat.snapshot().monsters[0].stun')>.5,'parry interrupts the real enemy');run('keys.c=false');g.step();
run("keyAction('1')");assert.equal(run('combat.snapshot().monsters.length'),0,'equipped skill damages real monsters');assert.equal(run('progression.snapshot(state).xp'),12,'real monster kill rewards XP');assert(run("state.progression.claimedRewards['monster:lavenderway:camp-1:monster:1']"));
const stamina=run('abilities.snapshot().stamina'),cooldown=run('abilities.snapshot().cooldowns.petal_sweep');run("keys.arrowright=true;keyAction('k')");assert(g.tree.opened);assert.equal(run('Object.values(keys).some(Boolean)'),false,'opening tree releases held input');const position=run('hero.x');g.step(20);assert.equal(run('hero.x'),position);assert.equal(run('abilities.snapshot().stamina'),stamina,'tree pauses stamina');assert.equal(run('abilities.snapshot().cooldowns.petal_sweep'),cooldown,'tree pauses cooldowns');
run("keyAction('1');keyAction(' ');heal()");assert.equal(run('abilities.snapshot().stamina'),stamina,'gameplay shortcuts are suppressed while tree is open');run("keyAction('escape')");assert(!g.tree.opened);
run("hero.x=110;hero.y=100;hero.face='right';activateKatana(hero,{id:'thrust',damage:10,range:56,arc:1.2,activationId:'clear-test'})");assert(run("state.clearedCamps['lavenderway:camp-1']"));assert.equal(run('progression.snapshot(state).xp'),47,'camp reward is separate from a real kill');assert.equal(run("progression.grant(state,'camp:lavenderway:camp-1',35).ok"),false,'repeated clear reward cannot grant XP twice');
run("progression.grant(state,'test:level',600);progression.learn(state,'finishing_cut');enter('rosepetal');hero.face='right';activateKatana(hero,{id:'thrust',damage:2,range:56,arc:1.2,activationId:'practice-upgrade'})");assert.equal(run('training.snapshot()[0].hp'),5,'learned finisher upgrade reaches actual practice damage');
run("say([['Test','Pause.']]);keyAction('k')");assert(!g.tree.opened,'tree cannot swallow a story conversation');run("keyAction('escape');keyAction('k')");assert(g.tree.opened);run("enter('lavenderway')");assert(!g.tree.opened,'scene travel closes the overlay');assert.equal(run('abilities.snapshot().guarding'),false);assert.equal(run('combat.snapshot().monsters.length'),0,'cleared camps remain cleared after scene travel');
run('save()');const saved=g.storage['blooming-world-v05'];const loaded=game(saved);assert.equal(loaded.evaluate('state.inventory.apple'),7);assert.equal(loaded.evaluate('state.progression.xp'),647,'XP survives reload without migration double-credit');assert(loaded.evaluate('state.progression.skills.finishing_cut'));assert(loaded.evaluate("state.clearedCamps['lavenderway:camp-1']"));
console.log('PASS: actual game starter skill/equip/save, warned attack and timed parry, skill damage/XP, stable camp rewards, upgrade practice damage, tree pause/input guards, scene resets and additive reload.');
