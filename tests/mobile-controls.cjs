'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../dist');
class Target{
 constructor(id='',key){this.id=id;this.dataset=key?{key}:{};this.events=new Map();this.attrs={};this.style={};this.children=[];this.textContent='';this.hidden=false;this.disabled=false;this.focuses=0;const values=new Set();this.classList={toggle:(name,enabled)=>enabled?values.add(name):values.delete(name),contains:name=>values.has(name)};}
 addEventListener(type,handler){if(!this.events.has(type))this.events.set(type,new Set());this.events.get(type).add(handler);}
 removeEventListener(type,handler){this.events.get(type)?.delete(handler);}
 emit(type,fields={}){const event={target:this,currentTarget:this,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},...fields};for(const handler of [...(this.events.get(type)||[])])handler(event);return event;}
 setAttribute(key,value){this.attrs[key]=value;}
 getAttribute(key){return this.attrs[key];}
 setPointerCapture(id){this.captured=id;}
 closest(selector){if(selector==='[data-key]'&&this.dataset.key)return this;return null;}
 focus(){this.focuses++;}
}
function api(){const C={window:{},document:undefined,Set,Map,Promise};vm.createContext(C);vm.runInContext(fs.readFileSync(path.join(root,'mobile-controls.js'),'utf8'),C);return C.window.BloomMobile;}
const mobile=api(),doc=new Target(),win=new Target(),right=new Target('right','arrowright'),up=new Target('up','arrowup'),left=new Target('left','arrowleft'),run=new Target('run','shift'),buttons=[right,up,left,run],transitions=[],held={};
doc.querySelectorAll=()=>buttons;let under=null;doc.elementFromPoint=()=>under;
const control=mobile.bindHolds({root:doc,win,onHeld:(key,value)=>{held[key]=value;transitions.push([key,value]);}});
const down=(button,id,extra={})=>button.emit('pointerdown',{pointerId:id,pointerType:'touch',button:0,...extra});
const upAt=(button,id,type='pointerup')=>button.emit(type,{pointerId:id});
assert(down(right,1).defaultPrevented,'D-pad touch prevents browser gesture handling');down(up,2);assert(held.arrowright&&held.arrowup,'two fingers can move diagonally');assert.equal(control.snapshot().pointers,2);upAt(right,1);assert(!held.arrowright&&held.arrowup,'releasing one direction keeps the other finger active');upAt(up,2);
down(right,3);down(right,4);const beforeRelease=transitions.length;upAt(right,3,'pointercancel');assert(held.arrowright,'canceling one of two fingers on the same key does not cancel the remaining finger');assert.equal(transitions.length,beforeRelease,'no false key-up is emitted while a second finger holds the button');upAt(right,4,'lostpointercapture');assert(!held.arrowright);assert.equal(right.getAttribute('aria-pressed'),'false');
down(left,5);under=right;left.emit('pointermove',{pointerId:5,clientX:20,clientY:20});assert(!held.arrowleft&&held.arrowright,'a captured thumb slides to another D-pad button');upAt(left,5,'lostpointercapture');assert(!held.arrowright,'release on the original capture owner releases the new direction too');
down(up,6);under=run;up.emit('pointermove',{pointerId:6,clientX:50,clientY:20});assert(held.arrowup&&!held.shift,'sliding the D-pad never accidentally activates Run');win.emit('pointerup',{pointerId:6});assert(!held.arrowup,'window release is a fallback when the button misses pointerup');
down(run,7);const keyboard=run.emit('keydown',{key:' ',repeat:false});assert(keyboard.defaultPrevented);run.emit('keydown',{key:' ',repeat:true});assert.equal(control.snapshot().pointers,2,'keyboard repeat does not add phantom holds');run.emit('keyup',{key:' '});assert(held.shift,'pointer hold survives keyboard release of the same control');upAt(run,7);assert(!held.shift);
run.emit('keydown',{key:'Enter',repeat:false});run.emit('blur');assert(!held.shift,'tabbing away releases a keyboard-operated hold button');
for(const cause of['blur','pagehide','visibilitychange','resize','orientationchange']){
 down(right,20);down(run,21);
 if(cause==='visibilitychange'){doc.hidden=true;doc.emit(cause);doc.hidden=false;}else win.emit(cause);
 assert(!held.arrowright&&!held.shift,cause+' clears held touch inputs');assert.equal(control.snapshot().pointers,0);
}
assert(!down(right,30,{pointerType:'mouse',button:2}).defaultPrevented,'right-click does not hold a movement key');assert.equal(control.snapshot().pointers,0);
const originalCapture=right.setPointerCapture;right.setPointerCapture=()=>{throw Error('capture interrupted');};down(right,31);win.emit('pointercancel',{pointerId:31});assert(!held.arrowright,'capture failure still has a working cancellation path');right.setPointerCapture=originalCapture;
down(right,40);control.destroy();assert(!held.arrowright);for(const target of[doc,win,...buttons])for(const handlers of target.events.values())assert.equal(handlers.size,0,'destroy removes every registered hold listener');down(right,41);assert(!held.arrowright,'destroyed controls no longer change game input');

const settle=async()=>{for(let tick=0;tick<8;tick++)await Promise.resolve();};
async function viewports(){
 const d=new Target(),w=new Target(),container=new Target('play-area'),button=new Target('fullscreen'),canvas=new Target('game'),pad=new Target('touch');container.children=[canvas,pad];d.body={style:{overflow:'auto'}};d.fullscreenEnabled=false;d.fullscreenElement=null;
 const changes=[],viewport=mobile.bindViewport({container,button,doc:d,win:w,onChange:value=>changes.push(value)});assert(container.classList.contains('is-game-screen'),'the game fills its viewport before native fullscreen');assert.equal(button.textContent,'Enter fullscreen');
 await viewport.toggle();assert(viewport.expanded());assert(container.classList.contains('is-expanded'));assert.equal(d.body.style.overflow,'hidden');assert(container.children.includes(canvas)&&container.children.includes(pad),'Safari fallback keeps canvas and controls in the same expanded wrapper');
 const escape=d.emit('keydown',{key:'Escape'});assert(escape.defaultPrevented);await settle();assert(!viewport.expanded());assert.equal(d.body.style.overflow,'auto');assert.equal(button.textContent,'Enter fullscreen');assert(container.classList.contains('is-game-screen'),'Escape keeps the game screen mounted');
 await viewport.toggle();w.emit('pagehide');await Promise.resolve();await settle();assert(!viewport.expanded());assert.equal(d.body.style.overflow,'auto');assert.deepEqual(changes,[true,false,true,false]);
 const nativeDoc=new Target(),nativeWin=new Target(),nativeContainer=new Target(),nativeButton=new Target();nativeDoc.body={style:{overflow:''}};nativeDoc.fullscreenEnabled=true;let requests=0,exits=0;
 nativeContainer.requestFullscreen=async()=>{requests++;nativeDoc.fullscreenElement=nativeContainer;nativeDoc.emit('fullscreenchange');};nativeDoc.exitFullscreen=async()=>{exits++;nativeDoc.fullscreenElement=null;nativeDoc.emit('fullscreenchange');};
 const native=mobile.bindViewport({container:nativeContainer,button:nativeButton,doc:nativeDoc,win:nativeWin});await native.toggle();assert.equal(requests,1);assert(native.expanded());await native.exit();assert.equal(exits,1);assert(!native.expanded());assert.equal(nativeDoc.body.style.overflow,'');assert(nativeContainer.classList.contains('is-game-screen'),'native exit leaves the permanent game screen');
 await native.toggle();nativeDoc.fullscreenElement=null;nativeDoc.emit('fullscreenchange');assert(!native.expanded(),'native browser Escape updates the expansion state');
 nativeContainer.requestFullscreen=async()=>{throw Error('fullscreen denied');};await native.toggle();assert(native.expanded(),'a rejected fullscreen API falls back to browser expansion');await native.exit();assert(!native.expanded());
 assert.equal(mobile.bindViewport({container:null,button:nativeButton,doc:nativeDoc,win:nativeWin}),null,'clients without viewport controls remain supported');
}
function actualGame(full=false){
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),elements=new Map(),buttons=[],storage=new Map();
 const gradient={addColorStop(){}},ctx=new Proxy({createRadialGradient:()=>gradient},{get:(object,key)=>object[key]??(()=>{})});
 function element(id=''){const node=new Target(id);node.getContext=()=>ctx;return node;}
 for(const match of html.matchAll(/\bid="([^"]+)"/g))elements.set(match[1],element(match[1]));
 for(const match of html.matchAll(/<button\b([^>]*)>/g)){
  const attrs=Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(match=>[match[1],match[2]]));
  const node=attrs.id?elements.get(attrs.id):element();node.tagName='BUTTON';node.disabled=/\bdisabled\b/.test(match[1]);
  if(attrs['data-key'])node.dataset.key=attrs['data-key'];if('data-touch-action'in attrs)node.dataset.touchAction=attrs['data-touch-action'];buttons.push(node);
 }
 const document=new Target(),window=new Target(),location={href:'',search:''};document.body=element();document.body.style.overflow='';document.hidden=false;document.visibilityState='visible';
 document.getElementById=id=>{if(!elements.has(id))elements.set(id,element(id));return elements.get(id);};document.createElement=()=>element();document.elementFromPoint=()=>null;
 document.querySelectorAll=selector=>buttons.filter(button=>selector.includes('[data-key]')&&button.dataset.key||selector.includes('[data-touch-action]')&&button.dataset.touchAction!==undefined);
 const C={console,Math,JSON,Image:class{},Promise,URLSearchParams,document,window,location,fetch:()=>new Promise(()=>{}),requestAnimationFrame(){},setInterval(){},localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)},fixture:{id:'control-test',name:'Touch test estate',kind:'home',safe:true,theme:'rose',w:40,h:24,tiles:Array(24).fill('g'.repeat(40)),spawn:[160,160],objects:[],portals:[],signs:[{x:160,y:160,speaker:'Touch test sign',text:'An actual interaction.'}],exits:[]}};
 vm.createContext(C);for(const file of(full?['spell-catalog.js','progression.js','motion.js','abilities.js','hero-animation.js','combat.js','mobile-controls.js','adventure.js']:['hero-animation.js','combat.js','mobile-controls.js','adventure.js']))vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),C,{filename:file});
 const evaluate=source=>vm.runInContext(source,C);evaluate('maps={"control-test":fixture,rosepetal:fixture};atlas={};texture={};amaal={};ready=true;playing=true;enter("control-test")');
 return{C,document,window,elements,buttons,storage,evaluate,reset:()=>evaluate('playing=true;enter("control-test")'),direction:key=>buttons.find(button=>button.dataset.key===key)};
}
async function gameIntegration(){
 const game=actualGame(),{C,document,window,elements,evaluate,reset,direction}=game,point=()=>evaluate('({x:hero.x,y:hero.y})'),close=(actual,expected,label)=>assert(Math.abs(actual-expected)<1e-8,label+': expected '+expected+', got '+actual);
 const right=direction('arrowright'),up=direction('arrowup'),run=direction('shift'),heal=elements.get('touchHeal'),map=elements.get('touchMap'),journal=elements.get('touchJournal'),interact=elements.get('touchInteract'),attack=elements.get('touchSwing');
 down(right,101);evaluate('update(.1)');close(point().x,166.2,'real touch direction uses walking speed');upAt(right,101);
 reset();down(run,102);down(right,103);evaluate('update(.1)');close(point().x,170.5,'holding touch Run and direction uses running speed');assert(evaluate('held("shift")'));upAt(run,102);upAt(right,103);
 reset();down(right,104);down(up,105);evaluate('update(.1)');const diagonal=point();close(Math.hypot(diagonal.x-160,diagonal.y-160),6.2,'multi-pointer diagonal movement stays normalized');upAt(right,104,'pointercancel');const before=point();evaluate('update(.1)');close(point().x,before.x,'canceling one direction stops that axis');close(point().y,before.y-6.2,'the other direction keeps moving');upAt(up,105);
 reset();window.emit('keydown',{key:'ArrowRight',target:elements.get('game')});down(right,106);upAt(right,106);evaluate('update(.1)');close(point().x,166.2,'releasing touch does not cancel a physical key');window.emit('keyup',{key:'ArrowRight'});evaluate('update(.1)');close(point().x,166.2,'physical key-up stops the remaining input');
 for(const cause of['scene','dialogue','blur','pagehide','visibilitychange']){
  reset();down(right,110);down(run,111);window.emit('keydown',{key:'w',target:elements.get('game')});
  if(cause==='scene')reset();else if(cause==='dialogue')evaluate('say([["Audit","Pause input."]])');else if(cause==='visibilitychange'){document.hidden=true;document.visibilityState='hidden';document.emit(cause);document.hidden=false;document.visibilityState='visible';}else window.emit(cause);
  assert.equal(evaluate('touchControls.snapshot().pointers'),0,cause+' releases the actual game controller');assert.equal(evaluate('Object.values(touchKeys).some(Boolean)||Object.values(keys).some(Boolean)'),false,cause+' clears physical and touch state');
  upAt(right,110);upAt(run,111);assert.equal(evaluate('held("arrowright")||held("shift")'),false,cause+' does not resurrect a canceled touch after release');
 }
 reset();evaluate('state.hp=1;state.food=2;ui()');heal.onclick();assert.equal(evaluate('state.hp'),3,'touch Heal calls the actual food/health action');assert.equal(evaluate('state.food'),1);assert(game.storage.has('blooming-world-v05'),'touch actions preserve the existing local save key');
 journal.onclick();assert(evaluate('speaking'));assert.equal(elements.get('speaker').textContent,'Amaal’s journal');assert(heal.disabled&&map.disabled&&run.disabled,'dialogue disables gameplay actions and movement');assert.equal(interact.disabled,false,'Interact remains available to advance dialogue');down(run,112);down(right,113);assert.equal(evaluate('held("shift")||held("arrowright")'),false,'even a stale pointer event cannot enable Run or direction during dialogue');upAt(run,112);upAt(right,113);heal.onclick();assert.equal(evaluate('state.food'),1,'a stale Heal activation cannot consume food during dialogue');interact.onclick();assert.equal(elements.get('speech').textContent,evaluate('fullText'),'touch Interact advances the real dialogue');evaluate('keyAction("escape")');assert.equal(map.disabled,false);
 map.onclick();assert.match(C.location.href,/^world-map\.html(?:\?|$)/,'touch Map navigates to the real world map');reset();attack.onclick();assert(C.window.BloomHero.busy(),'touch Attack starts Amaal’s existing attack animation');
 reset();interact.onclick();assert.equal(elements.get('speaker').textContent,'Touch test sign','touch Interact reaches a real area interaction');assert.equal(evaluate('fullText'),'An actual interaction.');
 reset();evaluate('ferryTrip={from:"a",to:"b",t:0,duration:1};ui();state.hp=1;state.food=2');C.location.href='';heal.onclick();map.onclick();journal.onclick();attack.onclick();down(run,114);down(right,115);assert.equal(evaluate('held("shift")||held("arrowright")'),false,'stale pointer events cannot run during a ferry crossing');assert.equal(evaluate('state.hp'),1);assert.equal(C.location.href,'');assert.equal(evaluate('speaking'),false);assert.equal(C.window.BloomHero.busy(),false,'ferry transit does not start combat or journal actions');
 reset();evaluate('playing=false;syncTouchButtons();state.hp=1;state.food=2');heal.onclick();map.onclick();down(run,116);down(right,117);evaluate('update(.1)');close(point().x,160,'stale title-screen touches cannot move Amaal');assert.equal(evaluate('held("shift")'),false,'Run is inactive before play');assert.equal(evaluate('state.hp'),1,'title-screen action callbacks cannot heal');assert.equal(C.location.href,'');assert(game.buttons.filter(button=>button.dataset.key||button.dataset.touchAction!==undefined).every(button=>button.disabled),'all gameplay controls are disabled before play');
 reset();down(right,120);await elements.get('fullscreen').onclick();assert(elements.get('play-area').classList.contains('is-expanded'),'the real Expand button uses Safari-compatible wrapper expansion');assert(!elements.get('screen').classList.contains('is-expanded'),'expansion targets the wrapper instead of hiding controls outside a canvas-only fullscreen');assert.equal(evaluate('touchControls.snapshot().pointers'),0,'entering expanded view clears old movement input');window.emit('pagehide');await settle();assert.equal(document.body.style.overflow,'');assert(elements.get('play-area').classList.contains('is-game-screen'),'leaving fullscreen keeps the whole game viewport');
}
function heldCombatIntegration(){
 const game=actualGame(true),attack=game.elements.get('touchSwing'),{evaluate,window}=game;
 down(attack,200);assert(evaluate('heroAnim.busy()'),'touch hold begins an actual paid attack immediately');
 for(let tick=0;tick<30;tick++)evaluate('update(.04)');
 assert(evaluate('abilities.snapshot().stamina')<80,'holding Attack chains real stamina-funded combo strikes');
 upAt(attack,200);attack.onclick({detail:1});assert(!evaluate('held(" ")'),'release clears the attack hold');
 for(let tick=0;tick<35;tick++)evaluate('update(.04)');assert(!evaluate('heroAnim.busy()'),'release does not add another synthetic click attack');
 down(attack,201);window.emit('blur');assert(!evaluate('held(" ")'),'app interruption clears held combat input');
 evaluate('playing=false;syncTouchButtons()');down(attack,202);assert(!evaluate('held(" ")'),'title screen rejects stale combat holds');upAt(attack,202);
}
function responsiveMarkup(){
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),wrapper=html.match(/<section\b[^>]*id="play-area"[^>]*>([\s\S]*?)<\/section>/)?.[1];
 assert(wrapper,'a whole-game viewport wrapper exists');for(const id of['screen','game','touchRun','touchInteract','touchSwing','touchHeal','touchMap','touchJournal','fullscreen'])assert(wrapper.includes('id="'+id+'"'),id+' stays inside the fullscreen wrapper');
 assert(html.indexOf('src="mobile-controls.js')<html.indexOf('src="adventure.js'),'pointer module loads before gameplay integration');assert.match(html,/viewport-fit=cover/);assert.match(html,/safe-area-inset-(?:top|bottom)/,'expanded play accounts for phone notches and home indicators');assert.match(html,/\.touch button\{[^}]*min-height:44px[^}]*min-width:44px/,'gameplay touch targets meet 44px minimum dimensions');assert.match(html,/\.touch\{[^}]*touch-action:none[^}]*user-select:none/,'touch controls suppress browser panning and text selection');assert.match(html,/any-pointer:coarse/,'touch controls are available on large touch tablets and laptops');assert.match(html,/\.dialog\{[^}]*overflow:auto/,'long dialogue remains scrollable on phones');assert.match(html,/\.hint\{[^}]*white-space:normal/,'interaction hints wrap on narrow screens');assert.match(html,/100dvh/,'expanded mode follows the mobile browser viewport');
}
Promise.resolve().then(viewports).then(gameIntegration).then(heldCombatIntegration).then(responsiveMarkup).then(()=>console.log('PASS: multi-pointer/reference-counted holds, cancellation/blur/visibility cleanup and teardown; native/Safari fullscreen; actual game Run/diagonals, keyboard coexistence, scene resets, Heal/Map/Journal/Interact/Attack, ferry/title guards and responsive touch markup.')).catch(error=>{console.error(error);process.exitCode=1;});
