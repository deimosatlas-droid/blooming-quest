'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../dist'),context={window:{},Math,Map,Set,Int32Array,Uint8Array,Float64Array};
vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(root,'life.js'),'utf8'),context);
const life=context.window.BloomLife,tiles=Array.from({length:12},(_,y)=>y===0||y===11?'x'.repeat(18):'x'+'g'.repeat(16)+'x');
const area={id:'navigation-cache',kind:'town',w:18,h:12,tiles,objects:[{sprite:'fence',x:128,y:128,hit:[120,16,24,112]}],animals:[],residents:[{id:'walker',name:'Mira',type:'herbalist',x:40,y:40,speed:50,route:[[40,40],[232,40]],lines:['The garden is ready.']}]};
function canStand(x,y){for(const[dx,dy]of[[-4,-2],[4,-2],[-4,2],[4,2]])if(['w','x','s'].includes(area.tiles[Math.floor((y+dy)/16)]?.[Math.floor((x+dx)/16)]||'x'))return false;return !area.objects.some(o=>o.hit&&x+4>o.hit[0]&&x-4<o.hit[0]+o.hit[2]&&y+2>o.hit[1]&&y-2<o.hit[1]+o.hit[3]);}
life.configure({residentsImage:{}});life.enter(area,{canStand,staticNavigation:true});
assert.equal(life.navigationStats().builds,1);let crossed=false;
for(let i=0;i<1400;i++){life.update(.04,{x:40,y:50});const actor=life.snapshot()[0];assert(canStand(actor.x,actor.y),'indexed static collision preserves fence-safe movement');if(actor.x>200)crossed=true;}
assert(crossed,'cached graph still routes around a fence');
life.enter(area,{canStand,staticNavigation:true});assert.equal(life.navigationStats().builds,1,'revisit reuses static graph');assert.equal(life.navigationStats().hits,1);
area.objects[0].hit=[120,16,24,144];life.enter(area,{canStand,staticNavigation:true});assert.equal(life.navigationStats().builds,2,'changed collision invalidates graph automatically');
life.invalidateNavigation(area.id);life.enter(area,{canStand,staticNavigation:true});assert.equal(life.navigationStats().builds,3,'explicit invalidation rebuilds graph');
let liveAllowed=true;const dynamic={...area,id:'dynamic',objects:[],residents:[{...area.residents[0],route:[[40,40],[232,40]]}]};
life.enter(dynamic,{canStand:(x,y)=>liveAllowed&&x>20&&x<260&&y>20&&y<170});liveAllowed=false;
const before=life.snapshot()[0];for(let i=0;i<150;i++)life.update(.04,{x:40,y:50});const after=life.snapshot()[0];assert.equal(after.x,before.x,'arbitrary dynamic callback stays live when static cache is not requested');assert.equal(after.y,before.y);
vm.runInContext(fs.readFileSync(path.join(root,'routines.js'),'utf8'),context);life.configure({clockState:{day:1,minutes:600}});life.enter(area,{staticNavigation:true});const plans=life.navigationStats();assert.equal(plans.planBuilds,1);life.enter(area,{staticNavigation:true});assert.equal(life.navigationStats().planBuilds,plans.planBuilds,'unchanged resident plans are reused');assert.equal(life.navigationStats().planHits,plans.planHits+1);
area.residents[0].role='Blacksmith';life.enter(area,{staticNavigation:true});assert.equal(life.navigationStats().planBuilds,plans.planBuilds+1,'changed resident job invalidates its routine plan');
for(let i=0;i<10;i++)life.enter({...area,id:'bounded-'+i},{staticNavigation:true});assert(life.navigationStats().cached<=8,'navigation cache is bounded');
console.log('PASS: static navigation reuse, indexed fence-safe movement, changed-map invalidation, live dynamic callbacks and bounded navigation memory.');
