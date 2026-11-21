'use strict';
/* Cross-module game-flow regression. DOM/Canvas mocks cannot establish browser layout or device feel. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../dist'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const scripts=[...html.matchAll(/<script\s+src="([^"?]+)(?:\?[^"]*)?"/g)].map(match=>match[1]);
function fixture({loaded=true,saved,coarse=false,preferences}={}){
 const storage={...(saved?{'blooming-world-v05':saved}:{}),...(preferences?{'blooming-journey-settings-v1':preferences}:{})},events={},draws=[],document={events:{},activeElement:null,hidden:false,visibilityState:'visible',fullscreenElement:null,baseURI:'https://example.test/blooming-quest/'};let fullscreenCalls=0;
 const gradient={addColorStop(){}},context=new Proxy({createRadialGradient:()=>gradient,createLinearGradient:()=>gradient,getImageData:(_,__,w,h)=>({data:new Uint8ClampedArray(w*h*4).fill(255)}),measureText:value=>({width:String(value).length*6}),drawImage(...args){draws.push(args);}}, {get:(object,name)=>object[name]??(()=>{})});
 class Element{
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.parentElement=null;this.dataset={};this.attributes={};this.events={};this.hidden=false;this.disabled=false;this.value='';this.checked=false;this._text='';this._html='';this._classes=new Set();this.style={setProperty(name,value){this[name]=String(value);},getPropertyValue(name){return this[name]||'';}};this.classList={add:(...names)=>names.forEach(name=>this._classes.add(name)),remove:(...names)=>names.forEach(name=>this._classes.delete(name)),contains:name=>this._classes.has(name),toggle:(name,value)=>{const next=value??!this._classes.has(name);next?this._classes.add(name):this._classes.delete(name);return next;}};}
  get className(){return[...this._classes].join(' ');}set className(value){this._classes=new Set(String(value).split(/\s+/).filter(Boolean));}
  get textContent(){return this._text;}set textContent(value){this._text=String(value??'');}
  get innerHTML(){return this._html;}set innerHTML(value){this._html=String(value);this.replaceChildren();}
  get isConnected(){let current=this;while(current.parentElement)current=current.parentElement;return current===document.body;}
  get firstChild(){return this.children[0]||null;}
  appendChild(child){if(child.parentElement)child.parentElement.children.splice(child.parentElement.children.indexOf(child),1);child.parentElement=this;this.children.push(child);return child;}
  append(...children){for(const child of children)this.appendChild(child);}
  removeChild(child){this.children.splice(this.children.indexOf(child),1);child.parentElement=null;return child;}
  replaceChildren(...children){for(const child of this.children)child.parentElement=null;this.children=[];for(const child of children)this.appendChild(child);}
  remove(){this.parentElement?.removeChild(this);}
  setAttribute(name,value){this.attributes[name]=String(value);if(name==='id')this.id=String(value);if(name==='class')this.className=value;if(name==='hidden')this.hidden=true;if(name==='disabled')this.disabled=true;if(name.startsWith('data-'))this.dataset[name.slice(5).replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase())]=String(value);}
  getAttribute(name){if(name==='class')return this.className;return this.attributes[name]??null;}
  removeAttribute(name){delete this.attributes[name];if(name==='hidden')this.hidden=false;if(name==='disabled')this.disabled=false;}
  matches(selector){
   selector=selector.trim();if(!selector)return false;if(selector==='[hidden]')return this.hidden;if(selector.includes(':not(:disabled)')&&this.disabled)return false;
   selector=selector.replace(/:not\(:disabled\)/g,'');if(selector.includes(':not([contenteditable="false"])')){if(this.getAttribute('contenteditable')==='false')return false;selector=selector.replace(':not([contenteditable="false"])','');}
   const tag=selector.match(/^[\w-]+/);if(tag&&this.tagName!==tag[0].toUpperCase())return false;
   const id=selector.match(/#([\w-]+)/);if(id&&this.id!==id[1])return false;
   for(const match of selector.matchAll(/\.([\w-]+)/g))if(!this.classList.contains(match[1]))return false;
   for(const match of selector.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)){let value=match[1]==='hidden'?this.hidden?'':null:match[1]==='tabindex'?this.attributes.tabindex:this.getAttribute(match[1]);if(match[1].startsWith('data-'))value=this.dataset[match[1].slice(5).replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase())]??null;if(value===null||value===undefined)return false;if(match[2]!==undefined&&String(value)!==match[2])return false;}
   return true;
  }
  querySelectorAll(selector){const output=[];for(const child of this.children){if(selector.split(',').some(part=>child.matches(part)))output.push(child);output.push(...child.querySelectorAll(selector));}return output;}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  closest(selector){for(let current=this;current;current=current.parentElement)if(selector.split(',').some(part=>current.matches(part)))return current;return null;}
  contains(target){return this===target||this.children.some(child=>child.contains(target));}
  addEventListener(type,listener){(this.events[type]??=[]).push(listener);}
  removeEventListener(type,listener){this.events[type]=(this.events[type]||[]).filter(item=>item!==listener);}
  focus(){document.activeElement=this;}
  getClientRects(){return this.closest('[hidden]')?[]:[{}];}
  scrollIntoView(){}setPointerCapture(){}releasePointerCapture(){}
  getContext(){return context;}
  click(event={}){if(!this.disabled)this.onclick?.({target:this,preventDefault(){},isTrusted:false,detail:0,...event});}
  requestFullscreen(){fullscreenCalls++;document.fullscreenElement=this;for(const listener of document.events.fullscreenchange||[])listener();return Promise.resolve();}
 }
 document.createElement=tag=>new Element(tag);document.createElementNS=(_,tag)=>new Element(tag);document.body=new Element('body');document.body.className='play-screen';
 document.getElementById=id=>{function find(node){if(node.id===id)return node;for(const child of node.children){const match=find(child);if(match)return match;}return null;}return find(document.body);};document.querySelectorAll=selector=>document.body.querySelectorAll(selector);document.querySelector=selector=>document.body.querySelector(selector);document.addEventListener=(name,listener)=>(document.events[name]??=[]).push(listener);document.removeEventListener=(name,listener)=>document.events[name]=(document.events[name]||[]).filter(item=>item!==listener);document.exitFullscreen=()=>{document.fullscreenElement=null;return Promise.resolve();};
 // Parse the checked-in markup so IDs, nesting and reparented controls match the shipped page.
 const markup=html.replace(/<style[\s\S]*?<\/style>/gi,'').replace(/<script[\s\S]*?<\/script>/gi,'').split(/<body[^>]*>/i)[1].split(/<\/body>/i)[0],stack=[document.body],voids=new Set(['meta','link','img','input','br','hr','source']);
 for(const token of markup.matchAll(/<\/?[^>]+>/g)){const text=token[0],end=text.match(/^<\/([\w-]+)/);if(end){if(stack.at(-1).tagName===end[1].toUpperCase())stack.pop();continue;}const match=text.match(/^<([\w-]+)/);if(!match)continue;const element=new Element(match[1]);for(const attr of text.slice(match[0].length,-1).matchAll(/([\w-]+)(?:="([^"]*)")?/g))element.setAttribute(attr[1],attr[2]??'');stack.at(-1).appendChild(element);if(!voids.has(match[1].toLowerCase())&&!text.endsWith('/>'))stack.push(element);}
 const window={document,localStorage:{getItem:key=>storage[key]??null,setItem:(key,value)=>storage[key]=String(value)},addEventListener:(name,listener)=>(events[name]??=[]).push(listener),removeEventListener:(name,listener)=>events[name]=(events[name]||[]).filter(item=>item!==listener),matchMedia:query=>({matches:query.includes('coarse')?coarse:false}),navigator:{},screen:{orientation:{lock:()=>Promise.resolve(),unlock(){}}},location:{href:document.baseURI,pathname:'/blooming-quest/',search:'',hash:'',protocol:'https:',hostname:'example.test',reload(){}},history:{replaceState(){}},setTimeout,clearTimeout};
 const C={window,document,localStorage:window.localStorage,location:window.location,history:window.history,screen:window.screen,console,Math,JSON,Map,Set,WeakMap,Promise,Date,URL,URLSearchParams,Uint8Array,Uint8ClampedArray,Int32Array,Float32Array,performance,Image:class{constructor(){this.width=2048;this.height=2048;}set src(value){this._src=value;this.onload?.();}get src(){return this._src;}},requestAnimationFrame(){},setInterval(){},setTimeout,clearTimeout,fetch:url=>{if(!loaded)return new Promise(()=>{});const filename=String(url).split('?')[0];return Promise.resolve({ok:fs.existsSync(path.join(root,filename)),json:()=>Promise.resolve(JSON.parse(fs.readFileSync(path.join(root,filename),'utf8')))});}};
 vm.createContext(C);for(const script of scripts)if(fs.existsSync(path.join(root,script)))vm.runInContext(fs.readFileSync(path.join(root,script),'utf8'),C,{filename:script});
 const evaluate=code=>vm.runInContext(code,C),key=(pressed,extra={})=>{const event={key:pressed,target:document.activeElement,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;},stopImmediatePropagation(){this.stopped=true;this.immediate=true;},...extra};for(const listener of document.events.keydown||[]){listener(event);if(event.immediate)break;}if(!event.stopped)for(const listener of events.keydown||[])listener(event);return event;};
 return{C,document,storage,draws,evaluate,key,find:id=>document.getElementById(id),fullscreenCalls:()=>fullscreenCalls,step:(count=1,dt=1/60)=>{for(let i=0;i<count;i++)evaluate('update('+dt+')');}};
}
async function settle(){for(let count=0;count<16;count++)await Promise.resolve();}
const text=node=>[node.textContent,...node.children.map(text)].join(' ');

module.exports={fixture,settle,text};
