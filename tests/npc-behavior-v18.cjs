'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../dist'),maps=JSON.parse(fs.readFileSync(path.join(root,'fixed-maps.json'))),atlas=JSON.parse(fs.readFileSync(path.join(root,'assets/world-v05.json')));
function setup(minutes,getAreas){const C={window:{},Math};vm.createContext(C);for(const f of['routines.js','life.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),C);const life=C.window.BloomLife,clock={day:1,minutes};life.configure({residentsImage:{},clockState:clock,getAreas});return{C,life,clock};}
function stand(area,x,y){for(const[dx,dy]of[[-4,-2],[4,-2],[-4,2],[4,2]])if(['w','x','s'].includes(area.tiles?.[Math.floor((y+dy)/16)]?.[Math.floor((x+dx)/16)]||'x'))return false;return !(area.objects||[]).some(o=>o.hit&&x+4>o.hit[0]&&x-4<o.hit[0]+o.hit[2]&&y+2>o.hit[1]&&y-2<o.hit[1]+o.hit[3]);}

// Actual Tidepetal: Tessa stands beside, but not on, Dara's destination. The
// nearest grid anchor used to remain blocked until Dara's whole work slot ended.
const navigation=setup(430),town=maps.tidepetal;
navigation.life.enter(town,{atlas,staticNavigation:true});navigation.clock.minutes=600;
for(let frame=0;frame<1563;frame++)navigation.life.update(.04,{x:8,y:8});
const dara=navigation.life.snapshot().find(a=>a.id==='tidepetal_dara');
assert.equal(dara.reservationStatus,'occupied','Dara takes the clear workstation beside Tessa');
assert.equal(dara.state,'work');assert(Math.hypot(dara.x-dara.target[0],dara.y-dara.target[1])<=2.5,'the occupied workstation has actually been reached');

// A real ten-person household exercises empty-daytime navigation, staggered
// doorway arrivals, furniture-safe rest and ordered departures through one door.
const indoors=setup(1200,()=>maps),home=maps.tidepetal_1,door=home.portals.find(p=>p.kind==='return');
indoors.life.enter(home,{atlas,staticNavigation:true});assert.equal(indoors.life.snapshot().filter(a=>a.homeGuest).length,0);
indoors.clock.minutes=1380;let arrivals=0,previous=new Map();
for(let frame=0;frame<2400;frame++){
  indoors.life.update(.04,{x:8,y:8});const current=indoors.life.snapshot();
  for(const actor of current.filter(a=>a.homeGuest&&!a.hidden)){
    const before=previous.get(actor.id),source=home.residents?.find(p=>p.id===actor.id)||Object.values(maps).flatMap(a=>a.residents||[]).find(p=>p.id===actor.id);
    assert(stand(home,actor.x,actor.y),actor.id+' walks on accessible floor');
    if(!before||before.hidden){arrivals++;assert(Math.hypot(actor.x-door.x,actor.y-door.y)<2,'new arrival first appears at the doorway');}
    else assert(Math.hypot(actor.x-before.x,actor.y-before.y)<=(source.speed||24)*1.18*.04+.01,actor.id+' walks without teleporting');
    for(const other of current.filter(a=>a.homeGuest&&!a.hidden&&a.id!==actor.id))assert(Math.hypot(actor.x-other.x,actor.y-other.y)>=16-.001,'household members keep room while walking');
  }
  previous=new Map(current.map(a=>[a.id,a]));
}
const sleepers=indoors.life.snapshot().filter(a=>a.homeGuest&&!a.hidden);assert.equal(sleepers.length,10,'all ten original household identities arrive');assert.equal(arrivals,10);assert(sleepers.every(a=>a.sleeping),'every arrival reaches a resting spot');
for(const actor of sleepers){
  for(const dx of[-10,0,10])for(const dy of[-31,-16,-3])assert(!['w','x','s'].includes(home.tiles[Math.floor((actor.y+dy)/16)]?.[Math.floor((actor.x+dx)/16)]||'x'),actor.id+' rests with their full body clear of walls');
  for(const object of home.objects){const art=atlas[object.sprite];if(!art)continue;const scale=object.scale??1,x=object.x-art.anchor[0]*scale-2,y=object.y-art.anchor[1]*scale-1,w=art.rect[2]*scale+4,h=art.rect[3]*scale+3;assert(!(actor.x+10>x&&actor.x-10<x+w&&actor.y>y&&actor.y-31<y+h),actor.id+' rests beside furniture rather than through it');}
}
indoors.clock.minutes=600;
for(let frame=0;frame<3200;frame++){
  const before=new Map(indoors.life.snapshot().map(a=>[a.id,a]));indoors.life.update(.04,{x:8,y:8});
  for(const actor of indoors.life.snapshot().filter(a=>a.homeGuest)){const old=before.get(actor.id);if(old&&!old.hidden&&actor.hidden)assert(Math.hypot(actor.x-door.x,actor.y-door.y)<.6,actor.id+' leaves through the doorway');}
}
assert(indoors.life.snapshot().filter(a=>a.homeGuest).every(a=>a.hidden),'the whole household leaves without jamming the shared threshold');
assert.deepEqual(Array.from(indoors.life.talk(sleepers[0].id,{x:door.x,y:door.y})),[],'departed neighbours cannot be spoken to through stale IDs');

// A resident interaction carries real world coordinates into the game's actual
// scenery ray check. Its stable identity and original actor remain attached.
const interaction=setup(600),outdoors=maps.lavendyr;
interaction.life.enter(outdoors,{atlas,staticNavigation:true});interaction.life.update(.04,{x:8,y:8});
const person=interaction.life.snapshot().find(a=>!a.hidden&&!a.waitingFor),hero={x:person.x+20,y:person.y};
const target=interaction.life.interaction(hero);assert(target&&target.actor);assert.equal(target.id,target.actor.id);assert.equal(target.x,target.actor.x);assert.equal(target.y,target.actor.y);
const source=fs.readFileSync(path.join(root,'adventure.js'),'utf8');
Object.assign(interaction.C,{area:{...outdoors,objects:[{hit:[target.x+8,target.y-5,4,10]}]},hero,combat:null,tileAt:(x,y)=>outdoors.tiles[y]?.[x]||'x',target});
vm.runInContext(source.slice(source.indexOf('function segmentHitsBox('),source.indexOf('function campSpawnRecovery(')),interaction.C);
assert.equal(vm.runInContext('strikeClear(hero,target)',interaction.C),false,'solid scenery blocks talking to the real interaction target');
interaction.C.area.objects=[];assert.equal(vm.runInContext('strikeClear(hero,target)',interaction.C),true,'a clear approach remains interactable');

// Seats have one seated owner. A queued neighbour at an off-road waiting point
// retains a standing pose even though its desired destination is a bench.
const seats=setup(1085);seats.life.enter(maps.tidepetal,{atlas,staticNavigation:true});seats.life.update(.04,{x:8,y:8});
const entries=seats.life.actors({x:0,y:0},town.w*16,town.h*16),seated=entries.filter(e=>e.actor.task?.node.stationKind==='seat'&&e.actor.reservationStatus==='occupied');assert(seated.length>0,'actual evening routines include occupied benches');
for(const {actor}of seated)assert.equal(seats.life.animation(actor.id).motion,'seated');
for(const {actor}of entries.filter(e=>e.actor.waitingFor))assert.equal(seats.life.animation(actor.id).seated,false,'waiting neighbours do not sit on empty grass');
console.log('PASS: actual Tidepetal workstation stall fixed; ten-person indoor arrivals/rest/departures use safe floor and one doorway; resident interaction obstruction/identity preserved; occupied benches use seated poses and queued neighbours stand.');
