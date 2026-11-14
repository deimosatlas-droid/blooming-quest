'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const C={window:{},Math,Number};vm.createContext(C);vm.runInContext(fs.readFileSync(path.join(__dirname,'../dist/motion.js'),'utf8'),C);
const api=C.window.BloomMotion,plain=value=>JSON.parse(JSON.stringify(value)),clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
assert.deepEqual(plain(api.cameraBounds({worldWidth:1024,worldHeight:768,viewWidth:568,viewHeight:320,profile:'keyboard'})),{minX:0,maxX:640,minY:0,maxY:512},'keyboard keeps original world clamps');
let samples=0;
for(const viewport of[{w:568,h:320},{w:667,h:375},{w:844,h:390,left:44,right:44,bottom:21}])for(const profile of['touch','hybrid'])for(const leftHanded of[false,true])for(const requested of[.85,1,1.2]){
  const {w,h}=viewport,worldWidth=1024,worldHeight=768,config={worldWidth,worldHeight,viewWidth:w,viewHeight:h,profile,leftHanded,touchScale:requested,safeLeft:viewport.left||0,safeRight:viewport.right||0,safeBottom:viewport.bottom||0},bounds=api.cameraBounds(config);
  const stageW=Math.min(w,h*1.5),stageH=stageW/1.5,s=(stageW/384),stageX=(w-stageW)/2,stageY=(h-stageH)/2,effective=Math.max(1,Math.min(requested,h<360||w<640?1:1.2)),unit=44*effective,pad=3*unit+8,actions=2*unit+4;
  const leftSize=leftHanded?actions:pad,rightSize=leftHanded?pad:actions,controlY=h-(viewport.bottom||0)-64-pad;
  const blockers=[{x:(viewport.left||0)+8,y:controlY,w:leftSize,h:pad},{x:w-(viewport.right||0)-8-rightSize,y:controlY,w:rightSize,h:pad},{x:(w-236)/2,y:h-(viewport.bottom||0)-56,w:236,h:48}];
  for(const x of[0,8,worldWidth/2,worldWidth-8,worldWidth])for(const y of[0,8,worldHeight/2,worldHeight-8,worldHeight]){
    const camera={x:clamp(x-192,bounds.minX,bounds.maxX),y:clamp(y-170,bounds.minY,bounds.maxY)};
    // Full 19x33 source body plus a20px motion envelope on every side.
    const body={x:stageX+(x-camera.x-30)*s,y:stageY+(y-camera.y-53)*s,w:60*s,h:73*s};
    assert(blockers.every(blocker=>!overlap(body,blocker)),JSON.stringify({viewport,profile,leftHanded,requested,x,y,body,blockers,bounds}));samples++;
  }
}
const letterbox=api.cameraBounds({worldWidth:1024,worldHeight:768,viewWidth:1920,viewHeight:720,profile:'touch'});assert.equal(letterbox.minX,0);assert.equal(letterbox.maxX,640,'controls wholly in letterbox need no horizontal forest padding');
const portrait=api.cameraBounds({worldWidth:1024,worldHeight:768,viewWidth:390,viewHeight:844,profile:'touch'});assert.equal(portrait.minX,0);assert.equal(portrait.maxX,640,'portrait controls below the world do not force sideways padding');
const motion=api.create();motion.followCamera(0,{x:100,y:100,maxX:300,maxY:300});const negative=motion.followCamera(.01,{x:-120,y:-53,minX:-120,minY:-53,maxX:300,maxY:300,reducedMotion:true});assert.equal(negative.x,-120);assert.equal(negative.y,-53,'reduced motion snaps to the requested safe target');
const reset=motion.followCamera(.01,{x:1000,y:-100,minX:-20,minY:-10,maxX:80,maxY:90},true);assert.deepEqual(plain(reset),{x:80,y:-10},'explicit snap obeys new positive and negative bounds');
console.log('PASS: '+samples+' full-body/motion-envelope camera positions across three landscape sizes, notch insets, keyboard/touch/hybrid profiles, both handedness settings, control scales, portrait/letterbox fallback and reduced-motion bounds.');
