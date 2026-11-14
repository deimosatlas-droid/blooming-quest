'use strict';
// Exercise the actual travelling-kit state machine and DOM event handlers.
// This is not a browser layout or native touch test.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../dist');
class Element{
  constructor(tag,doc){this.tagName=tag.toUpperCase();this.ownerDocument=doc;this.children=[];this.parentElement=null;this.dataset={};this.attrs={};this.events={};this.style={};this.hidden=false;this.disabled=false;this.textContent='';const classes=new Set();this.classList={toggle:(key,value)=>value?classes.add(key):classes.delete(key),contains:key=>classes.has(key)};}
  setAttribute(key,value){this.attrs[key]=String(value);}
  getAttribute(key){return this.attrs[key];}
  appendChild(node){if(node.parentElement){const children=node.parentElement.children,index=children.indexOf(node);if(index>=0)children.splice(index,1);}node.parentElement=this;this.children.push(node);return node;}
  replaceChildren(...nodes){for(const node of this.children)node.parentElement=null;this.children=[];nodes.forEach(node=>this.appendChild(node));}
  contains(node){return this===node||this.children.some(child=>child.contains(node));}
  addEventListener(type,handler){(this.events[type]??=[]).push(handler);}
  closest(selector){for(let node=this;node;node=node.parentElement)if(selector==='[hidden]'&&node.hidden||selector==='details'&&node.tagName==='DETAILS')return node;return null;}
  matches(selector){if(selector==='button:not(:disabled)')return this.tagName==='BUTTON'&&!this.disabled;if(selector==='summary')return this.tagName==='SUMMARY';if(selector==='input:not(:disabled)')return this.tagName==='INPUT'&&!this.disabled;if(selector==='select:not(:disabled)')return this.tagName==='SELECT'&&!this.disabled;if(selector==='a[href]')return this.tagName==='A'&&Boolean(this.attrs.href);if(selector==='[tabindex="0"]')return this.attrs.tabindex==='0';return false;}
  querySelectorAll(selector){const matches=[];for(const child of this.children){if(selector.split(',').some(part=>child.matches(part.trim())))matches.push(child);matches.push(...child.querySelectorAll(selector));}return matches;}
  focus(){this.ownerDocument.activeElement=this;}
  getClientRects(){return this.closest('[hidden]')?[]:[{}];}
  scrollIntoView(){}
}
const nodes=new Map(),document={events:{},activeElement:null};
document.createElement=tag=>new Element(tag,document);document.createElementNS=(_,tag)=>document.createElement(tag);document.getElementById=id=>nodes.get(id)||null;document.addEventListener=(type,handler)=>(document.events[type]??=[]).push(handler);
const make=(id,tag='div',parent)=>{const node=document.createElement(tag);node.id=id;nodes.set(id,node);parent?.appendChild(node);return node;};
const play=make('play-area'),canvas=make('game','canvas',play),toggle=make('kit-toggle','button',play),hub=make('kit-overlay','div',play),panel=make('kit-panel','div',hub);
hub.hidden=true;hub.setAttribute('role','dialog');hub.setAttribute('aria-modal','true');make('kit-title','h2',panel);make('kit-close','button',panel);
for(const id of ['kit-bag','kit-map','open-skills','kit-journal','kit-options'])make(id,'button',panel);
make('kit-update-dot','span',toggle);make('kit-notice','span',toggle);make('kit-points','span',toggle);make('system-notice','button',panel).hidden=true;
const overlay=make('traveller-overlay','div',play),frame=make('traveller-window','div',overlay);overlay.hidden=true;
for(const[id,tag]of [['traveller-title','h2'],['traveller-close','button'],['traveller-tabs','div'],['traveller-body','div'],['traveller-feedback','p']])make(id,tag,frame);
make('status','p',play);make('portable-tools','details',play);make('new','button',play);
const C={window:{},document,Math,JSON,Promise,Map,Set,console};vm.createContext(C);vm.runInContext(fs.readFileSync(path.join(root,'traveller-ui.js'),'utf8'),C,{filename:'traveller-ui.js'});
const ui=C.window.BloomTraveller,$=id=>nodes.get(id),saved={hp:4,food:2,inventory:{apple:3},area:'rosepetal',lastSafeTown:'rosepetal',x:512,y:328,worldClock:{day:3,minutes:500}},world=JSON.parse(fs.readFileSync(path.join(root,'world.json'))),initial=JSON.stringify(saved);
let playing=false,allowPause=true,pauses=0,resumes=0,spells=0;
ui.configure({getState:()=>saved,getWorld:()=>world,getArea:()=>saved.area,getEnabled:view=>playing||view==='options',getOptions:()=>({playing,ready:playing,sound:false}),onPause:()=>{if(!allowPause)return false;pauses++;return true;},onResume:()=>resumes++,onSpells:()=>{assert(!ui.isOpen(),'hub closes before the real spellbook opens');spells++;}});
function key(name,extra={}){const event={key:name,target:document.activeElement,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;},stopImmediatePropagation(){this.immediate=true;},...extra};for(const handler of document.events.keydown||[])handler(event);return event;}
function click(node){assert.equal(typeof node.onclick,'function',node.id+' has a real click action');return node.onclick({target:node});}
function backdrop(){for(const handler of hub.events.click||[])handler({target:hub});}
function title(){return $('traveller-title').textContent;}

assert.equal(typeof ui.openKit,'function');assert.equal(typeof ui.isKitOpen,'function');
assert(!toggle.disabled,'satchel stays available for preboot recovery Options');toggle.focus();click(toggle);assert(ui.isKitOpen()&&ui.isOpen());assert(!hub.hidden&&overlay.hidden);assert.equal(toggle.getAttribute('aria-expanded'),'true');
for(const id of ['kit-bag','kit-map','open-skills','kit-journal'])assert($(id).disabled,id+' is unavailable before Start');assert(!$('kit-options').disabled,'Options remains available before Start');
click($('kit-options'));assert(ui.isOpen()&&!ui.isKitOpen());assert.equal(title(),'By the Campfire');assert(hub.hidden&&!overlay.hidden);ui.close();assert(!ui.isOpen());assert.equal(document.activeElement,toggle,'closing the page returns focus to the satchel');assert.equal(JSON.stringify(saved),initial,'preboot hub and Options do not mutate a saved journey');

playing=true;ui.update();allowPause=false;assert.equal(ui.openKit(),false,'game can reject hub during dialogue or ferry');assert(!ui.isOpen());allowPause=true;
toggle.focus();const beforePause=pauses;click(toggle);assert.equal(pauses,beforePause+1,'opening the hub pauses gameplay once');assert.equal(document.activeElement,$('kit-close'));
for(const id of ['kit-bag','kit-map','open-skills','kit-journal','kit-options'])assert(!$(id).disabled,id+' is available while playing');
const focusable=hub.querySelectorAll('button:not(:disabled)').filter(node=>!node.closest('[hidden]'));focusable.at(-1).focus();assert(key('Tab').defaultPrevented);assert.equal(document.activeElement,focusable[0],'Tab wraps within the satchel');assert(key('Tab',{shiftKey:true}).defaultPrevented);assert.equal(document.activeElement,focusable.at(-1),'Shift+Tab wraps within the satchel');
const resumesBeforeBag=resumes;click($('kit-bag'));assert(ui.isOpen()&&!ui.isKitOpen());assert.equal(title(),'Amaal’s Satchel');assert(hub.hidden&&!overlay.hidden);assert.equal(resumes,resumesBeforeBag,'switching hub to a page keeps the paused session');
assert(key('Escape').defaultPrevented);assert(!ui.isOpen()&&hub.hidden&&overlay.hidden);assert.equal(document.activeElement,toggle);

for(const[id,expected]of [['kit-map','The Blooming Atlas'],['kit-journal','Amaal’s Journal'],['kit-options','By the Campfire']]){toggle.focus();ui.openKit();click($(id));assert.equal(title(),expected);assert(!ui.isKitOpen()&&ui.isOpen());ui.close();assert.equal(document.activeElement,toggle);}
ui.openKit();click($('open-skills'));assert.equal(spells,1);assert(!ui.isOpen()&&hub.hidden&&overlay.hidden);
for(const[shortcut,expected]of [['b','Amaal’s Satchel'],['m','The Blooming Atlas'],['j','Amaal’s Journal'],['o','By the Campfire']]){toggle.focus();ui.openKit();assert(key(shortcut).defaultPrevented);assert.equal(title(),expected);assert(ui.isOpen()&&!ui.isKitOpen());ui.close();}
ui.openKit();key('k');assert.equal(spells,2);assert(!ui.isOpen());

toggle.focus();ui.openKit();assert(key('Escape').defaultPrevented);assert(!ui.isOpen()&&hub.hidden);assert.equal(toggle.getAttribute('aria-expanded'),'false');assert.equal(document.activeElement,toggle);
ui.openKit();backdrop();assert(!ui.isOpen(),'tapping the outside backdrop closes the satchel');assert(hub.hidden);assert.equal(document.activeElement,toggle);
ui.openKit();click($('kit-close'));assert(!ui.isOpen(),'the visible close button returns to play');
assert.equal(JSON.stringify(saved),initial,'opening, routing and closing menus never mutate gameplay data');assert(resumes>0);

const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),visibleKit=html.match(/<nav\b[^>]*class="traveller-kit"[^>]*>([\s\S]*?)<\/nav>/)?.[1]||html.match(/<div\b[^>]*class="traveller-kit"[^>]*>([\s\S]*?)<\/div>/)?.[1];
assert(visibleKit,'the on-screen travelling kit has a wrapper');assert(visibleKit.includes('id="kit-toggle"'));assert.equal((visibleKit.match(/<button\b/g)||[]).length,1,'one satchel button replaces the row of permanent menu buttons');
console.log('PASS: actual satchel hub pause, five page routes, modal exclusivity, close/Escape/backdrop, focus trap/return, keyboard shortcuts, preboot Options and unchanged saved gameplay.');
