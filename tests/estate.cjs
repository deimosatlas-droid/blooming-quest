'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../dist');
const maps=JSON.parse(fs.readFileSync(path.join(root,'fixed-maps.json'))),atlas=JSON.parse(fs.readFileSync(path.join(root,'assets/world-v05.json'))),home=maps.rosepetal;
assert.equal(home.kind,'home');assert.equal(home.safe,true);assert.equal(home.residents.length,0,'the estate has no village crowd');
const buildings=home.objects.filter(o=>/^(town_house_|house_)/.test(o.sprite)||['rose_tower','estate_barn','estate_greenhouse','lighthouse'].includes(o.sprite));
assert.deepEqual(buildings.map(o=>o.sprite).sort(),['estate_barn','rose_tower']);
assert.equal(home.portals.length,2,'only tower and barn have entrances');assert(home.portals.some(p=>p.target==='rosepetal_0'));assert(home.portals.some(p=>p.target==='rosepetal_barn'));
assert.equal(home.animals.length,8,'all current rescued animals are retained');
const residents=Object.values(maps).flatMap(m=>m.residents||[]);assert.equal(residents.length,104);assert.equal(new Set(residents.map(p=>p.id)).size,104);assert.equal(new Set(residents.map(p=>p.spriteRow)).size,104,'all character models remain globally unique');
function stand(x,y){
 for(const [dx,dy]of[[-4,-2],[4,-2],[-4,2],[4,2]])if(['w','x','s'].includes(home.tiles[Math.floor((y+dy)/16)]?.[Math.floor((x+dx)/16)]||'x'))return false;
 return !home.objects.some(o=>o.hit&&x+4>o.hit[0]&&x-4<o.hit[0]+o.hit[2]&&y+2>o.hit[1]&&y-2<o.hit[1]+o.hit[3]);
}
const reached=new Set(),queue=[[...home.spawn]],step=4,key=(x,y)=>x+','+y;
assert(stand(...home.spawn),'home arrival is clear');
for(let i=0;i<queue.length;i++){
 const [x,y]=queue[i],k=key(x,y);if(reached.has(k)||!stand(x,y))continue;reached.add(k);
 for(const [dx,dy]of[[step,0],[-step,0],[0,step],[0,-step]]){const nx=x+dx,ny=y+dy;if(nx>4&&nx<home.w*16-4&&ny>2&&ny<home.h*16-2&&!reached.has(key(nx,ny))&&stand(nx,ny))queue.push([nx,ny]);}
}
const points=[...reached].map(p=>p.split(',').map(Number));
function approach(x,y,range,label){assert(points.some(p=>Math.hypot(p[0]-x,p[1]-y)<=range),label+' has a clear approach from the home arrival');}
for(const portal of home.portals)approach(portal.x,portal.y,23,portal.label);
for(const exit of home.exits)approach(exit.side==='west'?8:home.w*16-8,exit.y,28,'road gate');
const plants=home.objects.filter(o=>o.forage),types={};assert.equal(plants.length,19);
for(const plant of plants){
 types[plant.forage.fruit]=(types[plant.forage.fruit]||0)+1;assert(atlas[plant.sprite]);approach(plant.x,plant.y,36,plant.forage.id||plant.sprite);
 const t=home.tiles[Math.floor(plant.y/16)]?.[Math.floor(plant.x/16)];assert(!['d','c','b'].includes(t),'harvest plants stay off walking surfaces');
}
for(const type of ['apple','pear','berry','poison_amanita','poison_bellcap','poison_inkcap'])assert(types[type]>0,type+' can be harvested at home');
const dummies=home.objects.filter(o=>o.training);assert.equal(dummies.length,3);
for(const dummy of dummies){assert(atlas[dummy.sprite]);approach(dummy.x,dummy.y,38,'practice dummy '+dummy.id);}
for(const animal of home.animals){assert(stand(animal.x,animal.y),animal.id+' starts on safe ground');for(const target of animal.route||[])assert(stand(...target),animal.id+' routine waypoint is clear');}
let fenceSamples=0;
for(const fence of home.fenceGroups)for(const [a,b]of fence.runs){const length=Math.hypot(b[0]-a[0],b[1]-a[1]),steps=Math.ceil(length);for(let i=0;i<=steps;i++){const t=i/Math.max(1,steps);assert(!stand(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t),fence.id+' has a passable gap between fence pieces');fenceSamples++;}}
console.log('PASS: secluded tower+barn home, 104 preserved globally unique residents relocated, 8 rescued animals, reachable entrances/roadgate/19 harvest plants/3 practice dummies, plants off paths; '+reached.size+' reachable foot positions and '+fenceSamples+' solid fence samples.');
