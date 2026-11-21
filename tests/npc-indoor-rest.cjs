'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../dist'),maps=JSON.parse(fs.readFileSync(path.join(root,'fixed-maps.json'))),atlas=JSON.parse(fs.readFileSync(path.join(root,'assets/world-v05.json')));
const C={window:{},Math,Map,Set,Int32Array,Uint8Array,Float64Array};vm.createContext(C);for(const file of['routines.js','life.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),C);
const life=C.window.BloomLife,clock={day:1,minutes:1380},sources=Object.values(maps).filter(a=>a.kind==='town').flatMap(a=>a.residents||[]),residentIds=new Set(sources.map(p=>p.id)),locations=new Map(),hidden=new Set();
function record(id,area){assert(!locations.has(id),id+' appears in one place at a time');locations.set(id,area);}
function stand(area,x,y){for(const[dx,dy]of[[-4,-2],[4,-2],[-4,2],[4,2]])if(['w','x','s'].includes(area.tiles?.[Math.floor((y+dy)/16)]?.[Math.floor((x+dx)/16)]||'x'))return false;return !(area.objects||[]).some(o=>o.hit&&x+4>o.hit[0]&&x-4<o.hit[0]+o.hit[2]&&y+2>o.hit[1]&&y-2<o.hit[1]+o.hit[3]);}
life.configure({residentsImage:{},clockState:clock,getAreas:()=>maps});
for(const area of Object.values(maps).filter(a=>a.kind==='town')){
 life.enter(area,{atlas,staticNavigation:true,canStand:(x,y)=>stand(area,x,y)});life.update(.04,{x:8,y:8});
 for(const actor of life.snapshot())if(residentIds.has(actor.id)){if(actor.hidden){hidden.add(actor.id);assert(actor.indoors,'offstage night resident has entered home');}else record(actor.id,area.id);}
}
assert(hidden.size>residentIds.size*.7,'most neighbours go indoors at night');
for(const area of Object.values(maps).filter(a=>a.kind==='interior')){
 life.enter(area,{atlas,staticNavigation:true,canStand:(x,y)=>stand(area,x,y)});life.update(.04,{x:8,y:8});const guests=life.snapshot().filter(a=>a.homeGuest&&!a.hidden);
 for(const actor of guests){assert(stand(area,actor.x,actor.y),actor.id+' rests on accessible floor');assert(hidden.has(actor.id),actor.id+' is no longer outside');record(actor.id,area.id);for(const other of guests)if(actor!==other)assert(Math.hypot(actor.x-other.x,actor.y-other.y)>=20-.001,'household members do not overlap');}
}
assert.equal(locations.size,residentIds.size,'every unique resident is visible either on night duty or in their own home');
const sample=sources.find(p=>hidden.has(p.id)),home=locations.get(sample.id),area=maps[home];life.enter(area,{atlas,staticNavigation:true,canStand:(x,y)=>stand(area,x,y)});assert(life.snapshot().some(a=>a.id===sample.id&&!a.hidden));
clock.minutes=600;life.update(.04,{x:8,y:8});assert(life.snapshot().find(a=>a.id===sample.id).homeTransition==='departing','waking neighbour starts walking to the doorway');for(let frame=0;frame<750;frame++)life.update(.04,{x:8,y:8});assert(!life.actors({x:0,y:0},area.w*16,area.h*16).some(e=>e.actor.id===sample.id),'resting neighbour leaves the interior when the work day begins');
clock.minutes=1200;life.enter(area,{atlas,staticNavigation:true,canStand:(x,y)=>stand(area,x,y)});assert(!life.snapshot().some(a=>a.id===sample.id),'neighbour is still out before bedtime');clock.minutes=1380;life.update(.04,{x:8,y:8});assert(life.snapshot().some(a=>a.id===sample.id&&!a.hidden&&a.homeTransition==='arriving'),'neighbour enters at the doorway while the player remains inside');for(let frame=0;frame<750;frame++)life.update(.04,{x:8,y:8});assert(life.snapshot().some(a=>a.id===sample.id&&!a.hidden&&a.sleeping),'neighbour walks to a resting place');clock.minutes=600;
let daytime=0;
for(const town of Object.values(maps).filter(a=>a.kind==='town')){life.enter(town,{atlas,staticNavigation:true,canStand:(x,y)=>stand(town,x,y)});life.update(.04,{x:8,y:8});daytime+=life.snapshot().filter(a=>residentIds.has(a.id)&&!a.hidden).length;}
assert(daytime>residentIds.size*.7,'neighbours return to outdoor routines by day');
life.configure({clockState:{day:1,minutes:600}});const town=Object.values(maps).find(a=>a.kind==='town'&&a.residents?.length);life.enter(town,{atlas,staticNavigation:true,canStand:(x,y)=>stand(town,x,y)});assert(life.actors({x:0,y:0},town.w*16,town.h*16).length>0,'changing only the clock keeps approved character artwork configured');
console.log('PASS: '+residentIds.size+' unique residents retain identities, enter real homes at rest time, avoid indoor overlap and return to daytime schedules.');
