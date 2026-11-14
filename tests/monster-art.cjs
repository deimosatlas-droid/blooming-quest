'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {createCanvas,loadImage}=require('@napi-rs/canvas');
const root=path.resolve(__dirname,'../dist');
(async()=>{
 const layout=JSON.parse(fs.readFileSync(path.join(root,'assets/road-monsters.json'))),picture=await loadImage(path.join(root,'assets/road-monsters.png'));
 const source=fs.readFileSync(path.join(root,'combat.js'),'utf8');let cases=0;
 for(const [type,profile]of Object.entries(layout.types)){
  const all=[...(profile.frames||[]),...(profile.attackFrames||[]),...Object.values(profile.directions||{}).flat(),...Object.values(profile.attackDirections||{}).flat()];
  for(const [x,y,w,h]of all)assert(x>=0&&y>=0&&w>0&&h>0&&x+w<=picture.width&&y+h<=picture.height,type+' animation fits atlas');
  for(const [direction,dx,dy]of [['down',0,12],['right',12,0],['up',0,-12],['left',-12,0]]){
   const sandbox={window:{},Math,JSON};vm.createContext(sandbox);vm.runInContext(source,sandbox);const combat=sandbox.window.BloomCombat;
   const hero={x:200+dx,y:200+dy,face:direction};let damage=0;
   combat.configure({image:picture,layout});combat.enter({id:'test',kind:'road',safe:false,camps:[{id:'art',x:200,y:180,monster:type,spawnPoints:[[200,200]],maxAlive:1,totalSpawns:1}]},{id:'test',hero,state:{},canStand:()=>true,onDamage:n=>damage+=n,atlas:{},drawSprite(){}});
   combat.update(.4);assert.equal(combat.snapshot().monsters.length,1,type+' spawns');assert(damage>0,type+' reaches melee attack');
   const canvas=createCanvas(384,256),ctx=canvas.getContext('2d'),draws=[];
   const traced=new Proxy(ctx,{get(o,key){if(key==='drawImage')return(...args)=>{draws.push(args);return o.drawImage(...args);};const val=o[key];return typeof val==='function'?val.bind(o):val;},set(o,key,value){o[key]=value;return true;}});
   const entry=combat.actors().find(a=>a.kind==='monster');combat.draw(entry,traced,{x:0,y:0});assert(draws.length,type+' draws source art');
   const expected=profile.attackDirections?.[direction]||profile.attackFrames||profile.directions?.[direction]||profile.frames;
   assert(expected.some(rect=>JSON.stringify(rect)===JSON.stringify(draws[0].slice(1,5))),type+' uses correct actual attack/direction frame');cases++;
  }
 }
 console.log('PASS: '+Object.keys(layout.types).length+' monster species, '+cases+' native Canvas2D directional attack renders and every source frame in bounds.');
})().catch(e=>{console.error(e);process.exitCode=1;});
