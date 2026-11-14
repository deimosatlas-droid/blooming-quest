const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const base=require('node:path').resolve(__dirname,'../dist')+'/';
const maps=JSON.parse(fs.readFileSync(base+'fixed-maps.json'));
const atlas=JSON.parse(fs.readFileSync(base+'assets/world-v05.json'));
const world=JSON.parse(fs.readFileSync(base+'world.json'));
const monsters=JSON.parse(fs.readFileSync(base+'assets/road-monsters.json'));
for(const id of ['tidepetal','seabloom']){
  const ferry=maps[id].portals.find(p=>p.kind==='ferry');
  assert(Array.isArray(ferry?.autoZone)&&ferry.autoZone.length===4,id+' requires a visible-ship autoZone');
  assert(Array.isArray(maps[id].ferryArrival)&&maps[id].ferryArrival.length===2,id+' requires a clear-quay ferryArrival');
}
const elements={},storage={},listeners={};
const gradient={addColorStop(){}};
const ctx=new Proxy({createRadialGradient:()=>gradient,measureText:text=>({width:String(text).length*5})},{get:(o,k)=>o[k]??(()=>{})});
const element=()=>({style:{},textContent:'',hidden:false,disabled:false,getContext:()=>ctx,addEventListener(){},requestFullscreen(){}});
const C={console,Math,JSON,Image:class{},Promise,URLSearchParams,fetch:()=>new Promise(()=>{}),
  localStorage:{getItem:key=>storage[key]??null,setItem:(key,value)=>storage[key]=value},
  document:{getElementById:id=>elements[id]??=element(),createElement:element,querySelectorAll:()=>[],fullscreenElement:null},
  setTimeout(){},clearTimeout(){},Date,performance:{now:()=>0},
  window:{addEventListener:(event,handler)=>listeners[event]=handler},location:{search:'',href:''},requestAnimationFrame(){},setInterval(){},
  testMaps:maps,testAtlas:atlas,testWorld:world,testMonsters:monsters};
vm.createContext(C);
for(const file of ['terrain.js','routines.js','life.js','combat.js','forage.js','hero-animation.js','training.js','adventure.js'].filter(file=>fs.existsSync(base+file)))vm.runInContext(fs.readFileSync(base+file,'utf8'),C);
vm.runInContext(`
maps=testMaps;atlas=testAtlas;W=testWorld;texture={};amaal={};ready=true;playing=true;
life.configure({residentsImage:{}});
combat.configure({image:{},layout:testMonsters});
enter('tidepetal',{from:'marigold'});
function testRead(){return {id:areaId,x:hero.x,y:hero.y,face:hero.face,w:area.w,h:area.h,trip:ferryTrip?{...ferryTrip}:null,hp:state.hp};}
function testStep(dx,dy,dt){keys={shift:true,d:dx>0,a:dx<0,s:dy>0,w:dy<0};update(dt);keys={};}
function testTick(dt){keys={};update(dt);}
function testCampBlocked(x,y,id){return Boolean(combat?.blockingCamp(x,y,maps[id],id,state,atlas));}
`,C);
const read=()=>C.testRead();
let movementFrames=0,transitions=0,crossings=0;
const inside=(point,box)=>point[0]>=box[0]&&point[1]>=box[1]&&point[0]<box[0]+box[2]&&point[1]<box[1]+box[3];
function advance(seconds){for(let elapsed=0;elapsed<seconds-1e-8;elapsed+=.04)C.testTick(Math.min(.04,seconds-elapsed));}
function navigationStand(id,allowAuto=false){
  const map=maps[id],buckets=new Map();
  for(const object of map.objects){
    if(!object.hit)continue;
    const[x,y,w,h]=object.hit;
    for(let bx=Math.floor((x-4)/64);bx<=Math.floor((x+w+4)/64);bx++)for(let by=Math.floor((y-2)/64);by<=Math.floor((y+h+2)/64);by++){
      const key=bx+','+by;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(object.hit);
    }
  }
  return(x,y)=>{
    if(!allowAuto&&(map.portals||[]).some(p=>p.autoZone&&inside([x,y],p.autoZone)))return false;
    for(const[dx,dy]of[[-4,-2],[4,-2],[-4,2],[4,2]])if(['w','x','s'].includes(map.tiles[Math.floor((y+dy)/16)]?.[Math.floor((x+dx)/16)]||'x'))return false;
    if(C.testCampBlocked(x,y,id))return false;
    return !(buckets.get(Math.floor(x/64)+','+Math.floor(y/64))||[]).some(([hx,hy,w,h])=>x+4>hx&&x-4<hx+w&&y+2>hy&&y-2<hy+h);
  };
}
function clearSegment(from,to,stand=C.canStand){
  const length=Math.hypot(to[0]-from[0],to[1]-from[1]);
  for(let i=0,n=Math.max(1,Math.ceil(length/3));i<=n;i++)if(!stand(from[0]+(to[0]-from[0])*i/n,from[1]+(to[1]-from[1])*i/n))return false;
  return true;
}
function pathTo(target,allowAuto=false){
  const current=read(),from=[current.x,current.y],stand=navigationStand(current.id,allowAuto);
  assert(C.canStand(...target),current.id+' destination is walkable: '+target);
  if((Math.abs(from[0]-target[0])<.001||Math.abs(from[1]-target[1])<.001)&&clearSegment(from,target,stand))return [target];
  const columns=current.w*2,rows=current.h*2,length=columns*rows,passable=new Uint8Array(length),previous=new Int32Array(length);previous.fill(-1);
  const point=index=>[(index%columns)*8,Math.floor(index/columns)*8];
  const walkable=index=>{if(!passable[index])passable[index]=stand(...point(index))?1:2;return passable[index]===1;};
  function nearest(position){
    const cx=Math.round(position[0]/8),cy=Math.round(position[1]/8);
    let best=-1,bestDistance=Infinity;
    for(let r=0;r<=3;r++){
      for(let y=Math.max(0,cy-r);y<=Math.min(rows-1,cy+r);y++)for(let x=Math.max(0,cx-r);x<=Math.min(columns-1,cx+r);x++){
        const index=y*columns+x,p=point(index),distance=Math.hypot(p[0]-position[0],p[1]-position[1]);
        if(distance<bestDistance&&walkable(index)&&clearSegment(position,p,stand)){best=index;bestDistance=distance;}
      }
      if(best>=0)return best;
    }
    return -1;
  }
  const start=nearest(from),end=nearest(target);assert(start>=0&&end>=0,current.id+' route endpoints connect to walking grid');
  const queue=[start];previous[start]=start;
  for(let head=0;head<queue.length&&previous[end]<0;head++){
    const index=queue[head],x=index%columns,y=Math.floor(index/columns);
    for(const[nx,ny]of[[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){
      if(nx<0||ny<0||nx>=columns||ny>=rows)continue;
      const next=ny*columns+nx;if(previous[next]>=0||!walkable(next))continue;
      if(!clearSegment(point(index),point(next),stand))continue;
      previous[next]=index;queue.push(next);
    }
  }
  assert(previous[end]>=0,current.id+' key-movement path exists to '+target);
  const raw=[target];for(let i=end;i!==start;i=previous[i])raw.push(point(i));raw.push(point(start));raw.reverse();
  // Only remove bends when the entire resulting walking segment is clear.
  const result=[];let origin=from;
  for(let i=0;i<raw.length;){let next=i;while(next+1<raw.length&&(Math.abs(origin[0]-raw[next+1][0])<.001||Math.abs(origin[1]-raw[next+1][1])<.001)&&clearSegment(origin,raw[next+1],stand))next++;result.push(raw[next]);origin=raw[next];i=next+1;}
  return result;
}
function walkTo(target,expectedTransition=null,expectedFerry=null){
  const initial=read(),path=pathTo(target,Boolean(expectedFerry));
  for(const point of path){
    for(let step=0;step<20000;step++){
      const before=read();
      if(before.trip){assert.equal(before.trip.to,expectedFerry,'only the intended walking ferry can start');return;}
      if(before.id!==initial.id){assert.equal(before.id,expectedTransition,initial.id+' transitions only to expected area');transitions++;return;}
      const dx=point[0]-before.x,dy=point[1]-before.y;
      if(Math.hypot(dx,dy)<.025)break;
      const mx=Math.abs(dx)>.015?Math.sign(dx):0,my=Math.abs(dy)>.015?Math.sign(dy):0;
      const remaining=Math.min(...[Math.abs(dx),Math.abs(dy)].filter(v=>v>.015));
      const dt=Math.min(.035,remaining*Math.hypot(mx,my)/105);
      C.testStep(mx,my,dt);movementFrames++;
      const after=read();
      if(after.trip){assert.equal(after.trip.to,expectedFerry,'walking onto the ship starts the intended ferry');return;}
      if(after.id!==initial.id){assert.equal(after.id,expectedTransition,initial.id+' crosses an actual walking edge');transitions++;return;}
      assert(C.canStand(after.x,after.y),initial.id+' every key-movement frame stays walkable');
      assert(Math.hypot(after.x-before.x,after.y-before.y)>.0001,initial.id+' movement does not snag at '+[before.x,before.y]);
      if(step===19999)assert.fail('walking route exceeded frame limit');
    }
  }
  assert(!expectedTransition,initial.id+' should have crossed its exit by key movement');
  assert(!expectedFerry,initial.id+' should auto-board after walking onto the visible ship');
  assert(Math.hypot(read().x-target[0],read().y-target[1])<.05,initial.id+' reaches target through movement');
}
function leave(side,target){
  const current=read(),exit=maps[current.id].exits.find(e=>e.side===side&&e.target===target);assert(exit,current.id+' has required '+side+' exit');
  walkTo([side==='west'?8:current.w*16-8,exit.y],target);
}
function board(expected){
  const current=read(),map=maps[current.id],portal=map.portals.find(p=>p.kind==='ferry');
  assert.equal(portal.arrival,expected);
  assert(!inside([current.x,current.y],portal.autoZone),'boarding starts from land or the clear arrival quay');
  const [zx,zy,zw,zh]=portal.autoZone,target=[zx+zw/2,zy+zh/2];
  assert(C.canStand(...target),current.id+' visible ship deck is walkable');
  const boat=map.objects.find(o=>o.sprite==='moored_boat');assert(boat,current.id+' has the actual visible passenger ship');
  const art=atlas[boat.sprite],scale=boat.scale||1;
  const shipBounds=[boat.x-art.anchor[0]*scale,boat.y-art.anchor[1]*scale,art.rect[2]*scale,art.rect[3]*scale];
  assert(inside(target,shipBounds),current.id+' auto-zone is on the visible ship');
  walkTo(target,null,expected);
  const aboard=read();assert.equal(aboard.trip?.to,expected,'walking aboard triggers travel without E');
  assert(inside([aboard.x,aboard.y],portal.autoZone),'travel starts only after Amaal reaches the actual ship zone');
  assert.equal(C.window.BloomCombat.snapshot().monsters.length,0,'crossing clears monster simulation');
  advance(.18);assert(read().trip,'the quick departure fade is visible');
  advance(.32);assert.equal(read().id,expected,'quick ship crossing arrives within half a second');assert.equal(read().trip,null);
  const arrival=maps[expected].ferryArrival,destinationPortal=maps[expected].portals.find(p=>p.kind==='ferry');
  assert(Math.hypot(read().x-arrival[0],read().y-arrival[1])<.05,'landing uses the clear quay');
  assert(!inside(arrival,destinationPortal.autoZone),'the clear arrival quay is outside the return trigger');
  advance(2);assert.equal(read().id,expected,'standing still after arrival never bounces back');assert.equal(read().trip,null);
  assert(Math.hypot(read().x-arrival[0],read().y-arrival[1])<.05,'idle arrival does not move Amaal back onto a ship');
  const saved=JSON.parse(storage['blooming-world-v05']);assert.equal(saved.area,expected,'landing is saved');
  assert.equal(C.window.BloomCombat.snapshot().monsters.length,0,'arrival remains a safe town');crossings++;
}
function walkOnLand(){
  const map=maps[read().id];walkTo(map.spawn);
  // Tidepetal's town streets themselves are wooden boardwalks. Continue north
  // into the civic gardens so this checks real land beyond the harbour district.
  const townInterior=[map.spawn[0],map.spawn[1]-80];walkTo(townInterior);
  const current=read(),tile=map.tiles[Math.floor(current.y/16)][Math.floor(current.x/16)];
  assert(!['b','w'].includes(tile),'Amaal walks off the quay and back onto town land');
}
function closedEdge(side,target){
  const current=read(),map=maps[current.id],exit=map.exits.find(e=>e.side===side&&e.target===target);
  const halfWidth=exit.halfWidth||exit.height/2||exit.width/2||32;
  let approach=null;
  for(const distance of [80,-80,112,-112,144,-144]){
    const y=exit.y+distance;if(y<24||y>map.h*16-24||Math.abs(y-exit.y)<=halfWidth)continue;
    for(const inset of [24,40,56,72]){
      const point=[side==='west'?inset:map.w*16-inset,y];
      if(!C.canStand(...point))continue;
      try{pathTo(point);approach=point;break;}catch{}
    }
    if(approach)break;
  }
  assert(approach,map.name+' has a reachable spot beside a closed boundary');walkTo(approach);
  for(let elapsed=0;elapsed<1;elapsed+=.04){
    C.testStep(side==='west'?-1:1,0,.04);movementFrames++;
    assert.equal(read().id,current.id,'walking against an edge outside the opening cannot jump to another map');
    assert.equal(read().trip,null);assert(C.canStand(read().x,read().y),'closed boundary leaves Amaal on valid ground');
  }
}

assert.equal(read().id,'tidepetal');assert.equal(read().x,30,'test starts at the real Marigold entrance');
board('seabloom');walkOnLand();board('tidepetal');walkOnLand();
board('seabloom');
assert.match(elements.status.textContent,/Hydrangea/i,'arrival explains the next town');
assert.match(elements.status.textContent,/east/i,'arrival points toward the next road');
closedEdge('east','coastroad');leave('east','coastroad');leave('east','hydrangea');
leave('west','coastroad');leave('west','seabloom');
board('tidepetal');closedEdge('west','marigold');leave('west','marigold');
assert.equal(crossings,4,'four ship crossings are triggered by walking aboard without E');
assert.equal(transitions,5,'five land transitions occur through actual gate openings');
assert(movementFrames>1000,'long-distance movement is simulated rather than teleported');
console.log('PASS: automatic walk-on ship travel in both directions; quick fades, clear-quay arrivals and no idle bounce; actual town land walks; Seabloom → Coastroad → Hydrangea roundtrip; closed edges reject travel and five gate openings work; '+movementFrames+' collision-checked WASD/Shift frames.');
