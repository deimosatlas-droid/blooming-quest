/* Practice targets react to the same active katana frame as roadside enemies. */
(function(global){
  'use strict';
  const DIR={down:[0,1],right:[1,0],up:[0,-1],left:[-1,0]};
  let targets=[],options={},time=0;
  function enter(area,config={}){
    options=config;time=0;
    targets=(area.objects||[]).filter(o=>o.training).map((source,index)=>{
      const detail=typeof source.training==='object'?source.training:{};
      const maxHp=Math.max(1,Number(detail.maxHealth)||3);
      return {id:String(detail.id||source.id||'dummy-'+index),x:source.x,y:source.y,sprite:source.sprite,
        maxHp,hp:maxHp,hits:0,resetSeconds:Number(detail.resetSeconds)||2,resetIn:0,flash:0,recoil:[0,0],activations:new Set()};
    });
  }
  function update(dt){
    time+=dt;
    for(const target of targets){
      target.flash=Math.max(0,target.flash-dt);
      if(target.resetIn>0){target.resetIn=Math.max(0,target.resetIn-dt);if(target.resetIn===0){target.hp=target.maxHp;target.hits=0;target.activations.clear();}}
    }
  }
  function strike(hero,spec={}){
    let hits=0;const direction=DIR[hero.face]||DIR.down,range=Number(spec.range)||40,cosine=Math.cos(Number(spec.arc)||1.45);
    for(const target of targets){
      if(target.hp<=0||spec.activationId&&target.activations.has(spec.activationId))continue;
      const dx=target.x-hero.x,dy=target.y-hero.y,distance=Math.hypot(dx,dy);
      if(distance>range+10||distance>=10&&(dx*direction[0]+dy*direction[1])/distance<cosine)continue;
      if(options.canStrike&&!options.canStrike(hero,target))continue;
      target.hp=Math.max(0,target.hp-(Number(spec.damage)||1));target.hits++;target.flash=.3;
      target.recoil=[direction[0]*3,direction[1]*2];target.resetIn=target.resetSeconds;if(spec.activationId)target.activations.add(spec.activationId);hits++;
      options.onMessage?.((spec.name||'Katana')+' · practice hit '+target.hits+(target.hp===0?' · target resetting.':' · '+target.hp+'/'+target.maxHp+' strength.'));
    }
    return {hits};
  }
  function offset(source){
    const id=source.training?.id||source.id,target=targets.find(t=>id?t.id===String(id):t.x===source.x&&t.y===source.y);
    if(!target||!target.flash)return {x:0,y:0};
    const scale=target.flash/.3*Math.sin((.3-target.flash)*35);
    return {x:Math.round(target.recoil[0]*scale),y:Math.round(target.recoil[1]*scale)};
  }
  function hint(hero){const t=targets.find(t=>Math.hypot(t.x-hero.x,t.y-hero.y)<58);return t?'Space · practice combo · '+t.hits+' hits':null;}
  function hud(ctx,camera){
    ctx.save();ctx.textAlign='center';ctx.font='7px monospace';
    for(const target of targets){
      const x=Math.round(target.x-camera.x),y=Math.round(target.y-camera.y);
      if(x<-25||x>409||y<0||y>300)continue;
      if(!target.hits)continue;
      ctx.fillStyle='#203c2cd9';ctx.fillRect(x-12,y-45,24,4);ctx.fillStyle=target.hp?'#e2c37a':'#a4b99a';ctx.fillRect(x-11,y-44,22*target.hp/target.maxHp,2);
      ctx.fillStyle='#fff0c5';ctx.fillText(target.hp?target.hits+' HIT'+(target.hits===1?'':'S'):'RESETTING',x,y-49);
      if(target.flash>0){ctx.fillStyle='#ffe8a8';for(let i=0;i<4;i++){const angle=i*Math.PI/2+time*2;ctx.fillRect(Math.round(x+Math.cos(angle)*11),Math.round(y-23+Math.sin(angle)*9),2,2);}}
    }
    ctx.restore();
  }
  function snapshot(){return targets.map(({id,x,y,hp,maxHp,hits,resetIn})=>({id,x,y,hp,maxHp,hits,resetIn}));}
  global.BloomTraining={enter,update,strike,offset,hud,hint,snapshot};
})(window);
