'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../dist'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
class Element{
  constructor(tag='div',document){this.tagName=tag.toUpperCase();this.ownerDocument=document;this.children=[];this.parentElement=null;this.dataset={};this.attrs={};this.events={};this.textContent='';this.innerHTML='';this.value='';this.hidden=false;this.disabled=false;this.style={setProperty(name,value){this[name]=value;}};const classes=new Set();this.classList={toggle(name,value){if(value)classes.add(name);else classes.delete(name);},contains:name=>classes.has(name)};}
  setAttribute(name,value){this.attrs[name]=String(value);}
  getAttribute(name){return this.attrs[name];}
  appendChild(child){this.children.push(child);child.parentElement=this;return child;}
  replaceChildren(...children){for(const child of this.children)child.parentElement=null;this.children=[];for(const child of children)this.appendChild(child);}
  addEventListener(type,callback){(this.events[type]??=[]).push(callback);}
  closest(selector){if(selector==='[hidden]'){for(let item=this;item;item=item.parentElement)if(item.hidden)return item;}return null;}
  querySelectorAll(selector){const output=[];for(const child of this.children){if(selector.includes('button:not(:disabled)')&&child.tagName==='BUTTON'&&!child.disabled||selector.includes('input:not(:disabled)')&&child.tagName==='INPUT'&&!child.disabled)output.push(child);if(selector==='[data-skill-node]'&&child.dataset.skillNode)output.push(child);if(selector==='[data-school-filter]'&&child.dataset.schoolFilter)output.push(child);output.push(...child.querySelectorAll(selector));}return output;}
  querySelector(selector){for(const field of ['skillNode','schoolFilter']){const attr=field==='skillNode'?'skill-node':'school-filter';const found=this.querySelectorAll('[data-'+attr+']').find(element=>selector==='[data-'+attr+'="'+element.dataset[field]+'"]');if(found)return found;}return null;}
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
for(const id of['close-skills','respec-skills','spell-search','spell-school-filters','skill-branches','skill-detail'])overlay.appendChild($(id));
for(const id of['learn-skill','spell-upgrade','skill-equip'])$('skill-detail').appendChild($(id));
$('spell-upgrade').appendChild($('upgrade-skill'));
for(let i=0;i<5;i++)$('skill-equip').appendChild($('equip-skill-'+i));
const C={window:{},document,console,Math,JSON,Set,Map};vm.createContext(C);
for(const source of['spell-catalog.js','progression.js','combat-ui.js'])vm.runInContext(fs.readFileSync(path.join(root,source),'utf8'),C,{filename:source});
const ui=C.window.BloomCombatUI,progression=C.window.BloomProgression,state={area:'rosepetal',x:100,y:100,hp:4,food:3,note:false,inventory:{berry:7},campProgress:{},clearedCamps:{}};
let enabled=false,pauseAllowed=true,pauses=0,resumes=0,actions=[],combat={stamina:100,maxStamina:100,cooldowns:{},status:'Ready'};
progression.migrate(state);
ui.configure({getState:()=>state,getCombat:()=>({...combat,enabled:enabled&&!ui.isOpen()}),onAction:key=>actions.push(key),onPause:()=>{pauses++;return pauseAllowed;},onResume:()=>{resumes++;},onLearn:id=>progression.learn(state,id),onUpgrade:id=>progression.upgrade(state,id),onEquip:(id,slot)=>progression.equip(state,id,slot),onRespec:()=>progression.respec(state)});
assert.equal(ui.open(),false,'tree refuses to open before play');assert($('open-skills').disabled);assert($('combat-dodge').disabled);
enabled=true;ui.update();assert(!$('open-skills').disabled);assert.equal($('combat-level').textContent,'01');assert.equal($('health-meter').getAttribute('aria-valuenow'),'4');assert.equal($('health-fill').style.width,'80.0%');assert.equal($('skill-point-badge').textContent,'3');
$('combat-dodge').onclick();assert.deepEqual(actions,['q']);pauseAllowed=false;assert.equal(ui.open(),false);assert(!ui.isOpen());pauseAllowed=true;$('open-skills').focus();assert(ui.open());assert.equal(document.activeElement,$('close-skills'));assert(!$('open-skills').disabled,'book stays accessible while its modal pauses the game');
const treeNodes=()=>$('skill-branches').querySelectorAll('[data-skill-node]');
const node=id=>treeNodes().find(button=>button.dataset.skillNode===id);
const filters=()=>$('spell-school-filters').querySelectorAll('[data-school-filter]');
const filter=id=>filters().find(button=>button.dataset.schoolFilter===id);
assert.equal(treeNodes().length,26,'twenty actual spells plus six supporting passive nodes');assert.equal($('skill-branches').children.length,5);assert.equal(filters().length,6,'All plus five schools');assert.match($('spell-results').textContent,/20 spells/);assert(treeNodes().every(node=>node.getAttribute('aria-label')));
node('rose_lance').onclick();assert($('learn-skill').disabled,'branch root is required');assert.match($('skill-prerequisite').textContent,/Petal Sweep/);
node('petal_sweep').onclick();assert(!$('learn-skill').disabled);$('learn-skill').onclick();assert.equal(progression.snapshot(state).points,2);assert.equal(progression.snapshot(state).loadout[0],'petal_sweep');assert.equal($('skill-rank-label').textContent,'Rank 1 of 3');assert.equal($('spell-upgrade').hidden,false);assert(!$('upgrade-skill').disabled);assert.match($('spell-upgrade-description').textContent,/Next:/,'next upgrade previews mechanical improvements');
$('upgrade-skill').onclick();assert.equal(progression.snapshot(state).ranks.petal_sweep,2);assert.equal(progression.snapshot(state).points,1);assert.equal($('skill-rank-label').textContent,'Rank 2 of 3');$('upgrade-skill').onclick();assert.equal(progression.snapshot(state).ranks.petal_sweep,3);assert.equal($('upgrade-skill').textContent,'Mastered · rank 3');assert($('upgrade-skill').disabled);assert.equal($('skill-point-badge').hidden,true);
$('equip-skill-4').onclick();assert.equal(progression.snapshot(state).loadout[4],'petal_sweep');assert.equal($('slot-name-4').textContent,'Petal Sweep');assert.equal($('equip-skill-4').getAttribute('aria-pressed'),'true');assert.match($('slot-cost-4').textContent,/R3/);
filter('frost').onclick();assert.equal(treeNodes().length,4);assert.match($('spell-results').textContent,/4 spells/);assert.equal(filter('frost').getAttribute('aria-pressed'),'true');assert(treeNodes().every(button=>['frost_shard','ice_ring','winter_ward','glacial_path'].includes(button.dataset.skillNode)));
filter('all').onclick();$('spell-search').value='ember';$('spell-search').oninput();assert.equal(treeNodes().length,4,'search matches spell school');assert.equal($('skill-detail-name').textContent,'Ember Bolt');$('spell-search').value='no such spell';$('spell-search').oninput();assert.equal(treeNodes().length,0);assert($('skill-detail').hidden);assert.match($('spell-results').textContent,/0 spells/);$('spell-search').value='';$('spell-search').oninput();assert.equal(treeNodes().length,26);assert(!$('skill-detail').hidden);
function key(key,extra={}){const event={key,target:document.activeElement,defaultPrevented:false,stopped:false,immediate:false,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;},stopImmediatePropagation(){this.immediate=true;},...extra};for(const callback of document.events.keydown||[])callback(event);return event;}
$('spell-search').focus();const typing=key('k');assert(!typing.defaultPrevented&&typing.stopped,'typing k in search does not close the grimoire or affect the world');assert(ui.isOpen());$('close-skills').focus();assert(key('w').defaultPrevented,'movement is trapped by the modal');
const paused=actions.length;$('combat-slot-4').onclick();assert.equal(actions.length,paused);node('petal_sweep').onclick();$('equip-skill-4').focus();assert(key('Tab').defaultPrevented);assert.equal(document.activeElement,$('close-skills'));assert(key('Tab',{shiftKey:true}).defaultPrevented);assert.equal(document.activeElement,$('equip-skill-4'));
const escape=key('Escape');assert(escape.defaultPrevented&&escape.immediate);assert(!ui.isOpen());assert.equal(resumes,1);assert.equal(document.activeElement,$('open-skills'));$('combat-slot-4').onclick();assert.equal(actions.at(-1),'5','fifth slot casts key5');
combat={...combat,stamina:10,cooldowns:{petal_sweep:2.6}};ui.update();assert($('combat-slot-4').disabled);assert.equal($('slot-cooldown-4').textContent,'3');combat={...combat,stamina:100,cooldowns:{},casting:true,currentSpell:'petal_sweep',castProgress:.4};ui.update();assert(!$('cast-display').hidden);assert.equal($('cast-spell-name').textContent,'Petal Sweep');assert.equal($('cast-fill').style.width,'40.0%');assert($('combat-slot-4').classList.contains('is-casting'));
combat={...combat,casting:false,target:{name:'Test goblin',hp:2,maxHp:4}};ui.update();assert($('cast-display').hidden);assert(!$('enemy-target').hidden);assert.equal($('enemy-fill').style.width,'50.0%');progression.grant(state,'test:xp',1740);ui.update();assert.equal($('combat-level').textContent,'30');assert.equal($('xp-fill').style.width,'100.0%');ui.open();$('respec-skills').onclick();assert.equal(progression.snapshot(state).points,61);assert(progression.snapshot(state).loadout.every(id=>id===null));assert.equal(state.inventory.berry,7);assert.equal(progression.snapshot(state).xp,1740);assert($('spell-upgrade').hidden&&$('skill-equip').hidden);
node('briar_bind').onclick();$('learn-skill').onclick();node('healing_bloom').onclick();$('learn-skill').onclick();$('upgrade-skill').onclick();assert.equal(progression.snapshot(state).ranks.healing_bloom,2);assert.match($('skill-detail-meta').children.map(child=>child.textContent).join(' '),/STAMINA/);assert($('skill-stat-lines').children.length>0,'resolved stats are visible for a learned utility spell');
ui.close();enabled=false;ui.update();assert($('combat-dodge').disabled&&$('combat-guard').disabled);
const wrapper=html.match(/<section\b[^>]*id="play-area"[^>]*>([\s\S]*?)<\/section>/)?.[1];
for(const id of['combat-slot-0','combat-slot-1','combat-slot-2','combat-slot-3','combat-slot-4','open-skills','skill-overlay','spell-search','upgrade-skill','touchDodge','touchGuard'])assert(wrapper?.includes('id="'+id+'"'),id+' belongs to fullscreen wrapper');
assert.match(html,/<button[^>]*id="touchSwing"[^>]*data-key=" "[^>]*data-touch-action=" "/);
assert(html.indexOf('src="spell-catalog.js')<html.indexOf('src="progression.js'));assert(html.indexOf('src="progression.js')<html.indexOf('src="combat-ui.js'));assert(html.indexOf('src="combat-ui.js')<html.indexOf('src="adventure.js'));
const css=fs.readFileSync(path.join(root,'combat-ui.css'),'utf8');assert.match(css,/repeat\(5,minmax\(44px,1fr\)\)/,'all five mobile slots retain44px targets');assert.match(css,/\.spell-search input\{font-size:16px/,'mobile search avoids Safari focus zoom');assert.match(css,/\.skill-equip button\{flex:0 0 44px;min-width:44px;min-height:44px\}/,'equip targets wrap with44px minimum width');
console.log('PASS: 20-spell/26-node browser, five schools/search, real learn/rank upgrades and stat previews, five-slot equip/cast/cooldowns, respec/XP, modal editing/focus/pause guards and responsive fullscreen controls.');
