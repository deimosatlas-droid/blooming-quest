'use strict';
// Uses the shipped scene, collision, gathering, NPC and travel code. This is a
// native VM integration check; it does not stand in for browser/device testing.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../dist'),read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const maps=read('fixed-maps.json'),atlas=read('assets/world-v05.json'),world=read('world.json');
const towns=Object.values(maps).filter(map=>map.kind==='town');
assert.equal(towns.reduce((n,map)=>n+map.residents.length,0),104,'104 established neighbours survive the region upgrade');
assert.equal(new Set(towns.flatMap(map=>map.residents.map(actor=>actor.appearanceId))).size,104,'resident appearances remain unique');
assert.equal(Object.values(maps).reduce((n,map)=>n+map.objects.filter(object=>object.forage).length,0),109,'all 109 saved gathering sources survive');
assert.equal(crypto.createHash('sha256').update(JSON.stringify(maps.rosepetal)).digest('hex'),'a8fb1a82b394b32ae7f0222280d1af33cd59932dc5bc3f92f691b88079103efd','Rosepetal retains its exact authored data');
assert.equal(crypto.createHash('sha256').update(JSON.stringify(Object.fromEntries(Object.entries(maps).filter(([id])=>!['lavendyr','lavenderway'].includes(id))))).digest('hex'),'ba134232111724e2dad5d4ba45e78773c06498b9e97b6a9db51cbd29efe19f2a','every non-Lavendyr map retains its exact authored data');
assert.equal(crypto.createHash('sha256').update(JSON.stringify(maps.lavendyr)).digest('hex'),'c51a8616ba378704c30a3bb4377b88a425a2da955df85b41d50d089fd29ce517','the road detail pass preserves the completed v18 Lavendyr town exactly');
assert.equal(crypto.createHash('sha256').update(JSON.stringify(Object.fromEntries(Object.entries(maps).filter(([id])=>id!=='lavenderway')))).digest('hex'),'20f4fae94894f34cf036f2d16ef393eba1d883f2c2b507a20ad632b6ef2e5ac6','the road detail pass preserves every other authored map exactly');
assert.equal(maps.lavendyr.kind,'town');assert.equal(maps.lavendyr.safe,true);assert.equal((maps.lavendyr.camps||[]).length,0,'the town contains no monster camps');assert.equal(maps.lavenderway.kind,'road');assert.equal(maps.lavenderway.safe,false);assert.equal((maps.lavenderway.residents||[]).length,0,'the road is not a merged settlement');assert.equal(maps.lavenderway.camps.length,4);
assert.equal(maps.lavendyr.buildingCount,8);assert.equal(maps.lavendyr.residents.length,13);
assert.equal(maps.lavendyr.portals.filter(portal=>portal.kind==='door').length,8);
for(const id of ['lavendyr','lavenderway']){
 assert.equal(maps[id].regionVersion,18,id+' carries the authored region upgrade');
 assert(maps[id].walkLanes?.length,id+' declares the unobstructed travel lanes');
 for(const object of maps[id].objects)assert(atlas[object.sprite],id+' scenery has real atlas art: '+object.sprite);
}
for(const key of ['greenhouse','dryingShed','streamBridge','arenaApproach','remedySage','remedyRosemary','remedyThyme']){
 const point=maps.lavenderway.questLandmarks?.[key];
 assert(point&&Number.isFinite(point.x)&&Number.isFinite(point.y),'the regional design gives '+key+' a concrete location');
}
assert.equal(maps.lavenderway.detailVersion,18,'Lavenderway includes the authored nature detail pass');
assert.deepEqual(Object.fromEntries(['remedySage','remedyRosemary','remedyThyme','greenhouse','dryingShed','streamBridge','arenaApproach'].map(key=>[key,maps.lavenderway.questLandmarks[key]])),{
 remedySage:{x:480,y:240},remedyRosemary:{x:768,y:536},remedyThyme:{x:1632,y:288},greenhouse:{x:1840,y:272},dryingShed:{x:736,y:488},streamBridge:{x:904,y:336},arenaApproach:{x:2112,y:288}
},'the nature detail pass keeps every established remedy, greenhouse, bridge and arena quest position');
assert.deepEqual(maps.lavenderway.camps.map(camp=>camp.id),['camp-1','camp-2','camp-3','camp-4'],'saved camp identifiers are stable');
assert.deepEqual(maps.lavenderway.camps.map(({id,x,y,spawnPoints})=>({id,x,y,spawnPoints})),[
 {id:'camp-1',x:424,y:264,spawnPoints:[[400,286],[448,286],[424,306]]},
 {id:'camp-2',x:712,y:408,spawnPoints:[[688,430],[736,430],[712,450]]},
 {id:'camp-3',x:1464,y:360,spawnPoints:[[1440,382],[1488,382],[1464,402]]},
 {id:'camp-4',x:1960,y:344,spawnPoints:[[1936,366],[1984,366],[1960,386]]}
],'the nature detail pass keeps the four established camps and every spawn position');
assert.deepEqual(maps.lavenderway.camps.map(camp=>camp.regionalMonster),['lavender_imp','violet_brambleback','amethyst_wisp','lavender_imp'],'Lavenderway has its distinct regional monster roster');
assert.deepEqual(maps.lavenderway.camps.map(camp=>camp.monster),['slime','horned_rabbit','beetle','boar'],'legacy camp monsters remain available to base-only fixtures');
assert.deepEqual(maps.lavenderway.camps.map(camp=>camp.name),['Lavender Imp Den','Brambleback Hollow','Amethyst Wisp Grove','Thornbound Garden Camp']);
assert.deepEqual(maps.lavenderway.camps.map(camp=>camp.totalSpawns),[6,7,8,9],'saved wave slot counts remain stable');
assert.equal(Object.values(maps).filter(map=>map.kind==='road').reduce((n,map)=>n+map.camps.length,0),24);
assert.deepEqual(maps.lavendyr.reservedQuestSites.gardenEntrance,[352,224]);
assert.deepEqual(maps.lavenderway.objects.filter(object=>object.forage).map(object=>object.id).sort(),Array.from({length:5},(_,i)=>Array.from({length:3},(_,j)=>`lavenderway_forage_${i}_${j}`)).flat().sort(),'saved road gathering identifiers are stable');

const elements={},storage={},gradient={addColorStop(){}},context=new Proxy({createRadialGradient:()=>gradient},{get:(object,key)=>object[key]??(()=>{})});
const node=()=>({style:{},dataset:{},textContent:'',hidden:false,disabled:false,classList:{toggle(){},contains:()=>false},getContext:()=>context,setAttribute(){},addEventListener(){},focus(){}});
const C={console,Math,JSON,Map,Set,Uint8Array,Int32Array,Promise,URLSearchParams,Image:class{},fetch:()=>new Promise(()=>{}),window:{addEventListener(){}},document:{getElementById:id=>elements[id]??=node(),createElement:node,querySelectorAll:()=>[],addEventListener(){},body:node()},localStorage:{getItem:key=>storage[key]??null,setItem:(key,value)=>storage[key]=value},location:{search:'',href:''},setInterval(){},requestAnimationFrame(){},realMaps:maps,realWorld:world,realAtlas:atlas,monsterLayout:read('assets/road-monsters.json')};
vm.createContext(C);
for(const file of ['forage.js','routines.js','life.js','combat.js','journey-content.js','adventure.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),C,{filename:file});
const run=code=>vm.runInContext(code,C);
run(`maps=realMaps;W=realWorld;atlas=realAtlas;texture={};amaal={};ready=true;playing=true;
life.configure({residentsImage:{},clockState:state.worldClock,getAreas:()=>maps});
content.install(maps,W,atlas);combat.configure({image:{},layout:monsterLayout});
function regionDismiss(){for(let i=0;i<40&&speaking;i++)nextLine()}
function regionReachability(){
 const columns=area.w*2,rows=area.h*2,size=columns*rows,pass=new Uint8Array(size),seen=new Uint8Array(size),queue=[];
 const fits=(x,y)=>{const index=y*columns+x;if(!pass[index])pass[index]=canStand(x*8,y*8)?1:2;return pass[index]===1;};
 const sx=Math.round(hero.x/8),sy=Math.round(hero.y/8);if(!fits(sx,sy))throw Error(areaId+' arrival does not align with a walkable grid position');
 const start=sy*columns+sx;seen[start]=1;queue.push(start);
 for(let head=0;head<queue.length;head++){
  const p=queue[head],x=p%columns,y=Math.floor(p/columns);
  for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){
   const xx=x+dx,yy=y+dy,index=yy*columns+xx;
   if(xx<0||yy<0||xx>=columns||yy>=rows||seen[index]||!fits(xx,yy))continue;
   // Match movement's small collision steps so a thin fence cannot be jumped.
   if([2,4,6].some(step=>!canStand(x*8+dx*step,y*8+dy*step)))continue;
   seen[index]=1;queue.push(index);
  }
 }
 return{columns,rows,seen,count:queue.length};
}
let regionGrid;
function regionConnected(x,y,radius=12){
 const{columns,rows,seen}=regionGrid;
 for(let gy=Math.max(0,Math.floor((y-radius)/8));gy<Math.min(rows,Math.ceil((y+radius)/8)+1);gy++)for(let gx=Math.max(0,Math.floor((x-radius)/8));gx<Math.min(columns,Math.ceil((x+radius)/8)+1);gx++)if(seen[gy*columns+gx]&&Math.hypot(gx*8-x,gy*8-y)<=radius)return true;
 return false;
}
function regionFindApproach(x,y,match){
 for(const radius of[0,8,12,20,24,28,34,40])for(let angle=0;angle<32;angle++){
  const px=x+Math.cos(angle*Math.PI/16)*radius,py=y+Math.sin(angle*Math.PI/16)*radius;
  if(!canStand(px,py)||!regionConnected(px,py,9))continue;hero.x=px;hero.y=py;
  const candidate=findInteraction();if(candidate&&match(candidate))return candidate;
 }
 return null;
}`);
let reachablePositions=0,boundarySamples=0,doors=0,residents=0,plants=0,landmarks=0;
for(const id of ['lavendyr','lavenderway']){
 C.regionId=id;run('enter(regionId);regionGrid=regionReachability()');
 const map=maps[id];reachablePositions+=run('regionGrid.count');
 assert(run('canStand(hero.x,hero.y)'),id+' arrival is clear');
 for(const exit of map.exits){
  C.exitPoint=[exit.side==='west'?8:map.w*16-8,exit.y];
  assert(run('regionConnected(...exitPoint,8)'),id+' exit to '+exit.target+' connects to the arrival');
 }
 for(const side of ['west','east','north','south']){
  const length=['west','east'].includes(side)?map.h*16:map.w*16;
  for(let n=8;n<length;n+=8){
   if(map.exits.some(exit=>exit.side===side&&Math.abs(n-exit.y)<=(exit.halfWidth||32)+4))continue;
   C.boundaryPoint=side==='west'?[8,n]:side==='east'?[map.w*16-8,n]:side==='north'?[n,8]:[n,map.h*16-8];
   assert(!run('canStand(...boundaryPoint)'),id+' closes its '+side+' boundary at '+n);boundarySamples++;
  }
 }
 for(const actor of map.residents||[]){
  C.actorPoint=[actor.x,actor.y];C.actorId=actor.id;
  assert(run('canStand(...actorPoint)&&regionConnected(...actorPoint,9)'),id+' keeps '+actor.name+' on a connected walkable position');
  // Daily plans can place the resident at work or breakfast on scene entry.
  C.actorPoint=run('(()=>{const actor=life.snapshot().find(candidate=>candidate.id===actorId);return[actor.x,actor.y]})()');
  assert(run('Boolean(regionFindApproach(...actorPoint,n=>n.type===\'resident\'&&n.id===actorId))'),actor.name+' has an unmasked E conversation approach at the current routine position');
  run('interact()');assert(run('speaking'),actor.name+' can be spoken to using the real E handler');run('regionDismiss()');residents++;
 }
 for(const portal of map.portals.filter(portal=>portal.kind==='door')){
  C.portalPoint=[portal.x,portal.y];C.portalTarget=portal.target;
  assert(run('Boolean(regionFindApproach(...portalPoint,n=>n.type===\'portal\'&&n.target===portalTarget))'),portal.label+' has a connected unmasked E approach');
  run('interact()');assert.equal(run('areaId'),portal.target,'real E enters the intended interior');
  assert(run('canStand(hero.x,hero.y)'),portal.label+' has a clear interior arrival');
  C.returnPortal=maps[portal.target].portals.find(candidate=>candidate.target===id);
  assert(C.returnPortal,portal.label+' retains its return doorway');
  run('hero.x=returnPortal.x;hero.y=returnPortal.y;interact()');
  assert.equal(run('areaId'),id,'real E returns through '+portal.label);assert(run('canStand(hero.x,hero.y)'),portal.label+' returns onto a clear doorstep');doors++;
 }
 for(const camp of map.camps||[]){
  C.campPoint=[camp.x,camp.y];C.spawnPoints=camp.spawnPoints;
  assert(run('regionConnected(...campPoint,70)'),camp.id+' has a connected combat clearing');
  assert(run('spawnPoints.every(point=>canStand(...point)&&regionConnected(...point,9))'),camp.id+' keeps every authored monster spawn valid and reachable');
 }
 for(const source of map.objects.filter(object=>object.forage)){
  C.plantId=String(typeof source.forage==='object'?source.forage.id||source.id:source.id);C.plantPoint=[source.x,source.y];
  assert(run('Boolean(regionFindApproach(...plantPoint,n=>n.type===\'forage\'&&n.id===plantId))'),source.id+' has a connected unmasked E gathering approach');
  const before=run('JSON.stringify(state.inventory)');run('interact()');assert.notEqual(run('JSON.stringify(state.inventory)'),before,source.id+' is gathered by the production E handler');plants++;
 }
 for(const lane of map.walkLanes||[]){
  const points=Array.isArray(lane)?lane:lane.points;assert(Array.isArray(points)&&points.length>1,id+' declares a useful walk lane');
  for(let i=1;i<points.length;i++){
   const[a,b]=[points[i-1],points[i]],steps=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/2);
   for(let step=0;step<=steps;step++){
    C.lanePoint=[a[0]+(b[0]-a[0])*step/steps,a[1]+(b[1]-a[1])*step/steps];
    if(!run('canStand(...lanePoint)'))assert.fail(id+' travel lane is blocked at '+C.lanePoint+' by '+run("JSON.stringify({tile:tileAt(Math.floor(lanePoint[0]/16),Math.floor(lanePoint[1]/16)),objects:area.objects.filter(o=>o.hit&&lanePoint[0]+4>o.hit[0]&&lanePoint[0]-4<o.hit[0]+o.hit[2]&&lanePoint[1]+2>o.hit[1]&&lanePoint[1]-2<o.hit[1]+o.hit[3]).map(o=>o.id||o.label||o.sprite),camp:combat.blockingCamp(...lanePoint,area,areaId,state,atlas)?.id})"));
   }
  }
 }
 if(id==='lavendyr'){
  assert(run('regionConnected(504,320,9)'),"Maera's existing bluebell quest remains reachable");
  assert(run('regionConnected(352,236,12)'),"Briarvault's existing entry remains reachable");
  run('state.note=true;state.journey.stage=2;hero.x=504;hero.y=320');
  assert.equal(run('findInteraction()?.id'),'closed-flowers','the existing flowers retain the real E prompt');run('interact();regionDismiss()');assert.equal(run('state.journey.stage'),3,'real E still investigates the opening bluebells');
  run('state.journey.stage=5;state.inventory.briar_key=1;hero.x=352;hero.y=236');
  assert.equal(run('findInteraction()?.id'),'cellar-entry','the existing cellar retains its real E entrance prompt');
  run('interact();regionDismiss()');assert.equal(run('areaId'),'briarvault','real E enters Briarvault from the upgraded town');
  run('hero.x=112;hero.y=520;interact();regionDismiss()');assert.equal(run('areaId'),'lavendyr','real E returns from Briarvault into the upgraded town');
  assert(run('canStand(hero.x,hero.y)&&regionConnected(hero.x,hero.y,12)'),'the dungeon return remains on the connected town route');
 }
 for(const[key,landmark]of Object.entries(map.questLandmarks||{})){
  if(Array.isArray(landmark))continue;const point=landmark.at||[landmark.x,landmark.y];
  if(!point.every(Number.isFinite))continue;C.landmarkPoint=point;
  assert(run('regionConnected(...landmarkPoint,24)'),id+' '+key+' gathering/landmark approach is connected');landmarks++;
 }
}
assert.equal(doors,8);assert.equal(residents,13);assert.equal(plants,15);
const gatheredInventory=run('JSON.stringify(state.inventory)'),gatheredDays=run('JSON.stringify(state.foragePicked)');
run("state.clearedCamps['lavenderway:camp-2']=true");
// Exercise the scene's movement-driven road gates in both directions. No
// development travel selector or direct destination entry is used here.
for(const[id,target,side]of[['lavendyr','lavenderway','west'],['lavenderway','lavendyr','east']]){
 C.travelId=id;C.travelTarget=target;C.travelSide=side;
 run("{enter(travelId);const exit=area.exits.find(candidate=>candidate.target===travelTarget);hero.x=travelSide==='west'?13:area.w*16-13;hero.y=exit.y;keys=travelSide==='west'?{a:true}:{d:true};for(let i=0;i<8&&areaId===travelId;i++)update(.04);keys={};}");
 assert.equal(run('areaId'),target,'walking through the '+id+' gate reaches '+target);assert(run('canStand(hero.x,hero.y)'),'road travel arrives safely');
}
run('save()');const save=JSON.parse(storage['blooming-world-v05']);
assert.equal(JSON.stringify(save.inventory),gatheredInventory,'gathered inventory survives scene travel and the original save key');
assert.equal(JSON.stringify(save.foragePicked),gatheredDays,'harvest-day records survive scene travel');
assert(save.clearedCamps['lavenderway:camp-2'],'the existing saved camp flag survives scene travel');
assert(save.worldClock,'region interactions retain the saved game clock');
console.log(`PASS: Lavenderway nature detail preserves all 88 other maps; Lavendyr/Lavenderway production collision connects ${reachablePositions} grid positions, ${doors} working doors, ${residents} conversation approaches, ${plants} actual E harvests and ${landmarks} quest landmarks; four intact camps retain their positions and reachable spawns; ${boundarySamples} closed edge samples, clear authored lanes and movement-driven round-trip travel; 104 residents/109 forage sources/stable quest positions and unchanged Lavendyr/Rosepetal.`);
