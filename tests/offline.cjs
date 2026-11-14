'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../dist'),workerSource=fs.readFileSync(path.join(root,'sw.js'),'utf8'),clientSource=fs.readFileSync(path.join(root,'pwa-client.js'),'utf8');
function worker({fail=false,windows=1}={}){
 const stores=new Map(),events={},messages=[],requests=[];let skips=0,claimed=0,networkDown=false;
 const scope='https://example.test/repo/',prefix='blooming-quest-offline:'+encodeURIComponent('/repo/')+':',old=prefix+'older',other='blooming-quest-offline:'+encodeURIComponent('/other/')+':older';
 stores.set(old,new Map([['old','safe']]));stores.set(other,new Map([['other','safe']]));
 const caches={async open(name){if(!stores.has(name))stores.set(name,new Map());const data=stores.get(name);return{async put(key,response){data.set(String(key),response);},async match(key){return data.get(String(key));},async keys(){return[...data.keys()].map(url=>({url}));}};},async delete(name){return stores.delete(name);},async keys(){return[...stores.keys()];}};
 const self={registration:{scope},addEventListener:(type,fn)=>events[type]=fn,clients:{async matchAll(){return Array.from({length:windows},(_,i)=>({url:scope+'index.html?tab='+i,postMessage:data=>messages.push(data)}));},async claim(){claimed++;}},async skipWaiting(){skips++;}};
 const C={self,caches,URL,Request,Response,Promise,console,fetch:async request=>{const url=typeof request==='string'?request:request.url;requests.push(request);if(networkDown)throw Error('Offline');return new Response(url,{status:fail&&url.endsWith('/fixed-maps.json')?404:200});}};
 vm.createContext(C);C.importScripts=filename=>vm.runInContext(fs.readFileSync(path.join(root,filename),'utf8'),C);vm.runInContext(workerSource,C);
 const run=async(type,extra={})=>{let pending;events[type]({waitUntil:p=>pending=p,...extra});if(pending)await pending;};
 return{C,self,events,stores,scope,old,other,messages,requests,run,get skips(){return skips;},get claimed(){return claimed;},get cache(){return vm.runInContext('CACHE',C);},set windows(n){windows=n;},offline(){networkDown=true;}};
}
class Channel{constructor(){this.port1={onmessage:null,close(){}};this.port2={postMessage:data=>queueMicrotask(()=>this.port1.onmessage?.({data}))};}}
async function client(){
 const elements={},listeners={},reloads=[],calls=[];let canUpdate=true,saveFails=false;
 const element=()=>({hidden:false,disabled:false,textContent:'',onclick:null});
 const waiting={postMessage(data,ports){calls.push(data.type);ports[0].postMessage(data.type==='BLOOM_CAN_UPDATE'?{allowed:canUpdate}:{accepted:true});}};
 const registration={scope:'https://example.test/repo/',active:{},waiting,addEventListener(){},async update(){}};
 const service={async register(url,options){assert.equal(url,'https://example.test/repo/sw.js');assert.equal(options.scope,registration.scope);assert.equal(options.updateViaCache,'none');return registration;},async getRegistration(){return null;},addEventListener:(type,fn)=>listeners[type]=fn};
 let saves=0;const win={navigator:{serviceWorker:service},location:{protocol:'https:',hostname:'example.test',reload(){reloads.push(true);}},setTimeout,clearTimeout,BloomSaveTransfer:{async prepareReload(){if(saveFails)throw Error('Cannot save');saves++;}}};
 const C={window:win,document:{baseURI:'https://example.test/repo/index.html?v=15',getElementById:id=>elements[id]??=element()},URL,MessageChannel:Channel,Promise};vm.createContext(C);vm.runInContext(clientSource,C);await Promise.resolve();await win.BloomOffline.enable();
 return{api:win.BloomOffline,elements,listeners,reloads,calls,get saves(){return saves;},set canUpdate(value){canUpdate=value;},set saveFails(value){saveFails=value;}};
}
(async()=>{
 const installed=worker();await installed.run('install');assert(installed.stores.has(installed.cache));assert(installed.stores.has(installed.old),'install never deletes a working old release');assert.equal(installed.skips,0,'downloaded updates never silently activate');
 assert(installed.requests.length>30,'all core local data and assets are downloaded');assert(installed.requests.every(r=>r.cache==='reload'),'new releases bypass stale HTTP caches');
 let response;installed.events.fetch({request:{method:'GET',url:installed.scope+'index.html?area=rosepetal&v=15',mode:'navigate'},respondWith:p=>response=p});assert.equal(await(await response).text(),installed.scope+'index.html','development query strings do not break offline navigation');
 installed.offline();installed.events.fetch({request:{method:'GET',url:installed.scope+'world.json?v=15',mode:'cors'},respondWith:p=>response=p});assert.equal(await(await response).text(),installed.scope+'world.json','world data loads offline');
 installed.events.fetch({request:{method:'GET',url:installed.scope+'unavailable-extra.html',mode:'navigate'},respondWith:p=>response=p});assert.equal(await(await response).text(),installed.scope+'offline.html');
 let intercepted=false;installed.events.fetch({request:{method:'GET',url:'https://images.example/preview.png'},respondWith(){intercepted=true;}});assert(!intercepted,'creator previews are not captured as game dependencies');
 const failed=worker({fail:true});await assert.rejects(()=>failed.run('install'));assert(!failed.stores.has(failed.cache));assert(failed.stores.has(failed.old),'a failed download preserves the old release');
 const msg=async(w,type)=>{let reply;await w.run('message',{data:{type},ports:[{postMessage:data=>reply=data}]});return reply;};
 installed.windows=2;assert.equal((await msg(installed,'BLOOM_APPLY_UPDATE')).accepted,false);assert.equal(installed.skips,0,'other running tabs prevent a mid-session asset switch');
 installed.windows=1;assert.equal((await msg(installed,'BLOOM_APPLY_UPDATE')).accepted,true);assert.equal(installed.skips,1);
 await installed.run('activate');assert.equal(installed.claimed,1);assert(!installed.stores.has(installed.old));assert(installed.stores.has(installed.other),'activation never removes another repository subpath cache');
 const page=await client();page.listeners.controllerchange();assert.equal(page.reloads.length,0,'worker changes never silently reload gameplay');
 page.canUpdate=false;await page.api.applyUpdate();assert.equal(page.saves,0);assert.equal(page.reloads.length,0);assert.match(page.elements['offline-status'].textContent,/other.*tabs/);
 page.canUpdate=true;page.saveFails=true;await page.api.applyUpdate();assert.equal(page.calls.filter(c=>c==='BLOOM_APPLY_UPDATE').length,0,'a failed save prevents activation');
 page.saveFails=false;await page.api.applyUpdate();assert.equal(page.saves,1);page.listeners.controllerchange();page.listeners.controllerchange();assert.equal(page.reloads.length,1,'explicit update saves and reloads exactly once');
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8'));assert.equal(manifest.start_url,'./index.html');assert.equal(manifest.scope,'./');assert(fs.existsSync(path.join(root,manifest.icons[0].src)));
 console.log('PASS: atomic complete offline downloads/rollback, cached query-safe navigation and world data, opt-in setup, scope-isolated caches, explicit saved update, other-tab guard and no automatic reload.');
})().catch(error=>{console.error(error);process.exitCode=1;});
