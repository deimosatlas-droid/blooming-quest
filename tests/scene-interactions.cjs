'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const base=path.resolve(__dirname,'../dist')+'/',elements={},storage={},listeners={},gradient={addColorStop(){}};
let transfer=null,importing=false,reloads=0,replaced='';
const context2d=new Proxy({createRadialGradient:()=>gradient},{get:(o,key)=>o[key]??(()=>{})});
const element=()=>({style:{},textContent:'',hidden:false,getContext:()=>context2d,addEventListener(){}});
const C={console,Math,JSON,Image:class{},Promise,URLSearchParams,fetch:()=>new Promise(()=>{}),
 document:{getElementById:id=>elements[id]??=element(),createElement:element,querySelectorAll:()=>[]},
 localStorage:{getItem:key=>storage[key]??null,setItem:(key,value)=>storage[key]=value},
 window:{addEventListener:(type,handler)=>listeners[type]=handler,BloomSaveTransfer:{configure:config=>transfer=config,isImporting:()=>importing}},
 location:{search:'',href:'',pathname:'/index.html',hash:'',reload(){reloads++;listeners.pagehide?.();}},
 history:{replaceState(_state,_title,target){replaced=target;}},requestAnimationFrame(){},setInterval(){},
 testMaps:JSON.parse(fs.readFileSync(base+'fixed-maps.json')),testAtlas:JSON.parse(fs.readFileSync(base+'assets/world-v05.json'))};
vm.createContext(C);
for(const file of ['forage.js','hero-animation.js','training.js','combat.js','adventure.js'])vm.runInContext(fs.readFileSync(base+file,'utf8'),C);
vm.runInContext(`
function check(value,label){if(!value)throw Error(label)}
maps=testMaps;atlas=testAtlas;texture={};amaal={};playing=true;ready=true;configureSaveTransfer();
enter('rosepetal',{at:[292,248]});
const inkcap='rosepetal_poison_inkcap_2';
check(canStand(hero.x,hero.y),'the real wall-side approach is walkable');
check(!forage.interaction(hero),'a nearby mushroom across the solid garden wall cannot offer a harvest prompt');
check(!forage.harvest(inkcap,hero).picked,'direct harvest also enforces the wall');
interact();check(!state.inventory.poison_inkcap,'E cannot collect the mushroom across that wall');
enter('rosepetal',{at:[304,208]});
check(forage.interaction(hero)?.id===inkcap,'the same plant has a valid approach inside the garden');
interact();check(state.inventory.poison_inkcap===1,'E gathers it from the reachable side');
enter('rosepetal',{at:[720,200]});
check(canStand(hero.x,hero.y),'the orchard approach behind the tree is walkable');
check(forage.interaction(hero)?.id==='rosepetal_home_fruit_0','the target tree own trunk does not hide its fruit interaction');
interact();check(state.inventory.apple===1,'E picks fruit when only the target plant collider intersects the reach line');

state.note=true;state.clearedCamps['saved:camp']=true;
enter('lavendyr');say([['Maera','A Lavendyr conversation'],['Maera','A second line']]);
check(speaking&&$('dialog').style.display==='block','the original conversation is active');
$('new').onclick();
check(areaId==='rosepetal'&&!speaking,'Return home ends the conversation in its old scene');
check(dialogue.length===0&&fullText===''&&typed===0,'old queued lines and typing progress are discarded');
check($('dialog').style.display==='none'&&$('speaker').textContent===''&&$('speech').textContent==='','old conversation UI is cleared');
check($('quick').style.visibility===''&&$('hint').hidden,'home restores the quick HUD and clears its previous prompt');
const before=hero.x;keys={d:true};update(.04);check(hero.x>before,'old dialogue cannot keep the destination paused');keys={};
check(state.note&&state.inventory.apple===1&&state.clearedCamps['saved:camp'],'scene changes keep the existing quest, harvest and camp progress');
say([['Audit','Another old line']]);enter('lavendyr');check(!speaking&&dialogue.length===0,'all scene entries clear old dialogue, not only the home button');
`,C);

// Confirm every authored plant still has an actual unmasked E approach when
// the new reach check and intact-camp collision both run in production code.
let plants=0;
for(const [id,map]of Object.entries(C.testMaps)){
 if(!map.objects.some(o=>o.forage))continue;
 C.testAreaId=id;vm.runInContext('state.foragePicked={};enter(testAreaId)',C);
 for(const source of map.objects.filter(o=>o.forage)){
  const detail=typeof source.forage==='object'?source.forage:source,id=String(detail.id||source.id);
  C.plantId=id;C.sourcePoint=[source.x,source.y];
  const result=vm.runInContext(`(()=>{
   const plant=forage.snapshot().find(p=>p.id===plantId);if(!plant)return 'missing plant';
   for(const radius of[12,20,28,34])for(let angle=0;angle<32;angle++){
    const p={x:sourcePoint[0]+Math.cos(angle*Math.PI/16)*radius,y:sourcePoint[1]+Math.sin(angle*Math.PI/16)*radius};
    if(!canStand(p.x,p.y))continue;hero.x=p.x;hero.y=p.y;
    if(findInteraction()?.type!=='forage'||findInteraction().id!==plantId)continue;
    const before=forage.inventory()[plant.fruit];interact();
    return forage.inventory()[plant.fruit]===before+plant.amount?null:'E did not harvest';
   }
   return 'no clear unmasked approach';
  })()`,C);
  assert.equal(result,null,id+' in '+map.name+': '+result);plants++;
 }
}
assert.equal(plants,109);
assert(storage['blooming-world-v05'],'the original game save key remains in use');
assert(transfer&&typeof transfer.getAreas==='function','save transfer receives the ready game state and map catalog');
assert.equal(Object.keys(transfer.getAreas()).length,Object.keys(C.testMaps).length);
vm.runInContext("enter('tidepetal');hero.x=640;hero.y=440;save();ferryTrip={to:'seabloom'};hero.x=1;hero.y=1;",C);
const departure=JSON.parse(storage['blooming-world-v05']);transfer.beforeExport();
assert.equal(transfer.getState().area,'tidepetal','an export during a crossing retains the stable departure area');
assert.equal(transfer.getState().x,departure.x);assert.equal(transfer.getState().y,departure.y);
assert.equal(storage['blooming-world-v05'],JSON.stringify(departure),'ferry export never invents a destination or transient coordinates');
const imported=JSON.stringify({area:'sunveil',x:400,y:440,note:true,inventory:{apple:9}});
storage['blooming-world-v05']=imported;importing=true;
C.location.search='?area=rosepetal&devtravel=1&v=15&theme=safe';C.location.hash='#journey';
transfer.onImport();
assert.equal(replaced,'/index.html?v=15&theme=safe#journey','import removes only development travel selectors before reloading');
assert.equal(reloads,1,'an accepted import reloads once');
assert.equal(storage['blooming-world-v05'],imported,'pagehide cannot overwrite imported progress with the old live scene');
vm.runInContext('ferryTrip=null;save(true)',C);assert.equal(storage['blooming-world-v05'],imported,'manual/autosaves also respect an import already in progress');
console.log('PASS: garden-wall harvest rejection and target-trunk exemption; dialogue reset/unpaused scene travel; all109 plants retain production E approaches; save-transfer map/state hooks, stable ferry export, import URL cleanup and pagehide/autosave protection.');
