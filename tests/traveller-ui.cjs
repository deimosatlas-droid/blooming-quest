'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../dist');
class Element{
  constructor(tag='div',document){this.tagName=tag.toUpperCase();this.ownerDocument=document;this.parentElement=null;this.children=[];this.dataset={};this.attrs={};this.events={};this.textContent='';this.innerHTML='';this.hidden=false;this.disabled=false;this.style={};const classes=new Set();this.classList={toggle(name,value){if(value)classes.add(name);else classes.delete(name);},contains:name=>classes.has(name)};}
  setAttribute(name,value){this.attrs[name]=String(value);}
  getAttribute(name){return this.attrs[name];}
  appendChild(node){node.parentElement=this;this.children.push(node);return node;}
  replaceChildren(...nodes){for(const node of this.children)node.parentElement=null;this.children=[];for(const node of nodes)this.appendChild(node);}
  addEventListener(type,handler){(this.events[type]??=[]).push(handler);}
  closest(selector){for(let node=this;node;node=node.parentElement)if(selector==='[hidden]'&&node.hidden||selector==='details'&&node.tagName==='DETAILS')return node;return null;}
  matches(selector){
    if(selector==='button:not(:disabled)')return this.tagName==='BUTTON'&&!this.disabled;
    if(selector==='input:not(:disabled)')return this.tagName==='INPUT'&&!this.disabled;
    if(selector==='select:not(:disabled)')return this.tagName==='SELECT'&&!this.disabled;
    if(selector==='a[href]')return this.tagName==='A'&&Boolean(this.href||this.attrs.href);
    if(selector==='[tabindex="0"]')return this.attrs.tabindex==='0';
    const data=selector.match(/^\[data-([\w-]+)\]$/);if(data){const key=data[1].replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase());return key in this.dataset;}
    return false;
  }
  querySelectorAll(selector){const output=[];for(const child of this.children){if(selector.split(',').some(part=>child.matches(part.trim())))output.push(child);output.push(...child.querySelectorAll(selector));}return output;}
  focus(){this.ownerDocument.activeElement=this;}
  getClientRects(){return this.closest('[hidden]')?[]:[{}];}
  scrollIntoView(){this.scrolled=true;}
}
const nodes=new Map(),document={events:{},activeElement:null};
document.createElement=tag=>new Element(tag,document);document.createElementNS=(_,tag)=>document.createElement(tag);document.getElementById=id=>nodes.get(id)||null;document.addEventListener=(name,handler)=>(document.events[name]??=[]).push(handler);
const make=(id,tag='div')=>{const node=document.createElement(tag);node.id=id;nodes.set(id,node);return node;};
const play=make('play-area'),overlay=make('traveller-overlay'),frame=make('traveller-window');overlay.hidden=true;play.appendChild(overlay);overlay.appendChild(frame);
for(const[id,tag]of [['traveller-title','h2'],['traveller-close','button'],['traveller-tabs','div'],['traveller-body','div'],['traveller-feedback','p']])frame.appendChild(make(id,tag));
for(const id of ['kit-map','kit-bag','kit-journal','kit-options'])play.appendChild(make(id,'button'));
play.appendChild(make('status','p'));
const details=make('portable','details'),exportButton=make('export-save','button');play.appendChild(details);details.appendChild(exportButton);
const C={window:{},document,Math,JSON,Promise,Map,Set,console};vm.createContext(C);vm.runInContext(fs.readFileSync(path.join(root,'traveller-ui.js'),'utf8'),C,{filename:'traveller-ui.js'});
const ui=C.window.BloomTraveller,$=id=>nodes.get(id),world=JSON.parse(fs.readFileSync(path.join(root,'world.json')));
const state={area:'rosepetal',lastSafeTown:'rosepetal',x:512,y:328,hp:2,food:2,note:false,inventory:{apple:2,berry:3,poison_amanita:1,moss_clump:4},clearedCamps:{'lavenderway:camp-1':true,'unrelated:flag':true},campProgress:{'foxglove:camp-2':{cleared:true}}};
let enabled=false,allowPause=true,pauses=0,resumes=0,saves=0,spells=0,uses=[],travels=[],options={sound:false,expanded:false},deferExpand=false,finishExpand=null,expandCalls=0,expandError=false;
ui.configure({getState:()=>state,getWorld:()=>world,getArea:()=>state.area,getEnabled:()=>enabled&&!ui.isOpen(),getOptions:()=>options,
 onPause:()=>{pauses++;return allowPause;},onResume:()=>resumes++,onSpells:()=>{assert(!ui.isOpen());spells++;},
 onUseItem:id=>{assert(ui.isOpen(),'use callback runs before the bag closes');uses.push(id);if(id==='noodles'){state.food--;state.hp=Math.min(5,state.hp+2);}else{state.inventory[id]--;state.hp=Math.min(5,state.hp+1);}return{ok:true,message:'Ate '+id+'.'};},
 onTravel:id=>{assert(!ui.isOpen(),'travel closes the modal before entering an area');travels.push(id);state.area=id;return{ok:true};},onSave:()=>{saves++;return{ok:true,message:'Saved at home.'};},onSound:()=>{options.sound=!options.sound;return{ok:true};},onExpand:async()=>{expandCalls++;if(expandError)throw Error('Fullscreen exit failed.');if(deferExpand)await new Promise(resolve=>finishExpand=resolve);options.expanded=!options.expanded;return{ok:true};}});
const descendants=selector=>$('traveller-body').querySelectorAll(selector),buttonBy=(key,value)=>descendants('button:not(:disabled)').find(node=>node.dataset[key]===value),allButtons=()=>descendants('button:not(:disabled)');
const tab=id=>$('traveller-tabs').querySelectorAll('[data-travel-tab]').find(node=>node.dataset.travelTab===id);
function key(name,extra={}){const event={key:name,target:document.activeElement,defaultPrevented:false,stopped:false,immediate:false,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;},stopImmediatePropagation(){this.immediate=true;},...extra};for(const handler of document.events.keydown||[])handler(event);return event;}
const tick=()=>Promise.resolve().then(()=>Promise.resolve());
const text=node=>[node.textContent,...node.children.map(text)].join(' ');
(async()=>{
 assert.equal(ui.open('bag'),false);assert($('kit-bag').disabled,'title screen buttons are disabled');assert.equal(ui.open('invalid'),false);
 enabled=true;ui.update();allowPause=false;assert.equal(ui.open('bag'),false,'game can reject menus during conversation/ferry');allowPause=true;$('kit-bag').focus();assert(ui.open('bag'));assert(!$('traveller-overlay').hidden);assert.equal(document.activeElement,$('traveller-close'));assert.equal($('traveller-title').textContent,'Amaal’s Satchel');assert.equal(buttonBy('inventoryItem','apple').getAttribute('aria-label'),'Apple, 2');
 assert.equal(descendants('[data-inventory-item]').length,5,'only owned fruit/ingredient/noodle entries are listed');assert.equal(state.inventory.moss_clump,4,'unknown compatible inventory is preserved');
 buttonBy('inventoryItem','apple').onclick();const staleUse=buttonBy('useItem','apple').onclick;assert(staleUse);staleUse();await tick();assert.equal(state.inventory.apple,1);assert.equal(state.hp,3);assert.deepEqual(uses,['apple']);assert.match($('traveller-feedback').textContent,/Ate apple/);
 buttonBy('inventoryItem','poison_amanita').onclick();assert.equal(descendants('[data-use-item]').length,0,'poisonous mushrooms have no Eat action');assert.match(text($('traveller-body')),/Poisonous crafting ingredient/);staleUse();await tick();assert.deepEqual(uses,['apple'],'a stale edible action cannot consume the newly selected poisonous ingredient');assert.equal(state.inventory.poison_amanita,1);
 buttonBy('bagCategory','crafting').onclick();assert.equal(descendants('[data-inventory-item]').length,2,'crafting pocket includes known poison and unknown saved items');assert(buttonBy('inventoryItem','stored:moss_clump'));
 buttonBy('bagCategory','meals').onclick();assert.equal(descendants('[data-inventory-item]').length,1);buttonBy('inventoryItem','noodles').onclick();buttonBy('useItem','noodles').onclick();await tick();assert.equal(state.food,1);assert.equal(state.hp,5);assert.equal(buttonBy('useItem','noodles'),undefined,'full-health food action is disabled');
 state.hp=1;ui.update();const last=buttonBy('useItem','noodles');last.focus();assert(key('Tab').defaultPrevented);assert.equal(document.activeElement,$('traveller-close'));assert(key('Tab',{shiftKey:true}).defaultPrevented);assert.equal(document.activeElement,last,'focus remains trapped among visible modal controls');
 const pauseCount=pauses;key('m');assert.equal(pauses,pauseCount,'switching kit pages keeps one paused session');assert.equal($('traveller-title').textContent,'The Blooming Atlas');assert.equal(descendants('[data-fast-travel]').length,1);assert.equal(descendants('[data-map-town]').length,16,'all eight pins and eight accessible list destinations are available');assert.equal(descendants('[data-map-route]').length,7,'six long roads plus ferry retain hover highlights');
 const sea=descendants('[data-map-town]').find(node=>node.dataset.mapTown==='seabloom'&&!node.dataset.mapPin);sea.focus();sea.onclick();const selected=descendants('[data-map-town]').find(node=>node.dataset.mapTown==='seabloom'&&!node.dataset.mapPin);assert.equal(document.activeElement,selected,'selection keeps focus on the town list instead of jumping to its map pin');assert.equal(selected.getAttribute('aria-pressed'),'true');assert(buttonBy('fastTravel','seabloom'));
 const seaPin=descendants('[data-map-town]').find(node=>node.dataset.mapTown==='seabloom'&&node.dataset.mapPin);seaPin.onmouseenter();assert(seaPin.classList.contains('is-previewed'));const ferry=descendants('[data-map-route]').find(node=>node.dataset.mapRoute==='petalferry');assert(ferry.classList.contains('is-linked'));seaPin.onmouseleave();assert(ferry.classList.contains('is-linked'),'selected destination routes stay highlighted after hover leaves');
 buttonBy('fastTravel','seabloom').onclick();await tick();assert.deepEqual(travels,['seabloom']);assert(!ui.isOpen());assert.equal(state.inventory.apple,1);assert.equal(document.activeElement,$('kit-bag'),'closing restores the original kit focus');
 assert(ui.open('journal'));assert.equal($('traveller-title').textContent,'Amaal’s Journal');assert.match(text($('traveller-body')),/Check the bookshelf/);assert.match(text($('traveller-body')),/2 \/ 24 monster camps cleared/,'unrelated old flags do not inflate actual camp clears');state.note=true;ui.update();assert.match(text($('traveller-body')),/Follow Lavenderway Fields east/);assert.match(text($('traveller-body')),/still being written/,'journal does not invent finished quest chains');
 tab('spells').onclick();assert.equal(spells,1);assert(!ui.isOpen());
 assert(ui.open('options'));assert(allButtons().find(node=>node.textContent==='Sound effects · off'));allButtons().find(node=>node.textContent==='Save journey').onclick();await tick();assert.equal(saves,1);assert.match($('traveller-feedback').textContent,/Saved at home/);allButtons().find(node=>node.textContent==='Sound effects · off').onclick();await tick();assert(options.sound);assert(allButtons().find(node=>node.textContent==='Sound effects · on'));allButtons().find(node=>node.textContent==='Expand game view').onclick();await tick();assert(options.expanded);assert(allButtons().find(node=>node.textContent==='Leave expanded view'));
 const input=document.createElement('input');$('traveller-body').appendChild(input);input.focus();assert(!key('m').defaultPrevented,'native input editing is not hijacked');assert.equal($('traveller-title').textContent,'By the Campfire');const escape=key('Escape');assert(escape.defaultPrevented&&escape.immediate);assert(!ui.isOpen());
 ui.open('options');options.expanded=true;deferExpand=true;details.open=false;
 const opening=allButtons().find(node=>node.textContent==='Save files & offline play').onclick();
 assert(!ui.isOpen(),'save tools close the modal before leaving fullscreen');assert.equal(details.open,false,'save tools stay hidden until fullscreen exit completes');assert.notEqual(document.activeElement,exportButton,'focus waits for the exit callback');finishExpand();await opening;deferExpand=false;
 assert.equal(options.expanded,false);assert(details.open);assert.equal(document.activeElement,exportButton,'after fullscreen exit the real export panel is visible and focused');
 details.open=false;ui.open('options');const callsBeforeNormal=expandCalls;await allButtons().find(node=>node.textContent==='Save files & offline play').onclick();assert.equal(expandCalls,callsBeforeNormal,'normal view does not toggle into fullscreen while opening save files');assert(details.open);assert.equal(document.activeElement,exportButton);
 details.open=false;options.expanded=true;expandError=true;ui.open('options');assert.equal(await allButtons().find(node=>node.textContent==='Save files & offline play').onclick(),false);assert.equal(details.open,false,'failed fullscreen exit never focuses a hidden export panel');assert.match($('status').textContent,/Fullscreen exit failed/);expandError=false;options.expanded=false;
 enabled=false;ui.update();assert($('kit-map').disabled&&$('kit-options').disabled);assert.equal(state.inventory.poison_amanita,1);assert.equal(state.inventory.moss_clump,4);assert(resumes>0);
 console.log('PASS: real bag quantities/categories/food/poison safety, unknown-item preservation, eight Map A destinations/routes/current marker and fast travel, honest journal, options callbacks, title/pause guards, focus trap and save-file access.');
})().catch(error=>{console.error(error);process.exitCode=1;});
