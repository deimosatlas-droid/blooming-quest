'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {createCanvas}=require('@napi-rs/canvas'),root=path.resolve(__dirname,'../dist'),C={window:{}};vm.createContext(C);vm.runInContext(fs.readFileSync(path.join(root,'lighting.js'),'utf8'),C);
const lighting=C.window.BloomLighting;
function sample(kind,theme,minutes){const canvas=createCanvas(8,8),ctx=canvas.getContext('2d');ctx.fillStyle='#76c564';ctx.fillRect(0,0,8,8);lighting.draw(ctx,{kind,theme},minutes,8,8);return [...ctx.getImageData(4,4,1,1).data];}
const noon=sample('town','rose',720),dusk=sample('town','rose',1140),night=sample('town','rose',1380),interior=sample('interior','moon',1380);
const brightness=c=>(c[0]+c[1]+c[2])/3;
assert.deepEqual(noon,[118,197,100,255],'daytime keeps the existing grass palette');
assert(brightness(noon)>brightness(dusk)&&brightness(dusk)>brightness(night),'evening and night visibly follow the displayed clock');
assert(brightness(night)>brightness(noon)*.6,'night remains readable for exploration');
assert.deepEqual(interior,noon,'indoor rooms stay lit regardless of outdoor clock or moon theme');
assert.deepEqual(sample('home','rose',1380),night,'the home estate uses the same night lighting');
assert.deepEqual(sample('road','rose',1380),night,'long roads use the same clock');
assert.deepEqual(sample('town','rose',0),sample('town','rose',1440),'midnight has no lighting jump');
assert.deepEqual(sample('town','rose',480),sample('town','rose',1020),'daylight is stable from08:00to17:00');
assert(brightness(sample('town','moon',720))<brightness(noon),'Moonblossom keeps its existing magical theme tint');
assert(brightness(sample('town','moon',1380))>brightness(noon)*.45,'night does not hide the moon town');
assert(lighting.nightStrength(420)>0&&lighting.nightStrength(420)<lighting.nightStrength(360),'dawn brightens gradually');
console.log('PASS: saved-clock dawn/dusk/night light, unchanged daytime palettes, retained moon theme, lit interiors, readable nights and continuous midnight.');
