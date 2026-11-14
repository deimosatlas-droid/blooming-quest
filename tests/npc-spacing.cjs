'use strict';
/* Run with node tests/npc-spacing.cjs. No renderer, package install or network needed. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../dist');
const MIN_DISTANCE=16,EPSILON=.15;
function setup(){
 const sandbox={window:{},Math,Map,Set,Int32Array,Uint8Array,Float64Array};vm.createContext(sandbox);
 for(const name of ['routines.js','life.js'])vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),sandbox);
 return sandbox.window.BloomLife;
}
function physicalStand(map,x,y){
 for(const [dx,dy]of[[-4,-2],[4,-2],[-4,2],[4,2]])if(['w','x','s'].includes(map.tiles[Math.floor((y+dy)/16)]?.[Math.floor((x+dx)/16)]||'x'))return false;
 return !map.objects.some(o=>o.hit&&x+4>o.hit[0]&&x-4<o.hit[0]+o.hit[2]&&y+2>o.hit[1]&&y-2<o.hit[1]+o.hit[3]);
}
function isWaitingClaim(entry){return entry.status==='waiting'||entry.kind==='waiting'||entry.kind==='idle';}
function claims(life){return life.inspectReservations().filter(r=>!isWaitingClaim(r));}
function assertUniqueClaims(life,label){
 const reservations=claims(life),keys=new Set(),owners=new Set(),actors=new Set(life.snapshot().map(a=>a.id));
 for(const r of reservations){
  assert.equal(typeof r.stationKey,'string',label+': station claims have stable keys');assert(r.stationKey.length,label+': station key is not empty');
  assert(!keys.has(r.stationKey),label+': station capacity is1 for '+r.stationKey);keys.add(r.stationKey);
  assert(!owners.has(r.owner),label+': resident holds onlyone destination at a time: '+r.owner);owners.add(r.owner);
  assert(actors.has(r.owner),label+': reservation owner is a current resident');
  assert(Array.isArray(r.point)&&r.point.length===2,label+': station claim records its approach point');
 }
 return reservations;
}
function humans(life){return life.snapshot().filter(a=>a.id!=='stormy-companion'&&a.job);}
function assertSpacing(life,map,label,{offRoad=true}={}){
 const actors=humans(life);
 for(let i=0;i<actors.length;i++){
  const a=actors[i];assert(physicalStand(map,a.x,a.y),label+': '+a.id+' stays clear of solid scenery');
  for(let j=i+1;j<actors.length;j++){
   const b=actors[j],distance=Math.hypot(a.x-b.x,a.y-b.y);
   assert(distance>=MIN_DISTANCE-EPSILON,label+': '+a.id+' and '+b.id+' crowd to '+distance.toFixed(2)+'px');
  }
  if(offRoad&&a.waitingFor&&a.target){
   assert(physicalStand(map,...a.target),label+': '+a.id+' waiting point is physically safe');
   const code=map.tiles[Math.floor(a.target[1]/16)]?.[Math.floor(a.target[0]/16)];
   assert(!['d','c','b'].includes(code),label+': '+a.id+' waits away from the main walking surface');
  }
 }
 assertUniqueClaims(life,label);
 return actors;
}
const fixtureAtlas={estate_workbench:{rect:[0,0,48,45],anchor:[24,45]}};
function fixture(count=8,secondStation=false){
 const m={id:'capacity-fixture',w:40,h:24,kind:'town',theme:'rose',tiles:Array.from({length:24},(_,y)=>y===12||y===13?'d'.repeat(40):'g'.repeat(40)),objects:[{sprite:'estate_workbench',x:320,y:144,label:'The shared craft bench',hit:[300,131,40,10]}],workstations:[{id:'shared-craft',kind:'craft',x:320,y:168,target:[320,144],label:'The shared craft bench'}],portals:[],exits:[],animals:[],residents:[]};
 if(secondStation){m.objects.push({sprite:'estate_workbench',x:432,y:144,label:'The second craft bench',hit:[412,131,40,10]});m.workstations.push({id:'second-craft',kind:'craft',x:432,y:168,target:[432,144],label:'The second craft bench'});}
 const nodes=[{point:[320,168],focus:[320,144],label:'The shared craft bench'}];
 if(secondStation)nodes.push({point:[432,168],focus:[432,144],label:'The second craft bench'});
 for(let i=0;i<count;i++)m.residents.push({id:'worker-'+i,name:'Worker '+i,role:'Carpenter',type:'worker',x:64+i*32,y:320,speed:40,route:[[64+i*32,320],[320,168]],lines:['There is always something to mend.'],routine:{home:[64+i*32,320],work:nodes,lunch:nodes,shop:[560,320],evening:[64+i*32,320]}});
 return m;
}
const life=setup();assert.equal(typeof life.inspectReservations,'function','v10 exports reservation inspection');
const crowded=fixture(),worldClock={day:1,minutes:618};life.configure({residentsImage:{},clockState:worldClock});life.enter(crowded,{canStand:(x,y)=>physicalStand(crowded,x,y),atlas:fixtureAtlas});
let actors=assertSpacing(life,crowded,'single-station entry'),active=claims(life);
assert.equal(actors.length,8,'all eight residents remain in the scene');assert.equal(active.length,1,'raw object and workstation aliases share one capacity1 station');
assert(actors.filter(a=>a.waitingFor).length>=7,'residents who cannot reserve a station use distinct waiting positions');
const firstOwner=active[0].owner,firstStation=active[0].stationKey,initialQueue=actors.filter(a=>a.waitingFor).map(a=>a.id);
const firstPlan=life.inspectRoutines().find(p=>p.id===firstOwner),initialSlot=Math.floor((worldClock.minutes-firstPlan.times.start)/firstPlan.times.cycle);
life.update(.04,{x:16,y:16});
const occupied=claims(life).find(r=>r.owner===firstOwner);
assert.equal(occupied.status,'occupied','initial station user has arrived');
const arrivalMinute=worldClock.minutes;
assert(occupied.leaseUntil-arrivalMinute>=18-.05&&occupied.leaseUntil-arrivalMinute<=26+.05,'actual occupied use has an18–26minute finite lease');
let releasedAt=null,handover=null,breakUntil=null;
for(let frame=0;frame<1350;frame++){
 life.update(.04,{x:16,y:16});
 const claim=claims(life).find(r=>r.stationKey===firstStation),oldActor=humans(life).find(a=>a.id===firstOwner);
 if(releasedAt===null&&(!claim||claim.owner!==firstOwner)){
  releasedAt=worldClock.minutes;breakUntil=oldActor.breakUntil;
  assert(oldActor.waitingFor,'former owner leaves the station for an off-station break');
  assert(Number.isFinite(breakUntil),'former user records its break deadline');
  assert(breakUntil-releasedAt>=8-.05&&breakUntil-releasedAt<=14+.05,'use is followed by an8–14minute off-station break');
 }
 if(releasedAt!==null&&worldClock.minutes<releasedAt+8-.05)assert(!claims(life).some(r=>r.owner===firstOwner),'previous owner cannot immediately reclaim during its minimum break');
 if(!handover&&claim&&claim.owner!==firstOwner)handover={owner:claim.owner,minute:worldClock.minutes};
 if(frame%5===0)assertSpacing(life,crowded,'single-station frame'+frame);
}
assert(releasedAt!==null&&releasedAt-arrivalMinute<=26+.1,'station is released within its use lease');
assert(handover,'a queued resident receives the station after its prior user leaves');
assert.equal(handover.owner,initialQueue[0],'the oldest queued resident receives the station before the previous owner can reclaim it');
assert.equal(Math.floor((handover.minute-firstPlan.times.start)/firstPlan.times.cycle),initialSlot,'handover occurs within the same work slot, not only on a schedule change');
const oldKeys=new Set(claims(life).map(r=>r.stationKey));worldClock.minutes=1300;life.update(.04,{x:16,y:16});
assert(!claims(life).some(r=>oldKeys.has(r.stationKey)),'task changes release old station claims immediately');
life.enter({...crowded,id:'empty-road',kind:'road',residents:[],workstations:[]},{canStand:(x,y)=>physicalStand(crowded,x,y),atlas:fixtureAtlas});
assert.equal(life.inspectReservations().length,0,'leaving an area releases every reservation');assert.equal(humans(life).length,0,'an empty resident list never resurrects prior NPCs');
worldClock.minutes=600;life.enter(crowded,{canStand:(x,y)=>physicalStand(crowded,x,y),atlas:fixtureAtlas});
assert.equal(claims(life).length,1,'station is reservable again after returning');assertSpacing(life,crowded,'return to shared station');
const alternatives=fixture(8,true),alternativeClock={day:1,minutes:600};life.configure({residentsImage:{},clockState:alternativeClock});life.enter(alternatives,{canStand:(x,y)=>physicalStand(alternatives,x,y),atlas:fixtureAtlas});
assert.equal(claims(life).length,2,'a second station of the same kind is used before waiting');assertSpacing(life,alternatives,'alternative stations');
const approaching=fixture(1),approachClock={day:1,minutes:430};life.configure({residentsImage:{},clockState:approachClock});life.enter(approaching,{canStand:(x,y)=>physicalStand(approaching,x,y),atlas:fixtureAtlas});
approachClock.minutes=600;life.update(.04,{x:16,y:16});const traveller=humans(life)[0];
assert.equal(traveller.state,'travel','fixture resident is still approaching the workbench');
assert(claims(life).some(r=>r.owner===traveller.id&&r.stationKey===traveller.stationKey),'station is reserved while the resident is approaching');
const approachClaim=claims(life).find(r=>r.owner===traveller.id);assert.equal(approachClaim.approachUntil-approachClaim.since,90,'an approach reservation has a finite90-minute timeout');
const maps=JSON.parse(fs.readFileSync(path.join(root,'fixed-maps.json'))),atlas=JSON.parse(fs.readFileSync(path.join(root,'assets/world-v05.json')));
let residentCount=0,samples=0,waitingSamples=0,minimum=Infinity;const residentIds=new Set();const phases=[430,600,735,900,1085,1300];
for(const map of Object.values(maps))if(map.kind==='town'||map.kind==='home'){
 residentCount+=map.residents.length;for(const person of map.residents){assert(!residentIds.has(person.id),'resident identity remains unique after relocation: '+person.id);residentIds.add(person.id);}
 for(const minute of phases){
  const state={day:1,minutes:minute};life.configure({residentsImage:{},clockState:state});life.enter(map,{canStand:(x,y)=>physicalStand(map,x,y),atlas});
  const check=label=>{
   const current=assertSpacing(life,map,label);assert.equal(current.length,map.residents.length,map.id+': every authored NPC is present');
   for(let i=0;i<current.length;i++)for(let j=i+1;j<current.length;j++)minimum=Math.min(minimum,Math.hypot(current[i].x-current[j].x,current[i].y-current[j].y));
   waitingSamples+=current.filter(a=>a.waitingFor).length;samples++;
  };
  check(map.id+' minute'+minute+' entry');
  for(let frame=0;frame<300;frame++){life.update(.04,{x:16,y:16});if(frame%10===0)check(map.id+' minute'+minute+' frame'+frame);}
 }
}
assert.equal(residentCount,104,'all104 unique NPC identities are retained across towns');
console.log('PASS: station capacity1 including approach, alias canonicalization, alternate stations, safe distinct waits, finite use/break/approach leases and FIFO handover, task/exit release, reacquisition, empty-scene handling; '+residentCount+' NPCs across six phases, '+samples+' spacing samples, '+waitingSamples+' queued-actor samples, minimum '+(Number.isFinite(minimum)?minimum.toFixed(2):'n/a')+'px.');
