'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../dist'),C={window:{},Math,JSON};vm.createContext(C);vm.runInContext(fs.readFileSync(path.join(root,'hero-animation.js'),'utf8'),C);
const api=C.window.BloomHero,hero={x:100,y:100,face:'right'},moves=api.moves();
assert.deepEqual(Array.from(moves,m=>Number(m.duration.toFixed(2))),[.36,.34,.46],'attacks have short, defined commitments');
const impacts=[],context={hero,canStand:()=>true,onActive:(h,spec)=>impacts.push(spec),intentFace:'up'};
api.requestAttack(hero);assert(!api.canMove());assert(!api.canCast());assert.equal(api.cancelRecovery(),false,'movement/casting cannot erase anticipation or active damage');
api.update(.20,context);assert.equal(impacts.length,1);assert(!api.canMove(),'opening recovery still commits the strike');api.update(.08,context);assert(api.canMove()&&api.canCast());assert(api.cancelRecovery());assert(!api.busy());assert.equal(impacts.length,1,'recovery cancel cannot repeat the hit');
api.requestAttack(hero);assert.equal(api.status().id,'return','short recovery cancels retain the combo step');api.reset();hero.x=100;hero.y=100;hero.face='right';
api.requestAttack(hero);api.requestAttack(hero);api.requestAttack(hero);assert.equal(api.requestAttack(hero),false,'only two explicitly requested follow-ups can be queued');api.update(.36,context);assert.equal(hero.face,'up','queued follow-up steers to current intent');assert.equal(api.status().id,'return');api.update(.8,context);assert(!api.busy());assert.equal(new Set(impacts.map(hit=>hit.activationId)).size,impacts.length,'every active contact has a distinct activation ID');
api.reset();hero.x=100;hero.y=100;hero.face='right';api.requestAttack(hero);api.update(1,{hero,canStand:x=>x<=104,onActive(){}});assert(hero.x<=104,'faster moves retain swept collision');
const walk={width:160,height:192},actions={width:256,height:1024},layout=JSON.parse(fs.readFileSync(path.join(root,'assets/amaal-actions.json')));
api.configure({walkImage:walk,image:actions,layout});api.reset();
const signatures=new Map(),draws=[];let alpha=1;
const ctx=new Proxy({get globalAlpha(){return alpha;},set globalAlpha(value){alpha=value;},drawImage(...args){draws.push({args,alpha});}},{get:(o,k)=>o[k]??(()=>{})});
const poses=[
 ['dodge-start',{dodging:true,dodgeProgress:.08}],['dodge-low',{dodging:true,dodgeProgress:.5}],['dodge-land',{dodging:true,dodgeProgress:.9}],
 ['guard-open',{guarding:true,guardAge:.05}],['guard-held',{guarding:true,guardAge:.5}],
 ['cast-gather',{casting:true,castProgress:.2,castColor:'#d98f72'}],['cast-release',{casting:true,castProgress:.7,castColor:'#8bd6ef'}],
 ['hurt',{hurt:true,hurtProgress:.5}]
];
for(const face of ['down','right','up','left'])for(const[name,defense]of poses){
 draws.length=0;api.draw(ctx,80,80,{face},{walkImage:walk,clock:.45,defense});assert(draws.length>=5,name+' uses articulated body/arms/head rather than one idle image');
 for(const{args}of draws){const[image,sx,sy,w,h,dx,dy,dw,dh]=args;assert(image===walk);assert(sx>=0&&sy>=0&&sx+w<=walk.width&&sy+h<=walk.height,name+' source rectangle remains inside existing artwork');assert(dw>0&&dh>0);assert(Number.isInteger(dx)&&Number.isInteger(dy)&&Number.isInteger(dw)&&Number.isInteger(dh),name+' remains pixel aligned');}
 signatures.set(face+':'+name,JSON.stringify(draws.map(({args})=>args.slice(1))));
}
for(const face of ['down','right','up','left'])assert.notEqual(signatures.get(face+':dodge-start'),signatures.get(face+':dodge-low'),'dodge silhouette visibly compresses during travel');
assert.notEqual(signatures.get('down:cast-gather'),signatures.get('down:cast-release'),'casting changes body and arm pose between gather and release');
api.reset();hero.x=100;hero.y=100;hero.face='right';for(let i=0;i<12;i++){hero.x+=3;api.update(.03,{hero,defense:{dodging:true,dodgeProgress:i/12}});}draws.length=0;api.drawGround(ctx,{x:0,y:0});assert(draws.length>0&&draws.length<=30,'dodge trails use a bounded set of actual sprite echoes');assert(draws.every(item=>item.alpha<.2),'echoes stay faint enough to read the main body');
api.update(.3,{hero});draws.length=0;api.drawGround(ctx,{x:0,y:0});assert.equal(draws.length,0,'dodge echoes expire');api.hit();draws.length=0;api.draw(ctx,80,80,hero,{walkImage:walk});assert(draws.length>=5,'damage triggers a dedicated short recoil');api.update(.3,{hero});draws.length=0;api.draw(ctx,80,80,hero,{walkImage:walk});assert.equal(draws.length,1,'recoil settles back to the authored idle sprite');
api.reset();draws.length=0;api.drawGround(ctx,{x:0,y:0});assert.equal(draws.length,0,'scene resets remove trails and transient poses');
console.log('PASS: faster active-only combos, recovery/movement/cast cancellation gates, queued steering, swept collision, eight articulated defence/cast/hurt poses in four directions and bounded fading dodge echoes.');
if(process.argv.includes('--render'))render().catch(error=>{console.error(error);process.exitCode=1;});
async function render(){
 const{createCanvas,loadImage}=require('@napi-rs/canvas'),picture=await loadImage(path.join(root,'assets/amaal-walk.png')),actionImage=await loadImage(path.join(root,'assets/amaal-actions.png'));
 api.configure({walkImage:picture,image:actionImage,layout});api.reset();
 const cells=[['Idle',{}],...poses],scale=3,w=78,h=88,canvas=createCanvas(cells.length*w,4*h),g=canvas.getContext('2d');g.imageSmoothingEnabled=false;g.fillStyle='#14271e';g.fillRect(0,0,canvas.width,canvas.height);g.font='9px sans-serif';
 for(let row=0;row<4;row++)for(let column=0;column<cells.length;column++){
  const[name,defense]=cells[column],face=['down','right','up','left'][row],small=createCanvas(48,48),paint=small.getContext('2d');paint.imageSmoothingEnabled=false;
  api.draw(paint,24,43,{face},{walkImage:picture,clock:.45,defense});g.fillStyle='#e9d6b2';g.fillText(name,column*w+3,row*h+11);g.drawImage(small,0,0,48,48,column*w+9,row*h+16,60,60);
 }
 const target='/workspace/work/amaal-v14-motion.png';fs.writeFileSync(target,canvas.toBuffer('image/png'));console.log('Native motion pose contact: '+target);
}
