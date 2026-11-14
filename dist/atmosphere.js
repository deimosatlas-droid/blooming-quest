/* Small, original weather and synthesized sound effects; no remote assets or music. */
(function(global){
  'use strict';
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));
  const hash=text=>{let value=2166136261;for(const letter of String(text))value=Math.imul(value^letter.charCodeAt(0),16777619);return value>>>0;};
  const unit=seed=>((Math.imul(seed^0x45d9f3b,0x45d9f3b)>>>0)%65536)/65536;
  let config={},time=0,lastArea=null,region='',weatherKey='',weather={kind:'clear',density:0},lights=[],previousHero=null,steps=0,bellAt=12;
  let audio=null,effectBus=null,ambientBus=null,ambientNode=null,ambientFilter=null,noise=null,active=false,unlocked=false,audioFailed=false;
  const voices=new Set();
  const settings=()=>config.getSettings?.()||{};
  const saved=()=>config.getState?.()||{};
  const area=()=>config.getArea?.()||null;
  const hero=()=>config.getHero?.()||null;
  const volumes=()=>{const value=settings();return{effect:clamp(value.effectVolume??.5,0,1),ambient:clamp(value.ambientVolume??.3,0,1)};};
  function night(){const minutes=Number(saved().worldClock?.minutes)||0;return global.BloomLighting?.nightStrength?.(minutes)??(minutes<360||minutes>=1140?1:0);}
  function volumeTo(parameter,value){if(!parameter)return;try{if(parameter.setTargetAtTime)parameter.setTargetAtTime(value,audio.currentTime,.025);else parameter.value=value;}catch(error){parameter.value=value;}}
  function silence(){active=false;volumeTo(ambientBus?.gain,0);}
  function refresh(){
    const current=area(),clock=saved().worldClock||{},id=String(current?.id||current?.name||current?.theme||'world');
    if(current!==lastArea){
      lastArea=current;region=id;weatherKey='';previousHero=null;steps=0;bellAt=time+10;
      lights=(current?.objects||[]).filter(object=>object.glow||/^town_house_|rose_tower|estate_barn/.test(object.sprite||'')).slice(0,48);
    }
    const key=id+':'+(Number(clock.day)||1)+':'+Math.floor((Number(clock.minutes)||0)/180)+':'+String(settings().weatherEnabled!==false);
    if(key===weatherKey)return current;
    weatherKey=key;
    if(!current||['interior','dungeon'].includes(current.kind)||settings().weatherEnabled===false){weather={kind:'clear',density:0};return current;}
    const seed=hash(key),chance=unit(seed),theme=String(current.theme||''),port=current.port||/coast|port|quay|seabloom|tidepetal/.test(theme+' '+id);
    let kind='wind';
    if(port)kind=chance>.78?'rain':'mist';
    else if(/night|woodland|forest/.test(theme))kind=chance>.72?'rain':'mist';
    else if(/rose|lavender|moon/.test(theme))kind=chance>.88?'rain':'petals';
    else if(chance>.83)kind='rain';
    weather={kind,density:kind==='rain'?20:kind==='petals'?11:kind==='wind'?8:3,seed};
    return current;
  }
  function discard(node){voices.delete(node);try{node.disconnect?.();}catch(error){}}
  function prepareAudio(){
    if(audio||audioFailed)return Boolean(audio);
    const Constructor=global.AudioContext||global.webkitAudioContext;if(!Constructor)return false;
    try{
      audio=new Constructor();effectBus=audio.createGain();ambientBus=audio.createGain();
      effectBus.gain.value=0;ambientBus.gain.value=0;effectBus.connect(audio.destination);ambientBus.connect(audio.destination);
      noise=audio.createBuffer(1,Math.max(1,Math.floor(audio.sampleRate*2)),audio.sampleRate);
      const samples=noise.getChannelData(0);for(let index=0;index<samples.length;index++)samples[index]=unit(index+173)*2-1;
      return true;
    }catch(error){audioFailed=true;try{audio?.close?.();}catch(ignored){}audio=null;return false;}
  }
  function unlock(){
    unlocked=true;if(!prepareAudio())return false;
    try{const result=audio.resume?.();result?.catch?.(()=>{});}catch(error){}
    return true;
  }
  function pulse(frequency,duration,level,type='sine',destination=effectBus,endFrequency=frequency){
    if(!audio||!destination||voices.size>=12)return;
    try{
      const oscillator=audio.createOscillator(),gain=audio.createGain(),start=audio.currentTime;
      oscillator.type=type;oscillator.frequency.setValueAtTime(frequency,start);oscillator.frequency.exponentialRampToValueAtTime(Math.max(25,endFrequency),start+duration);
      gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(level,start+.008);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
      oscillator.connect(gain);gain.connect(destination);voices.add(oscillator);oscillator.onended=()=>{discard(oscillator);try{gain.disconnect();}catch(error){}};
      oscillator.start(start);oscillator.stop(start+duration+.015);
    }catch(error){}
  }
  function rustle(duration,level,frequency=900){
    if(!audio||!noise||voices.size>=12)return;
    try{
      const source=audio.createBufferSource(),filter=audio.createBiquadFilter(),gain=audio.createGain(),start=audio.currentTime;
      source.buffer=noise;filter.type='bandpass';filter.frequency.value=frequency;filter.Q.value=.6;
      gain.gain.setValueAtTime(level,start);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
      source.connect(filter);filter.connect(gain);gain.connect(effectBus);voices.add(source);source.onended=()=>{discard(source);try{filter.disconnect();gain.disconnect();}catch(error){}};
      source.start(start,unit(Math.floor(time*997))*Math.max(.1,2-duration));source.stop(start+duration);
    }catch(error){}
  }
  function syncAudio(current){
    if(!audio||!unlocked)return;
    const volume=volumes(),outdoors=current&&!['interior','dungeon'].includes(current.kind);volumeTo(effectBus.gain,volume.effect);
    volumeTo(ambientBus.gain,active&&outdoors&&volume.ambient>0?volume.ambient*.075:0);
    if(!ambientNode&&active&&outdoors&&volume.ambient>0){
      try{
        ambientNode=audio.createBufferSource();ambientFilter=audio.createBiquadFilter();ambientNode.buffer=noise;ambientNode.loop=true;
        ambientFilter.type='lowpass';ambientNode.connect(ambientFilter);ambientFilter.connect(ambientBus);ambientNode.start();
      }catch(error){ambientNode=null;ambientFilter=null;}
    }
    if(ambientFilter)ambientFilter.frequency.value=weather.kind==='rain'?1700:current?.port?380:210;
    if(active&&current?.port&&time>=bellAt){bellAt=time+18+unit(hash(region)+Math.floor(time))*12;pulse(523,.8,.1,'sine',ambientBus);pulse(784,.9,.04,'sine',ambientBus);}
  }
  function sound(event){
    const kind=typeof event==='string'?event:event?.kind;
    if(kind==='unlock')return unlock();
    if(kind==='pause'){silence();return true;}
    if(kind==='resume'){active=true;syncAudio(area());return true;}
    if(!audio||!unlocked||volumes().effect<=0)return false;
    volumeTo(effectBus.gain,volumes().effect);
    if(kind==='sword'){rustle(.10,.13,1900);pulse(220,.08,.025,'triangle',effectBus,110);}
    else if(kind==='hit'){rustle(.07,.15,700);pulse(140,.10,.10,'triangle',effectBus,65);}
    else if(kind==='parry'){pulse(1175,.20,.10,'sine');pulse(1760,.15,.045,'sine');}
    else if(kind==='hurt'){pulse(180,.17,.08,'triangle',effectBus,75);}
    else if(kind==='spell'){pulse(392,.19,.055,'sine',effectBus,784);pulse(587,.24,.04,'sine');}
    else if(kind==='harvest'){rustle(.10,.08,1700);pulse(660,.12,.035,'sine',effectBus,880);}
    else if(kind==='interact'){pulse(440,.07,.025,'sine');}
    else if(kind==='step'){
      const current=area(),position=hero(),tile=current?.tiles?.[Math.floor((position?.y||0)/16)]?.[Math.floor((position?.x||0)/16)];
      if(tile==='c'){pulse(410,.04,.045,'triangle',effectBus,270);rustle(.035,.035,2100);}
      else if(tile==='b'||tile==='i'){pulse(160,.06,.05,'triangle',effectBus,105);}
      else rustle(.055,.045,tile==='a'?1400:700);
    }else return false;
    return true;
  }
  function update(dt){
    const elapsed=clamp(dt,0,.1);if(!elapsed)return;
    time+=elapsed;const current=refresh(),position=hero();active=true;
    if(position&&Number.isFinite(position.x)&&Number.isFinite(position.y)){
      if(previousHero){const distance=Math.hypot(position.x-previousHero.x,position.y-previousHero.y);if(distance>0&&distance<40)steps+=distance;}
      previousHero={x:position.x,y:position.y};if(steps>=14){steps%=14;sound('step');}
    }
    syncAudio(current);
  }
  function glow(ctx,x,y,radius,strength){
    const gradient=ctx.createRadialGradient(x,y-5,0,x,y-5,radius);gradient.addColorStop(0,'rgba(255,192,95,'+strength+')');gradient.addColorStop(1,'rgba(255,192,95,0)');ctx.fillStyle=gradient;ctx.fillRect(x-radius,y-radius-5,radius*2,radius*2);
  }
  function draw(ctx,cam={x:0,y:0}){
    const current=refresh();if(!ctx||!current||['interior','dungeon'].includes(current.kind))return;
    const prefs=settings(),motion=prefs.reducedMotion?0:time,nightAmount=night(),position=hero(),hx=(position?.x??-1000)-(cam.x||0),hy=(position?.y??-1000)-(cam.y||0);
    ctx.save();
    if(nightAmount>0)for(const object of lights){const x=object.x-(cam.x||0),y=object.y-(cam.y||0);if(x<-45||x>429||y<-45||y>301)continue;glow(ctx,x,y,object.glow?29:24,nightAmount*(object.glow?.20:.12));}
    if(prefs.weatherEnabled===false){ctx.restore();return;}
    const seed=weather.seed||1;
    if(weather.kind==='mist'){
      for(let index=0;index<3;index++){
        const x=((unit(seed+index*37)*510+motion*(2+index))%510)-63,y=36+unit(seed+index*71)*200;
        const gradient=ctx.createRadialGradient(x,y,0,x,y,95);gradient.addColorStop(0,'rgba(205,225,219,.045)');gradient.addColorStop(1,'rgba(205,225,219,0)');ctx.fillStyle=gradient;ctx.fillRect(x-95,y-95,190,190);
      }
    }else for(let index=0;index<weather.density;index++){
      const speed=weather.kind==='rain'?93:7+unit(seed+index*59)*8;
      const x=((unit(seed+index*41)*420+motion*(weather.kind==='rain'?-17:6)+42000)%420)-18,y=((unit(seed+index*83)*280+motion*speed)%280)-12;
      if(x>hx-13&&x<hx+13&&y>hy-39&&y<hy+7)continue;
      if(weather.kind==='rain'){
        ctx.strokeStyle='rgba(187,215,224,.25)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(Math.round(x),Math.round(y));ctx.lineTo(Math.round(x-2),Math.round(y+7));ctx.stroke();
      }else{
        ctx.fillStyle=weather.kind==='petals'?'rgba(235,171,180,.55)':'rgba(193,185,115,.38)';ctx.fillRect(Math.round(x+Math.sin(motion+index)*2),Math.round(y),weather.kind==='petals'?2:3,1);
      }
    }
    ctx.restore();
  }
  function configure(options={}){
    config=options;lastArea=null;weatherKey='';previousHero=null;steps=0;silence();refresh();
    return true;
  }
  function snapshot(){refresh();return{region,weather:weather.kind,particles:weather.density,unlocked,audioAvailable:Boolean(audio),active,voices:voices.size};}
  global.BloomAtmosphere={configure,update,draw,sound,snapshot};
})(window);
