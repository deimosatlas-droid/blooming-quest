'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../dist');
function setup(){const sandbox={window:{},Math,Map,Set,Int32Array,Uint8Array,Float64Array};vm.createContext(sandbox);for(const f of['routines.js','life.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),sandbox);return sandbox.window.BloomLife;}
function stand(map,x,y){for(const[dx,dy]of[[-4,-2],[4,-2],[-4,2],[4,2]])if(['w','x','s'].includes(map.tiles[Math.floor((y+dy)/16)]?.[Math.floor((x+dx)/16)]||'x'))return false;return!map.objects.some(o=>o.hit&&x+4>o.hit[0]&&x-4<o.hit[0]+o.hit[2]&&y+2>o.hit[1]&&y-2<o.hit[1]+o.hit[3]);}
const maps=JSON.parse(fs.readFileSync(path.join(root,'fixed-maps.json'))),atlas=JSON.parse(fs.readFileSync(path.join(root,'assets/world-v05.json')));
const routineSandbox={window:{},Math};vm.createContext(routineSandbox);vm.runInContext(fs.readFileSync(path.join(root,'routines.js'),'utf8'),routineSandbox);const planner=routineSandbox.window.BloomRoutines;
let count=0,wateringCases=0,maxWaterFoot=0,maxWaterHand=0;
for(const map of Object.values(maps))if(map.kind==='town'){
 const life=setup(),clock={day:1,minutes:600};life.configure({residentsImage:{},clockState:clock});life.enter(map,{canStand:(x,y)=>stand(map,x,y),atlas});
 for(const plan of life.inspectRoutines()){
  count++;
  if(!['child','elder'].includes(plan.job))for(const node of plan.work)assert.notEqual(node.stationKind,'seat',map.id+': '+plan.id+' does not use a labelled porch bench as job equipment');
  for(const node of[plan.home,...plan.work,...plan.lunch,...plan.shops,...plan.evening])if(node.source!=='authored'&&node.source!=='start')assert(Math.hypot(node.point[0]-node.focus[0],node.point[1]-node.focus[1])<=48,map.id+': '+plan.id+' can actually reach the equipment from its approach point');
 }
 life.update(.01,{x:16,y:16});
 for(const entry of life.actors({x:0,y:0},map.w*16,map.h*16))if(entry.actor.kind==='resident'){
  const actor=entry.actor,m=/object-(\d+)$/.exec(actor.task.node.stationKey),object=m?map.objects[+m[1]]:null;
  if(object&&/bench/.test(object.sprite)&&!/workbench/.test(object.sprite))assert(!['hammer','craft','carry','serve'].includes(actor.task.action),map.id+': '+actor.id+' uses the physical seat truthfully');
  if(actor.plan.job==='gardener'){
   const original={task:actor.task,x:actor.x,y:actor.y,face:actor.face,working:actor.working,walking:actor.walking,minute:clock.minutes};
   for(const node of actor.plan.stations||[]){
    if(!node.tags.includes('garden'))continue;
    const task=planner.forNode(actor.plan,{...actor.task,phase:'morning-work',action:'water',baseAction:'water',state:'work'},node);if(task.action!=='water')continue;
    const dx=node.focus[0]-node.point[0],dy=node.focus[1]-node.point[1];actor.task=task;actor.x=node.point[0];actor.y=node.point[1];actor.face=Math.abs(dx)>Math.abs(dy)?dx<0?'left':'right':dy<0?'up':'down';actor.working=true;actor.walking=false;
    const foot=Math.hypot(dx,dy);assert(foot<=32,map.id+': '+actor.id+' watering approach is close to the actual plant');maxWaterFoot=Math.max(maxWaterFoot,foot);
    for(let sample=0;sample<12;sample++){
     clock.minutes=600+sample*.24;const pose=life.animation(actor.id),side=actor.face==='left'?-1:1,hand=[actor.x+pose.baseX+side*6+pose.torsoX+(side<0?pose.leftArmX:pose.rightArmX),actor.y-13+pose.torsoY+(side<0?pose.leftArmY:pose.rightArmY)],distance=Math.hypot(node.focus[0]-hand[0],node.focus[1]-hand[1]);
     assert(distance<=20.1,map.id+': '+actor.id+' watering stream can reach the plant from the actual animated hand');maxWaterHand=Math.max(maxWaterHand,distance);
    }
    wateringCases++;
   }
   Object.assign(actor,{task:original.task,x:original.x,y:original.y,face:original.face,working:original.working,walking:original.walking});clock.minutes=original.minute;
  }
 }
}
assert.equal(count,104,'all unique residents retain schedules');
const fixture={id:'continuity',w:40,h:24,kind:'town',theme:'rose',tiles:Array.from({length:24},(_,y)=>y===12||y===13?'d'.repeat(40):'g'.repeat(40)),objects:[{sprite:'estate_workbench',x:320,y:144,label:'The shared craft bench',hit:[300,131,40,10]}],workstations:[{id:'shared',kind:'craft',x:320,y:168,target:[320,144],label:'The shared craft bench'}],residents:[],animals:[],portals:[],exits:[]};
for(let i=0;i<3;i++)fixture.residents.push({id:'worker-'+i,name:'Worker '+i,role:'Carpenter',type:'worker',x:64+i*32,y:320,speed:40,routine:{home:[64+i*32,320],work:[{point:[320,168],focus:[320,144],label:'The shared craft bench'}],evening:[64+i*32,320]},route:[[64+i*32,320],[320,168]],lines:['Hello.']});
const life=setup(),clock={day:1,minutes:618};life.configure({residentsImage:{},clockState:clock});life.enter(fixture,{canStand:(x,y)=>stand(fixture,x,y),atlas});life.update(.04,{x:16,y:16});const firstOwner=life.inspectReservations()[0].owner;let before;
for(let f=0;f<1400;f++){
 life.update(.04,{x:16,y:16});const first=life.snapshot().find(a=>a.id===firstOwner),claim=life.inspectReservations()[0];
 if(claim&&claim.owner!==firstOwner&&first.breakUntil>clock.minutes){before={clock:clock.minutes,first,claim,actors:life.snapshot()};break;}
}
assert(before,'fixture reaches a queued handover while the previous owner is taking its required break');
const inside={...fixture,id:'inside',kind:'interior',residents:[]};
life.enter(inside,{canStand:(x,y)=>stand(fixture,x,y),atlas});const serialized=JSON.parse(JSON.stringify(clock)),savedQueue=JSON.parse(JSON.stringify(clock.stationState.continuity.queues));life.enter(fixture,{canStand:(x,y)=>stand(fixture,x,y),atlas});
assert.equal(life.clock().minutes,before.clock,'scene entry never advances the clock');
let claim=life.inspectReservations().find(c=>c.stationKey===before.claim.stationKey),old=life.snapshot().find(a=>a.id===firstOwner);
assert.equal(claim.owner,before.claim.owner,'the new owner keeps an approaching reservation after a house visit');assert.equal(claim.approachUntil,before.claim.approachUntil,'house entry cannot renew its approach lease');assert.equal(old.breakUntil,before.first.breakUntil,'house entry cannot remove a mandatory work break');
for(const actor of life.snapshot()){const previous=before.actors.find(p=>p.id===actor.id);assert(Math.hypot(actor.x-previous.x,actor.y-previous.y)<.001,'brief re-entry preserves '+actor.id+' position');}
const reloaded=setup();reloaded.configure({residentsImage:{},clockState:serialized});reloaded.enter(fixture,{canStand:(x,y)=>stand(fixture,x,y),atlas});claim=reloaded.inspectReservations().find(c=>c.stationKey===before.claim.stationKey);assert.equal(claim.owner,before.claim.owner,'save/reload preserves approaching station ownership');assert.equal(reloaded.snapshot().find(a=>a.id===firstOwner).breakUntil,before.first.breakUntil,'save/reload preserves the break deadline');
reloaded.enter(inside,{canStand:(x,y)=>stand(fixture,x,y),atlas});
assert.deepEqual(JSON.parse(JSON.stringify(serialized.stationState.continuity.queues)),savedQueue,'the active FIFO waiting order survives scene entry and save/reload');
reloaded.enter(fixture,{canStand:(x,y)=>stand(fixture,x,y),atlas});assert.equal(reloaded.inspectReservations().find(c=>c.stationKey===before.claim.stationKey).owner,before.claim.owner,'repeated room visits cannot steal the active reservation');
// Known misleading labels cannot turn seats into crafting equipment.
const seatMap={...fixture,id:'physical-seat',objects:[{sprite:'town_bench',x:320,y:144,label:'The Blacksmith Workshop porch bench',hit:[306,134,28,8]}],workstations:[{id:'bad-label',kind:'craft',x:320,y:168,target:[320,144],label:'The Blacksmith Workshop porch bench'}],residents:[{id:'smith',name:'Pip',role:'Blacksmith',type:'blacksmith',x:96,y:320,route:[[96,320],[320,168]],lines:['Hello.']}]};
const seat=setup();seat.configure({residentsImage:{},clockState:{day:1,minutes:600}});seat.enter(seatMap,{canStand:(x,y)=>stand(seatMap,x,y),atlas});seat.update(.01,{x:16,y:16});assert(!['hammer','craft'].includes(seat.snapshot()[0].activity),'without valid equipment the smith gets a truthful non-hammering task');
// The water arc follows actual equipment coordinates in every facing direction.
const drawLife=setup(),drawClock={day:1,minutes:600};drawLife.configure({residentsImage:{},clockState:drawClock});drawLife.enter({...fixture,id:'water',objects:[],workstations:[],residents:[{...fixture.residents[0],id:'gardener',role:'Gardener',type:'herbalist',routine:{home:[64,320],work:[320,168]}}]},{canStand:(x,y)=>stand(fixture,x,y)});const actor=drawLife.actors({x:0,y:0},640,384)[0].actor;actor.x=160;actor.y=160;actor.walking=false;actor.working=true;actor.talkPause=0;actor.state='work';
const directions={up:[0,-1],right:[1,0],down:[0,1],left:[-1,0]};
for(const[face,[ux,uy]]of Object.entries(directions)){
 actor.face=face;actor.task.action='water';const pose=drawLife.animation(actor.id),side=face==='left'?-1:1,hand=[actor.x+pose.baseX+side*6+pose.torsoX+(side<0?pose.leftArmX:pose.rightArmX),actor.y-13+pose.torsoY+(side<0?pose.leftArmY:pose.rightArmY)];actor.task.node.focus=[hand[0]+ux*14,hand[1]+uy*14];const drops=[];let color='';const ctx={save(){},restore(){},beginPath(){},ellipse(){},fill(){},drawImage(){},moveTo(){},lineTo(){},stroke(){},fillRect(x,y,w,h){if(['#83bed0','#c6e6da'].includes(color))drops.push([x,y]);},set fillStyle(v){color=v;},set strokeStyle(v){},set lineWidth(v){}};drawLife.draw({actor},ctx,{x:0,y:0});assert.equal(drops.length,3);const dot=drops.reduce((sum,p)=>sum+(p[0]-hand[0])*ux+(p[1]-hand[1])*uy,0)/drops.length;assert(dot>0,face+' watering arc travels toward the actual plant');assert(drops.every(p=>Math.hypot(p[0]-hand[0],p[1]-hand[1])<=19),face+' arc stays short');
}
const defaultLife=setup();defaultLife.enter({...fixture,residents:[]},{canStand:()=>true});assert.doesNotThrow(()=>defaultLife.enter({...inside,residents:[]},{canStand:()=>true}),'default clock remains compatible when a test/client enters scenes before image configuration');
console.log('PASS: actual104-resident fixture compatibility and close approaches; physical seats override misleading job labels; scene/save continuity preserves leases, breaks, FIFO and positions; four-direction plant-target watering; '+wateringCases+' actual plant-care cases, maxfoot '+maxWaterFoot.toFixed(1)+'px/maxanimated-hand '+maxWaterHand.toFixed(1)+'px.');
