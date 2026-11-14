/* Portable, local save files. No account or remote service is involved. */
(function(global){
  'use strict';
  const KEY='blooming-world-v05',BACKUP_KEY=KEY+':previous',FORMAT='blooming-quest-save',MAX_BYTES=4*1024*1024;
  let config={},configured=false,importing=false;
  const $=id=>typeof document==='undefined'?null:document.getElementById(id);
  function notify(message){const target=$('portable-status');if(target)target.textContent=message;}
  function object(value){return value!==null&&typeof value==='object'&&!Array.isArray(value);}
  function safeTree(value,depth=0,budget={left:50000}){
    if(depth>24||--budget.left<0)throw Error('This save is too complex to import.');
    if(typeof value==='number'&&!Number.isFinite(value))throw Error('The save contains an invalid number.');
    if(typeof value==='string'&&value.length>10000)throw Error('The save contains an invalid text field.');
    if(Array.isArray(value)){if(value.length>10000)throw Error('The save contains an oversized list.');for(const item of value)safeTree(item,depth+1,budget);}
    else if(object(value))for(const [key,item]of Object.entries(value)){
      if(['__proto__','constructor','prototype'].includes(key))throw Error('The save contains an unsupported field.');
      safeTree(item,depth+1,budget);
    }
  }
  function validate(input,areas=config.getAreas?.()){
    if(!object(input))throw Error('Choose a Blooming Quest save file.');
    let state=input;
    if('format'in input){
      if(input.format!==FORMAT||input.version!==1||!object(input.data))throw Error('This save format is not supported by this version of the game.');
      state=input.data;
    }
    safeTree(state);
    if(typeof state.area!=='string'||!/^[A-Za-z0-9_-]{1,96}$/.test(state.area))throw Error('The save has no valid world location.');
    for(const field of ['x','y','hp'])if(typeof state[field]!=='number'||!Number.isFinite(state[field])||state[field]<0||state[field]>10000000)throw Error('The save has an invalid '+field+' value.');
    if(!Number.isInteger(state.hp)||state.hp>100000)throw Error('The save has invalid health.');
    if('food'in state&&(!Number.isInteger(state.food)||state.food<0||state.food>1000000))throw Error('The save has invalid supplies.');
    if('note'in state&&typeof state.note!=='boolean')throw Error('The save has an invalid quest flag.');
    if('face'in state&&!['down','right','up','left'].includes(state.face))throw Error('The save has an invalid facing direction.');
    for(const field of ['clearedCamps','defeatedMonsters','campProgress','inventory','foragePicked','worldClock'])if(field in state){
      const legacyList=['clearedCamps','defeatedMonsters'].includes(field)&&Array.isArray(state[field]);
      if(!object(state[field])&&!legacyList)throw Error('The save has invalid '+field+' data.');
    }
    for(const field of ['inventory','foragePicked'])if(state[field])for(const value of Object.values(state[field]))if(!Number.isInteger(value)||value<0||value>1000000000)throw Error('The save has invalid '+field+' counts.');
    for(const field of ['clearedCamps','defeatedMonsters'])if(state[field]){
      if(Array.isArray(state[field])){if(state[field].some(value=>typeof value!=='string'||value.length>200))throw Error('The save has invalid '+field+' flags.');}
      else if(Object.values(state[field]).some(value=>typeof value!=='boolean'))throw Error('The save has invalid '+field+' flags.');
    }
    if(state.worldClock){const clock=state.worldClock;if(!Number.isInteger(clock.day)||clock.day<1||clock.day>10000000||typeof clock.minutes!=='number'||clock.minutes<0||clock.minutes>=1440)throw Error('The save has an invalid world clock.');if('actors'in clock&&!object(clock.actors))throw Error('The save has invalid resident data.');}
    if(state.campProgress)for(const progress of Object.values(state.campProgress)){
      if(!object(progress))throw Error('The save has invalid camp progress.');
      for(const field of ['hp','spawned'])if(field in progress&&(!Number.isInteger(progress[field])||progress[field]<0||progress[field]>1000000))throw Error('The save has invalid camp progress.');
      if('cleared'in progress&&typeof progress.cleared!=='boolean')throw Error('The save has invalid camp progress.');
    }
    if(areas){const area=areas[state.area];if(!area)throw Error('This save uses an area unavailable in this version. Update the game before importing it.');if(state.x>=area.w*16||state.y>=area.h*16)throw Error('The saved position is outside its world map.');}
    return JSON.parse(JSON.stringify(state));
  }
  function parse(text){if(typeof text!=='string'||text.length>MAX_BYTES)throw Error('Choose a save file smaller than 4 MB.');let value;try{value=JSON.parse(text);}catch{throw Error('This file is not valid JSON.');}return validate(value);}
  function envelope(state){return{format:FORMAT,version:1,exportedAt:new Date().toISOString(),data:state};}
  function refreshUI(){
    for(const id of ['export-save','import-save']){const button=$(id);if(button)button.disabled=!configured||importing;}
    const previous=$('restore-save');if(previous){try{previous.hidden=!global.localStorage.getItem(BACKUP_KEY);}catch{previous.hidden=true;}previous.disabled=!configured||importing;}
  }
  function configure(options={}){config=options;configured=true;refreshUI();}
  async function snapshot(){
    if(!configured||typeof config.getState!=='function')throw Error('The world is still loading. Try again when it is ready.');
    await config.beforeExport?.();
    const areas=config.getAreas?.();if(config.getAreas&&!areas)throw Error('The world is still loading. Try again when it is ready.');
    return validate(config.getState(),areas);
  }
  async function exportSave(){
    if(importing)throw Error('A save is being imported.');
    const state=await snapshot(),text=JSON.stringify(envelope(state),null,2);
    if(typeof document!=='undefined'&&typeof Blob!=='undefined'&&global.URL?.createObjectURL){
      const url=global.URL.createObjectURL(new Blob([text],{type:'application/json'})),link=document.createElement('a');
      link.href=url;link.download='blooming-quest-save-'+new Date().toISOString().slice(0,10)+'.json';link.hidden=true;document.body.appendChild(link);link.click();link.remove();global.setTimeout(()=>global.URL.revokeObjectURL(url),1000);
    }
    notify('Save file exported. Keep it to move your journey to another browser or website.');return text;
  }
  async function importSave(text){
    if(importing)throw Error('A save is already being imported.');
    const next=parse(text);
    if(!configured||typeof config.onImport!=='function')throw Error('The world is still loading. Try again when it is ready.');
    const previous=await snapshot(),previousRaw=JSON.stringify(previous),storage=global.localStorage;
    // Write the rollback copy before touching the live save. A storage failure
    // aborts the import instead of destroying the user's current journey.
    storage.setItem(BACKUP_KEY,previousRaw);
    importing=true;refreshUI();
    try{storage.setItem(KEY,JSON.stringify(next));notify('Save imported. Reloading your journey…');await config.onImport(next);return next;}
    catch(error){importing=false;try{storage.setItem(KEY,previousRaw);}catch{}refreshUI();throw error;}
  }
  async function restorePrevious(){const raw=global.localStorage.getItem(BACKUP_KEY);if(!raw)throw Error('There is no previous save to restore.');return importSave(raw);}
  async function prepareReload(){
    // A broken/loading release must still be able to apply a corrective update.
    // Before configure(), gameplay has not started: leave its stored save intact.
    if(configured){const state=await snapshot();global.localStorage.setItem(KEY,JSON.stringify(state));}
    if(global.location&&global.history){const url=new URL(global.location.href);url.searchParams.delete('area');url.searchParams.delete('devtravel');global.history.replaceState(null,'',url.pathname+url.search+url.hash);}
    return true;
  }
  function handle(promise){Promise.resolve(promise).catch(error=>notify(error.message||'The save action could not finish.'));}
  const download=$('export-save'),upload=$('import-save'),file=$('save-file'),restore=$('restore-save');
  if(download)download.onclick=()=>handle(exportSave());
  if(upload&&file)upload.onclick=()=>file.click();
  if(restore)restore.onclick=()=>handle(restorePrevious());
  if(file)file.onchange=()=>{const chosen=file.files?.[0];file.value='';if(!chosen)return;if(chosen.size>MAX_BYTES){notify('Choose a save file smaller than 4 MB.');return;}handle(chosen.text().then(importSave));};
  global.BloomSaveTransfer={configure,exportSave,importSave,restorePrevious,prepareReload,validate,isImporting:()=>importing,saveKey:KEY,backupKey:BACKUP_KEY};refreshUI();
})(window);
