const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const base=require('node:path').resolve(__dirname,'../dist')+'/';
const maps=JSON.parse(fs.readFileSync(base+'fixed-maps.json')),atlas=JSON.parse(fs.readFileSync(base+'assets/world-v05.json'));
const elements={},storage={},listeners={},gradient={addColorStop(){}};
const ctx=new Proxy({createRadialGradient:()=>gradient},{get:(o,key)=>o[key]??(()=>{})});
const element=()=>({style:{},textContent:'',hidden:false,getContext:()=>ctx,addEventListener(){}});
const C={console,Math,JSON,Image:class{},Promise,URLSearchParams,fetch:()=>new Promise(()=>{}),
  document:{getElementById:id=>elements[id]??=element(),createElement:element,querySelectorAll:()=>[]},
  localStorage:{getItem:key=>storage[key]??null,setItem:(key,value)=>storage[key]=value},
  window:{addEventListener:(type,handler)=>listeners[type]=handler},location:{search:'',href:''},requestAnimationFrame(){},setInterval(){},testMaps:maps,testAtlas:atlas};
vm.createContext(C);
for(const name of ['hero-animation.js','training.js','combat.js','adventure.js'])vm.runInContext(fs.readFileSync(base+name,'utf8'),C);
vm.runInContext('maps=testMaps;atlas=testAtlas;texture={};amaal={};playing=true;ready=true;enter("rosepetal");',C);
const button={closest:selector=>selector.includes('button,a')?button:null};
const input={closest:selector=>selector.startsWith('input,')?input:null};
const game={closest:()=>null};
function key(key,target=game,extra={}){const e={key,target,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},...extra};listeners.keydown(e);listeners.keyup({key});return e;}
vm.runInContext('say([["Audit","First line"],["Audit","Second line"]]);typed=3;',C);
assert.equal(key('Enter',button).defaultPrevented,false,'focused Continue keeps native Enter behavior');
assert.equal(vm.runInContext('typed',C),3,'global key handler does not also advance focused Continue');
elements.next.onclick();assert.equal(vm.runInContext('fullText',C),'First line');assert.equal(vm.runInContext('typed',C),10,'one native click finishes only the current line');
vm.runInContext('speaking=false;heroAnim.reset();',C);
assert.equal(key(' ',button).defaultPrevented,false,'focused Save can receive its native Space click');
assert.equal(C.window.BloomHero.busy(),false);elements.save.onclick();assert(storage['blooming-world-v05']);
const summary={closest:selector=>selector.includes('summary')?summary:null};
assert.equal(key(' ',summary).defaultPrevented,false,'the save/offline disclosure keeps native Space behavior');
assert.equal(key('Enter',summary).defaultPrevented,false,'the save/offline disclosure keeps native Enter behavior');
assert.equal(C.window.BloomHero.busy(),false,'opening save tools cannot start a katana attack');
assert.equal(vm.runInContext('areaId',C),'rosepetal','opening save tools cannot enter a nearby doorway');
assert.equal(key(' ',game).defaultPrevented,true,'Space still belongs to combat in the game');assert(C.window.BloomHero.busy());
vm.runInContext('heroAnim.reset();',C);key('w',input);assert.equal(vm.runInContext('Boolean(keys.w)',C),false,'typing fields do not move Amaal');
listeners.keydown({key:'w',target:button,preventDefault(){}});assert.equal(vm.runInContext('keys.w',C),true,'WASD still works after clicking a toolbar button');
listeners.blur();assert.equal(vm.runInContext('Boolean(keys.w)',C),false,'blur releases movement');
key('m',game,{ctrlKey:true});assert.equal(C.location.href,'','browser modifier shortcuts do not invoke game navigation');

// Reproduce the actual estate fence exploit: the lunge stops, and so must the hit.
vm.runInContext(`
enter('rosepetal');hero.x=168;hero.y=592;hero.face='down';
if(!canStand(168,592)||canStand(168,604))throw Error('actual fence fixture is valid');
keyAction(' ');keyAction(' ');keyAction(' ');for(let i=0;i<45;i++)update(.04);
if(training.snapshot()[0].hp!==3)throw Error('thrust cannot damage a target across the paddock fence');
if(hero.y>=598)throw Error('lunge cannot cross that fence');
`,C);

// Every intact den has a real ground base. Old inside-den saves recover in front.
let camps=0,spawnPoints=0;
for(const [id,area]of Object.entries(maps).filter(([,a])=>a.kind==='road')){
  C.roadId=id;
  vm.runInContext(`enter(roadId);for(const camp of area.camps)for(const point of camp.spawnPoints)if(!canStand(...point))throw Error('camp collision blocks an authored spawn');`,C);
  for(const camp of area.camps){
    C.campSource=camp;
    vm.runInContext(`
      enter('rosepetal');enter(roadId,{at:[campSource.x,campSource.y-8]});
      if(canStand(campSource.x,campSource.y-8))throw Error('intact den base is solid');
      if(!canStand(hero.x,hero.y)||hero.y<=campSource.y)throw Error('old inside-den save recovers visibly in front using the new map');
      hero.x=campSource.x;hero.y=campSource.y+24;hero.face='up';heroAnim.reset();
      for(let chain=0;chain<4&&!state.clearedCamps[roadId+':'+campSource.id];chain++){keyAction(' ');keyAction(' ');keyAction(' ');for(let i=0;i<45;i++)update(.04);}
      if(!state.clearedCamps[roadId+':'+campSource.id])throw Error('front approach can still break a solid den: '+roadId+':'+campSource.id+' '+JSON.stringify({hero,combat:combat.snapshot(),animation:heroAnim.status(),clear:strikeClear(hero,campSource)}));
      if(!canStand(campSource.x,campSource.y-8))throw Error('clearing a den releases its collision');
      heroAnim.reset();hero.x=campSource.x;hero.y=campSource.y+24;keys={w:true};
      for(let i=0;i<16;i++){update(.04);if(!canStand(hero.x,hero.y))throw Error('walking through cleared den stays valid');}keys={};
      if(hero.y>=campSource.y-8)throw Error('Amaal actually walks through the cleared site');
      enter(roadId,{at:[campSource.x,campSource.y-8]});
      if(hero.x!==campSource.x||hero.y!==campSource.y-8)throw Error('saved cleared sites stay open on re-entry');
    `,C);
    camps++;spawnPoints+=camp.spawnPoints.length;
  }
}

C.anonymousRoad={id:'anonymous',name:'Anonymous den',kind:'road',safe:false,w:30,h:20,theme:'woodland',
  tiles:Array.from({length:20},()=> 'g'.repeat(30)),objects:[],portals:[],signs:[],exits:[],spawn:[120,160],
  camps:[{x:200,y:160,type:'wood',health:1,totalSpawns:0}]};
vm.runInContext(`
maps.anonymous=anonymousRoad;enter('anonymous');
if(canStand(200,152))throw Error('anonymous intact camp base is solid');
hero.x=200;hero.y=184;hero.face='up';combat.swing(hero,{activationId:'anonymous-clear',range:40,arc:1.4});
if(!state.clearedCamps['anonymous:camp-0']||!canStand(200,152))throw Error('anonymous camp uses the same stable fallback ID for clearing and collision');
enter('rosepetal');enter('anonymous',{at:[200,152]});
if(hero.y!==152)throw Error('anonymous cleared camp stays open during pre-enter spawn validation');
delete maps.anonymous;
`,C);

// Flood with ALL dens intact: both road gates, all spawn points and front stances
// remain connected to each road's entry, independent of the clearing tests above.
for(const [id,area]of Object.entries(maps).filter(([,a])=>a.kind==='road')){
  const boxes=area.objects.filter(o=>o.hit).map(o=>o.hit).concat(area.camps.map(c=>C.window.BloomCombat.footprint(c,atlas)));
  const buckets=new Map();
  for(const box of boxes){const[x,y,w,h]=box;for(let bx=Math.floor((x-4)/64);bx<=Math.floor((x+w+4)/64);bx++)for(let by=Math.floor((y-2)/64);by<=Math.floor((y+h+2)/64);by++){const key=bx+','+by;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(box);}}
  const stand=(x,y)=>{
    for(const[dx,dy]of[[-4,-2],[4,-2],[-4,2],[4,2]])if(['w','x','s'].includes(area.tiles[Math.floor((y+dy)/16)]?.[Math.floor((x+dx)/16)]||'x'))return false;
    return !(buckets.get(Math.floor(x/64)+','+Math.floor(y/64))||[]).some(([hx,hy,w,h])=>x+4>hx&&x-4<hx+w&&y+2>hy&&y-2<hy+h);
  };
  const columns=area.w*2,rows=area.h*2,seen=new Uint8Array(columns*rows),tested=new Uint8Array(columns*rows);
  const start=Math.round(area.spawn[1]/8)*columns+Math.round(area.spawn[0]/8),queue=[start];seen[start]=1;
  for(let head=0;head<queue.length;head++){
    const index=queue[head],x=index%columns,y=Math.floor(index/columns);
    for(const[nx,ny]of[[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){
      if(nx<0||ny<0||nx>=columns||ny>=rows)continue;const next=ny*columns+nx;if(tested[next]||seen[next])continue;tested[next]=1;
      if(stand(nx*8,ny*8)){seen[next]=1;queue.push(next);}
    }
  }
  const connected=(x,y)=>stand(x,y)&&[-1,0,1].some(dx=>[-1,0,1].some(dy=>{
    const nx=Math.round(x/8)+dx,ny=Math.round(y/8)+dy;if(nx<0||ny<0||nx>=columns||ny>=rows||!seen[ny*columns+nx])return false;
    return [0,.25,.5,.75,1].every(t=>stand(x+(nx*8-x)*t,y+(ny*8-y)*t));
  }));
  for(const exit of area.exits)assert(connected(exit.side==='west'?8:area.w*16-8,exit.y),id+' exit remains connected');
  for(const camp of area.camps){assert(connected(camp.x,camp.y+24),id+' front attack approach remains connected');for(const p of camp.spawnPoints)assert(connected(...p),id+' spawn remains connected');}
}
console.log('PASS: focused-button/native input, typing/modifiers and blur, actual fence strike occlusion; '+camps+' solid camps, old-save recovery, break/open/reload and actual walk-through; all '+spawnPoints+' spawn points, camp fronts and six-road gates remain reachable with every camp intact.');
