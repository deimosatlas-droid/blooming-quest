/* Local title, input profiles and comfort preferences. No account or runtime service. */
(function(global){
  'use strict';
  const doc=typeof document==='undefined'?null:document,$=id=>doc?.getElementById?.(id)||null;
  const SETTINGS_KEY='blooming-journey-settings-v1',SAVE_KEY='blooming-world-v05';
  const ACTIONS={up:['Move up','w'],down:['Move down','s'],left:['Move left','a'],right:['Move right','d'],interact:['Interact','e'],attack:['Attack',' '],dodge:['Dodge','q'],guard:['Guard / parry','c'],run:['Run','shift'],heal:['Heal','h'],bag:['Bag','b'],map:['Map','m'],spells:['Spellbook','k'],journal:['Journal','j'],options:['Options','o'],slot1:['Spell slot 1','1'],slot2:['Spell slot 2','2'],slot3:['Spell slot 3','3'],slot4:['Spell slot 4','4'],slot5:['Spell slot 5','5']};
  const PROFILES={keyboard:'Keyboard & mouse',touch:'Touch · landscape',hybrid:'Hybrid · touch + keys'};
  const DEFAULT_BINDINGS=Object.fromEntries(Object.entries(ACTIONS).map(([id,definition])=>[id,definition[1]]));
  let config={},mounted=false,bound=false,settings,initialSave=false,artSignature=null,artWide=false,capturing=null,optionsTarget=null,newJourneyPending=false;
  const clamp=(value,min,max,fallback)=>Number.isFinite(Number(value))?Math.max(min,Math.min(max,Number(value))):fallback;
  const key=value=>String(value??'').toLowerCase().replace(/^space(bar)?$/,' ');
  function suggestedProfile(){return global.matchMedia?.('(any-pointer:coarse)')?.matches?'touch':'keyboard';}
  function defaults(){return{profile:suggestedProfile(),textScale:1,touchScale:1,touchOpacity:.9,leftHanded:false,reducedMotion:Boolean(global.matchMedia?.('(prefers-reduced-motion:reduce)')?.matches),reducedFlashes:false,weatherEnabled:true,soundEnabled:true,effectVolume:.65,ambientVolume:.35,bindings:{...DEFAULT_BINDINGS}};}
  function sanitize(value={}){
    const next={...defaults(),...value},used=new Set(),bindings={...DEFAULT_BINDINGS};
    if(!Object.prototype.hasOwnProperty.call(PROFILES,next.profile))next.profile=suggestedProfile();
    next.textScale=clamp(next.textScale,1,1.5,1);next.touchScale=clamp(next.touchScale,1,1.2,1);next.touchOpacity=clamp(next.touchOpacity,.4,1,.9);next.effectVolume=clamp(next.effectVolume,0,1,.65);next.ambientVolume=clamp(next.ambientVolume,0,1,.35);
    for(const id of ['leftHanded','reducedMotion','reducedFlashes','weatherEnabled','soundEnabled'])next[id]=Boolean(next[id]);
    const incoming=value.bindings&&typeof value.bindings==='object'?value.bindings:{};
    for(const id of Object.keys(ACTIONS))bindings[id]=validKey(incoming[id])?key(incoming[id]):DEFAULT_BINDINGS[id];
    // A corrupt or conflicting saved binding set falls back atomically; never lose an action.
    for(const binding of Object.values(bindings)){if(used.has(binding)){next.bindings={...DEFAULT_BINDINGS};return next;}used.add(binding);}
    next.bindings=bindings;return next;
  }
  function validKey(value){const normalized=key(value);return normalized==='shift'||normalized.length===1&&normalized!=='\n'&&normalized!=='\t';}
  try{initialSave=Boolean(global.localStorage?.getItem(SAVE_KEY));settings=sanitize(JSON.parse(global.localStorage?.getItem(SETTINGS_KEY)||'{}'));}catch{settings=defaults();}
  function getSettings(){return{...settings,bindings:{...settings.bindings}};}
  function getProfile(){return settings.profile;}
  function setSettings(patch={}){
    settings=sanitize({...settings,...patch,bindings:{...settings.bindings,...patch.bindings}});
    try{global.localStorage?.setItem(SETTINGS_KEY,JSON.stringify(settings));}catch{}
    apply();config.onSettingsChange?.(getSettings());return getSettings();
  }
  function mapKey(value){
    const normalized=key(value),action=Object.keys(ACTIONS).find(id=>settings.bindings[id]===normalized);
    if(action)return ACTIONS[action][1];
    return Object.values(DEFAULT_BINDINGS).includes(normalized)?'':normalized;
  }
  function keyLabel(value){const normalized=key(value);return normalized===' '?'Space':normalized==='shift'?'Shift':normalized.startsWith('arrow')?normalized.slice(5):normalized.toUpperCase();}
  function prompt(action){
    const id=Object.prototype.hasOwnProperty.call(ACTIONS,action)?action:'interact',label=keyLabel(settings.bindings[id]);
    if(settings.profile==='touch')return id==='interact'?'Tap':ACTIONS[id][0];
    return settings.profile==='hybrid'?label+' / '+(id==='interact'?'tap':ACTIONS[id][0]):label;
  }
  function setBinding(action,value){
    if(!Object.prototype.hasOwnProperty.call(ACTIONS,action)||!validKey(value))return{ok:false,message:'Choose a letter, number, symbol, Space or Shift. Escape cancels.'};
    const normalized=key(value),conflict=Object.keys(ACTIONS).find(id=>id!==action&&settings.bindings[id]===normalized);
    if(conflict)return{ok:false,message:keyLabel(normalized)+' is already used for '+ACTIONS[conflict][0]+'.'};
    setSettings({bindings:{[action]:normalized}});return{ok:true,message:ACTIONS[action][0]+' uses '+keyLabel(normalized)+'.'};
  }
  function apply(){
    const body=doc?.body;if(!body)return;
    body.dataset.inputProfile=settings.profile;body.dataset.leftHanded=String(settings.leftHanded);body.dataset.reducedMotion=String(settings.reducedMotion);body.dataset.reducedFlashes=String(settings.reducedFlashes);body.dataset.weatherEnabled=String(settings.weatherEnabled);
    const width=Number(global.innerWidth)||1000,height=Number(global.innerHeight)||700,shortLandscape=width>height&&(height<360||width<640),touchScale=shortLandscape?1:settings.touchScale;
    body.style?.setProperty?.('--game-text-scale',settings.textScale);body.style?.setProperty?.('--touch-scale',touchScale);body.style?.setProperty?.('--touch-opacity',settings.touchOpacity);
    for(const button of doc.querySelectorAll?.('[data-input-profile-choice]')||[]){const active=button.dataset.inputProfileChoice===settings.profile;button.setAttribute('aria-pressed',String(active));button.classList?.toggle('is-selected',active);}
    const profile=$('journey-profile-label');if(profile)profile.textContent=PROFILES[settings.profile];
    const teaching=$('journey-controls');if(teaching)teaching.textContent=settings.profile==='touch'?'Move with the arrows · hold Attack to chain · time Guard to parry':prompt('up')+' / arrows · move   '+prompt('interact')+' · interact   '+prompt('attack')+' · attack';
  }
  function node(tag,className,text){const result=doc.createElement(tag);if(className)result.className=className;if(text!==undefined)result.textContent=text;return result;}
  function button(text,className,callback){const result=node('button',className,text);result.type='button';result.onclick=callback;return result;}
  function clear(target){if(target.replaceChildren)target.replaceChildren();else target.innerHTML='';}
  function message(text){if($('journey-feedback'))$('journey-feedback').textContent=text||'';}
  function profileChoices(){const group=node('div','journey-profile-choices');group.setAttribute('role','group');group.setAttribute('aria-label','How are you playing?');
    for(const[id,label]of Object.entries(PROFILES)){const choice=button(label,'journey-profile-choice',()=>setSettings({profile:id}));choice.dataset.inputProfileChoice=id;choice.setAttribute('aria-pressed',String(settings.profile===id));group.appendChild(choice);}return group;
  }
  function requestNewJourney(){
    if(!config.getReady?.())return false;
    const panel=$('journey-confirm');if(!panel)return false;panel.hidden=false;message('');$('journey-confirm-start')?.focus?.({preventScroll:true});return true;
  }
  async function beginNewJourney(event){
    if(newJourneyPending||!config.getReady?.()||typeof config.onNewJourney!=='function')return false;newJourneyPending=true;
    try{
      if(initialSave){const current=config.getState?.(),raw=current?JSON.stringify(current):global.localStorage?.getItem(SAVE_KEY);if(raw)global.localStorage.setItem(SAVE_KEY+':previous',raw);}
      const result=await config.onNewJourney?.(event);
      if(result===false||result?.ok===false){message(result?.message||'The new journey could not start. Your current save is safe.');return false;}
      initialSave=true;if($('journey-confirm'))$('journey-confirm').hidden=true;return true;
    }catch(error){message('Your current journey could not be backed up. Export it from Options before starting again.');return false;}
    finally{newJourneyPending=false;}
  }
  function mount(){
    const cover=$('cover'),play=$('play-area');if(mounted||!cover||!doc?.createElement)return false;mounted=true;
    // The title belongs to the full game frame, not its fixed-aspect world canvas.
    if(play?.appendChild&&cover.parentElement!==play)play.appendChild(cover);cover.classList?.add?.('journey-cover');
    const start=$('start')||button('Begin Journey','',()=>config.onStart?.()),load=$('loadtext')||node('p','','Preparing the world…');start.id='start';load.id='loadtext';
    clear(cover);const art=node('canvas','journey-title-art');art.id='journey-art';art.width=384;art.height=256;art.setAttribute('aria-hidden','true');cover.appendChild(art);
    const shade=node('div','journey-title-shade');shade.setAttribute('aria-hidden','true');cover.appendChild(shade);
    const petals=node('div','journey-petals');petals.setAttribute('aria-hidden','true');for(let index=0;index<7;index++){const petal=node('i');petal.style?.setProperty?.('--petal',index);petals.appendChild(petal);}cover.appendChild(petals);
    const panel=node('div','journey-title-panel');panel.appendChild(node('span','journey-title-eyebrow','A letter. A missing love. A road in bloom.'));const heading=node('h2','journey-title','Blooming Quest');panel.appendChild(heading);panel.appendChild(node('p','journey-subtitle','Amaal’s Journey'));
    const summary=node('p','journey-save-summary');summary.id='journey-save-summary';panel.appendChild(summary);
    const actions=node('div','journey-title-actions');start.classList?.add?.('journey-primary');actions.appendChild(start);const fresh=button('New Journey','journey-secondary',requestNewJourney);fresh.id='journey-new';actions.appendChild(fresh);actions.appendChild(button('Options','journey-secondary',()=>config.onOptions?.()));const importButton=button('Import Save','journey-secondary',()=>config.onImport?.());importButton.id='journey-import';actions.appendChild(importButton);panel.appendChild(actions);
    const confirm=node('div','journey-confirm');confirm.id='journey-confirm';confirm.hidden=true;confirm.setAttribute('role','group');confirm.setAttribute('aria-label','Start a new journey?');confirm.appendChild(node('p','','Start again at Rosepetal? Your current journey will be kept as the previous-save backup. Export a copy in Options if you want to keep several journeys.'));const yes=button('Keep backup & begin','journey-primary',beginNewJourney);yes.id='journey-confirm-start';confirm.appendChild(yes);confirm.appendChild(button('Keep playing this journey','journey-secondary',()=>{confirm.hidden=true;fresh.focus?.({preventScroll:true});}));panel.appendChild(confirm);
    const setup=node('div','journey-profile');setup.appendChild(node('p','','How are you playing?'));setup.appendChild(profileChoices());const controls=node('p','journey-controls');controls.id='journey-controls';setup.appendChild(controls);panel.appendChild(setup);panel.appendChild(load);const feedback=node('p','journey-feedback');feedback.id='journey-feedback';feedback.setAttribute('role','status');panel.appendChild(feedback);cover.appendChild(panel);
    apply();return true;
  }
  function drawTitle(){
    const canvas=$('journey-art'),art=config.getTitleArt?.(),wide=Number(global.innerWidth)>=1000&&Number(global.innerHeight)>=600;if(!canvas?.getContext||!art?.area||!art?.atlas||!art?.texture)return false;if(artSignature===art.area&&artWide===wide)return true;
    const ctx=canvas.getContext('2d');if(!ctx)return false;artSignature=art.area;artWide=wide;ctx.imageSmoothingEnabled=false;const area=art.area,atlas=art.atlas,texture=art.texture,cam={x:wide?240:320,y:64},palette={g:'grass',d:'dirt_clean',w:'water',b:'dock_planks',c:'cobble_grey',a:'sand_1',f:'dirt_clean'};
    ctx.fillStyle='#6b8d60';ctx.fillRect(0,0,384,256);
    for(let y=Math.floor(cam.y/16);y<Math.ceil((cam.y+256)/16);y++)for(let x=Math.floor(cam.x/16);x<Math.ceil((cam.x+384)/16);x++){const sprite=atlas[area.tilePalette?.[area.tiles?.[y]?.[x]]||palette[area.tiles?.[y]?.[x]]];if(sprite)ctx.drawImage(texture,...sprite.rect,x*16-cam.x,y*16-cam.y,16,16);}
    for(const object of [...(area.objects||[])].sort((a,b)=>a.y-b.y)){const sprite=atlas[object.sprite],scale=object.scale||1;if(!sprite)continue;const dx=object.x-cam.x-sprite.anchor[0]*scale,dy=object.y-cam.y-sprite.anchor[1]*scale;if(dx>384||dy>256||dx+sprite.rect[2]*scale<0||dy+sprite.rect[3]*scale<0)continue;ctx.drawImage(texture,...sprite.rect,Math.round(dx),Math.round(dy),sprite.rect[2]*scale,sprite.rect[3]*scale);}
    ctx.fillStyle='rgba(30,34,69,.40)';ctx.fillRect(0,0,384,256);
    if(ctx.createRadialGradient){for(const[x,y]of [[501-cam.x,133],[519-cam.x,133],[511-cam.x,190]]){const light=ctx.createRadialGradient(x,y,0,x,y,24);light.addColorStop(0,'#ffdf925c');light.addColorStop(1,'#ffdc9000');ctx.fillStyle=light;ctx.fillRect(x-24,y-24,48,48);}}
    if(art.amaal)ctx.drawImage(art.amaal,0,0,40,48,wide?286:214,208,40,48);
    if(art.animalsImage)ctx.drawImage(art.animalsImage,0,128,32,32,wide?320:249,224,32,32);return true;
  }
  function update(){
    if(!mounted)mount();if(config.getPlaying?.())initialSave=true;const ready=Boolean(config.getReady?.()),state=config.getState?.()||{},world=config.getWorld?.()||{},where=[...(world.towns||[]),...(world.roads||[]),...(world.dungeons||[])].find(place=>place.id===state.area||String(state.area||'').startsWith(place.id+'_'))?.name||'Rosepetal Tower',level=global.BloomProgression?.snapshot?.(state)?.level||1,day=Math.max(1,Number(state.worldClock?.day)||1);
    const start=$('start');if(start){start.disabled=!ready;start.textContent=initialSave?'Continue Journey':'Begin Journey';}
    if($('journey-new')){$('journey-new').disabled=!ready;$('journey-new').hidden=!initialSave;}
    if($('journey-import'))$('journey-import').disabled=!ready;
    if($('journey-save-summary'))$('journey-save-summary').textContent=initialSave?where+' · Day '+day+' · Level '+level:'Your first steps begin at Rosepetal Tower.';
    drawTitle();apply();
  }
  function showTitle(){
    config.onReturnTitle?.();const cover=$('cover');if(!cover)return false;cover.style.display='';if($('journey-confirm'))$('journey-confirm').hidden=true;update();$('start')?.focus?.({preventScroll:true});return true;
  }
  function renderOptions(target){
    if(!target||!doc?.createElement)return false;optionsTarget=target;clear(target);target.classList?.add?.('journey-preferences');
    target.appendChild(node('h3','','Controls & comfort'));target.appendChild(profileChoices());
    const grid=node('div','journey-preference-grid');
    function range(id,label,min,max,step){const wrap=node('label','journey-preference'),text=node('span','',label),value=node('output','',String(Math.round(settings[id]*100))+'%'),input=node('input');input.type='range';input.min=min;input.max=max;input.step=step;input.value=settings[id];input.setAttribute('aria-label',label);input.oninput=()=>{setSettings({[id]:Number(input.value)});value.textContent=Math.round(settings[id]*100)+'%';};wrap.appendChild(text);wrap.appendChild(input);wrap.appendChild(value);grid.appendChild(wrap);}
    range('textScale','Menu text size',1,1.5,.1);range('touchScale','Touch control size',1,1.2,.05);range('touchOpacity','Touch control opacity',.4,1,.05);range('effectVolume','Sound effects volume',0,1,.05);range('ambientVolume','Ambient volume',0,1,.05);
    for(const[id,label]of [['leftHanded','Left-handed touch layout'],['reducedMotion','Reduce motion and camera movement'],['reducedFlashes','Reduce flashes and hit flicker'],['weatherEnabled','Weather and drifting petals']]){const wrap=node('label','journey-preference journey-toggle'),input=node('input');input.type='checkbox';input.checked=settings[id];input.onchange=()=>setSettings({[id]:input.checked});wrap.appendChild(input);wrap.appendChild(node('span','',label));grid.appendChild(wrap);}target.appendChild(grid);
    const details=node('details','journey-bindings'),summary=node('summary','','Customize keyboard controls');details.appendChild(summary);details.appendChild(node('p','','Choose an action, then press its new key. Arrow keys always remain available. Escape cancels.'));
    const bindings=node('div','journey-binding-grid');for(const[id,[label]]of Object.entries(ACTIONS)){const control=button(label+' · '+keyLabel(settings.bindings[id]),'journey-binding',()=>{capturing={id,control};control.textContent=label+' · press a key…';$('journey-binding-status').textContent='Choose a key for '+label+'.';});control.dataset.bindingAction=id;bindings.appendChild(control);}details.appendChild(bindings);const status=node('p','journey-binding-status');status.id='journey-binding-status';status.setAttribute('role','status');details.appendChild(status);details.appendChild(button('Restore default keys','journey-secondary',()=>{setSettings({bindings:{...DEFAULT_BINDINGS}});renderOptions(target);}));target.appendChild(details);
    const back=button('Return to title','journey-secondary journey-return-title',()=>{config.onCloseMenus?.();showTitle();});target.appendChild(back);return true;
  }
  function bind(){if(bound||!doc)return;bound=true;global.addEventListener?.('resize',()=>{apply();drawTitle();});doc.addEventListener?.('keydown',event=>{
    if(!capturing)return;if(capturing.control.isConnected===false||capturing.control.closest?.('[hidden]')){capturing=null;return;}event.preventDefault?.();event.stopImmediatePropagation?.();event.stopPropagation?.();const capture=capturing;if(event.key==='Escape'){capturing=null;capture.control.textContent=ACTIONS[capture.id][0]+' · '+keyLabel(settings.bindings[capture.id]);return;}
    const result=setBinding(capture.id,event.key);if($('journey-binding-status'))$('journey-binding-status').textContent=result.message;if(result.ok){capturing=null;capture.control.textContent=ACTIONS[capture.id][0]+' · '+keyLabel(settings.bindings[capture.id]);}
  },true);}
  function configure(options={}){config=options;bind();mount();update();return getSettings();}
  global.BloomJourney={configure,update,getProfile,getSettings,setSettings,mapKey,prompt,setBinding,renderOptions,showTitle,requestNewJourney,beginNewJourney};
  // Install capture before the game configures its modal shortcut listeners.
  bind();apply();
})(window);
