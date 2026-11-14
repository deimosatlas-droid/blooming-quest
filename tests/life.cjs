const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = require('node:path').resolve(__dirname,'../dist')+'/';
const sandbox = { window:{}, console, Math, Int32Array };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(root+'life.js','utf8'),sandbox);
const life=sandbox.window.BloomLife;
const map={id:'test',w:18,h:12,kind:'town',theme:'rose',objects:[],animals:[],residents:[{
  id:'herbalist',name:'Mira',type:'herbalist',x:40,y:40,speed:45,
  route:[[40,40],[232,40]],lines:['The roses prefer the morning sun.','Raeez took the east road.']
}]};
const canStand=(x,y)=>x>=8&&y>=8&&x<=280&&y<=184&&!(x>120&&x<144&&y<128);
const hero={x:40,y:53};
life.configure({residentsImage:{}});
life.enter(map,{canStand,hero});
assert.equal(life.interaction(hero).name,'Mira');
assert.equal(life.talk('herbalist',hero)[0][1],map.residents[0].lines[0]);
assert.equal(life.talk('herbalist',hero)[0][1],map.residents[0].lines[1]);
let crossed=false,moved=false;
for(let i=0;i<1600;i++) {
  life.update(.04,hero);
  const a=life.snapshot()[0];
  assert(canStand(a.x,a.y),'resident remains on walkable ground while routing around a fence');
  if(a.x>200)crossed=true;
  if(a.walking)moved=true;
}
assert(crossed&&moved,'resident completes a useful route around the obstacle');
const entry=life.actors({x:0,y:0})[0];
assert.equal(entry.sort,entry.actor.y);
let drawArgs;
const ctx={fillStyle:'',beginPath(){},ellipse(){},fill(){},drawImage(...args){drawArgs=args;},fillRect(){}};
life.draw(entry,ctx,{x:0,y:0});
assert(drawArgs&&drawArgs[1]>=0&&drawArgs[1]+drawArgs[3]<=160,'drawing stays within the directional sheet');
life.configure({residentsImage:null});
assert.equal(life.actors().length,0,'missing matching artwork never falls back to an unrelated NPC');
assert.equal(life.interaction(hero),null);
life.configure({residentsImage:{},animalsImage:{},animalLayout:{cell:[32,32],anchor:[16,28],directions:4,types:{cat:0}}});
life.enter({...map,residents:[]},{canStand,hero});
assert.equal(life.snapshot()[0].id,'stormy-companion');
for(let i=0;i<100;i++){hero.x+=.6;life.update(.04,hero);}
assert(life.snapshot()[0].x>40,'Stormy follows Amaal');
const stormy=life.snapshot()[0];assert.equal(life.interaction(stormy).id,'stormy-companion');assert.equal(life.talk('stormy-companion',stormy)[0][0],'Stormy');assert.equal(life.talk('stormy-companion',stormy)[0][1],'I am following you. For the adventure. And the possibility of snacks.');
life.enter({...map,residents:[],animals:[]},{canStand});
assert.equal(life.snapshot().length,0,'map entry resets previous resident and companion state');

// Check actual authored routes using the game's collision rules when the map rebuild is present.
const maps=JSON.parse(fs.readFileSync(root+'fixed-maps.json'));
const atlas=JSON.parse(fs.readFileSync(root+'assets/world-v05.json'));
let count=0;
for(const [id,area] of Object.entries(maps)) {
  if(!(area.residents?.length))continue;
  const stand=(x,y)=>{
    for(const [dx,dy]of[[-4,-2],[4,-2],[-4,2],[4,2]]){
      const tile=area.tiles[Math.floor((y+dy)/16)]?.[Math.floor((x+dx)/16)]||'x';
      if(['w','x','s'].includes(tile))return false;
    }
    return !area.objects.some(o=>o.hit&&x+4>o.hit[0]&&x-4<o.hit[0]+o.hit[2]&&y+2>o.hit[1]&&y-2<o.hit[1]+o.hit[3]);
  };
  for(const person of [...area.residents,...(area.animals||[])]){
    assert(stand(person.x,person.y),id+': '+person.id+' authored starting point is walkable');
    for(const target of person.route||[])assert(stand(...target),id+': '+person.id+' task point is walkable');
  }
  life.enter(area,{canStand:stand,atlas});
  assert.equal(life.snapshot().filter(a=>a.id!=='stormy-companion').length,area.residents.length+(area.animals?.length||0),id+' has safe resident placements');
  for(let i=0;i<1800;i++) {
    life.update(.04,{x:32,y:32});
    if(i%25===0)for(const actor of life.snapshot())assert(stand(actor.x,actor.y),id+': '+actor.id+' stays walkable');
  }
  count+=area.residents.length;
}
// Exercise the integration, including the branch that distinguishes life actors from Amaal.
const elements={};
const gradient={addColorStop(){}};
const canvasContext=new Proxy({createRadialGradient:()=>gradient},{get:(o,key)=>o[key]??(()=>{})});
const element=()=>({style:{},textContent:'',hidden:false,disabled:false,getContext:()=>canvasContext,addEventListener(){},requestFullscreen(){}});
Object.assign(sandbox,{
  Image:class{},URLSearchParams,Promise,fetch:()=>new Promise(()=>{}),
  localStorage:{getItem(){return null;},setItem(){}},
  document:{getElementById:id=>elements[id]??=element(),createElement:element,querySelectorAll:()=>[],fullscreenElement:null},
  location:{search:'',href:''},requestAnimationFrame(){},setInterval(){},testMaps:maps,testAtlas:atlas
});
sandbox.window.addEventListener=()=>{};
vm.runInContext(fs.readFileSync(root+'adventure.js','utf8'),sandbox);
life.configure({residentsImage:{}});
vm.runInContext(`
maps=testMaps;atlas=testAtlas;texture={};amaal={};ready=true;playing=true;
enter('rosepetal');
area.residents=[{id:'integration',name:'Nadia',type:'merchant',x:hero.x,y:hero.y,lines:['Fresh bread for the long road?']}];
life.enter(area,{hero,canStand,atlas});
render();
if(findInteraction().type!=='resident')throw Error('nearest resident interaction is integrated');
interact();
if(!speaking||$('speaker').textContent!=='Nadia')throw Error('resident dialogue opens through E');
const frozen=life.snapshot()[0].x;update(.04);
if(life.snapshot()[0].x!==frozen)throw Error('dialogue pauses residents');
`,sandbox);
console.log('PASS: matching-art gating, directional sprite draw, fence-aware routines, dialogue, y-sort, Stormy, resets, live-game rendering/E interaction; '+count+' authored residents simulated.');
