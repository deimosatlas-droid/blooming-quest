'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../dist'),source=fs.readFileSync(path.join(root,'motion.js'),'utf8');
function fixture(canStand=()=>true){
 const C={window:{},Math,Number};vm.createContext(C);vm.runInContext(source,C);
 const hero={x:100,y:100};const motion=C.window.BloomMotion.create({getHero:()=>hero,canStand});
 return{hero,motion};
}
const near=(a,b,label,tolerance=1e-8)=>assert(Math.abs(a-b)<tolerance,label+': '+a+' versus '+b);
function walk(hz,input={dx:1,dy:0,speed:105}){
 const f=fixture();for(let i=0;i<hz;i++)f.motion.step(1/hz,input);return f;
}
for(const hz of[30,60,120]){
 const f=walk(hz);near(f.hero.x-100,105*(1-.020*(1-Math.exp(-1/.020))),'analytic one-second running distance at '+hz+'Hz');
 near(f.hero.y,100,'straight movement at '+hz+'Hz');
 const diagonal=walk(hz,{dx:1,dy:1,speed:105});near(Math.hypot(diagonal.hero.x-100,diagonal.hero.y-100),f.hero.x-100,'diagonal speed stays normalized at '+hz+'Hz');
}
const f=fixture();f.motion.step(.06,{dx:1,dy:0,speed:105});assert(f.motion.velocity().x>=105*.95,'running reaches95% of target within60ms');
const before=f.hero.x;f.motion.step(.1,{dx:0,dy:0,speed:105});near(f.hero.x,before,'release stops immediately');near(f.motion.velocity().x,0,'released velocity is zero');
f.motion.step(.1,{dx:1,dy:1,speed:105});const x=f.hero.x;f.motion.step(.1,{dx:0,dy:1,speed:105});near(f.hero.x,x,'releasing only one diagonal axis stops that axis immediately');assert(f.motion.velocity().y>0,'remaining direction stays active');
f.motion.reset();f.motion.step(.1,{dx:1,dy:0,speed:105});const turnX=f.hero.x;f.motion.step(.01,{dx:-1,dy:0,speed:105});assert(f.hero.x<turnX&&f.motion.velocity().x<0,'reverse input responds during the first update');
f.motion.step(.01,{dx:-1,dy:0,speed:23});assert(Math.hypot(f.motion.velocity().x,f.motion.velocity().y)<=23,'guard/walk speed reductions cannot inherit faster running momentum');
const blockedX=f.hero.x;f.motion.step(.1,{dx:1,dy:1,speed:105,blocked:true});near(f.hero.x,blockedX,'attack/cast blocking stops movement');near(Math.hypot(f.motion.velocity().x,f.motion.velocity().y),0,'blocked input clears velocity');
for(const speed of[62,105,180,260,520]){
 // A half-pixel fence and the game's four-pixel player half-width. Even this
 // thin scenery leaves no gap large enough for the <=2px player sweep.
 const seen=[],wall=fixture((x,y)=>{seen.push([x,y]);return !(x+4>114&&x-4<114.5);});
 wall.motion.step(.5,{dx:1,dy:0,speed});assert(wall.hero.x<=110,'thin fence blocks speed '+speed);near(wall.motion.velocity().x,0,'collision clears blocked momentum at '+speed);
 for(let i=1;i<seen.length;i++)assert(Math.abs(seen[i][0]-seen[i-1][0])<=2+1e-8,'collision samples remain within2px');
}
const slide=fixture((x,y)=>x<=108);slide.motion.step(.2,{dx:1,dy:1,speed:105});assert(slide.hero.x<=108&&slide.hero.y>110,'sequential axes slide along a wall without crossing it');
slide.motion.reset();near(slide.motion.velocity().x,0,'reset releases horizontal momentum');near(slide.motion.velocity().y,0,'reset releases vertical momentum');
const c=fixture().motion;let camera=c.followCamera(1/60,{x:10,y:20,maxX:200,maxY:200});near(camera.x,10,'camera initializes at the target');near(camera.y,20,'camera initializes vertically');
camera=c.followCamera(.05,{x:150,y:180,maxX:200,maxY:200});assert(camera.x>10&&camera.x<150&&camera.y>20&&camera.y<180,'camera follows without snapping or overshooting');
let lastX=camera.x;for(let i=0;i<80;i++){camera=c.followCamera(1/120,{x:150,y:180,maxX:200,maxY:200});assert(camera.x>=lastX&&camera.x<=150,'subpixel camera accumulation advances monotonically');lastX=camera.x;}
camera=c.followCamera(.1,{x:500,y:-100,maxX:120,maxY:100});assert(camera.x>=0&&camera.x<=120&&camera.y>=0&&camera.y<=100,'camera clamps after map bounds shrink');
camera=c.followCamera(.1,{x:8,y:9,maxX:120,maxY:100},true);near(camera.x,8,'explicit scene snap');near(camera.y,9,'explicit vertical scene snap');
c.reset();camera=c.followCamera(0,{x:90,y:90,maxX:120,maxY:100});near(camera.x,8,'movement-only reset preserves camera state');
c.reset({camera:true});camera=c.followCamera(0,{x:90,y:90,maxX:120,maxY:100});near(camera.x,90,'scene reset initializes the new camera target');
for(const hz of[30,60,120]){
 const motion=fixture().motion;motion.followCamera(0,{x:0,y:0,maxX:500,maxY:500});for(let i=0;i<hz;i++)camera=motion.followCamera(1/hz,{x:400,y:300,maxX:500,maxY:500});near(camera.x,Math.round(400*(1-Math.exp(-14))),'camera frame-rate consistency at '+hz+'Hz');
}
console.log('PASS: frame-rate-consistent responsive acceleration, normalized diagonals, immediate stops/reversal, speed caps, thin-fence sweeps, wall sliding and clamped subpixel camera following/reset.');
