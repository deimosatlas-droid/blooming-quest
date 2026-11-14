/* Ground is cached once per area; contours follow the authored, walkable streets. */
(function (global) {
  'use strict';
  const SIZE=16;
  const DEFAULT={g:'grass',d:'dirt_clean',c:'cobble_grey',b:'dock_planks',w:'water',a:'sand_1',i:'tavern_floor',s:'wall',f:'dirt_clean'};
  const ROAD=new Set(['d','c','b']);
  const BLOCKED=new Set(['w','x','s']);
  const PALETTES={
    rose:['#628e49','#96b461','#b4a66b'],lavender:['#628c51','#95ad73','#a5a277'],
    gold:['#748d46','#a8b85a','#bea167'],hydrangea:['#527f50','#88a76b','#a5a977'],
    riverport:['#577e4c','#8ea264','#a2a177'],coast:['#69894f','#a3ae71','#b7a67a'],
    stone:['#587a48','#899b64','#9e9573'],moon:['#5d8463','#8aa17d','#a3ac8c'],
    night:['#55734f','#829274','#9a9775'],woodland:['#5b8446','#93aa60','#b0a46a']
  };
  function tile(area,x,y){return area.tiles[y]?.[x]||'x';}
  function key(area,atlas,type){const selected=area.tilePalette?.[type]||DEFAULT[type];return atlas[selected]?selected:DEFAULT[type];}
  function seed(text){let n=2166136261;for(const ch of String(text))n=Math.imul(n^ch.charCodeAt(0),16777619);return n>>>0;}
  function noise(x,y,n){let v=Math.imul(x+374761393,668265263)^Math.imul(y+1274126177,2246822519)^n;v=Math.imul(v^(v>>>13),1274126177);return ((v^(v>>>16))>>>0)/4294967296;}
  function drawTile(ctx,texture,atlas,name,x,y){const a=atlas[name];if(a)ctx.drawImage(texture,...a.rect,x*SIZE,y*SIZE,SIZE,SIZE);}
  function neighbours(area,x,y,types){return [[x,y-1],[x+1,y],[x,y+1],[x-1,y]].map(([xx,yy])=>types.has(tile(area,xx,yy)));}

  function contours(area,types=ROAD){
    const stride=area.w+1,edges=[],outgoing=new Map();
    function edge(x1,y1,x2,y2,direction){
      const from=y1*stride+x1,to=y2*stride+x2,index=edges.length;
      edges.push({from,to,direction,used:false});
      if(!outgoing.has(from))outgoing.set(from,[]);outgoing.get(from).push(index);
    }
    for(let y=0;y<area.h;y++)for(let x=0;x<area.w;x++)if(types.has(tile(area,x,y))){
      const [up,right,down,left]=neighbours(area,x,y,types);
      if(!up)edge(x,y,x+1,y,0);
      if(!right)edge(x+1,y,x+1,y+1,1);
      if(!down)edge(x+1,y+1,x,y+1,2);
      if(!left)edge(x,y+1,x,y,3);
    }
    const loops=[],errors=[];
    for(let first=0;first<edges.length;first++){
      if(edges[first].used)continue;
      let index=first;const points=[];let closed=false;
      for(let step=0;step<=edges.length;step++){
        const current=edges[index];if(current.used)break;
        current.used=true;points.push([current.from%stride,Math.floor(current.from/stride)]);
        if(current.to===edges[first].from){closed=true;break;}
        const choices=(outgoing.get(current.to)||[]).filter(next=>!edges[next].used);
        if(!choices.length)break;
        // At a diagonal contact, the clockwise turn keeps two separate lawns apart.
        const priority=[1,0,3,2];
        choices.sort((a,b)=>priority.indexOf((edges[a].direction-current.direction+4)%4)-priority.indexOf((edges[b].direction-current.direction+4)%4));
        index=choices[0];
      }
      if(!closed){errors.push('Open contour');continue;}
      const turns=[];
      for(let i=0;i<points.length;i++){
        const before=points[(i+points.length-1)%points.length],p=points[i],after=points[(i+1)%points.length];
        if((p[0]-before[0])*(after[1]-p[1])!==(p[1]-before[1])*(after[0]-p[0]))turns.push(p);
      }
      if(turns.length>=3)loops.push(turns);
    }
    return {loops,errors,edges:edges.length};
  }
  function rounded(area,points,field=false){
    return points.map((p,i)=>{
      const before=points[(i+points.length-1)%points.length],after=points[(i+1)%points.length];
      const px=p[0]*SIZE,py=p[1]*SIZE,dx=px-before[0]*SIZE,dy=py-before[1]*SIZE,ex=after[0]*SIZE-px,ey=after[1]*SIZE-py;
      const len=Math.hypot(dx,dy),nextLen=Math.hypot(ex,ey),convex=dx*ey-dy*ex>0;
      const adjacent=[tile(area,p[0]-1,p[1]-1),tile(area,p[0],p[1]-1),tile(area,p[0]-1,p[1]),tile(area,p[0],p[1])];
      // Water, walls and planks retain their exact collision boundary and full width.
      const rigid=adjacent.some(t=>BLOCKED.has(t)||t==='b');
      const radius=rigid?0:Math.min(field?5:convex?22:7,len/2,nextLen/2);
      return {x:px,y:py,radius,convex,in:[px-dx/len*radius,py-dy/len*radius],out:[px+ex/nextLen*radius,py+ey/nextLen*radius]};
    });
  }
  function trace(ctx,loops){
    ctx.beginPath();
    for(const points of loops){
      const last=points[points.length-1];ctx.moveTo(...last.out);
      for(const p of points){ctx.lineTo(...p.in);if(p.radius)ctx.quadraticCurveTo(p.x,p.y,...p.out);else ctx.lineTo(p.x,p.y);}
      ctx.closePath();
    }
  }
  function grassTuft(ctx,x,y,color,height=2){
    ctx.fillStyle=color;ctx.fillRect(x,y-height,1,height);ctx.fillRect(x-1,y-1,1,1);ctx.fillRect(x+1,y-2,1,2);
  }
  function quietGrass(ctx,area){
    const n=seed(area.id||area.name||'blooming'),colors=PALETTES[area.theme]||PALETTES.woodland;
    const grass=(x,y)=>tile(area,Math.floor(x/SIZE),Math.floor(y/SIZE))==='g';
    ctx.save();
    // Coarse patches vary the lawn without a high-contrast repeated flower texture.
    for(let yy=0;yy<area.h*SIZE;yy+=64)for(let xx=0;xx<area.w*SIZE;xx+=64){
      const p=noise(xx,yy,n);if(p>.73)continue;
      const x=xx+12+Math.floor(noise(xx+4,yy,n)*41),y=yy+12+Math.floor(noise(xx,yy+4,n)*41);
      if(!grass(x,y))continue;
      ctx.fillStyle='rgba(44,79,36,0.035)';ctx.beginPath();ctx.ellipse(x,y,15+Math.floor(p*13),7+Math.floor(p*6),0,0,Math.PI*2);ctx.fill();
      ctx.globalAlpha=.44;
      for(let i=0;i<5+Math.floor(p*5);i++){
        const dx=Math.floor(noise(xx+i*17,yy+7,n)*38)-19,dy=Math.floor(noise(xx+9,yy+i*13,n)*24)-12;
        if(grass(x+dx,y+dy))grassTuft(ctx,x+dx,y+dy,colors[i%2]);
      }
      ctx.globalAlpha=1;
    }
    // The floor is darker and leafier beneath actual trees, not at arbitrary positions.
    for(const [index,o]of(area.objects||[]).entries())if(/^(tree|pine)/.test(o.sprite)){
      const phase=noise(Math.round(o.x),Math.round(o.y),n);
      ctx.fillStyle='rgba(32,65,30,0.065)';ctx.beginPath();ctx.ellipse(o.x,o.y-3,18+phase*10,7+phase*3,0,0,Math.PI*2);ctx.fill();
      for(let i=0;i<7;i++){
        const dx=Math.floor(noise(index*31+i,11,n)*44)-22,dy=Math.floor(noise(index*13+i,19,n)*20)-12;
        const x=Math.round(o.x+dx),y=Math.round(o.y+dy);
        if(!grass(x,y))continue;
        ctx.globalAlpha=.48;
        if(i%3){grassTuft(ctx,x,y,colors[i%2],2+(i%2));}
        else{ctx.fillStyle=colors[2];ctx.fillRect(x,y,2,1);ctx.fillStyle=colors[0];ctx.fillRect(x+1,y+1,1,1);}
      }
      ctx.globalAlpha=1;
    }
    ctx.restore();
  }
  function banks(ctx,area){
    const n=seed((area.id||'')+'banks');ctx.save();
    for(let y=1;y<area.h-1;y++)for(let x=1;x<area.w-1;x++)if(tile(area,x,y)==='g'){
      const nearBridge=[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]].some(([dx,dy])=>tile(area,x+dx,y+dy)==='b');
      if(nearBridge)continue;
      for(const [dx,dy]of[[-1,0],[1,0],[0,-1],[0,1]]){
        if(tile(area,x+dx,y+dy)!=='w'||noise(x*7+dx,y*11+dy,n)>.65)continue;
        const along=4+Math.floor(noise(x,y,n)*8),px=x*16+(dx<0?2:dx>0?13:along),py=y*16+(dy<0?3:dy>0?14:along);
        ctx.globalAlpha=.65;
        grassTuft(ctx,px,py,'#597c4f',3);grassTuft(ctx,px+2,py+1,'#88a06b',2);
        ctx.globalAlpha=.28;ctx.fillStyle='#405b3d';ctx.fillRect(px-2,py+1,5,1);
      }
    }
    ctx.restore();
  }
  function nearbyRoad(area,x,y){
    const own=tile(area,x,y);if(ROAD.has(own))return own;
    if(own!=='g')return null;
    for(const [dx,dy]of[[0,-1],[1,0],[0,1],[-1,0],[-1,-1],[1,-1],[1,1],[-1,1]]){
      const t=tile(area,x+dx,y+dy);if(ROAD.has(t)&&t!=='b')return t;
    }
    return null;
  }
  function roadLeaves(ctx,area){
    if(area.kind!=='road')return;
    const n=seed((area.id||'')+'fallen-leaves'),colors=area.theme==='night'?['#797552','#a6956a','#59704c']:area.theme==='coast'?['#9b9667','#b5a172','#708151']:['#a08a51','#c0a066','#6b854b'];
    ctx.save();ctx.globalAlpha=.62;
    for(const [index,o]of(area.objects||[]).entries())if(/^(tree|pine)/.test(o.sprite)&&noise(index,7,n)<.34){
      const tx=Math.floor(o.x/16),ty=Math.floor(o.y/16);let closest=null,best=70*70;
      for(let yy=Math.max(0,ty-4);yy<=Math.min(area.h-1,ty+4);yy++)for(let xx=Math.max(0,tx-4);xx<=Math.min(area.w-1,tx+4);xx++){
        const type=tile(area,xx,yy);if(type!=='d'&&type!=='c')continue;
        const distance=(xx*16+8-o.x)**2+(yy*16+8-o.y)**2;
        if(distance<best){best=distance;closest=[xx,yy];}
      }
      if(!closest)continue;
      for(let i=0;i<3;i++){
        const x=closest[0]*16+3+Math.floor(noise(index*3+i,19,n)*10),y=closest[1]*16+3+Math.floor(noise(index*5+i,23,n)*10);
        ctx.fillStyle=colors[i%colors.length];ctx.fillRect(x,y,2,1);ctx.fillRect(x+1,y-1,1,1);ctx.fillStyle='#74694c';ctx.fillRect(x+1,y+1,1,1);
      }
    }
    ctx.restore();
  }
  function streetSurface(ctx,area,atlas,texture){
    const outline=contours(area);if(!outline.loops.length)return;
    const loops=outline.loops.map(points=>rounded(area,points));
    ctx.save();trace(ctx,loops);ctx.clip('evenodd');
    for(let y=0;y<area.h;y++)for(let x=0;x<area.w;x++){
      const type=nearbyRoad(area,x,y);if(type)drawTile(ctx,texture,atlas,key(area,atlas,type),x,y);
    }
    // An inset, subdued lip breaks the perfectly cut edge of the tile texture.
    trace(ctx,loops);ctx.strokeStyle=area.theme==='coast'?'rgba(78,88,64,0.24)':'rgba(53,68,42,0.25)';ctx.lineWidth=1.5;ctx.stroke();
    const n=seed((area.id||'')+'wear');ctx.globalAlpha=.20;
    for(let y=0;y<area.h;y++)for(let x=0;x<area.w;x++){
      const t=tile(area,x,y);if(t!=='c'&&t!=='d')continue;
      const adjacent=neighbours(area,x,y,ROAD);if(adjacent.every(Boolean)||noise(x,y,n)>.25)continue;
      const px=x*16+3+Math.floor(noise(x+19,y,n)*9),py=y*16+3+Math.floor(noise(x,y+19,n)*9);
      ctx.fillStyle=t==='c'?'#c6c1a2':'#bca579';ctx.fillRect(px,py,2,1);
      ctx.fillStyle=t==='c'?'#53664b':'#786a43';ctx.fillRect(px+2,py+1,1,1);
    }
    roadLeaves(ctx,area);ctx.restore();
  }
  function paint(area,atlas,texture){
    const canvas=document.createElement('canvas');canvas.width=area.w*SIZE;canvas.height=area.h*SIZE;
    const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
    ctx.fillStyle=area.kind==='interior'?'#192b23':'#76c564';ctx.fillRect(0,0,canvas.width,canvas.height);
    if(area.kind==='interior'){
      for(let y=0;y<area.h;y++)for(let x=0;x<area.w;x++)drawTile(ctx,texture,atlas,key(area,atlas,tile(area,x,y)),x,y);
      return canvas;
    }
    for(let y=0;y<area.h;y++)for(let x=0;x<area.w;x++)if('gdcf'.includes(tile(area,x,y)))drawTile(ctx,texture,atlas,key(area,atlas,'g'),x,y);
    quietGrass(ctx,area);
    for(let y=0;y<area.h;y++)for(let x=0;x<area.w;x++){
      const type=tile(area,x,y);
      if(type==='g'||type==='d'||type==='c')continue;
      if(type==='x'){ctx.fillStyle='#192b23';ctx.fillRect(x*SIZE,y*SIZE,SIZE,SIZE);}
      else drawTile(ctx,texture,atlas,key(area,atlas,type),x,y);
    }
    streetSurface(ctx,area,atlas,texture);banks(ctx,area);
    return canvas;
  }
  function inspect(area){
    const result=contours(area);
    return {edges:result.edges,errors:result.errors,loops:result.loops.map(points=>rounded(area,points))};
  }
  global.BloomTerrain={paint,inspect};
})(window);
