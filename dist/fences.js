/* Rosepetal's joined fence tiles reuse the approved atlas; no new sprite sheet. */
(function(global){
  'use strict';
  let image=null,atlas={};
  function configure(options={}){image=options.image||null;atlas=options.atlas||{};}
  function strip(ctx,rect,length,phase=0){
    for(let at=0;at<length;){const source=(phase+at)%rect[2],width=Math.min(rect[2]-source,length-at);ctx.drawImage(image,rect[0]+source,rect[1],width,rect[3],at,0,width,rect[3]);at+=width;}
  }
  function draw(object,ctx,camera={x:0,y:0}){
    const piece=object?.fencePiece;if(!piece||!image)return false;
    const stone=piece.style==='stone',horizontal=piece.axis==='h',cap=piece.axis==='cap';
    const source=atlas[stone?'estate_wall_h':horizontal||cap?'fence_h':'fence_v'];
    if(!source)return false;
    const x=Math.round(object.x-camera.x),y=Math.round(object.y-camera.y),length=Math.max(1,Math.min(32,Number(piece.length)||1));
    ctx.save();ctx.imageSmoothingEnabled=false;
    if(cap){
      // One compact upright at each corner/gate end; shared joints draw once.
      const width=stone?10:6,height=stone?10:12,offset=stone?11:0;
      ctx.drawImage(image,source.rect[0]+offset,source.rect[1]+(stone?0:4),width,height,x-Math.floor(width/2),y-height,width,height);
    }else if(horizontal){
      ctx.translate(x-length/2,y-source.rect[3]);strip(ctx,source.rect,length,Number(piece.phase)||0);
    }else if(stone){
      // The old vertical crop was a diagonal fragment. Turn the straight wall
      // coping through 90 degrees and keep its brick phase across tile seams.
      ctx.translate(x+source.rect[3]/2,y-length);ctx.rotate(Math.PI/2);strip(ctx,source.rect,length,Number(piece.phase)||0);
    }else{
      // fence_v's bottom half contains a T-junction, not a repeatable rail.
      // Its upper sixteen pixels are the continuous vertical side section.
      ctx.drawImage(image,source.rect[0],source.rect[1],16,length,x-8,y-length,16,length);
    }
    ctx.restore();return true;
  }
  global.BloomFences={configure,draw};
})(window);
