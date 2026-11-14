/* Amaal's travelling kit reads the existing save; game callbacks own every change. */
(function(global){
  'use strict';
  const doc=typeof document==='undefined'?null:document,$=id=>doc?.getElementById?.(id)||null;
  const VIEWS={map:'The Blooming Atlas',bag:'Amaal’s Satchel',journal:'Amaal’s Journal',options:'By the Campfire'};
  const CATEGORIES={all:'All',fruit:'Fruit',meals:'Meals',crafting:'Crafting'};
  const ITEMS={
    apple:{name:'Apple',category:'fruit',edible:true,description:'A crisp wild apple. Eat one to restore one heart.'},
    pear:{name:'Pear',category:'fruit',edible:true,description:'A ripe woodland pear. Eat one to restore one heart.'},
    berry:{name:'Wild Berries',category:'fruit',edible:true,description:'Sweet forest berries. Eat one portion to restore one heart.'},
    noodles:{name:'Noodles',category:'meals',edible:true,description:'A warm travelling meal. Eat one portion to restore two hearts.'},
    poison_amanita:{name:'Rosecap Amanita',category:'crafting',poisonous:true,description:'Poisonous crafting ingredient. Collect the mushroom and leave its growing patch intact. Do not eat.'},
    poison_bellcap:{name:'Violet Bellcap',category:'crafting',poisonous:true,description:'Poisonous crafting ingredient. Its violet cap belongs in the ingredient pocket, never in a meal.'},
    poison_inkcap:{name:'Inky Puffcap',category:'crafting',poisonous:true,description:'Poisonous crafting ingredient. Keep it safely apart from food. Do not eat.'}
  };
  const POINTS={rosepetal:[16.3,70],lavendyr:[25,48.6],sunveil:[40.6,67.4],tidepetal:[44.4,42.3],seabloom:[81.6,73.7],hydrangea:[84.1,46.9],thornrose:[88.4,29],moonblossom:[70.3,18.1]};
  // These landmark percentages match the approved Map A painting.
  const ROUTES={
    lavenderway:[[18.99,63.9],[19.75,61.23],[20.03,58.66],[20.99,56.45],[22.72,54.88],[24.52,53.78]],
    foxglove:[[24.52,53.78],[27.07,53.68],[29.56,54.33],[31.22,55.89],[32.04,58.38],[33.56,60.31],[35.57,62.34],[37.02,63.17]],
    marigold:[[37.02,63.17],[38.88,62.06],[40.47,60.5],[42.89,59.3],[43.99,57.55],[43.99,55.89],[43.37,53.96],[42.33,52.12],[41.78,50.46],[41.92,49.08],[42.89,47.42],[44.75,46.5]],
    coastroad:[[82.87,72.84],[82.87,68.69],[82.67,66.21],[82.8,64.18],[83.43,62.52],[83.56,61.14],[83.15,59.39],[81.98,57.55],[80.94,55.89],[80.39,54.24],[80.46,52.67],[81.08,50.83],[82.11,49.82]],
    nightshade:[[82.11,43.19],[83.22,41.44],[83.36,40.15],[82.67,38.4],[82.8,37.48],[83.77,36.28],[85.43,34.9],[87.09,33.89],[87.85,32.32]],
    moonpath:[[83.84,28.91],[82.46,27.16],[82.18,26.15],[80.52,25.87],[79.35,25.23],[78.38,23.66],[77.97,22.65],[76.24,22.28],[73.48,22.28],[71.55,22.01],[70.1,21.55]],
    petalferry:[[53.04,46.04],[53.66,51.75],[55.32,57.46],[58.15,62.15],[62.29,65.75],[66.85,68.32],[71.55,70.9],[75.69,74.03]]
  };
  let config={},configured=false,bound=false,opened=false,view='bag',category='all',selectedItem='',selectedTown='rosepetal',signature='',previousFocus=null,seenMap=false;
  const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
  const count=value=>Number.isFinite(Number(value))?Math.max(0,Math.floor(Number(value))):0;
  const state=()=>config.getState?.()||{},world=()=>config.getWorld?.()||{},area=()=>String(config.getArea?.()||state().area||'rosepetal');
  const el=(tag,className,text)=>{const node=doc.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=String(text);return node;};
  function clear(node){if(node?.replaceChildren)node.replaceChildren();else if(node)node.innerHTML='';}
  function button(label,className,handler){const node=el('button',className,label);node.type='button';node.onclick=handler;return node;}
  function feedback(message){const target=$('traveller-feedback');if(target)target.textContent=message||'';}
  function inventory(){
    const saved=state(),result=[];
    for(const[id,value]of Object.entries(saved.inventory||{})){
      const quantity=count(value);if(!quantity)continue;
      const known=own(ITEMS,id)&&id!=='noodles';
      result.push({id:known?id:'stored:'+id,key:id,count:quantity,...(known?ITEMS[id]:{name:String(id).replace(/_/g,' ').replace(/^./,letter=>letter.toUpperCase()),category:'crafting',description:'An item carried in your satchel.'})});
    }
    if(count(saved.food))result.push({id:'noodles',count:count(saved.food),...ITEMS.noodles});
    return result.sort((a,b)=>Object.keys(CATEGORIES).indexOf(a.category)-Object.keys(CATEGORIES).indexOf(b.category)||a.name.localeCompare(b.name));
  }
  function itemIcon(item){
    const mushroom=item.poisonous,color=item.id==='poison_bellcap'?'#9771ae':item.id==='poison_inkcap'?'#67717d':'#cc7366';
    let shape;
    if(item.id==='apple')shape='<path fill="#bd4c51" d="M16 10C4 1 0 18 8 28c4 5 6 0 8 1 3-1 5 4 9-1 9-12 5-26-9-18Z"/><path stroke="#795334" stroke-width="3" d="m16 11 2-8"/><path fill="#8ba563" d="M18 7c5-7 11-3 11-3-2 6-7 6-11 3"/>';
    else if(item.id==='pear')shape='<path fill="#c3b766" d="M16 5c-7 0-4 9-10 15-10 13 27 14 21 0-6-7-4-15-11-15Z"/><path stroke="#795334" stroke-width="3" d="m16 6 2-5"/><path fill="#8ca266" d="M19 4c5-4 9-1 9 1-3 3-6 3-9-1"/>';
    else if(item.id==='berry')shape='<path stroke="#7c9556" stroke-width="2" d="M17 6v15M7 13l10-7 10 7"/><path fill="#89a45f" d="M15 7C8-3 4 5 6 8l9-1m3 0c5-9 14-4 10 0l-10 1"/><g fill="#bd5867" stroke="#70373f" stroke-width="1"><circle cx="7" cy="17" r="6"/><circle cx="17" cy="17" r="6"/><circle cx="26" cy="17" r="6"/><circle cx="12" cy="26" r="6"/><circle cx="23" cy="26" r="6"/></g>';
    else if(item.id==='noodles')shape='<path fill="#d6b578" stroke="#7c5536" stroke-width="2" d="M2 17h30l-5 13H8Z"/><path fill="none" stroke="#e8d28e" stroke-width="2" d="M7 16c-8-7 12-3 5-8m1 8c-7-9 11-4 5-10m2 10c-7-7 11-2 5-9"/><path stroke="#86583a" stroke-width="2" d="m8 20 23-16m-20 18L34 6"/>';
    else if(mushroom)shape='<path fill="#d9c59a" stroke="#826c51" stroke-width="1" d="m13 16-3 16h15l-5-16Z"/><path fill="'+color+'" stroke="#6c4b48" stroke-width="1" d="M2 19C2-1 31-1 32 19c-9 4-21 4-30 0Z"/><g fill="#efe0ba"><rect x="8" y="10" width="4" height="3"/><rect x="17" y="5" width="4" height="3"/><rect x="23" y="13" width="3" height="3"/></g>';
    else shape='<path fill="#b49d6f" stroke="#766342" stroke-width="2" d="m6 8 11-6 11 6v18l-11 7-11-7Z"/><path fill="none" stroke="#e3d1a2" d="m6 8 11 7 11-7M17 15v18"/>';
    return '<svg viewBox="0 0 36 36" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">'+shape+'</svg>';
  }
  function result(action,success){
    try{return Promise.resolve(action?.()).then(value=>{feedback(value?.message||success);signature='';update();return value;}).catch(error=>{feedback(error.message||'That action could not finish.');return{ok:false};});}
    catch(error){feedback(error.message||'That action could not finish.');return Promise.resolve({ok:false});}
  }
  function useItem(id){
    if(!opened||view!=='bag'||selectedItem!==id)return false;
    const item=inventory().find(item=>item.id===id);
    if(!item?.edible||item.poisonous||!item.count||Number(state().hp)>=5)return false;
    result(()=>config.onUseItem?.(id),'A moment to recover.');return true;
  }
  function renderBag(body){
    const entries=inventory(),visible=entries.filter(item=>category==='all'||item.category===category);
    if(!visible.some(item=>item.id===selectedItem))selectedItem=visible[0]?.id||'';
    const layout=el('div','bag-layout'),pack=el('div','bag-pack'),toolbar=el('div','bag-toolbar'),categories=el('div','bag-categories');
    toolbar.appendChild(el('p','bag-count',entries.reduce((total,item)=>total+item.count,0)+' items · '+entries.length+' kinds'));
    for(const[id,label]of Object.entries(CATEGORIES)){
      const amount=entries.filter(item=>id==='all'||item.category===id).reduce((total,item)=>total+item.count,0);
      const tab=button(label+' '+amount,'bag-category',()=>{category=id;selectedItem='';signature='';update();});tab.dataset.bagCategory=id;tab.setAttribute('aria-pressed',String(category===id));categories.appendChild(tab);
    }
    toolbar.appendChild(categories);pack.appendChild(toolbar);
    const grid=el('div','bag-grid');grid.setAttribute('role','group');grid.setAttribute('aria-label','Items in your satchel');
    for(const item of visible){
      const cell=button('','bag-item',()=>{selectedItem=item.id;signature='';update();});cell.dataset.inventoryItem=item.id;cell.setAttribute('aria-pressed',String(item.id===selectedItem));cell.setAttribute('aria-label',item.name+', '+item.count+(item.poisonous?', poisonous crafting ingredient':''));cell.classList.toggle('is-selected',item.id===selectedItem);
      const icon=el('span','bag-item-icon');icon.innerHTML=itemIcon(item);cell.appendChild(icon);cell.appendChild(el('span','bag-item-count','×'+item.count));cell.appendChild(el('span','bag-item-label',item.name));grid.appendChild(cell);
    }
    if(!visible.length)grid.appendChild(el('p','bag-empty','This pocket is empty. Gather fruit and ingredients with Interact as you explore.'));
    pack.appendChild(grid);layout.appendChild(pack);
    const detail=el('div','bag-detail'),item=visible.find(item=>item.id===selectedItem);
    if(item){
      const icon=el('div','bag-detail-icon');icon.innerHTML=itemIcon(item);detail.appendChild(icon);detail.appendChild(el('h3','',item.name));detail.appendChild(el('p','bag-item-kind',item.poisonous?'Poisonous · crafting only':CATEGORIES[item.category]+' · ×'+item.count));detail.appendChild(el('p','',item.description));
      if(item.edible){const use=button(item.id==='noodles'?'Eat noodles · +2 hearts':'Eat one · +1 heart','bag-use',()=>useItem(item.id));use.dataset.useItem=item.id;use.disabled=Number(state().hp)>=5;detail.appendChild(use);if(use.disabled)detail.appendChild(el('p','bag-use-note','Amaal is already at full health.'));}
      if(item.poisonous)detail.appendChild(el('p','bag-poison-note','Keep away from food. Crafting is not available in this draft.'));
    }else{detail.appendChild(el('h3','','A place for what you find'));detail.appendChild(el('p','','Your collected items appear here. Plants remain after harvesting and regrow with the game day.'));}
    layout.appendChild(detail);body.appendChild(layout);
  }
  function towns(){return Array.isArray(world().towns)?world().towns.filter(town=>POINTS[town.id]):[];}
  function locationInfo(){
    const id=area(),data=world(),saved=state(),town=towns().find(town=>id===town.id||id.startsWith(town.id+'_'));
    if(town)return{id:town.id,name:town.name,point:POINTS[town.id],label:'Amaal is in '+town.name};
    const road=data.roads?.find(road=>road.id===id),points=ROUTES[road?.id];
    if(road&&points){const along=Math.max(0,Math.min(1,(Number(saved.x)||0)/((road.size?.[0]||1)*16)))*(points.length-1),index=Math.min(points.length-2,Math.floor(along)),t=along-index,a=points[index],b=points[index+1];return{id:saved.lastSafeTown||'rosepetal',name:road.name,point:[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],label:'Amaal is on '+road.name};}
    const last=towns().find(town=>town.id===saved.lastSafeTown)||towns()[0];return{id:last?.id,name:last?.name||'the road',point:POINTS[last?.id],label:'Last safe stop: '+(last?.name||'Rosepetal Tower')};
  }
  function selectTown(id){if(!towns().some(town=>town.id===id))return false;selectedTown=id;signature='';update();return true;}
  function highlight(id,enabled){
    for(const pin of $('traveller-body')?.querySelectorAll?.('[data-map-town]')||[])if(pin.dataset.mapTown===id)pin.classList.toggle('is-previewed',enabled);
    for(const route of $('traveller-body')?.querySelectorAll?.('[data-map-route]')||[]){const data=[...(world().roads||[]),...(world().ferries||[])].find(item=>item.id===route.dataset.mapRoute);route.classList.toggle('is-linked',Boolean(data?.from===(enabled?id:selectedTown)||data?.to===(enabled?id:selectedTown)));}
  }
  function renderMap(body){
    const data=world(),destinations=towns(),current=locationInfo();
    if(!destinations.some(town=>town.id===selectedTown))selectedTown=current.id||destinations[0]?.id;
    const layout=el('div','map-layout'),chart=el('div','map-chart'),art=el('div','map-art'),image=el('img','traveller-map-image');
    image.src='assets/map-a-world.png?v=15';image.alt='The Blooming Atlas: seven towns, Rosepetal estate, long roads and the ferry passage';image.width=1448;image.height=1086;image.draggable=false;art.appendChild(image);
    if(doc.createElementNS){
      const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 1000 1000');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('class','traveller-routes');svg.setAttribute('aria-hidden','true');
      for(const route of [...(data.roads||[]),...(data.ferries||[])]){const points=ROUTES[route.id];if(!points)continue;const path=doc.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',points.map((point,index)=>(index?'L':'M')+(point[0]*10)+' '+(point[1]*10)).join(' '));path.setAttribute('class','traveller-route'+(route.id==='petalferry'?' ferry':''));path.dataset.mapRoute=route.id;path.classList?.toggle('is-linked',route.from===selectedTown||route.to===selectedTown);svg.appendChild(path);}art.appendChild(svg);
    }
    for(const[townIndex,town]of destinations.entries()){
      const point=POINTS[town.id],pin=button(String(townIndex+1),'map-pin',()=>selectTown(town.id));pin.dataset.mapTown=town.id;pin.dataset.mapPin='true';pin.style.left=point[0]+'%';pin.style.top=point[1]+'%';pin.setAttribute('aria-label',town.name+', select destination');pin.setAttribute('aria-pressed',String(town.id===selectedTown));pin.title=town.name;pin.classList.toggle('is-selected',town.id===selectedTown);pin.onmouseenter=pin.onfocus=()=>highlight(town.id,true);pin.onmouseleave=pin.onblur=()=>highlight(town.id,false);art.appendChild(pin);
    }
    if(current.point){const marker=el('span','map-marker','●');marker.style.left=current.point[0]+'%';marker.style.top=current.point[1]+'%';marker.setAttribute('role','img');marker.setAttribute('aria-label',current.label);art.appendChild(marker);}
    image.onerror=()=>{image.hidden=true;feedback('The map painting could not load. Every destination below remains available.');};chart.appendChild(art);chart.appendChild(el('p','map-current',current.label));
    const list=el('div','map-destinations');for(const[townIndex,town]of destinations.entries()){const choose=button((townIndex+1)+'. '+town.name,'map-destination',()=>selectTown(town.id));choose.dataset.mapTown=town.id;choose.setAttribute('aria-pressed',String(town.id===selectedTown));choose.classList.toggle('is-selected',town.id===selectedTown);choose.onmouseenter=choose.onfocus=()=>highlight(town.id,true);choose.onmouseleave=choose.onblur=()=>highlight(town.id,false);list.appendChild(choose);}chart.appendChild(list);layout.appendChild(chart);
    const summary=el('div','map-summary'),selected=destinations.find(town=>town.id===selectedTown);
    if(selected){summary.appendChild(el('p','map-location-kind',selected.id==='rosepetal'?'Private home estate':selected.port?'Safe harbour':'Safe town'));summary.appendChild(el('h3','',selected.name));summary.appendChild(el('p','',selected.description||selected.subtitle||''));const places=el('ul','map-places');for(const place of selected.places||[])places.appendChild(el('li','',place));summary.appendChild(places);
      const travel=button('Travel to '+selected.name,'map-travel',()=>{if(!opened||view!=='map'||selectedTown!==selected.id||!towns().some(town=>town.id===selected.id))return;close();result(()=>config.onTravel?.(selected.id),'Journey continued.');});travel.dataset.fastTravel=selected.id;travel.disabled=typeof config.onTravel!=='function';summary.appendChild(travel);summary.appendChild(el('p','map-travel-note','Development travel · every town and home unlocked. Your journey is preserved.'));
    }else summary.appendChild(el('p','','The atlas is still opening.'));
    const fallback=el('a','map-full-page','Open the full atlas ↗');fallback.href='world-map.html?v=15';summary.appendChild(fallback);layout.appendChild(summary);body.appendChild(layout);
  }
  function clearedCampCount(){
    const saved=state(),cleared=saved.clearedCamps,progress=saved.campProgress||{};
    return(world().roads||[]).reduce((total,road)=>total+[1,2,3,4].filter(index=>{const key=road.id+':camp-'+index;return(Array.isArray(cleared)?cleared.includes(key):cleared?.[key]===true)||progress[key]?.cleared===true;}).length,0);
  }
  function renderJournal(body){
    const saved=state(),page=el('div','journal-page'),story=el('div','journal-entry');story.appendChild(el('p','journal-eyebrow','The search for Raeez'));story.appendChild(el('h3','',saved.note?'A note, and a road east':'Before dinner'));
    story.appendChild(el('p','',saved.note?'Raeez’s note says the flowers along the old road have stopped opening. He went to ask the herbalist. Follow Lavenderway Fields east to Lavendyr Glade.':'Raeez has not returned. Check the bookshelf inside our tower at Rosepetal Estate for his note.'));story.appendChild(el('p','journal-draft-note','The opening story is a draft. The later quest trail is still being written.'));page.appendChild(story);
    const notes=el('div','journal-entry');notes.appendChild(el('h3','','Notes from the road'));notes.appendChild(el('p','',locationInfo().label));notes.appendChild(el('p','',clearedCampCount()+' / '+(world().livingWorld?.camps||24)+' monster camps cleared. Broken camps stay quiet.'));notes.appendChild(el('p','','The towns, our home and boat crossings are safe. Monsters emerge from camps beside the long roads.'));
    const fruit=inventory().filter(item=>item.category==='fruit');notes.appendChild(el('p','',fruit.length?'Forage carried: '+fruit.map(item=>item.name+' ×'+item.count).join(' · '):'Gather fruit and berries beside the roads. Plants stay in place and regrow with the game day.'));notes.appendChild(el('p','','Poisonous mushrooms are crafting ingredients. They cannot be eaten.'));page.appendChild(notes);
    const character=el('div','journal-entry'),progression=global.BloomProgression?.snapshot?.(saved);character.appendChild(el('h3','','Amaal'));character.appendChild(el('p','',count(saved.hp)+' / 5 hearts'+(progression?' · Level '+progression.level+' · '+progression.xp+' XP':'')));character.appendChild(el('p','','At home: the rose-covered tower, animal barn, gardens and three practice dummies.'));page.appendChild(character);body.appendChild(page);
  }
  async function openSaveFiles(){
    if(!opened||view!=='options')return false;
    close();
    try{
      // The normal and native fullscreen layouts intentionally hide these tools.
      // Finish exiting that layout before opening and focusing its save panel.
      if((config.getOptions?.()||{}).expanded){
        if(typeof config.onExpand!=='function')throw Error('Leave expanded view to open your save files.');
        await config.onExpand();
        if((config.getOptions?.()||{}).expanded)throw Error('Leave expanded view to open your save files.');
      }
      const target=$('export-save'),details=target?.closest?.('details');
      if(details)details.open=true;
      target?.focus?.({preventScroll:true});target?.scrollIntoView?.({block:'nearest'});return true;
    }catch(error){
      const message=error.message||'The save-file tools could not open.';feedback(message);
      const status=$('status')||$('portable-status');if(status)status.textContent=message;
      return false;
    }
  }
  function renderOptions(body){
    const grid=el('div','options-grid'),options=config.getOptions?.()||{};
    grid.appendChild(button('Save journey','traveller-option',()=>{if(opened)result(()=>config.onSave?.(),'Journey saved.');}));
    grid.appendChild(button(options.sound?'Sound effects · on':'Sound effects · off','traveller-option',()=>{if(opened)result(()=>config.onSound?.(),'Sound setting updated.');}));
    grid.appendChild(button(options.expanded?'Leave expanded view':'Expand game view','traveller-option',()=>{if(opened)result(()=>config.onExpand?.(),'View updated.');}));
    grid.appendChild(button('Save files & offline play','traveller-option',openSaveFiles));
    body.appendChild(grid);body.appendChild(el('p','options-help','Your journey saves in this browser. Export a save file before changing device or browser. Optional offline play downloads the game for this device.'));
    const keys=el('div','options-help');keys.appendChild(el('h3','','On the road'));keys.appendChild(el('p','','WASD / arrows · move   Shift · run   E · interact   Space · hold to chain attacks   Q · dodge   C · guard / parry   1–5 · spells   B · bag   M · map   K · spellbook   J · journal   O · options'));body.appendChild(keys);
  }
  function renderTabs(){
    const target=$('traveller-tabs');if(!target)return;clear(target);
    for(const[id,label]of [['map','Map'],['bag','Bag'],['spells','Spellbook'],['journal','Journal'],['options','Options']]){
      const tab=button(label,'traveller-tab',()=>{if(id==='spells'){if(typeof config.onSpells==='function'){close();config.onSpells();}return;}open(id);});tab.dataset.travelTab=id;tab.setAttribute('aria-pressed',String(view===id));tab.disabled=id==='spells'&&typeof config.onSpells!=='function';target.appendChild(tab);
    }
  }
  function keydown(event){
    if(!opened)return;const target=event.target||doc.activeElement,editing=Boolean(target?.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName||''));
    if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation?.();event.stopPropagation?.();close();return;}
    if(event.key==='Tab'){
      const focusable=[...($('traveller-overlay')?.querySelectorAll?.('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex="0"]')||[])].filter(node=>!node.closest?.('[hidden]')&&(typeof node.getClientRects!=='function'||node.getClientRects().length));
      if(focusable.length){const first=focusable[0],last=focusable.at(-1),active=doc.activeElement;if(event.shiftKey&&(active===first||!focusable.includes(active))){event.preventDefault();last.focus?.();}else if(!event.shiftKey&&(active===last||!focusable.includes(active))){event.preventDefault();first.focus?.();}}
    }else if(!editing&&!['Enter',' '].includes(event.key)){
      event.preventDefault();const shortcut={b:'bag',m:'map',j:'journal',o:'options'}[event.key?.toLowerCase()];if(shortcut)open(shortcut);if(event.key?.toLowerCase()==='k'&&config.onSpells){close();config.onSpells();}
    }
    event.stopPropagation?.();
  }
  function bind(){
    if(bound||!doc)return;bound=true;
    for(const[id,destination]of [['kit-map','map'],['kit-bag','bag'],['kit-journal','journal'],['kit-options','options']])if($(id))$(id).onclick=()=>open(destination);
    if($('traveller-close'))$('traveller-close').onclick=close;
    $('traveller-overlay')?.addEventListener?.('click',event=>{if(event.target===$('traveller-overlay'))close();});doc.addEventListener?.('keydown',keydown,true);
  }
  function configure(options={}){config=options;configured=true;bind();update();}
  function open(next='bag'){
    if(!own(VIEWS,next)||!configured||!$('traveller-overlay'))return false;
    if(!opened){if(config.getEnabled?.()===false||config.onPause?.()===false)return false;previousFocus=doc.activeElement||$('kit-'+next);opened=true;$('traveller-overlay').hidden=false;$('play-area')?.classList?.toggle('traveller-open',true);}
    view=next;if(next==='map'&&!seenMap){selectedTown=locationInfo().id||'rosepetal';seenMap=true;}signature='';feedback('');renderTabs();update();$('traveller-close')?.focus?.({preventScroll:true});return true;
  }
  function close(){
    if(!opened)return false;opened=false;if($('traveller-overlay'))$('traveller-overlay').hidden=true;$('play-area')?.classList?.toggle('traveller-open',false);config.onResume?.();update();previousFocus?.focus?.({preventScroll:true});previousFocus=null;return true;
  }
  function update(){
    const enabled=configured&&(config.getEnabled?.()!==false||opened);
    for(const[id,destination]of [['kit-map','map'],['kit-bag','bag'],['kit-journal','journal'],['kit-options','options']]){const node=$(id);if(node){node.disabled=!enabled;node.setAttribute?.('aria-expanded',String(opened&&view===destination));}}
    if(!opened)return;const title=$('traveller-title');if(title)title.textContent=VIEWS[view];
    const saved=state(),next=JSON.stringify([view,category,selectedItem,selectedTown,saved.inventory,saved.food,saved.hp,saved.note,saved.progression?.xp,saved.clearedCamps,saved.campProgress,world().version,world().towns?.length,area(),view==='map'?saved.x:null,view==='map'?saved.y:null,view==='options'?config.getOptions?.():null]);
    if(next===signature)return;signature=next;const body=$('traveller-body');if(!body)return;
    const focus=doc.activeElement?.dataset||{},remembered={item:focus.inventoryItem,category:focus.bagCategory,town:focus.mapTown,pin:focus.mapPin,travel:focus.fastTravel,use:focus.useItem};clear(body);const content=el('div','traveller-'+view+'-view');content.id='traveller-'+view+'-view';content.dataset.travellerView=view;
    if(view==='bag')renderBag(content);else if(view==='map')renderMap(content);else if(view==='journal')renderJournal(content);else renderOptions(content);body.appendChild(content);
    const candidates=[...(body.querySelectorAll?.('button:not(:disabled), a[href]')||[])];const focusTarget=candidates.find(node=>remembered.item&&node.dataset.inventoryItem===remembered.item||remembered.category&&node.dataset.bagCategory===remembered.category||remembered.town&&node.dataset.mapTown===remembered.town&&node.dataset.mapPin===remembered.pin||remembered.travel&&node.dataset.fastTravel===remembered.travel||remembered.use&&node.dataset.useItem===remembered.use);focusTarget?.focus?.({preventScroll:true});
  }
  global.BloomTraveller={configure,open,close,isOpen:()=>opened,update};
})(window);
