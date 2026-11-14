const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const base=require('node:path').resolve(__dirname,'../dist')+'/';
const C={window:{},Math,JSON};vm.createContext(C);vm.runInContext(fs.readFileSync(base+'forage.js','utf8'),C);
const forage=C.window.BloomForage;
let state={note:true,campProgress:{camp:{hp:2}},worldClock:{day:1,minutes:480}},saved='',saves=0,messages=[];
const map={id:'orchard',objects:[
  {id:'apple-tree',sprite:'tree',x:100,y:100,forage:{fruit:'apple',yield:2}},
  {id:'pear-tree',sprite:'tree',x:200,y:100,forage:true,fruit:'pear',regrowDays:2},
  {id:'berries',sprite:'bush',x:300,y:100,forage:{fruit:'berry',yield:3}},
  {id:'flowers',sprite:'flowers',x:120,y:100}
]};
const poisonous=forage.catalogue().filter(type=>type.poisonous);
assert.equal(poisonous.map(type=>type.id).join(','),'poison_amanita,poison_bellcap,poison_inkcap');
for(const [index,type]of poisonous.entries())map.objects.push({id:'ingredient-'+type.id,sprite:type.id,
  x:400+index*100,y:100,forage:index===1?type.id:{fruit:type.id,yield:2}});
const enter=(area=map)=>forage.enter(area,{id:area.id,state,getDay:()=>state.worldClock?.day,
  onChange(){state={...state};saved=JSON.stringify(state);saves++;},onMessage:text=>messages.push(text)});
enter();assert.equal(forage.snapshot().length,forage.catalogue().length,'all authored known harvest types are pickable');
assert.equal(forage.spriteFor(map.objects[0]),'tree');
assert.equal(forage.interaction({x:100,y:115}).type,'forage');
assert.equal(forage.harvest('apple-tree',{x:300,y:300}).picked,false,'cannot harvest remotely');
assert.equal(forage.harvest('apple-tree',{x:100,y:115}).amount,2);
assert.equal(state.inventory.apple,2);assert.equal(state.foragePicked['orchard:apple-tree'],1);
assert.equal(forage.spriteFor({...map.objects[0]}),'tree_picked','picked fruit uses its bare plant appearance');
assert.equal(forage.harvest('apple-tree',{x:100,y:115}).picked,false,'same-day harvest cannot duplicate fruit');
assert.equal(state.inventory.apple,2);assert.equal(saves,1);
assert.equal(forage.harvest('pear-tree',{x:200,y:110}).picked,true);
assert.equal(forage.harvest('berries',{x:300,y:110}).total,3);
assert(messages.some(text=>/growing new fruit/.test(text)));
state.worldClock.day=2;assert.equal(forage.spriteFor(map.objects[0]),'tree','fruit appearance regrows with the game day');assert.equal(forage.harvest('apple-tree',{x:100,y:110}).picked,true,'fruit regrows on the next game day');
assert.equal(forage.harvest('pear-tree',{x:200,y:110}).picked,false,'longer regrowth is respected');
state.worldClock.day=3;assert.equal(forage.harvest('pear-tree',{x:200,y:110}).picked,true);
const restored=JSON.parse(saved);assert.equal(restored.inventory.apple,4);assert.equal(restored.inventory.pear,2);
assert.equal(restored.note,true);assert.equal(restored.campProgress.camp.hp,2,'fruit does not replace quest or combat saves');
state=restored;enter();assert.equal(forage.harvest('pear-tree',{x:200,y:110}).picked,false,'picked-day state survives reload');
enter({...map,id:'second-orchard'});assert.equal(forage.harvest('apple-tree',{x:100,y:110}).picked,true,'plant IDs are scoped to their map');
state={};enter();assert.equal(forage.inventory().apple,0,'old saves receive an empty fruit bag');
assert.equal(forage.harvest('berries',{x:300,y:110}).picked,true);
// Poison mushrooms are named crafting ingredients, never consumed on collection.
state={hp:3,food:2,worldClock:{day:10,minutes:480}};enter();
for(const type of poisonous){
  const source=map.objects.find(o=>o.id==='ingredient-'+type.id),hero={x:source.x,y:110};
  const prompt=forage.interaction(hero);
  assert.equal(prompt.poisonous,true);assert.equal(prompt.craftingIngredient,true);
  assert(prompt.label.includes(type.name)&&prompt.label.includes('poisonous crafting ingredient'));
  assert.equal(forage.inventory()[type.id],0);
  assert.equal(forage.harvest(source.id,hero).picked,true);
  assert.equal(forage.inventory()[type.id],type.id==='poison_bellcap'?1:2);
  assert.equal(forage.spriteFor(source),source.sprite+'_picked','cut stems remain after gathering');
  assert.equal(forage.harvest(source.id,hero).picked,false,'same-day mushroom harvest cannot duplicate ingredients');
  assert.equal(state.hp,3,'gathering poisonous ingredients does not eat them or affect health');
  assert.equal(state.food,2,'gathering does not consume or replenish meals');
}
assert(forage.summary().includes('Poisonous crafting ingredients:'));
assert(poisonous.every(type=>forage.summary().includes(type.name)));
state=JSON.parse(saved);enter();
assert(poisonous.every(type=>!forage.snapshot().find(p=>p.fruit===type.id).ready),'picked mushrooms survive save and reload');
state.worldClock.day=11;
for(const type of poisonous){
  const source=map.objects.find(o=>o.id==='ingredient-'+type.id);
  assert.equal(forage.spriteFor(source),source.sprite,'mushrooms regrow on the next shared game day');
  assert.equal(forage.harvest(source.id,{x:source.x,y:110}).picked,true);
}
// Verify the actual E action, journal bag and shared game-clock hook.
const elements={},storage={},gradient={addColorStop(){}};
const ctx=new Proxy({createRadialGradient:()=>gradient},{get:(o,k)=>o[k]??(()=>{})});
const element=()=>({style:{},textContent:'',hidden:false,getContext:()=>ctx,addEventListener(){},requestFullscreen(){}});
Object.assign(C,{Image:class{},Promise,URLSearchParams,fetch:()=>new Promise(()=>{}),
  localStorage:{getItem:key=>storage[key]??null,setItem:(key,value)=>storage[key]=value},
  document:{getElementById:id=>elements[id]??=element(),createElement:element,querySelectorAll:()=>[]},
  location:{search:'',href:''},requestAnimationFrame(){},setInterval(){},
  testAtlas:JSON.parse(fs.readFileSync(base+'assets/world-v05.json')),
  orchard:{id:'orchard',name:'Wild Orchard',kind:'town',safe:true,theme:'rose',w:25,h:20,
    tiles:Array.from({length:20},()=> 'g'.repeat(25)),spawn:[100,124],
    objects:[map.objects[0],{...map.objects.find(o=>o.sprite==='poison_amanita'),x:200,y:124}],portals:[],signs:[],exits:[]}});
C.window.addEventListener=()=>{};
for(const file of ['routines.js','life.js','adventure.js'])if(fs.existsSync(base+file))vm.runInContext(fs.readFileSync(base+file,'utf8'),C);
vm.runInContext(`
maps={orchard};atlas=testAtlas;texture={};amaal={};playing=true;ready=true;
life?.configure({clockState:state.worldClock});enter('orchard');
if(findInteraction()?.type!=='forage')throw Error('E targets a nearby authored fruit source');
keyAction('e');if(state.inventory.apple!==2)throw Error('E adds fruit to the saved bag');
save();keyAction('e');if(state.inventory.apple!==2)throw Error('E cannot duplicate a picked tree');
state.worldClock.day++;keyAction('e');if(state.inventory.apple!==4)throw Error('game-clock next day restocks the tree');
keyAction('j');if(!dialogue.some(line=>/bag/i.test(line[0])&&/Apples ×4/.test(line[1])))throw Error('journal exposes bag counts');
speaking=false;dialogue=[];hero.x=200;hero.y=140;state.hp=3;state.food=2;
keyAction('e');if(state.inventory.poison_amanita!==2||state.hp!==3||state.food!==2)throw Error('E stores poisonous ingredients without eating them');
keyAction('j');if(!dialogue.some(line=>/Poisonous crafting ingredients:.*Rosecap Amanita/.test(line[1])))throw Error('journal clearly labels poisonous crafting ingredients');
`,C);
assert.equal(JSON.parse(storage['blooming-world-v05']).inventory.apple,4);
assert.equal(JSON.parse(storage['blooming-world-v05']).inventory.poison_amanita,2);
const actualMaps=JSON.parse(fs.readFileSync(base+'fixed-maps.json'));let actualCount=0;const actualTypes={};
for(const [id,area]of Object.entries(actualMaps)){
  const sources=area.objects.filter(o=>o.forage);if(!sources.length)continue;
  const fruitState={};forage.enter(area,{id,state:fruitState,getDay:()=>1});
  const stand=(x,y)=>{
    for(const[dx,dy]of[[-4,-2],[4,-2],[-4,2],[4,2]])if(['w','x','s'].includes(area.tiles[Math.floor((y+dy)/16)]?.[Math.floor((x+dx)/16)]||'x'))return false;
    return !area.objects.some(o=>o.hit&&x+4>o.hit[0]&&x-4<o.hit[0]+o.hit[2]&&y+2>o.hit[1]&&y-2<o.hit[1]+o.hit[3]);
  };
  for(const source of sources){
    const detail=typeof source.forage==='object'?source.forage:source,plantId=detail.id||source.id;
    const plant=forage.snapshot().find(p=>p.id===plantId);assert(plant,id+' has a recognized harvestable plant');
    assert(C.testAtlas[source.sprite],source.sprite+' ripe art exists');
    assert(C.testAtlas[plant.pickedSprite],plant.pickedSprite+' picked art exists');
    assert.deepEqual(C.testAtlas[source.sprite].rect.slice(2),C.testAtlas[plant.pickedSprite].rect.slice(2),'ripe and picked art preserve the same footprint');
    if(area.kind==='road')assert(!['d','c','b'].includes(area.tiles[Math.floor(source.y/16)][Math.floor(source.x/16)]),id+' fruit grows off the paved road');
    let approach;
    for(const radius of[12,20,28,34])for(let direction=0;direction<8&&!approach;direction++){
      const angle=direction*Math.PI/4,p={x:source.x+Math.cos(angle)*radius,y:source.y+Math.sin(angle)*radius};
      if(stand(p.x,p.y)&&forage.interaction(p)?.id===plant.id)approach=p;
    }
    assert(approach,id+': '+plant.id+' has an unobstructed E approach');
    assert.equal(forage.harvest(plant.id,approach).picked,true);
    assert.equal(forage.spriteFor({...source}),plant.pickedSprite);actualCount++;
    actualTypes[plant.fruit]=(actualTypes[plant.fruit]||0)+1;
  }
}
console.log('PASS: nearby fruit/poison-ingredient E harvesting, daily regrowth, explicit poisonous crafting labels, no automatic eating, journal bag, saved inventory/picked-day state, ripe/picked appearance, old saves and quest/camp preservation; '+actualCount+' actual forage plants have valid art and unobstructed off-road approaches. Types: '+JSON.stringify(actualTypes));
