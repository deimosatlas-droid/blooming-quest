'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../dist');
function setup(){const sandbox={window:{},Math,Map,Set,Int32Array,Uint8Array,Float64Array};vm.createContext(sandbox);for(const file of ['routines.js','life.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),sandbox);return{life:sandbox.window.BloomLife,routines:sandbox.window.BloomRoutines};}
const {life,routines}=setup();
const expected={Herbalist:'gardener',Gardener:'gardener','Stable hand':'farmer',Blacksmith:'smith','Forge apprentice':'smith','Bridge carpenter':'craft','Cargo porter':'dock',Lamplighter:'lamplighter',Watchkeeper:'watch','Supply merchant':'merchant','Neighbour’s child':'child',Storyteller:'elder',Neighbour:'homemaker'};
for(const [role,job]of Object.entries(expected))assert.equal(routines.jobFor({role,type:'villager'}),job,role);
const blank={id:'clock-test',w:10,h:8,kind:'town',theme:'rose',tiles:Array(8).fill('gggggggggg'),objects:[],residents:[],animals:[],portals:[],exits:[]};
const worldClock={day:1,minutes:480},events=[];let saved=0;
life.configure({residentsImage:{},clockState:worldClock,onClockProgress:()=>saved++,onClockChange:c=>events.push(c.label)});
life.enter(blank,{canStand:()=>true});life.update(75,{x:16,y:16});assert.equal(worldClock.minutes,540,'75 real seconds advance one game hour');assert.equal(life.clock().label,'09:00');assert.equal(saved,1,'clock crosses an autosave bucket');assert.equal(events.at(-1),'09:00');
life.enter({...blank,id:'second-town'},{canStand:()=>true});assert.equal(life.clock().minutes,540,'entering another map does not reset time');
worldClock.minutes=1439.6;life.update(1,{x:16,y:16});assert.equal(life.clock().day,2);assert(Math.abs(life.clock().minutes-.4)<1e-8,'midnight rolls the day and minute together');
const invalid={day:0,minutes:1470};life.configure({clockState:invalid});assert.equal(invalid.day,2);assert.equal(invalid.minutes,30,'existing clock object is normalized in place');
const atlas={town_house_fixture:{rect:[0,0,64,80],anchor:[32,80]},estate_bed:{rect:[0,0,64,44],anchor:[32,44]},town_bench:{rect:[0,0,40,37],anchor:[20,37]},town_market_stall_red:{rect:[0,0,40,41],anchor:[20,41]}};
const fixture={id:'routine-fixture',w:30,h:22,kind:'town',theme:'rose',tiles:Array.from({length:22},(_,y)=>y===16?'d'.repeat(30):'g'.repeat(30)),objects:[{sprite:'town_house_fixture',x:64,y:128,label:'Mira’s Cottage',hit:[40,108,48,16]},{sprite:'town_house_fixture',x:240,y:192,label:'The Carpenter’s Cottage',hit:[216,172,48,16]},{sprite:'estate_bed',x:352,y:128,label:'The young herb beds',hit:[320,108,64,16]},{sprite:'town_bench',x:352,y:304,label:'The square bench',hit:[338,292,28,8]},{sprite:'town_market_stall_red',x:416,y:272,label:'The seed stall',hit:[398,257,36,12]}],residents:[{id:'mira-gardener',name:'Mira',role:'Gardener',type:'herbalist',x:64,y:160,route:[[64,160],[352,152]],lines:['The roses are settling in.'],speed:44}],animals:[],portals:[{kind:'door',x:64,y:136,label:'Enter Mira’s Cottage',target:'home'},{kind:'door',x:240,y:200,label:'Enter The Carpenter’s Cottage',target:'craft-home'}],exits:[]};
function fixtureStand(x,y){return x>=8&&y>=8&&x<=472&&y<=344&&!(x+4>128&&x-4<144&&y-2<240)&&!fixture.objects.some(o=>o.hit&&x+4>o.hit[0]&&x-4<o.hit[0]+o.hit[2]&&y+2>o.hit[1]&&y-2<o.hit[1]+o.hit[3]);}
function visibleStand(map,x,y,atlas){return !map.objects.some(o=>{const a=atlas[o.sprite];if(!a||!(/^(town_house_|house_)/.test(o.sprite)||['rose_tower','estate_barn','estate_greenhouse','lighthouse'].includes(o.sprite)))return false;const scale=o.scale||1;return x>o.x-a.anchor[0]*scale-2&&x<o.x-a.anchor[0]*scale+a.rect[2]*scale+2&&y>o.y-a.anchor[1]*scale-1&&y<o.y-4;});}
const clock={day:1,minutes:430};life.configure({residentsImage:{},clockState:clock});life.enter(fixture,{canStand:fixtureStand,atlas,hero:{x:32,y:32}});
let actor=life.snapshot()[0],plan=life.inspectRoutines()[0];assert.equal(plan.job,'gardener');assert(plan.home.label.includes('Mira'));assert(plan.work[0].label.includes('herb beds'),'work resolves an actual plant bed');
assert.equal(actor.state,'breakfast');assert(actor.x<128,'breakfast is at the real home porch');
clock.minutes=600;let crossed=false,working=false,walked=false;
for(let i=0;i<2400;i++){
 life.update(.04,{x:32,y:32});actor=life.snapshot()[0];assert(fixtureStand(actor.x,actor.y),'routine respects the fence and solid props');assert(visibleStand(fixture,actor.x,actor.y,atlas),'routine never walks through a house drawing');if(actor.x>300)crossed=true;if(actor.walking)walked=true;if(actor.state==='work'&&actor.activity==='water')working=true;
}
assert(crossed&&walked&&working,'resident routes around the fence and building, arrives and waters at work');
const spoken=life.talk('mira-gardener',actor);assert.equal(spoken[0][1],fixture.residents[0].lines[0],'existing story dialogue is retained');assert(spoken.length===2&&/water|roots|way/.test(spoken[1][1]),'dialogue also describes the current task');
const commands=[];let fill='';const ctx={save(){},restore(){},beginPath(){},ellipse(){},fill(){},drawImage(...args){commands.push(['image',args]);},fillRect(...args){commands.push(['rect',fill,...args]);},moveTo(){},lineTo(){},stroke(){},set fillStyle(v){fill=v;},get fillStyle(){return fill;},set strokeStyle(v){},set lineWidth(v){}};
for(let i=0;i<100;i++)life.update(.04,{x:32,y:32});const drawing=life.actors({x:actor.x-100,y:actor.y-100})[0];life.draw(drawing,ctx,{x:0,y:0});assert(commands.some(c=>c[0]==='rect'&&['#83bed0','#c6e6da'].includes(c[1])),'watering has visible droplet work effects');
clock.minutes=plan.times.lunch+3;life.update(.01,{x:32,y:32});assert.equal(life.snapshot()[0].activity,'break');assert(life.snapshot()[0].destination.includes('bench'),'lunch uses a real public seat');
clock.minutes=plan.times.shop+3;life.update(.01,{x:32,y:32});assert.equal(life.snapshot()[0].activity,'shop');assert(life.snapshot()[0].destination.includes('seed stall'),'shopping uses a real shop');
clock.minutes=plan.times.rest+3;life.update(.01,{x:32,y:32});assert.equal(life.snapshot()[0].activity,'rest');assert.equal(life.snapshot()[0].target[0],plan.home.point[0]);
const before=life.clock().minutes;life.enter({...blank,id:'ferry',kind:'ferry'},{canStand:()=>true});assert.equal(life.clock().minutes,before,'scene entry itself never advances or resets the clock');life.enter(fixture,{canStand:fixtureStand,atlas});assert.equal(life.clock().minutes,before);assert.equal(life.snapshot()[0].activity,'rest','returning late retains the actual current schedule');
const maps=JSON.parse(fs.readFileSync(path.join(root,'fixed-maps.json'))),realAtlas=JSON.parse(fs.readFileSync(path.join(root,'assets/world-v05.json')));let count=0;const jobs=new Set(),timings=[];
for(const [id,map]of Object.entries(maps))if(map.kind==='town'){
 const stand=(x,y)=>{
  for(const [dx,dy]of[[-4,-2],[4,-2],[-4,2],[4,2]])if(['w','x','s'].includes(map.tiles[Math.floor((y+dy)/16)]?.[Math.floor((x+dx)/16)]||'x'))return false;
  return !map.objects.some(o=>o.hit&&x+4>o.hit[0]&&x-4<o.hit[0]+o.hit[2]&&y+2>o.hit[1]&&y-2<o.hit[1]+o.hit[3]);
 };
 const state={day:1,minutes:600};life.configure({residentsImage:{},clockState:state});let started=performance.now();life.enter(map,{canStand:stand,atlas:realAtlas});timings.push({id,ms:Math.round(performance.now()-started)});
 const plans=life.inspectRoutines();assert.equal(plans.length,map.residents.length,id+' has a plan for every resident');
 for(const plan of plans){jobs.add(plan.job);for(const node of[plan.home,...plan.work,...plan.lunch,...plan.shops,...plan.evening]){assert(stand(...node.point),id+': '+plan.id+' destination is physically clear');assert(visibleStand(map,...node.point,realAtlas),id+': '+plan.id+' destination is outside house artwork');}}
 for(const minute of[390,600,735,900,1040,1140,1290]){
  state.minutes=minute;life.update(.01,{x:32,y:32});
  for(let frame=0;frame<100;frame++){life.update(.04,{x:32,y:32});if(frame%10===0)for(const actor of life.snapshot()){assert(stand(actor.x,actor.y),id+': '+actor.id+' stays clear of fences/props');assert(visibleStand(map,actor.x,actor.y,realAtlas),id+': '+actor.id+' stays outside house artwork');}}
 }
 count+=plans.length;
}
assert.equal(count,104);assert(jobs.size>=9,'actual towns contain diverse job behaviours');
console.log('PASS: persisted day clock and75-secondhours, day rollover, staggered job routines, real home/work/lunch/shop destinations, fence+whole-house detours, task dialogue/work effects; '+count+' actual residents across7dayphases; entry times '+JSON.stringify(timings));
