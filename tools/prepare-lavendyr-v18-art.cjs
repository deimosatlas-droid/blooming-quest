/* Authoring-only export of generated approved scene designs and pending creature previews. */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const {createCanvas,loadImage}=require('@napi-rs/canvas');
const root=path.resolve(__dirname,'..'),source=path.join(root,'assets-source/v18-art');
fs.mkdirSync(source,{recursive:true});
function bounds(g,x,y,w,h){const d=g.getImageData(x,y,w,h).data;let l=w,t=h,r=-1,b=-1;for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++)if(d[(yy*w+xx)*4+3]>32){l=Math.min(l,xx);r=Math.max(r,xx);t=Math.min(t,yy);b=Math.max(b,yy);}if(r<l)throw Error('Empty source sprite');return[x+l,y+t,r-l+1,b-t+1];}
(async()=>{
 for(const[name,file]of [['environment-master.png','/workspace/generated_images/exec-5a043d49-0390-44bf-aae0-7c60103fde2d.png'],['creature-master-pending.png','/workspace/generated_images/exec-bc31e147-76d6-49ab-8975-9b00b8f7e6eb.png']])if(fs.existsSync(file))fs.copyFileSync(file,path.join(source,name));
 const master=await loadImage(path.join(source,'environment-master.png')),raw=createCanvas(master.width,master.height),r=raw.getContext('2d');r.drawImage(master,0,0);
 const c=createCanvas(480,480),g=c.getContext('2d');g.imageSmoothingEnabled=false;
 const specs=[['conservatory',128,120],['herbal_cottage',80,84],['weaver_cottage',80,84],['drying_house',76,84],['birch',36,56],['well',44,48],['herb_stall',48,48],['wagon',64,52],['ruined_greenhouse',96,96]],entries={};
 for(let i=0;i<specs.length;i++){const[id,maxW,maxH]=specs[i],col=i%3,row=Math.floor(i/3),sx=Math.floor(col*master.width/3),sy=Math.floor(row*master.height/3),ex=Math.floor((col+1)*master.width/3),ey=Math.floor((row+1)*master.height/3),box=bounds(r,sx,sy,ex-sx,ey-sy),scale=Math.min(maxW/box[2],maxH/box[3]),w=Math.round(box[2]*scale),h=Math.round(box[3]*scale),x=col*160+Math.floor((160-w)/2),y=row*160+152-h;
 g.drawImage(master,...box,x,y,w,h);entries['lv18_'+id]={rect:[x,y,w,h],anchor:[Math.round(w/2),h-8],sheet:'lavendyr-v18'};}
 for(const[alias,key]of [['herbal','herbal_cottage'],['weaver','weaver_cottage'],['drying','drying_house']])entries['town_house_lavendyr_v18_'+alias]={...entries['lv18_'+key],doorOffset:({herbal:11,weaver:-20,drying:-1})[alias]};
 fs.writeFileSync(path.join(root,'dist/assets/lavendyr-v18.png'),c.toBuffer('image/png'));fs.writeFileSync(path.join(root,'dist/assets/lavendyr-v18.json'),JSON.stringify(entries));
 const atlasFile=path.join(root,'dist/assets/world-v05.json'),atlas=JSON.parse(fs.readFileSync(atlasFile));Object.assign(atlas,entries);fs.writeFileSync(atlasFile,JSON.stringify(atlas,null,2)+'\n');
 // Creature designs remain outside the player build until the user approves them.
 const im=await loadImage(path.join(source,'creature-master-pending.png')),src=createCanvas(im.width,im.height),ctx=src.getContext('2d');ctx.drawImage(im,0,0);const out=createCanvas(512,512),og=out.getContext('2d');og.imageSmoothingEnabled=false;
 const rows=[0,302,605,881,1254].map(v=>Math.round(v*im.height/1254)),types={},names=['lavender_imp','violet_brambleback','amethyst_wisp','medusa'],labels=['Lavender Imp','Violet Brambleback','Amethyst Wisp','Medusa · The Violet Gorgon'],limits=[[36,34],[46,38],[30,34],[100,94]],directions=['down','left','up','right'];
 for(let row=0;row<4;row++){const boxes=[];for(let col=0;col<4;col++){const x=Math.floor(col*im.width/4),end=Math.floor((col+1)*im.width/4);boxes.push(bounds(ctx,x,rows[row],end-x,rows[row+1]-rows[row]));}const scale=Math.min(limits[row][0]/Math.max(...boxes.map(b=>b[2])),limits[row][1]/Math.max(...boxes.map(b=>b[3]))),facing={};for(let col=0;col<4;col++){const box=boxes[col],w=Math.round(box[2]*scale),h=Math.round(box[3]*scale),x=col*128+64-Math.round(w/2),y=row*128+112-h;og.drawImage(im,...box,x,y,w,h);facing[directions[col]]=[[col*128,row*128,128,128]];}types[names[row]]={name:labels[row],sheet:'lavender-creatures',anchor:[64,112],bodyHeight:limits[row][1],scale:1,fps:4,directions:facing,frames:facing.down,health:[3,6,3,34][row],speed:[34,20,25,25][row],damage:row===3?2:1,attackKind:['cone','lunge','circle','cone'][row],combat:[{warning:.36,recovery:.24,poise:2,orbit:true},{warning:.7,recovery:.46,poise:5,heavy:true},{warning:.7,recovery:.4,poise:2,ranged:true},{warning:1.15,recovery:.55,poise:7,ranged:true}][row],artStatus:'four drawn facings, runtime-articulated animation'};}
 fs.writeFileSync(path.join(source,'creatures-pending.png'),out.toBuffer('image/png'));fs.writeFileSync(path.join(source,'creatures-pending.json'),JSON.stringify({types}));
 console.log(JSON.stringify({environment:entries,creaturePreview:path.join(source,'creatures-pending.png'),creatureTypes:Object.keys(types)}));
})();
