/* Map A: seven towns and the Rosepetal home estate share eight travel destinations. */
(function(global){
  'use strict';
  const ART='assets/map-a-world.png?v=18';
  const SAVE_KEY='blooming-world-v05',SELECTION_KEY='blooming-map-selected-town';
  const NS='http://www.w3.org/2000/svg';
  // Coordinates are percentages of the artwork, independent of image resolution.
  const MAP_ART={
    aspect:4/3,
    towns:{"rosepetal":{"x":16.3,"y":70,"label":"below","align":"right"},"lavendyr":{"x":25,"y":48.6,"label":"above"},"sunveil":{"x":40.6,"y":67.4,"label":"below"},"tidepetal":{"x":44.4,"y":42.3,"label":"above"},"seabloom":{"x":81.6,"y":73.7,"label":"below","align":"left"},"hydrangea":{"x":84.1,"y":46.9,"label":"below","align":"left"},"thornrose":{"x":88.4,"y":29,"label":"above","align":"left"},"moonblossom":{"x":70.3,"y":18.1,"label":"above"}},
    routes:{"lavenderway":[[18.99,63.9],[19.75,61.23],[20.03,58.66],[20.99,56.45],[22.72,54.88],[24.52,53.78]],"foxglove":[[24.52,53.78],[27.07,53.68],[29.56,54.33],[31.22,55.89],[32.04,58.38],[33.56,60.31],[35.57,62.34],[37.02,63.17]],"marigold":[[37.02,63.17],[38.88,62.06],[40.47,60.5],[42.89,59.3],[43.99,57.55],[43.99,55.89],[43.37,53.96],[42.33,52.12],[41.78,50.46],[41.92,49.08],[42.89,47.42],[44.75,46.5]],"coastroad":[[82.87,72.84],[82.87,68.69],[82.67,66.21],[82.8,64.18],[83.43,62.52],[83.56,61.14],[83.15,59.39],[81.98,57.55],[80.94,55.89],[80.39,54.24],[80.46,52.67],[81.08,50.83],[82.11,49.82]],"nightshade":[[82.11,43.19],[83.22,41.44],[83.36,40.15],[82.67,38.4],[82.8,37.48],[83.77,36.28],[85.43,34.9],[87.09,33.89],[87.85,32.32]],"moonpath":[[83.84,28.91],[82.46,27.16],[82.18,26.15],[80.52,25.87],[79.35,25.23],[78.38,23.66],[77.97,22.65],[76.24,22.28],[73.48,22.28],[71.55,22.01],[70.1,21.55]],"petalferry":[[53.04,46.04],[53.66,51.75],[55.32,57.46],[58.15,62.15],[62.29,65.75],[66.85,68.32],[71.55,70.9],[75.69,74.03]]}
  };
  let world=null,selectedId=null,hoveredId=null,saved={};
  const townButtons=new Map(),listButtons=new Map(),routeElements=new Map();
  const $=id=>document.getElementById(id);
  const town=id=>world?.towns.find(item=>item.id===id)||null;
  const isHome=location=>location?.id==='rosepetal'||location?.locationType==='home-estate';
  const locationKind=location=>isHome(location)?'home estate':location?.port?'safe port':'safe town';
  const destinationLabel=location=>isHome(location)?location.name+' · HOME':location.name;
  const routes=()=>[...(world?.roads||[]),...(world?.ferries||[])];
  function safeRead(key){try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}}
  function rgb(color){const value=String(color||'#9bbb84').replace('#','');return value.length===6?[0,2,4].map(i=>parseInt(value.slice(i,i+2),16)).join(','):'155,187,132';}
  function create(tag,classes,text){const element=document.createElement(tag);if(classes)element.className=classes;if(text)element.textContent=text;return element;}
  function pathFor(points){return points.map((point,i)=>(i?'L':'M')+(point[0]*10).toFixed(1)+' '+(point[1]*10).toFixed(1)).join(' ');}
  function travelUrl(id){return 'index.html?area='+encodeURIComponent(id)+'&devtravel=1&v=18';}
  function fastTravel(id=selectedId){if(!town(id))return false;location.href=travelUrl(id);return true;}
  function linkedTo(id,route){return route.from===id||route.to===id;}
  function paintSelection(){
    const active=hoveredId||selectedId;
    for(const [id,button]of townButtons){button.classList.toggle('is-selected',id===selectedId);button.classList.toggle('is-previewed',id===hoveredId);button.setAttribute('aria-pressed',String(id===selectedId));}
    for(const [id,button]of listButtons){button.classList.toggle('is-selected',id===selectedId);button.setAttribute('aria-pressed',String(id===selectedId));}
    for(const route of routes())routeElements.get(route.id)?.classList.toggle('is-linked',linkedTo(active,route));
  }
  function preview(id){hoveredId=town(id)?id:null;paintSelection();}
  function clearPreview(id){if(hoveredId===id){hoveredId=null;paintSelection();}}
  function locationInfo(){
    const area=String(saved.area||'rosepetal');
    const current=world.towns.find(t=>area===t.id||area.startsWith(t.id+'_'));
    if(current)return {town:current.id,label:'Amaal is in '+current.name,legend:'Amaal’s location',point:MAP_ART.towns[current.id]};
    const route=world.roads.find(r=>r.id===area);
    if(route){
      const points=MAP_ART.routes[route.id],progress=Math.max(0,Math.min(1,(Number(saved.x)||0)/(route.size[0]*16)));
      if(points){const scaled=progress*(points.length-1),index=Math.min(points.length-2,Math.floor(scaled)),t=scaled-index,a=points[index],b=points[index+1];return {town:saved.lastSafeTown,label:'Amaal is on '+route.name,legend:'Amaal’s location',point:{x:a[0]+(b[0]-a[0])*t,y:a[1]+(b[1]-a[1])*t}};}
    }
    const last=town(saved.lastSafeTown)||world.towns[0];return {town:last.id,label:'Last safe stop: '+last.name,legend:'Last safe stop',point:MAP_ART.towns[last.id]};
  }
  function previewPosition(point,width=270,height=140){
    const bgWidth=width*5.5,bgHeight=bgWidth/MAP_ART.aspect;
    const clamp=value=>Math.max(0,Math.min(1,value));
    return [clamp((bgWidth*point.x/100-width/2)/(bgWidth-width))*100,clamp((bgHeight*point.y/100-height/2)/(bgHeight-height))*100];
  }
  function updatePreview(id){
    const point=MAP_ART.towns[id],element=$('town-preview');if(!point)return;
    const rect=element.getBoundingClientRect?.()||{};
    const position=previewPosition(point,rect.width||270,rect.height||140);
    element.style.backgroundImage='url("'+ART+'")';element.style.backgroundPosition=position[0]+'% '+position[1]+'%';
    element.setAttribute('aria-label',town(id).name+' on the illustrated regional map');
  }
  function updateCard(id){
    const selected=town(id);if(!selected)return;
    $('detailtype').textContent=isHome(selected)?'HOME · ROSEPETAL ESTATE':selected.port?'A harbour across the gulf':'A safe place on the journey';
    $('detailname').textContent=selected.name;$('safe-label').textContent=isHome(selected)?'Safe home estate':selected.port?'Safe port':'Safe town';$('detaildesc').textContent=selected.description;
    $('detaillist').replaceChildren();for(const place of selected.places||[])$('detaillist').appendChild(create('li','',place));
    updatePreview(id);
    const current=locationInfo();$('current-note').textContent=current.town===id?current.label:'All seven towns and the home estate are open for development travel.';
    $('travel').disabled=false;$('travel').textContent='Fast travel to '+selected.name.replace(/ (Tower|Glade|Grove|Quay|Port|Meadows|Hills|Hamlet)$/,'')+' →';$('travel').setAttribute('aria-label','Fast travel to '+selected.name);
  }
  function choose(id){
    if(!town(id))return false;selectedId=id;hoveredId=null;updateCard(id);paintSelection();
    try{localStorage.setItem(SELECTION_KEY,JSON.stringify(id));}catch{}
    $('map-status').textContent=town(id).name+' selected. Fast travel is available.';return true;
  }
  function makeRoutes(){
    const layer=$('route-layer');layer.replaceChildren();routeElements.clear();
    for(const route of routes()){
      const points=MAP_ART.routes[route.id];if(!points)continue;
      const line=document.createElementNS(NS,'path');line.setAttribute('d',pathFor(points));line.setAttribute('class','map-route'+((world.ferries||[]).some(f=>f.id===route.id)?' ferry':''));line.setAttribute('data-route',route.id);layer.appendChild(line);routeElements.set(route.id,line);
    }
  }
  function makeTowns(){
    $('town-hotspots').replaceChildren();$('town-list').replaceChildren();townButtons.clear();listButtons.clear();
    for(const item of world.towns){
      const point=MAP_ART.towns[item.id];if(!point)throw Error('Missing map landmark: '+item.id);
      const button=create('button','town-node label-'+(point.label||'below')+(point.align?' label-'+point.align:''));button.type='button';button.dataset.town=item.id;button.style.setProperty('--town-x',point.x+'%');button.style.setProperty('--town-y',point.y+'%');button.style.setProperty('--town-rgb',rgb(item.color));button.setAttribute('aria-label',item.name+', '+locationKind(item)+'. Select for fast travel.');button.setAttribute('aria-pressed','false');
      button.appendChild(create('span','town-aura'));button.appendChild(create('span','town-spark'));button.appendChild(create('span','town-name',destinationLabel(item)));
      button.onmouseenter=()=>preview(item.id);button.onmouseleave=()=>clearPreview(item.id);button.onfocus=()=>preview(item.id);button.onblur=()=>clearPreview(item.id);button.onclick=()=>choose(item.id);
      $('town-hotspots').appendChild(button);townButtons.set(item.id,button);
      const link=create('button','town-list-button',destinationLabel(item));link.type='button';link.dataset.town=item.id;link.style.setProperty('--town-color',item.color);link.setAttribute('aria-pressed','false');link.onclick=()=>choose(item.id);link.onmouseenter=()=>preview(item.id);link.onmouseleave=()=>clearPreview(item.id);link.onfocus=()=>preview(item.id);link.onblur=()=>clearPreview(item.id);$('town-list').appendChild(link);listButtons.set(item.id,link);
    }
  }
  function markLocation(){
    const current=locationInfo(),marker=$('current-location');if(!current.point)return;marker.style.left=current.point.x+'%';marker.style.top=current.point.y+'%';marker.setAttribute('aria-label',current.label);marker.hidden=false;$('marker-legend').textContent=current.legend;
  }
  function initialize(data){
    if(!Array.isArray(data?.towns)||data.towns.length!==8)throw Error('The seven towns and home estate could not load.');
    world=data;saved=safeRead(SAVE_KEY)||{};makeRoutes();makeTowns();markLocation();
    const remembered=safeRead(SELECTION_KEY),start=town(remembered)?remembered:locationInfo().town||'rosepetal';choose(start);
    $('travel').onclick=()=>fastTravel();$('map-art').onerror=()=>{$('map-shell').classList.add('image-error');$('map-status').textContent='The map painting could not load. You can still choose a destination below and fast travel.';};
    return world;
  }
  global.BloomWorldMap={initialize,choose,preview,clearPreview,fastTravel,travelUrl,previewPosition,layout:MAP_ART,getState:()=>({selectedId,hoveredId,world,saved})};
  if(typeof document!=='undefined'){
    global.addEventListener?.('resize',()=>{if(selectedId)updatePreview(selectedId);});
    document.addEventListener('keydown',event=>{if(event.key.toLowerCase()==='m'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&event.target?.tagName!=='INPUT'&&event.target?.tagName!=='TEXTAREA'){event.preventDefault();location.href='index.html?devtravel=1&v=18';}});
    fetch('world.json?v=18').then(response=>{if(!response.ok)throw Error('Destination data is unavailable.');return response.json();}).then(initialize).catch(error=>{$('detailname').textContent='The atlas could not open';$('detaildesc').textContent='Refresh to try again.';$('map-status').textContent=error.message;$('travel').disabled=true;});
  }
})(window);
