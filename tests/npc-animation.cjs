'use strict';
/* Procedural pose tests use the existing sprites; no generated replacement frames. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../dist');
function setup(document){const sandbox={window:{},Math,Map,Set,Int32Array,Uint8Array,Float64Array,document};vm.createContext(sandbox);for(const file of['routines.js','life.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),sandbox);return sandbox.window.BloomLife;}
const fixture=(person={})=>({id:'animation-fixture',w:18,h:12,kind:'town',theme:'rose',tiles:Array(12).fill('g'.repeat(18)),objects:[],portals:[],animals:[],exits:[],residents:[{id:'animator',name:'Mira',role:'Gardener',type:'herbalist',x:48,y:72,spriteRow:0,speed:40,route:[[48,72],[240,72]],routine:{home:[48,72],work:[240,72]},lines:['A little care every day.'],...person}]});
const life=setup(),clock={day:1,minutes:600};life.configure({residentsImage:{},clockState:clock});life.enter(fixture(),{canStand:(x,y)=>x>8&&y>8&&x<280&&y<184});const actor=life.actors()[0].actor;
actor.x=48;actor.y=72;actor.face='down';actor.talkPause=0;actor.walking=true;
const poses=[];
for(let i=0;i<8;i++){actor.steps=i*Math.PI/4/10.5;poses.push(life.animation(actor.id));}
assert(new Set(poses.map(p=>p.leftLegY)).size>=3,'walking feet have a visible two-pixel lift');assert(new Set(poses.map(p=>p.rightArmY)).size>=3,'arms swing through several poses');assert(poses.some(p=>p.clothSway!==0),'clothes sway with the gait');assert(poses.some(p=>p.torsoY!==0),'body has a walking bounce');
actor.walking=false;actor.working=false;actor.state='waiting';const idle=[];
for(let i=0;i<30;i++){clock.minutes=600+i*.4;idle.push(life.animation(actor.id));}
assert(idle.some(p=>p.headFace!=='down'),'idle character glances to the side');assert(new Set(idle.map(p=>p.stretch)).size===2,'idle character breathes');
const actions=['water','fill','hammer','craft','sweep','read','carry','lamp','tend'];
for(const action of actions){actor.working=true;actor.task.action=action;const signatures=[];for(let i=0;i<8;i++){clock.minutes=600+i*.16;const p=life.animation(actor.id);assert.equal(p.motion,'work-'+action);signatures.push(JSON.stringify([p.leftArmX,p.leftArmY,p.rightArmX,p.rightArmY,p.headY,p.torsoX,p.torsoY]));}if(['water','fill','hammer','craft','sweep'].includes(action))assert(new Set(signatures).size>=2,action+' gesture moves through distinct poses');}
actor.working=false;actor.walking=true;actor.steps=.4;clock.minutes=600.25;const expected=JSON.stringify(life.animation(actor.id));assert.equal(JSON.stringify(life.animation(actor.id)),expected,'same clock and gait state gives identical animation');
const commands=[],ctx={save(){},restore(){},beginPath(){},ellipse(){},fill(){},moveTo(){},lineTo(){},stroke(){},fillRect(){},drawImage(...args){commands.push(args);},set fillStyle(v){},set strokeStyle(v){},set lineWidth(v){}};
for(const face of['down','right','up','left']){actor.face=face;for(let i=0;i<8;i++){actor.steps=i/8;life.draw({actor},ctx,{x:0,y:0});}}
for(const a of commands){assert(a[1]>=0&&a[1]+a[3]<=160,'source crop stays in its direction column');assert(a[2]>=0&&a[2]+a[4]<=48,'source crop stays in its identity row');assert(a[3]>0&&a[4]>0&&a[7]>0&&a[8]>0,'every articulated layer has valid dimensions');}
assert(commands.length>=32*6,'render uses overlapping head, torso, arm and leg layers');
const parts=life.animation(actor.id).parts;assert(parts.bodyStart<=parts.headEnd-3,'head and torso overlap at the neck');assert(parts.legStart<=parts.bodyEnd-3,'torso and legs overlap at the waist');
const again=setup(),againClock={day:1,minutes:600};again.configure({residentsImage:{},clockState:againClock});again.enter(fixture(),{canStand:(x,y)=>x>8&&y>8&&x<280&&y<184});const againActor=again.actors()[0].actor;againActor.x=48;againActor.y=72;againActor.face='left';againActor.walking=true;againActor.steps=actor.steps;againActor.working=false;againClock.minutes=clock.minutes;assert.equal(JSON.stringify(again.animation('animator')),JSON.stringify(life.animation('animator')),'pose determinism survives a fresh scene instance');
(async()=>{
 let native;try{native=require('@napi-rs/canvas');}catch{}
 if(native){
  const {createCanvas,loadImage}=native,synthetic=createCanvas(160,48),sc=synthetic.getContext('2d');
  for(let col=0;col<4;col++){const x=col*40;sc.fillStyle='#c4986a';sc.fillRect(x+9,8,22,20);sc.fillStyle='#466140';sc.fillRect(x+12,25,16,12);sc.fillStyle='#c4986a';sc.fillRect(x+8,26,5,9);sc.fillRect(x+27,26,5,9);sc.fillStyle='#64452f';sc.fillRect(x+12,35,7,5);sc.fillRect(x+22,35,7,5);}
  const doc={createElement:()=>createCanvas(1,1)},nativeLife=setup(doc),nativeClock={day:1,minutes:600};nativeLife.configure({residentsImage:synthetic,clockState:nativeClock});nativeLife.enter(fixture(),{canStand:(x,y)=>x>8&&y>8&&x<280&&y<184});const a=nativeLife.actors()[0].actor;a.x=48;a.y=72;a.walking=true;a.working=false;a.face='down';
  const output=createCanvas(96,96),oc=output.getContext('2d');oc.imageSmoothingEnabled=false;
  for(let i=0;i<32;i++){a.steps=i/32*Math.PI*2/10.5;oc.clearRect(0,0,96,96);nativeLife.draw({actor:a},oc,{x:0,y:0});const p=nativeLife.animation(a.id),x=48+p.baseX+p.torsoX;for(let y=55;y<=64;y++)assert(oc.getImageData(x,y,1,1).data[3]>200,'neck/torso attachment remains filled during articulated gait');}
  if(process.argv.includes('--render')){
   const maps=JSON.parse(fs.readFileSync(path.join(root,'fixed-maps.json'))),people=Object.values(maps).flatMap(m=>m.residents||[]).slice(0,8),image=await loadImage(path.join(root,'assets/residents.png')),texture=await loadImage(path.join(root,'assets/world-v05.png')),atlas=JSON.parse(fs.readFileSync(path.join(root,'assets/world-v05.json')));
   const contact=createCanvas(8*96,people.length*112),cc=contact.getContext('2d');cc.imageSmoothingEnabled=false;cc.fillStyle='#476948';cc.fillRect(0,0,contact.width,contact.height);cc.font='10px sans-serif';cc.fillStyle='#f2e6c3';
   for(let row=0;row<people.length;row++){
    const source={...people[row],x:48,y:72,route:[[48,72],[240,72]],authoredRoute:undefined,routine:{home:[48,72],work:[240,72]}};
    const preview=setup(doc),c={day:1,minutes:600};preview.configure({residentsImage:image,clockState:c,texture});preview.enter(fixture(source),{canStand:(x,y)=>x>8&&y>8&&x<280&&y<184,atlas});const person=preview.actors()[0].actor;person.x=48;person.y=72;person.face='down';person.talkPause=0;
    for(let col=0;col<8;col++){
     person.walking=col<4;person.working=col>=6;person.state=col<4?'travel':col>=6?'work':'waiting';person.steps=col*Math.PI/2/10.5;c.minutes=600+col*.16;if(col===4||col===5){const phase=col===5?9.5:2.5;c.minutes=(Math.floor((600/.8+person.phase*13)/13)*13+phase-person.phase*13)*.8;}if(col>=6)person.task.action=['water','hammer','read','sweep'][row%4];
     const tile=createCanvas(96,104),tc=tile.getContext('2d');tc.imageSmoothingEnabled=false;tc.save();tc.translate(-48,-56);tc.scale(2,2);preview.draw({actor:person},tc,{x:0,y:0});tc.restore();cc.drawImage(tile,col*96,row*112+8);cc.fillText(col<4?'step '+(col+1):col<6?'idle / look':person.task.action,col*96+5,row*112+11);
    }
    cc.fillText(source.name,4,row*112+109);
   }
   const file='/workspace/work/npc-v10-animation-contact.png';fs.writeFileSync(file,contact.toBuffer('image/png'));console.log('Native animation contact: '+file);
  }
 }
 console.log('PASS: articulated gait/arm/cloth motion, breathing/headlooks, task poses, full source crop coverage with overlapping seams, deterministic clock/gait phases'+(native?',32nativeCanvas seam checks':'')+'.');
})().catch(error=>{console.error(error);process.exitCode=1;});
