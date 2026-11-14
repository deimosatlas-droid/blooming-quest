/* Outdoor light follows the same saved clock as residents and harvests. */
(function(global){
  'use strict';
  const smooth=t=>t*t*(3-2*t);
  function nightStrength(minutes){
    const value=Number.isFinite(Number(minutes))?Number(minutes):480,m=((value%1440)+1440)%1440;
    if(m<300||m>=1260)return 1;
    if(m<480)return 1-smooth((m-300)/180);
    if(m<=1020)return 0;
    return smooth((m-1020)/240);
  }
  function draw(ctx,area,minutes,width=384,height=256){
    if(!area||area.kind==='interior')return;
    ctx.save();
    if(area.theme==='moon'||area.theme==='night'){
      ctx.fillStyle=area.theme==='moon'?'#192f6660':'#132a3c50';ctx.fillRect(0,0,width,height);
    }else if(area.theme==='gold'){
      ctx.fillStyle='#d7a7480e';ctx.fillRect(0,0,width,height);
    }
    const strength=nightStrength(minutes)*(area.theme==='moon'||area.theme==='night'?.1:.28);
    if(strength>0){ctx.fillStyle='rgba(18,35,70,'+strength+')';ctx.fillRect(0,0,width,height);}
    ctx.restore();
  }
  global.BloomLighting={draw,nightStrength};
})(window);
