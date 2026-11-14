'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const base=path.resolve(__dirname,'../dist')+'/',maps=JSON.parse(fs.readFileSync(process.argv[2]||base+'fixed-maps.json'));
const elements={},context2d=new Proxy({},{get:()=>()=>{}}),element=()=>({style:{},hidden:false,getContext:()=>context2d,addEventListener(){}});
const C={Math,JSON,Image:class{},Promise,URLSearchParams,fetch:()=>new Promise(()=>{}),localStorage:{getItem:()=>null},document:{getElementById:id=>elements[id]??=element(),createElement:element,querySelectorAll:()=>[]},window:{addEventListener(){}},location:{search:''},requestAnimationFrame(){},setInterval(){},setTimeout(){},performance:{now:()=>0},testMap:null};vm.createContext(C);
vm.runInContext(fs.readFileSync(base+'adventure.js','utf8'),C);
const use=map=>{C.testMap=map;vm.runInContext('area=testMap',C);};let samples=0,openings=0;const failures=[];
for(const [id,map]of Object.entries(maps)){
 if(!['home','town','road'].includes(map.kind))continue;
 const W=map.w*16,H=map.h*16;
 for(const side of ['west','east','north','south']){
  // Omit distant colliders which mathematically cannot touch the teststrip;
  // movement itself always uses the unmodified production canStand function.
  const relevant=map.objects.filter(o=>o.hit&&(side==='west'?o.hit[0]<20:side==='east'?o.hit[0]+o.hit[2]>W-20:side==='north'?o.hit[1]<20:o.hit[1]+o.hit[3]>H-20));use({...map,objects:relevant});
  const length=['west','east'].includes(side)?H:W;
  for(let a=2;a<length-2;a+=2){
   // Fourpixelsallowonlythevisiblemouth'shero-footprintfringe. Runtime
   // exitOpening below independently enforces the exact authored halfWidth.
   if(map.exits.some(e=>e.side===side&&Math.abs(a-e.y)<=(e.halfWidth||32)+4))continue;
   const [x,y]=side==='west'?[8,a]:side==='east'?[W-8,a]:side==='north'?[a,8]:[a,H-8];samples++;
   if(C.canStand(x,y))failures.push([id,side,x,y]);
  }
 }
 use(map);
 for(const e of map.exits){
  const x=e.side==='west'?8:W-8;assert(C.canStand(x,e.y),id+' named exit remains physically open');
  C.testY=e.y;vm.runInContext('hero.y=testY',C);assert(C.exitOpening(e),id+' exact exit centre is enabled');
  C.testY=e.y+(e.halfWidth||32)+5;vm.runInContext('hero.y=testY',C);assert(!C.exitOpening(e),id+' off-gate movement cannot change maps');openings++;
 }
}
assert.deepEqual(failures,[],'closed world edges require visible solid boundaries: '+JSON.stringify(failures.slice(0,15)));
for(const id of ['thornrose','nightshade']){
 use(maps[id]);assert(!C.canStand(8,240),id+' fractional-anchor pine regression is fixed');
 const fixture={...maps[id],objects:maps[id].objects.filter(o=>!String(o.id||'').startsWith('audit_v11_west_pine_'))};use(fixture);assert(C.canStand(8,240),id+' fixture reproduces original missing-row defect');
}
console.log('PASS: production canStand closes '+samples+' outdoor edge samples; '+openings+' named exits remain open; exact exit gates reject off-axis transitions; original Thornrose/Nightshade missing-pine fixtures reproduced.');
