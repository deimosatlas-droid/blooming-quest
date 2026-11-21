'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../dist/mobile-controls.js'),'utf8');

// A small DOM event-path fixture, independent of the controls implementation.
// Capture is pending until the next pointer event, capture events bubble, and
// pointerup/cancel implicitly release capture, as in Pointer Events 3 §§4.1.3/9.
// This deliberately differs from the direct, nonbubbling emitters in older tests.
class Node{
 constructor(name,parent=null,key=''){
  this.name=name;this.parentNode=parent;this.dataset=key?{key}:{};this.disabled=false;this.events=new Map();this.attrs={};this.style={};
  const classes=new Set();this.classList={toggle:(name,on)=>on?classes.add(name):classes.delete(name),contains:name=>classes.has(name)};
 }
 addEventListener(type,handler){if(!this.events.has(type))this.events.set(type,new Set());this.events.get(type).add(handler);}
 removeEventListener(type,handler){this.events.get(type)?.delete(handler);}
 setAttribute(name,value){this.attrs[name]=value;}
 closest(selector){for(let node=this;node;node=node.parentNode){if(selector==='[data-key]'&&node.dataset?.key)return node;if(selector==='.touch-pad'&&node.isPad)return node;}return null;}
 setPointerCapture(id){this.device.capture(this,id);}
 hasPointerCapture(id){return this.device.pending.get(id)===this;}
 releasePointerCapture(id){if(this.hasPointerCapture(id))this.device.pending.delete(id);}
 dispatch(type,fields={},bubbles=true){
  const event={type,target:this,currentTarget:null,defaultPrevented:false,bubbles,preventDefault(){this.defaultPrevented=true;},...fields};
  for(let node=this;node;node=bubbles?node.parentNode:null){event.currentTarget=node;for(const handler of [...(node.events.get(type)||[])])handler(event);}
  event.currentTarget=null;return event;
 }
}
class PointerDevice{
 constructor(){this.active=new Map();this.pending=new Map();this.contacts=new Map();this.log=[];}
 capture(target,id){if(!this.contacts.has(id))throw Error('NotFoundError');this.pending.set(id,target);}
 process(id){
  const previous=this.active.get(id),next=this.pending.get(id),fields=this.contacts.get(id)||{pointerId:id};
  if(previous&&previous!==next){this.log.push(['lostpointercapture',previous.name,id]);previous.dispatch('lostpointercapture',fields);}
  if(next&&previous!==next){this.log.push(['gotpointercapture',next.name,id]);next.dispatch('gotpointercapture',fields);}
  if(next)this.active.set(id,next);else this.active.delete(id);
 }
 down(target,id,x,y){
  const fields={pointerId:id,pointerType:'touch',button:0,buttons:1,clientX:x,clientY:y};
  this.contacts.set(id,fields);this.pending.set(id,target); // implicit capture before pointerdown listeners
  return target.dispatch('pointerdown',fields);
 }
 move(hit,id,x,y){
  const fields={...this.contacts.get(id),clientX:x,clientY:y};this.contacts.set(id,fields);this.process(id);
  (this.active.get(id)||hit).dispatch('pointermove',fields);
 }
 end(hit,id,type='pointerup'){
  this.process(id);const fields={...this.contacts.get(id),buttons:0};
  (this.active.get(id)||hit).dispatch(type,fields);this.pending.delete(id);this.process(id);this.contacts.delete(id);
 }
 lose(id){this.pending.delete(id);this.process(id);}
}
function fixture(onHeld){
 const win=new Node('window'),doc=new Node('document',win),orientation=new Node('orientation'),pad=new Node('pad',doc),device=new PointerDevice();
 pad.isPad=true;let rect={left:20,top:30,width:140,height:140};pad.getBoundingClientRect=()=>rect;
 const arrows=['arrowup','arrowdown','arrowleft','arrowright'].map(key=>new Node(key,pad,key)),run=new Node('run',doc,'shift'),attack=new Node('attack',doc,' '),guard=new Node('guard',doc,'c'),buttons=[...arrows,run,attack,guard];
 const under=new Node('outside',doc),icon=new Node('arrow-icon',arrows[3]);for(const node of[win,doc,pad,...buttons,under,icon])node.device=device;
 doc.hidden=false;doc.visibilityState='visible';doc.querySelectorAll=()=>buttons;doc.elementFromPoint=()=>under;win.screen={orientation};
 const C={window:win,document:doc,Promise};vm.createContext(C);vm.runInContext(source,C,{filename:'mobile-controls.js'});
 const values=new Map(),changes=[],control=C.window.BloomMobile.bindHolds({root:doc,win,onHeld:(key,value)=>{values.set(key,value);changes.push([key,value]);onHeld?.(key,value,control);}});
 const held=()=>[...values].filter(([,value])=>value).map(([key])=>key).sort();
 return{win,doc,orientation,pad,arrows,run,attack,guard,buttons,under,icon,device,control,held,changes,setRect:next=>rect=next};
}
const checks=[];
function check(name,run){try{run();checks.push([name,true]);}catch(error){checks.push([name,false]);console.error('FAIL: '+name+'\n'+error.stack);}}

check('implicit capture is replaced before activation; events bubble through button/pad/window',()=>{
 const f=fixture();f.device.down(f.icon,1,150,45);assert.deepEqual(f.held(),['arrowright','arrowup']);
 f.device.move(f.under,1,150,45);assert.equal(f.device.active.get(1),f.pad,'the pad owns the captured thumb');
 assert.deepEqual(f.device.log,[['gotpointercapture','pad',1]],'synchronous override does not invent a lost implicit-button event');
 assert.equal(f.control.snapshot().pointers,1,'bubbling pointerdown starts only one hold');
 assert.deepEqual(f.changes,[['arrowright',true],['arrowup',true]],'bubbling pointermove does not pulse the held keys');
 f.device.end(f.under,1);assert.deepEqual(f.held(),[]);assert.equal(f.control.snapshot().pointers,0);
});
check('descendant capture transfer bubbles without releasing the pad-owned hold',()=>{
 const f=fixture();f.device.down(f.arrows[3],40,150,100);
 // Exercise an actual established descendant capture followed by a transfer,
 // separately from the usual implicit-capture override before activation.
 f.arrows[3].setPointerCapture(40);f.device.move(f.under,40,150,100);
 f.pad.setPointerCapture(40);f.device.move(f.under,40,150,100);
 assert.deepEqual(f.device.log,[['gotpointercapture','arrowright',40],['lostpointercapture','arrowright',40],['gotpointercapture','pad',40]]);
 assert.deepEqual(f.held(),['arrowright'],'the previous descendant loss cannot release the new pad hold');
 assert.equal(f.control.snapshot().pointers,1);f.device.lose(40);assert.deepEqual(f.held(),[],'losing capture on the actual pad releases it');f.device.end(f.under,40);
});
check('failed explicit capture still releases when the implicit descendant owner loses capture',()=>{
 const f=fixture();f.pad.setPointerCapture=()=>{throw Error('capture unavailable');};f.device.down(f.icon,41,150,100);f.device.move(f.under,41,150,100);
 assert.equal(f.device.active.get(41),f.icon,'the implicit target remains captured when pad capture fails');assert.deepEqual(f.held(),['arrowright']);
 f.device.lose(41);assert.deepEqual(f.held(),[],'loss of the fallback owner must not stick movement');f.device.move(f.under,41,150,100);assert.deepEqual(f.held(),[]);f.device.end(f.under,41);
});
check('browser chrome and visual viewport resize keep a stationary thumb moving',()=>{
 const f=fixture();f.device.down(f.arrows[3],2,150,100);f.device.move(f.under,2,150,100);
 for(let tick=0;tick<4;tick++){f.win.dispatch('resize');assert.deepEqual(f.held(),['arrowright'],'resize is not a touch release');}
 f.setRect({left:20,top:10,width:140,height:140});f.win.dispatch('resize');assert.deepEqual(f.held(),['arrowright']);
 f.device.move(f.under,2,150,80);assert.deepEqual(f.held(),['arrowright'],'the next move uses the resized pad geometry');
 f.device.end(f.under,2);assert.deepEqual(f.held(),[],'release after resize cannot leave movement stuck');
});
check('captured thumb drift past pad bounds keeps eight-way movement and combat fingers',()=>{
 const f=fixture();f.device.down(f.pad,3,150,45);f.device.down(f.attack,4,400,100);f.device.down(f.guard,5,450,100);
 f.device.move(f.under,3,205,-15);assert.deepEqual(f.held(),[' ','arrowright','arrowup','c'],'a thumb remains directed beyond the tiny pad');
 f.pad.dispatch('pointerleave',{pointerId:3,pointerType:'touch',clientX:205,clientY:-15},false);assert.deepEqual(f.held(),[' ','arrowright','arrowup','c'],'layout/capture boundary events do not release a live touch');
 f.device.move(f.under,3,-30,180);assert.deepEqual(f.held(),[' ','arrowdown','arrowleft','c'],'the thumb can steer through all sectors outside the pad');
 f.device.move(f.under,3,90,100);assert.deepEqual(f.held(),[' ','c'],'the centre deadzone remains an intentional stop');
 f.device.move(f.under,3,205,100);f.device.end(f.under,4);assert.deepEqual(f.held(),['arrowright','c'],'lifting attack does not drop the walking thumb or guard');
 f.device.end(f.under,3,'pointercancel');assert.deepEqual(f.held(),['c'],'OS cancellation releases only that thumb');f.device.end(f.under,5);assert.deepEqual(f.held(),[]);
});
check('capture loss, visibility, app switching and both orientation APIs stop without resurrection',()=>{
 for(const cause of['capture','blur','pagehide','hidden','orientationchange','orientation-api']){
  const f=fixture();f.device.down(f.pad,10,150,45);f.device.move(f.under,10,150,45);f.device.down(f.run,11,300,100);
  if(cause==='capture'){f.device.lose(10);f.device.end(f.run,11);}
  else if(cause==='hidden'){f.doc.hidden=true;f.doc.dispatch('visibilitychange');}
  else if(cause==='orientation-api')f.orientation.dispatch('change');else f.win.dispatch(cause);
  assert.deepEqual(f.held(),[],cause+' clears held input');assert.equal(f.control.snapshot().pointers,0,cause+' removes live pointer bookkeeping');
  f.device.move(f.under,10,150,45);assert.deepEqual(f.held(),[],cause+' cannot resurrect from a late captured move');
  f.device.end(f.under,10);f.device.end(f.run,11);assert.deepEqual(f.held(),[]);
 }
});
check('menu rejection during diagonal pointerdown cannot capture or restart on the bubbling pad',()=>{
 let rejects=0;const f=fixture((key,value,control)=>{if(value){rejects++;control.reset();}});
 f.device.down(f.icon,20,150,45);assert.deepEqual(f.held(),[]);assert.equal(f.control.snapshot().pointers,0);
 assert.equal(rejects,1,'the pad must not retry a rejected descendant pointerdown');
 assert.notEqual(f.device.pending.get(20),f.pad,'a rejected hold must not acquire explicit pad capture');
 f.device.move(f.under,20,150,45);assert.deepEqual(f.held(),[]);f.device.end(f.under,20);
});
check('disabled buttons reject nested hits and controller destroy removes every listener',()=>{
 const f=fixture();f.arrows[3].disabled=true;f.device.down(f.icon,30,150,100);assert.deepEqual(f.held(),[],'the parent pad cannot bypass a disabled arrow');f.device.end(f.under,30);
 for(const arrow of f.arrows)arrow.disabled=true;f.device.down(f.pad,31,150,45);assert.deepEqual(f.held(),[]);f.device.end(f.under,31);
 f.arrows[0].disabled=false;f.device.down(f.pad,32,90,40);f.control.destroy();assert.deepEqual(f.held(),[]);
 for(const node of[f.doc,f.win,f.orientation,f.pad,...f.buttons])for(const handlers of node.events.values())assert.equal(handlers.size,0,'destroy removes '+node.name+' listeners');
 f.device.move(f.under,32,150,45);assert.deepEqual(f.held(),[]);f.device.end(f.under,32);
});
const failures=checks.filter(([,passed])=>!passed);
if(failures.length){console.error(failures.length+' of '+checks.length+' touch lifecycle checks failed');process.exitCode=1;}
else console.log('PASS: spec-ordered implicit/pending capture, DOM bubbling, sustained mobile viewport resize and thumb drift, independent combat fingers, cancellation/interruption cleanup, rejected menu input and teardown.');
