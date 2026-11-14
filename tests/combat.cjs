const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const root=require('node:path').resolve(__dirname,'../dist')+'/';
const source=fs.readFileSync(root+'combat.js','utf8');
const maps=JSON.parse(fs.readFileSync(root+'fixed-maps.json','utf8'));
const world=JSON.parse(fs.readFileSync(root+'world.json','utf8'));
const atlas=JSON.parse(fs.readFileSync(root+'assets/world-v05.json','utf8'));
const profile={name:'Test Slime',frames:[[0,0,24,24]],anchor:[12,22],health:2,speed:26,damage:1};
const campSprite={rect:[0,0,32,32],anchor:[16,32]};
const testAtlas={...atlas,camp_wood:campSprite,camp_rock:campSprite,camp_haunt:campSprite,camp_ruins:campSprite};
const fixtureCamp=(overrides={})=>({id:'brambles',x:240,y:200,type:'wood',monster:'slime',spawnPoints:[[260,200]],health:4,maxAlive:3,spawnEvery:.5,totalSpawns:8,...overrides});
const fixtureRoad=(camps=[fixtureCamp()],overrides={})=>({id:'testroad',name:'Test Road',kind:'road',safe:false,w:40,h:30,tiles:Array.from({length:30},()=> 'g'.repeat(40)),objects:[],portals:[],signs:[],exits:[],spawn:[200,200],camps,...overrides});
const walkable=(x,y)=>x>=8&&y>=8&&x<=632&&y<=472;
function makeRuntime({image={},types={slime:profile}}={}){
  const context={window:{},console,Math,JSON};
  vm.createContext(context);vm.runInContext(source,context);
  const combat=context.window.BloomCombat;
  combat.configure({image,layout:{types}});
  return {combat,context};
}
function enter(combat,area,{hero={x:200,y:200,face:'right'},state={hp:100},canStand=walkable,onDamage,onClear}={}){
  const events={damage:0,clears:0,progress:0,messages:[]};
  combat.enter(area,{id:area.id,hero,canStand,state,atlas:testAtlas,drawSprite(){},
    onDamage:amount=>{events.damage++;state.hp-=amount;return onDamage?.(amount);},
    onClear:camp=>{events.clears++;onClear?.(camp);},onProgress:()=>events.progress++,onMessage:text=>events.messages.push(text)});
  return {hero,state,events};
}
function advance(combat,seconds){for(let t=0;t<seconds;t+=.04)combat.update(.04);}
function campHp(combat,id='brambles'){return combat.snapshot().camps.find(c=>c.id===id).hp;}

// A swing can damage targets in front only, and its damage is applied once.
{
  const {combat}=makeRuntime();
  const road=fixtureRoad([fixtureCamp({id:'front',x:226,health:6}),fixtureCamp({id:'back',x:174,health:6})]);
  const run=enter(combat,road);
  combat.swing({x:200,y:200,face:'right'});
  assert.equal(campHp(combat,'front'),5,'Space arc damages the forward camp');
  assert.equal(campHp(combat,'back'),6,'Space arc leaves the camp behind Amaal intact');
  combat.swing({x:200,y:200,face:'right'});
  assert.equal(campHp(combat,'front'),5,'one attack cannot hit repeatedly');
  advance(combat,.4);
  assert.equal(campHp(combat,'front'),5,'updates do not reapply a swing');
  combat.swing({x:200,y:200,face:'right'});
  assert.equal(campHp(combat,'front'),4,'a later attack can damage again');
  enter(combat,road,{hero:run.hero,state:JSON.parse(JSON.stringify(run.state))});
  assert.equal(campHp(combat,'front'),4,'partly damaged camp HP also survives reload');
}

// Destruction removes the whole camp encounter and survives leaving/reloading.
{
  const {combat}=makeRuntime();
  const road=fixtureRoad([fixtureCamp({health:2,spawnEvery:.1})]);
  const run=enter(combat,road,{hero:{x:216,y:200,face:'right'}});
  advance(combat,1.5);
  assert(combat.snapshot().monsters.length>0,'a nearby intact camp produces visible monsters');
  combat.swing(run.hero);advance(combat,.4);combat.swing(run.hero);
  assert.equal(campHp(combat),0);
  assert.equal(run.events.clears,1,'one clear callback per destroyed camp');
  assert.equal(run.state.clearedCamps['testroad:brambles'],true,'cleared camp is durable');
  assert.equal(combat.snapshot().monsters.length,0,'breaking a camp removes its remaining monsters');
  advance(combat,100);
  assert.equal(combat.snapshot().monsters.length,0,'destroyed camps never respawn monsters');
  enter(combat,road,{hero:run.hero,state:JSON.parse(JSON.stringify(run.state))});
  advance(combat,20);
  assert(combat.snapshot().camps[0].cleared,'reloaded camp stays cleared');
  assert.equal(combat.snapshot().monsters.length,0);
}

// Camp population and the lifetime spawn budget are finite.
{
  const {combat}=makeRuntime({types:{slime:{...profile,health:1,speed:.1}}});
  const run=enter(combat,fixtureRoad([fixtureCamp({health:100,maxAlive:2,totalSpawns:4,spawnEvery:.1})]),{hero:{x:240,y:200,face:'right'}});
  advance(combat,3);
  assert.equal(combat.snapshot().monsters.length,2,'camp fills to its population cap');
  for(let wave=0;wave<3;wave++){
    assert(combat.snapshot().monsters.length<=2,'live population stays bounded');
    combat.swing(run.hero);advance(combat,1.5);
  }
  advance(combat,100);
  const result=combat.snapshot();
  assert.equal(result.camps[0].spawned,4,'lifetime spawn budget is finite');
  assert.equal(result.monsters.length,0,'defeated finite waves do not restart');
}

// Killed monsters remain killed even if their camp has not yet been destroyed.
{
  const {combat}=makeRuntime();
  const road=fixtureRoad([fixtureCamp({health:100,maxAlive:1,totalSpawns:1})]);
  const run=enter(combat,road);
  advance(combat,1);
  const target=combat.snapshot().monsters[0];
  assert(target,'a monster exists to fight');
  for(let attack=0;attack<5&&combat.snapshot().monsters.length;attack++){
    const monster=combat.snapshot().monsters[0];
    Object.assign(run.hero,{x:monster.x-22,y:monster.y,face:'right'});
    combat.swing(run.hero);advance(combat,.4);
  }
  assert.equal(combat.snapshot().monsters.length,0,'katana defeats a real monster');
  assert(run.state.defeatedMonsters[target.id],'defeated monster ID is saved');
  assert(!run.state.clearedCamps['testroad:brambles'],'killing a monster need not destroy its camp');
  assert(run.events.progress>0,'combat mutations request saving');
  enter(combat,road,{hero:run.hero,state:JSON.parse(JSON.stringify(run.state))});
  advance(combat,20);
  assert.equal(combat.snapshot().monsters.length,0,'a saved defeated monster does not return');
}

// Contact hurts Amaal, with a shared invulnerability window across attackers.
{
  const {combat}=makeRuntime();
  const run=enter(combat,fixtureRoad([fixtureCamp({spawnPoints:[[200,200]],maxAlive:2,totalSpawns:2,spawnEvery:.05})]));
  advance(combat,.85);
  assert.equal(run.events.damage,1,'monster contact causes actual health damage');
  const hp=run.state.hp;
  advance(combat,.3);
  assert.equal(run.state.hp,hp,'contact cannot drain health every frame');
  advance(combat,1.2);
  assert(run.state.hp<hp,'contact can hurt again after invulnerability ends');
}

// No invisible monster fallback, and no monsters in any safe scene type.
{
  const {combat}=makeRuntime({image:null});
  const run=enter(combat,fixtureRoad([fixtureCamp({spawnPoints:[[200,200]]})]));
  advance(combat,100);
  assert.equal(combat.snapshot().monsters.length,0,'missing approved monster art disables monster spawning');
  assert.equal(run.state.hp,100,'invisible enemies cannot harm Amaal');
}
for(const scene of [{kind:'town'},{kind:'interior'},{kind:'ferry'},{kind:'boat'},{kind:'road',safe:true}]){
  const {combat}=makeRuntime();
  enter(combat,fixtureRoad([fixtureCamp()],scene));advance(combat,100);
  assert.equal(combat.snapshot().monsters.length,0,'safe scene has no monsters: '+JSON.stringify(scene));
  assert.equal(combat.snapshot().camps.length,0,'safe scene has no encounter camps');
}

// Exercise all six authored long roads, using their final camp geometry when available.
const roads=Object.entries(maps).filter(([,m])=>m.kind==='road');
assert.equal(roads.length,6,'world retains six long roads');
for(const [id,area]of roads){
  const candidates=area.camps?.length?area.camps:[fixtureCamp({x:area.spawn[0]+48,y:area.spawn[1],spawnPoints:[[area.spawn[0]+64,area.spawn[1]]]})];
  const types=Object.fromEntries(candidates.map(c=>[c.monster||'slime',profile]));
  const {combat}=makeRuntime({types});
  const walk=(x,y)=>{
    for(const[dx,dy]of[[-4,-2],[4,-2],[-4,2],[4,2]])if(['w','x','s'].includes(area.tiles[Math.floor((y+dy)/16)]?.[Math.floor((x+dx)/16)]||'x'))return false;
    return !area.objects.some(o=>o.hit&&x+4>o.hit[0]&&x-4<o.hit[0]+o.hit[2]&&y+2>o.hit[1]&&y-2<o.hit[1]+o.hit[3]);
  };
  const road={...area,id,camps:candidates};
  const run=enter(combat,road,{hero:{x:candidates[0].x-24,y:candidates[0].y,face:'right'},canStand:walk});
  advance(combat,5);
  assert(combat.snapshot().camps.length>0,id+' initializes roadside camps');
  for(const monster of combat.snapshot().monsters)assert(walk(monster.x,monster.y),id+' monster stays on passable ground');
  assert(combat.snapshot().monsters.length<=candidates.reduce((n,c)=>n+(c.maxAlive||3),0),id+' population stays capped');
  for(const camp of candidates){
    const approach=[[camp.x-24,camp.y,'right'],[camp.x+24,camp.y,'left'],[camp.x,camp.y-24,'down'],[camp.x,camp.y+24,'up']].find(p=>walk(p[0],p[1]));
    assert(approach,id+': '+camp.id+' has a walkable melee approach');
    Object.assign(run.hero,{x:approach[0],y:approach[1],face:approach[2]});
    const before=campHp(combat,camp.id);combat.swing(run.hero);
    assert(campHp(combat,camp.id)<before,id+': '+camp.id+' can actually be struck');
    advance(combat,.4);
  }
}

// Run the actual adventure hooks: Space changes HP and defeat returns to a safe town.
{
  const elements={},saved={};
  const gradient={addColorStop(){}};
  const context2d=new Proxy({createRadialGradient:()=>gradient},{get:(o,key)=>o[key]??(()=>{})});
  const element=()=>({style:{},textContent:'',hidden:false,disabled:false,getContext:()=>context2d,addEventListener(){},requestFullscreen(){}});
  const C={console,Math,JSON,Image:class{},Promise,URLSearchParams,fetch:()=>new Promise(()=>{}),
    localStorage:{getItem:k=>saved[k]??null,setItem:(k,v)=>saved[k]=v},
    document:{getElementById:id=>elements[id]??=element(),createElement:element,querySelectorAll:()=>[],fullscreenElement:null},
    window:{addEventListener(){}},location:{search:'',href:''},requestAnimationFrame(){},setInterval(){},testMaps:maps,testWorld:world,testAtlas,profile};
  vm.createContext(C);vm.runInContext(source,C);vm.runInContext(fs.readFileSync(root+'adventure.js','utf8'),C);
  C.spaceRoad=fixtureRoad([fixtureCamp({x:160,y:120,spawnPoints:[[120,120]],health:4,maxAlive:1,totalSpawns:1})],{id:'space-test',spawn:[136,120]});
  C.deathRoad=fixtureRoad([fixtureCamp({x:160,y:120,spawnPoints:[[120,120]],health:4,maxAlive:1,totalSpawns:1})],{id:'death-test',spawn:[120,120]});
  vm.runInContext(`
    W=testWorld;maps={...testMaps,'space-test':spaceRoad,'death-test':deathRoad};atlas=testAtlas;texture={};amaal={};ready=true;playing=true;
    combat.configure({image:{},layout:{types:{slime:profile}}});
    enter('rosepetal');enter('space-test');hero.face='right';
    const before=combat.snapshot().camps[0].hp;keyAction(' ');
    if(combat.snapshot().camps[0].hp!==before-1)throw Error('Space key must damage camp HP through adventure');
    keyAction(' ');if(combat.snapshot().camps[0].hp!==before-1)throw Error('adventure cooldown blocks duplicate Space damage');
    render();
    enter('rosepetal');enter('death-test');state.hp=1;
    for(let i=0;i<40&&areaId==='death-test';i++)update(.04);
    if(!['town','home'].includes(area.kind)||state.hp!==5)throw Error('defeat returns Amaal to a safe checkpoint with restored health');
    if(combat.snapshot().monsters.length)throw Error('defeat clears road combat before returning home');
    save();if(JSON.parse(localStorage.getItem('blooming-world-v05')).hp!==5)throw Error('restored health is saved');
  `,C);
}
console.log('PASS: directional Space damage, cooldown, finite camp waves, camp destruction, defeated-monster persistence, damage/invulnerability, approved-art gating, six roads, safe scenes, adventure Space hooks, defeat/respawn/save.');
