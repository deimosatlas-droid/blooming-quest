/* Optional authoring export; game players and release CI need no native package. */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const {createCanvas,loadImage}=require('@napi-rs/canvas');
(async()=>{
 const root=path.resolve(__dirname,'..');
 for(const name of ['map-icon.png','bag-icon.png','spellbook-icon.png']){
  const master=path.join(root,'assets-source/ui',name),target=path.join(root,'dist/assets/ui',name);
  const picture=await loadImage(master),canvas=createCanvas(144,144),g=canvas.getContext('2d');
  g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';g.drawImage(picture,0,0,144,144);
  fs.writeFileSync(target,canvas.toBuffer('image/png'));
 }
})().catch(error=>{console.error(error.message);process.exitCode=1;});
