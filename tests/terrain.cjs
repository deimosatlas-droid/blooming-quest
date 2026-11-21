'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createCanvas,loadImage}=require('@napi-rs/canvas');
const ROOT=require('node:path').resolve(__dirname,'../dist')+'/';
const sandbox={window:{},document:{createElement(type){assert.equal(type,'canvas');return createCanvas(1,1);}},Math,Set,Map};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync(ROOT+'terrain.js','utf8'),sandbox);
const terrain=sandbox.window.BloomTerrain;
const color={g:'#4a8a40',d:'#a16e45',c:'#8b8b83',b:'#896345',w:'#487a9c',a:'#c8b67a',i:'#997e57',s:'#615b55',f:'#856949'};
const names={g:'grass',d:'dirt_clean',c:'cobble_grey',b:'dock_planks',w:'water',a:'sand_1',i:'tavern_floor',s:'wall',f:'dirt_clean'};
const testTexture=createCanvas(16*9,16),tc=testTexture.getContext('2d'),testAtlas={};
let offset=0;for(const [type,value]of Object.entries(color)){tc.fillStyle=value;tc.fillRect(offset,0,16,16);testAtlas[names[type]]={rect:[offset,0,16,16],anchor:[0,0]};offset+=16;}
const area=(rows,extra={})=>({id:'fixture',w:rows[0].length,h:rows.length,kind:'town',theme:'rose',tiles:rows,objects:[],...extra});
const pixel=(canvas,x,y)=>Array.from(canvas.getContext('2d').getImageData(x,y,1,1).data);
const digest=canvas=>crypto.createHash('sha256').update(canvas.toBuffer('image/png')).digest('hex');
const roadColor=[133,105,73,255]; // f and d deliberately share a fallback tile name.
const waterColor=[72,122,156,255],bridgeColor=[137,99,69,255];
const isolated=area(['ggggggg','ggggggg','ggggggg','gggdggg','ggggggg','ggggggg','ggggggg']);
const single=terrain.paint(isolated,testAtlas,testTexture),info=terrain.inspect(isolated);
assert.equal(info.loops.length,1);assert.equal(info.errors.length,0);assert(info.loops[0].every(p=>p.radius===8));
assert.deepEqual(pixel(single,56,56),roadColor,'one-tile path keeps its walkable middle');
assert.notDeepEqual(pixel(single,48,48),roadColor,'convex path corner shows underlying lawn');
const capped=area(['ggggggggg','ggggggggg','gggdddggg','gggdddggg','gggdddggg','gggdddggg','ggggggggg']);
const cInfo=terrain.inspect(capped);assert.equal(cInfo.loops.length,1);assert(cInfo.loops[0].some(p=>p.radius===22),'wide path end rounds over multiple tiles');
const c=terrain.paint(capped,testAtlas,testTexture);assert.notDeepEqual(pixel(c,48,32),roadColor);assert.deepEqual(pixel(c,72,40),roadColor);
const junction=area(['gggdddggg','gggdddggg','ddddddddd','ddddddddd','ddddddddd','gggdddggg','gggdddggg']);
const jInfo=terrain.inspect(junction);assert.equal(jInfo.loops.length,1);assert.equal(jInfo.errors.length,0);assert(jInfo.loops[0].some(p=>!p.convex&&p.radius>0),'junction has a rounded inside corner');
const diagonal=area(['ggggg','gdggg','ggdgg','ggggg']);assert.equal(terrain.inspect(diagonal).loops.length,2,'diagonal contacts do not merge unrelated paths');
const water=area(['gggggg','ggwwwg','ggwbwg','ggwwwg','ggddd g'.replace(' ',''),'gggggg']);
const before=JSON.stringify(water),w=terrain.paint(water,testAtlas,testTexture);assert.equal(JSON.stringify(water),before,'painting cannot change movement terrain');
assert.deepEqual(pixel(w,3*16+8,2*16+8),bridgeColor,'bridge middle is not narrowed');
assert.deepEqual(pixel(w,2*16+8,1*16+8),waterColor,'water remains the water texture');
assert(terrain.inspect(water).loops.flat().filter(p=>p.x===48&&p.y===32).every(p=>p.radius===0),'bridge/water corners stay exact');
const inside=area(['ssssss','siiiis','siiiis','ssssss'],{kind:'interior'});const interior=terrain.paint(inside,testAtlas,testTexture);assert.equal(interior.width,96);assert.deepEqual(pixel(interior,24,24),[153,126,87,255]);
const forest=area(Array(10).fill('gggggggggg'),{objects:[{sprite:'tree0',x:64,y:64},{sprite:'pine',x:96,y:80}]});
const f1=terrain.paint(forest,testAtlas,testTexture),f2=terrain.paint(forest,testAtlas,testTexture);assert.equal(digest(f1),digest(f2),'ground detail is deterministic');
assert.notEqual(digest(f1),digest(terrain.paint({...forest,objects:[]},testAtlas,testTexture)),'real trees receive forest-floor detail');
const regional=createCanvas(16,16),rg=regional.getContext('2d');rg.fillStyle='#c371bf';rg.fillRect(0,0,16,16);
const regionalAtlas={...testAtlas,regional_grass:{rect:[0,0,16,16],anchor:[8,16],sheet:'regional'},flower_patch:{rect:[0,0,16,16],anchor:[8,16],sheet:'regional'}};
const regionalFloor=terrain.paint(area(['ggg','ggg','ggg'],{tilePalette:{g:'regional_grass'}}),regionalAtlas,testTexture,{regional});assert.deepEqual(pixel(regionalFloor,0,0),[195,113,191,255],'regional terrain uses its own texture rather than unrelated base-atlas pixels');
const cachedFlowers=terrain.paint(area(['ggg','gdg','ggg'],{objects:[{sprite:'flower_patch',x:24,y:16,groundDetail:true},{sprite:'flower_patch',x:24,y:32,groundDetail:true}]}),regionalAtlas,testTexture,{regional});assert.deepEqual(pixel(cachedFlowers,24,8),[195,113,191,255],'low flowers are baked into the cached ground');assert.deepEqual(pixel(cachedFlowers,24,24),roadColor,'cached plants cannot cover the readable road');
(async()=>{
 const sheets={'lavendyr-v18':await loadImage(ROOT+'assets/lavendyr-v18.png'),'lavender-nature-v18':await loadImage(ROOT+'assets/lavender-nature-v18.png')};
 const maps=JSON.parse(fs.readFileSync(ROOT+'fixed-maps.json')),atlas=JSON.parse(fs.readFileSync(ROOT+'assets/world-v05.json')),texture=await loadImage(ROOT+'assets/world-v05.png');
 const measurements=[];let count=0;
 for(const [id,map]of Object.entries(maps)){
  const data=JSON.stringify(map),shape=terrain.inspect(map);assert.equal(shape.errors.length,0,id+' has closed street contours');
  const start=performance.now(),canvas=terrain.paint(map,atlas,texture,sheets),elapsed=performance.now()-start;
  assert.equal(canvas.width,map.w*16);assert.equal(canvas.height,map.h*16);assert.equal(JSON.stringify(map),data,id+' remains unchanged');
  measurements.push({id,ms:Math.round(elapsed)});count++;
 }
 const slow=measurements.sort((a,b)=>b.ms-a.ms).slice(0,4);assert(slow[0].ms<1000,'terrain cache builds within1second perarea: '+JSON.stringify(slow));
 if(process.argv.includes('--render')){
  const shot=(id,hx,hy)=>{
   const map=maps[id],x=hx??map.spawn[0],y=hy??map.spawn[1],cx=Math.round(Math.max(0,Math.min(map.w*16-384,x-192))),cy=Math.round(Math.max(0,Math.min(map.h*16-256,y-(map.cameraY?170+(map.cameraY-170)*Math.max(0,1-Math.max(0,y-map.spawn[1])/128):170))));
   const ground=terrain.paint(map,atlas,texture,sheets),out=createCanvas(384,256),ctx=out.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(ground,cx,cy,384,256,0,0,384,256);
   for(const o of [...map.objects].sort((a,b)=>a.y-b.y)){
    const a=atlas[o.sprite],scale=o.scale??1;if(!a||o.groundDetail)continue;ctx.drawImage(a.sheet?sheets[a.sheet]:texture,...a.rect,Math.round(o.x-cx-a.anchor[0]*scale),Math.round(o.y-cy-a.anchor[1]*scale),a.rect[2]*scale,a.rect[3]*scale);
   }
   if(map.theme==='moon'||map.theme==='night'){ctx.fillStyle=map.theme==='moon'?'#192f6660':'#132a3c50';ctx.fillRect(0,0,384,256);}
   return out;
  };
  const world=JSON.parse(fs.readFileSync(ROOT+'world.json')),contact=createCanvas(384*4,280*2),ctx=contact.getContext('2d');ctx.fillStyle='#152b1f';ctx.fillRect(0,0,contact.width,contact.height);ctx.fillStyle='#eee6cf';ctx.font='11px sans-serif';
  world.towns.forEach((town,i)=>{ctx.fillText(town.name,i%4*384+7,Math.floor(i/4)*280+15);ctx.drawImage(shot(town.id),i%4*384,Math.floor(i/4)*280+24);});
  fs.writeFileSync(require('node:path').join(require('node:os').tmpdir(),'terrain-v08-town-contact.png'),contact.toBuffer('image/png'));
  const roads=Object.values(maps).filter(m=>m.kind==='road'),out=createCanvas(384*3,280*2),rctx=out.getContext('2d');rctx.fillStyle='#152b1f';rctx.fillRect(0,0,out.width,out.height);rctx.fillStyle='#eee6cf';rctx.font='11px sans-serif';
  roads.forEach((road,i)=>{const camp=road.camps?.[0];rctx.fillText(road.name,i%3*384+7,Math.floor(i/3)*280+15);rctx.drawImage(shot(road.id,camp?.x,camp?camp.y+60:road.spawn[1]),i%3*384,Math.floor(i/3)*280+24);});
  fs.writeFileSync(require('node:path').join(require('node:os').tmpdir(),'terrain-v08-road-contact.png'),out.toBuffer('image/png'));
  const fixture=createCanvas(432,128),fx=fixture.getContext('2d');fx.imageSmoothingEnabled=false;fx.drawImage(single,0,0);fx.drawImage(c,112,0);fx.drawImage(terrain.paint(junction,testAtlas,testTexture),272,0);fs.writeFileSync(require('node:path').join(require('node:os').tmpdir(),'terrain-v08-curves-fixture.png'),fixture.toBuffer('image/png'));
 }
 console.log('PASS: rounded end caps and inside junctions; separate diagonal paths; unchanged bridges/water/interiors; deterministic grass and forest floor; '+count+' actual area caches; slowest '+JSON.stringify(slow));
})().catch(error=>{console.error(error);process.exitCode=1;});
