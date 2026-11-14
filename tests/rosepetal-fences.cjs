'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../dist'),maps=JSON.parse(fs.readFileSync(path.join(root,'fixed-maps.json'))),atlas=JSON.parse(fs.readFileSync(path.join(root,'assets/world-v05.json'))),home=maps.rosepetal;
const pieces=home.objects.filter(object=>object.fencePiece),caps=pieces.filter(object=>object.fencePiece.axis==='cap');
assert.equal(home.fenceGroups.length,6);assert(pieces.length>0,'estate uses the joined fence renderer');assert.equal(new Set(caps.map(object=>object.x+','+object.y)).size,caps.length,'shared corners draw only one cap');
assert.equal(new Set(home.objects.filter(object=>object.id).map(object=>object.id)).size,home.objects.filter(object=>object.id).length,'fence replacement keeps object IDs unique');
let runs=0;
for(const group of home.fenceGroups)for(const[index,[a,b]]of group.runs.entries()){
 const horizontal=a[1]===b[1],length=Math.abs(horizontal?b[0]-a[0]:b[1]-a[1]),tiles=pieces.filter(object=>object.fenceGroup===group.id&&object.fenceRun===index).sort((a,b)=>a.fencePiece.offset-b.fencePiece.offset);
 assert(tiles.length,group.id+' run has visible tiles');let cursor=0;
 for(const object of tiles){const piece=object.fencePiece;assert.equal(piece.offset,cursor,group.id+' has neither doubled tiles nor visual gaps');assert.equal(piece.axis,horizontal?'h':'v');assert.equal(piece.style,group.style);assert(Number.isInteger(piece.length)&&piece.length>0&&piece.length<=(horizontal?32:group.style==='wood'?16:24));assert.equal(object.x,horizontal?a[0]+cursor+piece.length/2:a[0]);assert.equal(object.y,horizontal?a[1]:a[1]+cursor+piece.length);cursor+=piece.length;}
 assert.equal(cursor,length,group.id+' ends exactly at its gate/corner without an overlapping final stamp');runs++;
}
for(const cap of caps)assert(!home.objects.some(object=>object.sprite==='estate_gatepost'&&Math.abs(object.x-cap.x)<=12&&Math.abs(object.y-cap.y)<=4),'low joint caps do not double-stamp the rose arch pillars');
// Test the actual game's canStand, with its real hero footprint and scene data.
const {game}=require('./helpers/arpg-game.cjs'),runtime=game();runtime.C.fenceMaps=maps;runtime.C.fenceAtlas=atlas;runtime.C.fenceWorld=JSON.parse(fs.readFileSync(path.join(root,'world.json')));
runtime.evaluate('W=fenceWorld;maps=fenceMaps;atlas=fenceAtlas;enter("rosepetal")');
const report=runtime.evaluate(`(()=>{let samples=0,gates=0;for(const group of area.fenceGroups){for(const[a,b]of group.runs){const length=Math.hypot(b[0]-a[0],b[1]-a[1]);for(let at=0;at<=Math.ceil(length);at++){const t=at/Math.max(1,Math.ceil(length)),x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t;if(canStand(x,y))throw Error(group.id+' has a walk-through fence seam at '+x+','+y);samples++;}}for(const gate of group.gates){const x=(gate.a[0]+gate.b[0])/2,y=(gate.a[1]+gate.b[1])/2,vertical=gate.a[0]===gate.b[0];for(let offset=-14;offset<=14;offset+=2)if(!canStand(x+(vertical?offset:0),y+(vertical?0:offset)))throw Error(group.id+' gate is blocked');gates++;}}return{samples,gates};})()`);
assert(report.samples>6000);assert.equal(report.gates,6,'all six intended entrances remain open through the actual collision code');
// Rendering must use approved source rectangles and small sorted pieces.
const C={window:{},Math};vm.createContext(C);vm.runInContext(fs.readFileSync(path.join(root,'fences.js'),'utf8'),C);const fences=C.window.BloomFences,picture={},calls=[],rotations=[];
const context={imageSmoothingEnabled:true,save(){},restore(){},translate(){},rotate(angle){rotations.push(angle);},drawImage(...args){calls.push(args);}};
assert.equal(fences.draw(pieces[0],context),false,'loading fallback leaves standard sprite rendering available');fences.configure({image:picture,atlas});assert.equal(fences.draw({sprite:'rose_tower'},context),false,'ordinary scenery uses its existing renderer');
for(const object of pieces){const before=calls.length;assert(fences.draw(object,context));assert(calls.length>before);}
for(const[source,sx,sy,width,height,dx,dy,dw,dh]of calls){assert.equal(source,picture);assert(width>0&&height>0&&width<=32&&height<=16);assert.equal(width,dw);assert.equal(height,dh,'fence pieces retain pixel scale rather than stretching artwork');assert(['fence_h','fence_v','estate_wall_h'].some(key=>{const r=atlas[key].rect;return sx>=r[0]&&sy>=r[1]&&sx+width<=r[0]+r[2]&&sy+height<=r[1]+r[3];}),'every composition crop stays inside approved fence artwork');assert([sx,sy,width,height,dx,dy,dw,dh].every(Number.isFinite));}
assert(rotations.length>0&&rotations.every(angle=>angle===Math.PI/2),'straight wall strips replace diagonal vertical stone fragments');
assert(pieces.filter(object=>object.fencePiece.axis==='v').every(object=>object.fencePiece.length<=24),'small vertical pieces preserve world depth sorting');
console.log('PASS: '+runs+' exact joined runs, unique corner/gate caps, no overlap stamps, '+report.samples+' actual solid fence positions, all six actual gate crossings, bounded approved-art composition and ordinary-scene fallback.');
