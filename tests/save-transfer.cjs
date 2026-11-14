'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.resolve(__dirname,'../dist/save-transfer.js'),'utf8');
const areas={rosepetal:{w:64,h:48},lavenderway:{w:160,h:36}};
const original=()=>({area:'rosepetal',x:512,y:328,hp:3,food:2,note:true,face:'right',lastSafeTown:'rosepetal',inventory:{apple:7,poison_amanita:3},foragePicked:{'rosepetal:mushroom':2},clearedCamps:{'lavenderway:camp-1':true},defeatedMonsters:{'lavenderway:camp-1:monster:1':true},campProgress:{'lavenderway:camp-1':{hp:0,spawned:3,cleared:true}},worldClock:{day:2,minutes:650.5,actors:{'lavendyr:npc':{x:120,y:80,task:'work'}},stations:{lavendyr:{owner:'npc',leaseUntil:680}}}});
function setup(options={}){
 const values=new Map(),history=[],events=[];let live=original(),beforeCalls=0,failKey=null,failOnce=false;
 const storage={getItem:key=>values.get(key)??null,setItem(key,value){if(key===failKey){if(failOnce)failKey=null;throw Error('Storage full');}values.set(key,String(value));if(options.failAfterBackup&&key==='blooming-world-v05:previous'){failKey='blooming-world-v05';failOnce=true;}}};
 const win={localStorage:storage,location:{href:'https://example.test/game/index.html?area=rosepetal&devtravel=1&v=13&other=keep#marker'},history:{replaceState(a,b,url){history.push(url);}},URL,setTimeout};
 const C={window:win,URL,Date,JSON,Promise};vm.createContext(C);vm.runInContext(source,C);const api=win.BloomSaveTransfer;
 values.set(api.saveKey,JSON.stringify(live));
 api.configure({getAreas:()=>areas,getState:()=>live,beforeExport(){beforeCalls++;live={...live,x:520};if(!api.isImporting())storage.setItem(api.saveKey,JSON.stringify(live));},onImport:async state=>{
  events.push('import');assert(api.isImporting(),'import locks out pagehide/autosave before reload');
  if(!api.isImporting())storage.setItem(api.saveKey,JSON.stringify(live));
  if(options.importError)throw Error('Reload unavailable');
 }});
 return{api,values,events,history,get live(){return live;},get beforeCalls(){return beforeCalls;},fail(key,once=false){failKey=key;failOnce=once;}};
}
(async()=>{
 const exported=setup(),text=await exported.api.exportSave(),file=JSON.parse(text);
 assert.equal(file.format,'blooming-quest-save');assert.equal(file.version,1);assert.equal(file.data.x,520,'export snapshots current hero state before download');assert.equal(exported.beforeCalls,1);
 assert.equal(file.data.inventory.apple,7);assert.equal(file.data.worldClock.stations.lavendyr.owner,'npc');
 const moved=setup(),incoming={...original(),area:'lavenderway',x:1300,y:440,inventory:{apple:19,poison_bellcap:4}};
 await moved.api.importSave(JSON.stringify({format:file.format,version:1,data:incoming}));
 assert.deepEqual(JSON.parse(moved.values.get(moved.api.saveKey)),incoming,'a new origin can import the complete exported journey');
 assert.equal(JSON.parse(moved.values.get(moved.api.backupKey)).x,520,'rollback captures the destination browser current hero position');
 assert.equal(moved.events.length,1);assert(moved.api.isImporting(),'old game autosaves stay blocked until the new page loads');
 const legacy=setup();await legacy.api.importSave(JSON.stringify(incoming));assert.equal(JSON.parse(legacy.values.get(legacy.api.saveKey)).area,'lavenderway','plain legacy world saves remain importable');
 const wrong=[null,[],{},'not-json',{...incoming,area:'../../outside'},{...incoming,area:'newer-dungeon'},{...incoming,x:3000},{...incoming,y:-1},{...incoming,hp:null},{...incoming,food:'3'},{...incoming,note:7},{...incoming,face:'east'},{...incoming,inventory:{apple:-1}},{...incoming,worldClock:{day:2,minutes:1440}},{format:file.format,version:2,data:incoming}];
 for(const bad of wrong){const h=setup(),before=h.values.get(h.api.saveKey);await assert.rejects(()=>h.api.importSave(typeof bad==='string'?bad:JSON.stringify(bad)));assert.equal(h.values.get(h.api.saveKey),before,'invalid files never replace a journey');assert(!h.api.isImporting());}
 const poisoned=setup();await assert.rejects(()=>poisoned.api.importSave('{"area":"rosepetal","x":10,"y":10,"hp":3,"__proto__":{"polluted":true}}'));
 assert.equal({}.polluted,undefined);
 const quota=setup(),old=quota.values.get(quota.api.saveKey);quota.fail(quota.api.backupKey);await assert.rejects(()=>quota.api.importSave(JSON.stringify(incoming)),/Storage full/);assert.equal(JSON.parse(quota.values.get(quota.api.saveKey)).x,520);assert(!quota.api.isImporting());
 const failedWrite=setup({failAfterBackup:true});await assert.rejects(()=>failedWrite.api.importSave(JSON.stringify(incoming)),/Storage full/);assert(!failedWrite.api.isImporting());assert.equal(JSON.parse(failedWrite.values.get(failedWrite.api.saveKey)).x,520,'failed replacement restores the fresh destination save');
 const failedReload=setup({importError:true});await assert.rejects(()=>failedReload.api.importSave(JSON.stringify(incoming)),/Reload unavailable/);assert.equal(JSON.parse(failedReload.values.get(failedReload.api.saveKey)).area,'rosepetal');assert(!failedReload.api.isImporting(),'a failed import releases the autosave guard');
 const restore=setup();restore.values.set(restore.api.backupKey,JSON.stringify(incoming));await restore.api.restorePrevious();assert.equal(JSON.parse(restore.values.get(restore.api.saveKey)).area,'lavenderway');assert.equal(JSON.parse(restore.values.get(restore.api.backupKey)).area,'rosepetal','restoring also keeps the journey it replaces');
 const update=setup();await update.api.prepareReload();assert.equal(JSON.parse(update.values.get(update.api.saveKey)).x,520);assert.equal(update.history.at(-1),'/game/index.html?v=13&other=keep#marker','explicit update saves and removes only temporary travel parameters');
 const untouched=new Map([['blooming-world-v05','an old saved journey']]),C={window:{localStorage:{getItem:k=>untouched.get(k),setItem(k,v){untouched.set(k,v);}},location:{href:'https://example.test/repo/index.html?area=rosepetal&devtravel=1'},history:{replaceState(){}},URL},URL,Date,JSON,Promise};vm.createContext(C);vm.runInContext(source,C);await C.window.BloomSaveTransfer.prepareReload();assert.equal(untouched.get('blooming-world-v05'),'an old saved journey','a corrective update before gameplay loads leaves the existing save untouched');
 console.log('PASS: portable save envelope/legacy import, live hero snapshot, complete camp/bag/clock preservation, previous-save rollback, malformed/prototype/out-of-map rejection, storage failures, import autosave guard and safe update URL cleanup.');
})().catch(error=>{console.error(error);process.exitCode=1;});
