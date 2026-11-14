'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {createCanvas}=require('@napi-rs/canvas'),root=path.resolve(__dirname,'../dist');
function fixture(AudioContext){
  const context={window:{AudioContext}},saved={worldClock:{day:2,minutes:480}},position={x:100,y:100},prefs={effectVolume:.5,ambientVolume:.3,weatherEnabled:true,reducedMotion:false,reducedFlashes:true};
  let current={id:'rosepetal',kind:'home',theme:'rose',objects:[],tiles:Array(20).fill('c'.repeat(30))};
  vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(root,'lighting.js'),'utf8'),context);vm.runInContext(fs.readFileSync(path.join(root,'atmosphere.js'),'utf8'),context);
  const api=context.window.BloomAtmosphere;api.configure({getState:()=>saved,getArea:()=>current,getHero:()=>position,getSettings:()=>prefs});
  return{api,saved,position,prefs,setArea:value=>current=value};
}
function frame(api){const canvas=createCanvas(384,256),g=canvas.getContext('2d');g.fillStyle='#76c564';g.fillRect(0,0,384,256);api.draw(g,{x:0,y:0});return{canvas,pixels:g.getImageData(0,0,384,256).data};}
function pixel(canvas,x,y){return[...canvas.getContext('2d').getImageData(x,y,1,1).data];}
const F=fixture();
assert.equal(F.api.sound('sword'),false,'sound does not create or unlock audio implicitly');F.api.update(.1);assert.equal(F.api.snapshot().audioAvailable,false,'unsupported audio remains a silent playable fallback');assert.doesNotThrow(()=>frame(F.api));
const weather=F.api.snapshot().weather;F.api.configure({getState:()=>F.saved,getArea:()=>({id:'rosepetal',kind:'home',theme:'rose',objects:[]}),getHero:()=>F.position,getSettings:()=>F.prefs});assert.equal(F.api.snapshot().weather,weather,'weather is deterministic from saved day/time and region');
F.setArea({id:'coastroad',kind:'road',theme:'coast',objects:[]});
const coast=fixture();coast.setArea({id:'coastroad',kind:'road',theme:'coast',objects:[]});coast.api.update(.1);assert(['mist','rain'].includes(coast.api.snapshot().weather),'coastal atmosphere uses mist or rain');
assert(coast.api.snapshot().particles<=20,'weather has a fixed small drawing budget');
coast.prefs.reducedMotion=true;const still=frame(coast.api).pixels;for(let i=0;i<30;i++)coast.api.update(.1);assert.deepEqual(frame(coast.api).pixels,still,'reduced motion keeps weather static');
coast.prefs.weatherEnabled=false;assert.equal(coast.api.snapshot().weather,'clear');assert.deepEqual(pixel(frame(coast.api).canvas,12,12),[118,197,100,255],'disabling weather preserves daytime terrain');
coast.prefs.weatherEnabled=true;coast.setArea({id:'room',kind:'interior',theme:'inside',objects:[{sprite:'town_house_fake',x:100,y:100,glow:true}]});coast.saved.worldClock.minutes=1380;assert.equal(coast.api.snapshot().particles,0);assert.deepEqual(pixel(frame(coast.api).canvas,100,95),[118,197,100,255],'outdoor weather and spill stay out of interiors');
coast.setArea({id:'night-estate',kind:'home',theme:'rose',objects:[{sprite:'rose_tower',x:100,y:100}]});coast.prefs.weatherEnabled=false;const spill=frame(coast.api).canvas;assert(pixel(spill,100,95)[0]>118,'night window spill warms the entrance');coast.saved.worldClock.minutes=720;assert.deepEqual(pixel(frame(coast.api).canvas,100,95),[118,197,100,255],'window spill does not wash over the daytime palette');
let constructors=0;const nodes=[],buses=[];
function param(){return{value:0,setValueAtTime(value){this.value=value;},linearRampToValueAtTime(value){this.value=value;},exponentialRampToValueAtTime(value){this.value=value;}};}
function node(){const value={connect(){},disconnect(){this.disconnected=true;},start(){this.started=true;},stop(){this.stopped=true;},frequency:param(),Q:param(),gain:param()};nodes.push(value);return value;}
class AudioMock{
  constructor(){constructors++;this.sampleRate=8000;this.currentTime=0;this.destination={};}
  createGain(){const value=node();buses.push(value);return value;}
  createBuffer(channels,length){const data=new Float32Array(length);return{getChannelData:()=>data};}
  createBufferSource(){return node();}
  createBiquadFilter(){return node();}
  createOscillator(){return node();}
  resume(){return Promise.resolve();}
}
const A=fixture(AudioMock);A.api.update(.1);frame(A.api);assert.equal(constructors,0,'configure, update and draw never autoplay or create AudioContext');assert.equal(A.api.sound('unlock'),true);assert.equal(constructors,1);A.api.sound('unlock');assert.equal(constructors,1,'repeated gesture unlock reuses one audio context');
A.api.update(.1);assert.equal(buses[0].gain.value,.5,'effect volume is independent');assert.equal(buses[1].gain.value,.3*.075,'ambience uses its own conservative volume');
A.prefs.effectVolume=0;assert.equal(A.api.sound('hit'),false,'effects mute immediately');A.prefs.effectVolume=.8;A.prefs.ambientVolume=0;A.api.update(.1);assert.equal(buses[0].gain.value,.8);assert.equal(buses[1].gain.value,0,'ambience can be muted without muting effects');
A.prefs.ambientVolume=.5;A.api.update(.1);A.api.sound('pause');assert.equal(A.api.snapshot().active,false);assert.equal(buses[1].gain.value,0,'opening a menu can silence continuous ambience');A.api.sound('resume');assert.equal(A.api.snapshot().active,true);assert.equal(buses[1].gain.value,.5*.075);
A.position.x+=14;A.api.update(.1);assert(A.api.snapshot().voices>=1,'moving across terrain produces surface footsteps after audio unlock');for(let i=0;i<30;i++)A.api.sound('hit');assert(A.api.snapshot().voices<=12,'rapid effects are bounded');for(const value of nodes)value.onended?.();assert.equal(A.api.snapshot().voices,0,'finished sound voices release their references');
A.setArea({id:'indoors',kind:'interior',theme:'inside',objects:[]});A.api.update(.1);assert.equal(buses[1].gain.value,0,'outdoor wind and water ambience do not play inside rooms');
const Broken=fixture(class{constructor(){throw Error('Audio denied');}});assert.equal(Broken.api.sound('unlock'),false);assert.doesNotThrow(()=>{Broken.api.update(.1);Broken.api.sound('parry');frame(Broken.api);},'denied audio does not break gameplay');
console.log('PASS: deterministic regional weather, bounded readable particles, reduced motion, indoor exclusion/night spill, no autoplay, separate volumes, paused ambience, surface footsteps, bounded sound voices and silent audio fallback.');
