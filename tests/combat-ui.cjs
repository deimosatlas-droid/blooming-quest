'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../dist'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
class Element{
  constructor(tag='div',document){this.tagName=tag.toUpperCase();this.ownerDocument=document;this.children=[];this.parentElement=null;this.dataset={};this.attrs={};this.events={};this.textContent='';this.innerHTML='';this.hidden=false;this.disabled=false;this.style={setProperty(name,value){this[name]=value;}};const classes=new Set();this.classList={toggle(name,value){if(value)classes.add(name);else classes.delete(name);},contains:name=>classes.has(name)};}
  setAttribute(name,value){this.attrs[name]=String(value);}
  getAttribute(name){return this.attrs[name];}
  appendChild(child){this.children.push(child);child.parentElement=this;return child;}
  replaceChildren(...children){for(const child of this.children)child.parentElement=null;this.children=[];for(const child of children)this.appendChild(child);}
  addEventListener(type,callback){(this.events[type]??=[]).push(callback);}
  closest(selector){if(selector==='[hidden]'){for(let item=this;item;item=item.parentElement)if(item.hidden)return item;}return null;}
  querySelectorAll(selector){const output=[];for(const child of this.children){if(selector==='button:not(:disabled), [tabindex="0"]'&&child.tagName==='BUTTON'&&!child.disabled)output.push(child);if(selector==='[data-skill-node]'&&child.dataset.skillNode)output.push(child);output.push(...child.querySelectorAll(selector));}return output;}
  querySelector(selector){return this.querySelectorAll('[data-skill-node]').find(element=>selector==='[data-skill-node="'+element.dataset.skillNode+'"]')||null;}
  getClientRects(){return this.closest('[hidden]')?[]:[{}];}
  focus(){this.ownerDocument.activeElement=this;}
}
const nodes=new Map(),document={events:{},activeElement:null};
document.createElement=tag=>new Element(tag,document);document.getElementById=id=>nodes.get(id)||null;document.addEventListener=(type,callback)=>{(document.events[type]??=[]).push(callback);};document.querySelector=selector=>selector==='.combat-vitals'?nodes.get('vitals'):null;
for(const match of html.matchAll(/<([a-z][\w-]*)\b[^>]*\bid="([^"]+)"[^>]*>/gi)){
  const node=document.createElement(match[1]);node.id=match[2];node.hidden=/\bhidden\b/.test(match[0]);node.disabled=/\bdisabled\b/.test(match[0]);nodes.set(node.id,node);
}
nodes.set('vitals',document.createElement('div'));
const $=id=>nodes.get(id),overlay=$('skill-overlay');
for(const id of['close-skills','respec-skills','skill-branches','skill-detail'])overlay.appendChild($(id));
for(const id of['learn-skill','skill-equip'])$('skill-detail').appendChild($(id));
for(let i=0;i<3;i++)$('skill-equip').appendChild($('equip-skill-'+i));
const C={window:{},document,console,Math,JSON,Set,Map};vm.createContext(C);
for(const source of['progression.js','combat-ui.js'])vm.runInContext(fs.readFileSync(path.join(root,source),'utf8'),C,{filename:source});
const ui=C.window.BloomCombatUI,progression=C.window.BloomProgression,state={area:'rosepetal',x:100,y:100,hp:4,food:3,note:false,inventory:{berry:7},campProgress:{},clearedCamps:{}};
let enabled=false,pauseAllowed=true,pauses=0,resumes=0,actions=[],combat={stamina:100,maxStamina:100,cooldowns:{},status:'Ready'};
progression.migrate(state);
ui.configure({getState:()=>state,getCombat:()=>({...combat,enabled:enabled&&!ui.isOpen()}),onAction:key=>actions.push(key),onPause:()=>{pauses++;return pauseAllowed;},onResume:()=>{resumes++;},onLearn:id=>progression.learn(state,id),onEquip:(id,slot)=>progression.equip(state,id,slot),onRespec:()=>progression.respec(state)});
assert.equal(ui.open(),false,'tree refuses to open before the game is playable');assert($('open-skills').disabled);assert($('combat-dodge').disabled);
enabled=true;ui.update();assert(!$('open-skills').disabled);assert.equal($('combat-level').textContent,'01');assert.equal($('stamina-meter').getAttribute('aria-valuenow'),'100');assert.equal($('health-meter').getAttribute('aria-valuenow'),'4');assert.equal($('health-fill').style.width,'80.0%');assert.equal($('skill-point-badge').textContent,'1');
$('combat-dodge').onclick();assert.deepEqual(actions,['q'],'Dodge button dispatches the same game action as Q');
pauseAllowed=false;assert.equal(ui.open(),false,'game can reject opening during dialogue or transit');assert(!ui.isOpen());assert.equal(overlay.hidden,true);
pauseAllowed=true;$('open-skills').focus();assert(ui.open());assert(ui.isOpen());assert.equal(overlay.hidden,false);assert.equal(document.activeElement,$('close-skills'));assert.equal($('open-skills').disabled,false,'Skills remains accessible while the game is paused by the tree');
const treeNodes=()=>$('skill-branches').querySelectorAll('[data-skill-node]');assert.equal(treeNodes().length,9,'all nine real definitions are rendered');assert.equal($('skill-branches').children.length,3,'three distinct branches');assert(treeNodes().every(node=>node.getAttribute('aria-label')),'all nodes expose name and prerequisite status');
const node=id=>treeNodes().find(button=>button.dataset.skillNode===id);
node('finishing_cut').onclick();assert($('learn-skill').disabled,'passive cannot be learned before its active prerequisite');assert.match($('skill-prerequisite').textContent,/Petal Sweep/);
node('petal_sweep').onclick();assert(!$('learn-skill').disabled);$('learn-skill').onclick();assert.equal(progression.snapshot(state).points,0);assert.equal(progression.snapshot(state).loadout[0],'petal_sweep');assert.equal($('skill-equip').hidden,false);assert.equal($('slot-name-0').textContent,'Petal Sweep');assert.match($('slot-icon-0').innerHTML,/<svg/,'learning replaces the empty marker with the real original skill icon');assert(node('petal_sweep').classList.contains('is-learned'));assert.equal($('skill-point-badge').hidden,true);
$('equip-skill-2').onclick();assert.equal(progression.snapshot(state).loadout[2],'petal_sweep');assert.equal($('slot-name-2').textContent,'Petal Sweep');assert.equal($('equip-skill-2').getAttribute('aria-pressed'),'true');
function key(key,extra={}){const event={key,defaultPrevented:false,stopped:false,immediate:false,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;},stopImmediatePropagation(){this.immediate=true;},...extra};for(const callback of document.events.keydown||[])callback(event);return event;}
const pausedActionCount=actions.length;$('combat-slot-2').onclick();assert.equal(actions.length,pausedActionCount,'stale action clicks cannot cast while the tree pauses the game');
assert(key('w').defaultPrevented,'movement keys are caught while the skill tree is open');
$('equip-skill-2').focus();const tab=key('Tab');assert(tab.defaultPrevented);assert.equal(document.activeElement,$('close-skills'),'Tab wraps to the first real modal control');
$('close-skills').focus();const reverse=key('Tab',{shiftKey:true});assert(reverse.defaultPrevented);assert.equal(document.activeElement,$('equip-skill-2'),'Shift+Tab wraps to the last visible control');
const escape=key('Escape');assert(escape.defaultPrevented&&escape.immediate,'Escape is consumed before fullscreen/story handlers can act');assert(!ui.isOpen());assert(overlay.hidden);assert.equal(resumes,1);assert.equal(document.activeElement,$('open-skills'),'close restores keyboard focus');
$('combat-slot-2').onclick();assert.equal(actions.at(-1),'3','equipped hotbar invokes slot 3');
combat={...combat,stamina:10,cooldowns:{petal_sweep:2.6}};ui.update();assert($('combat-slot-2').disabled);assert.equal($('slot-cooldown-2').hidden,false);assert.equal($('slot-cooldown-2').textContent,'3');
combat={...combat,stamina:100,cooldowns:{},target:{name:'Bramble camp',hp:3,maxHp:4},guarding:true};ui.update();assert.equal($('enemy-target').hidden,false);assert.equal($('enemy-name').textContent,'Bramble camp');assert.equal($('enemy-fill').style.width,'75.0%');assert(nodes.get('vitals').classList.contains('is-guarding'));assert(!$('combat-slot-2').disabled);assert.equal($('slot-cooldown-2').hidden,true);
progression.grant(state,'test:xp',150);ui.update();assert.equal($('combat-level').textContent,'03');assert.equal($('skill-point-badge').textContent,'2');
ui.open();$('respec-skills').onclick();assert.equal(progression.snapshot(state).points,3);assert(progression.snapshot(state).loadout.every(item=>item===null));assert.equal(state.inventory.berry,7,'respec leaves inventory and unrelated journey data intact');assert.equal(progression.snapshot(state).xp,150,'respec preserves XP');assert.equal($('skill-equip').hidden,true);
// Hidden equip controls are excluded from the modal's focus loop after reset.
$('learn-skill').focus();assert(key('Tab').defaultPrevented);assert.equal(document.activeElement,$('close-skills'));
const k=key('K');assert(k.defaultPrevented&&k.immediate);assert(!ui.isOpen());
enabled=false;ui.update();assert($('combat-dodge').disabled&&$('combat-guard').disabled);assert(!$('slot-icon-0').innerHTML.includes('<svg'),'reset returns skill slot art to an empty marker');
const wrapper=html.match(/<section\b[^>]*id="play-area"[^>]*>([\s\S]*?)<\/section>/)?.[1];
for(const id of['combat-slot-0','combat-slot-1','combat-slot-2','open-skills','skill-overlay','touchDodge','touchGuard'])assert(wrapper?.includes('id="'+id+'"'),id+' belongs to the expanded-game wrapper');
assert.match(html,/<button[^>]*id="touchDodge"[^>]*data-touch-action="q"/);assert.match(html,/<button[^>]*id="touchGuard"[^>]*data-key="c"/);assert.match(html,/<button[^>]*id="combat-guard"[^>]*data-key="c"/);
assert(html.indexOf('src="progression.js')<html.indexOf('src="combat-ui.js'));assert(html.indexOf('src="combat-ui.js')<html.indexOf('src="adventure.js'));
console.log('PASS: real nine-node learning/prerequisites, equip/respec/XP, resource and cooldown HUD, action dispatch, paused/title guards, modal keyboard/focus restoration and fullscreen/mobile markup.');
