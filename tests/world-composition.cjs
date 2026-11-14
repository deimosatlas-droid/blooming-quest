'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),vm=require('node:vm');
const root=path.resolve(__dirname,'../dist'),maps=JSON.parse(fs.readFileSync(path.join(root,'fixed-maps.json'))),atlas=JSON.parse(fs.readFileSync(path.join(root,'assets/world-v05.json')));
const towns=Object.values(maps).filter(a=>a.kind==='town'),roads=Object.values(maps).filter(a=>a.kind==='road');
const sandbox={window:{},Math,JSON,Set,Map};vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.join(root,'combat.js'),'utf8'),sandbox);const combat=sandbox.window.BloomCombat;
assert.equal(towns.length,7);assert.equal(roads.length,6);
assert.equal(towns.reduce((n,a)=>n+a.residents.length,0),104,'all unique neighbours retained');
assert.equal(new Set(towns.flatMap(a=>a.residents.map(r=>r.appearanceId))).size,104,'no appearance reused');
assert.equal(Object.values(maps).reduce((n,a)=>n+a.objects.filter(o=>o.forage).length,0),109,'all stable forage sources retained');
for(const town of towns){
 assert.equal(town.compositionVersion,17);assert(town.districts.some(d=>d.kind==='public-court'));assert(town.districts.some(d=>d.kind==='residential'));
 const houses=town.objects.filter(o=>o.sprite.startsWith('town_house_'));
 assert.notEqual(houses[0].sprite,houses[1].sprite,town.id+' central houses have different approved silhouettes');
 assert.equal(town.compositionChanges.variedFrontages,houses.length);
 for(const house of houses){
  const a=atlas[house.sprite],doorX=house.x+(a.doorOffset||0),portal=town.portals.find(p=>p.kind==='door'&&Math.abs(p.x-doorX)<1&&Math.abs(p.y-house.y-8)<1);
  assert(portal,town.id+': '+house.label+' door aligns with its current artwork');
  assert.equal(maps[portal.target].returnAt[0],portal.x,'interior return keeps the same physical door');
 }
}
const terrainHashes=roads.map(a=>crypto.createHash('sha256').update(a.tiles.join('')).digest('hex'));
assert.equal(new Set(terrainHashes).size,6,'all six routes have different geography');
assert(maps.coastroad.landmarks.some(l=>l.name==='Seaglass Inlet'));assert(maps.moonpath.landmarks.some(l=>l.name==='Stillmoon Pool'));
let samples=0,camps=0;
for(const area of roads){
 const columns=area.w*2,rows=area.h*2,buckets=new Map(),boxes=area.objects.filter(o=>o.hit).map(o=>o.hit);
 // Unbroken camps are real obstacles. Connect their spawn approaches around,
 // rather than through, the camp footprints used by the engine.
 for(const camp of area.camps)boxes.push(combat.footprint(camp,atlas));
 for(const box of boxes){const[x,y,w,h]=box;for(let by=Math.floor((y-2)/64);by<=Math.floor((y+h+2)/64);by++)for(let bx=Math.floor((x-4)/64);bx<=Math.floor((x+w+4)/64);bx++){const key=bx+','+by;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(box);}}
 const stand=(x,y)=>{
  for(const[dx,dy]of[[-4,-2],[4,-2],[-4,2],[4,2]])if(['w','x','s'].includes(area.tiles[Math.floor((y+dy)/16)]?.[Math.floor((x+dx)/16)]||'x'))return false;
  return !(buckets.get(Math.floor(x/64)+','+Math.floor(y/64))||[]).some(([bx,by,w,h])=>x+4>bx&&x-4<bx+w&&y+2>by&&y-2<by+h);
 };
 const start=Math.round(area.spawn[1]/8)*columns+Math.round(area.spawn[0]/8),seen=new Uint8Array(columns*rows),queue=[start];seen[start]=1;
 assert(stand(area.spawn[0],area.spawn[1]),area.id+' keeps a clear arrival');
 for(let head=0;head<queue.length;head++){
  const p=queue[head],x=p%columns,y=Math.floor(p/columns);
  for(const[dx,dy]of[[0,-1],[1,0],[0,1],[-1,0]]){const xx=x+dx,yy=y+dy,n=yy*columns+xx;if(xx<0||yy<0||xx>=columns||yy>=rows||seen[n]||!stand(xx*8,yy*8))continue;seen[n]=1;queue.push(n);}
 }
 samples+=queue.length;
 const nearbyReachable=(px,py,radius)=>{for(let y=Math.max(0,Math.floor((py-radius)/8));y<Math.min(rows,Math.ceil((py+radius)/8));y++)for(let x=Math.max(0,Math.floor((px-radius)/8));x<Math.min(columns,Math.ceil((px+radius)/8));x++)if(seen[y*columns+x]&&Math.hypot(x*8-px,y*8-py)<=radius)return true;return false;};
 for(const exit of area.exits){const x=exit.side==='west'?8:area.w*16-8;assert(nearbyReachable(x,exit.y,12),area.id+' exit connects to arrival');}
 for(const camp of area.camps){assert(camp.clearedLandmark,area.id+' has a meaningful cleared-site description');assert(nearbyReachable(camp.x,camp.y,70),area.id+' camp clearing has a connected combat approach');assert(camp.spawnPoints.some(([x,y])=>stand(x,y)&&nearbyReachable(x,y,16)),area.id+' camp has a valid reachable spawn');camps++;}
 for(const source of area.objects.filter(o=>o.forage))assert(nearbyReachable(source.x,source.y,34),area.id+': '+source.id+' connects to the route');
}
assert.equal(camps,24);
assert.deepEqual(maps.lavendyr.reservedQuestSites.gardenEntrance,[352,224]);
for(const area of Object.values(maps).filter(a=>a.kind==='interior'))for(const shelf of area.objects.filter(o=>o.sprite==='bookshelf'))assert(!area.objects.some(o=>o.sprite==='bed'&&Math.abs(o.x-shelf.x)<24&&Math.abs(o.y-shelf.y)<12),area.id+' guest bed is not hidden behind its shelf');
console.log('PASS: seven themed public/residential/work districts, distinct central house silhouettes and aligned doors; six distinct routes,24 connected camps,109 retained forage sources,104 unique residents; '+samples+' connected road grid positions; guest-bed shelf placement and reserved story approach.');
