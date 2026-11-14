/* Amaal's grimoire presents the real spell catalogue; the game owns every action. */
(function(global){
  'use strict';
  const doc=typeof document==='undefined'?null:document;
  const $=id=>doc?.getElementById?.(id)||null;
  const COLORS={katana:'#dda6a1',bloomcraft:'#b4cb8a',stormy:'#9cc8ca',frost:'#a9d8ed',ember:'#edb18b'};
  const ICON_PATHS={
    katana:'<path d="M8 27 25 5l3-1-1 4L10 29M6 24l7 6M4 30l3 2 4-5"/><path d="m18 7 1-3m7 15 4-1M6 15l-3-1"/>',
    petal_sweep:'<path d="M8 27 25 5l3-1-1 4L10 29M6 24l7 6M4 30l3 2 4-5M4 13c5-7 13-8 20-4M3 18c3-5 8-8 13-8"/>',
    rose_lance:'<path d="M6 30 25 7M19 7l10-5-3 11-1-6ZM7 20l7 6M13 12c-6-5-10-1-6 4 3 1 5 0 6-4Z"/>',
    crescent_return:'<path d="M24 3C3 6 4 27 25 31 14 20 14 14 24 3ZM5 7l-3 8 8-1m20 13 2-8-8 1"/>',
    thorn_dance:'<path d="M6 5 27 28M5 4l3 9m20-9L7 28M29 3l-3 10M4 24l7 7m12-7 7 7M12 8l5-4 5 4M11 18l-6 1m18-1 6 1"/>',
    bloomcraft:'<path d="M7 28C4 15 14 6 28 5c1 15-7 23-21 23Z"/><path d="M5 31 23 11M11 25l-1-8m6 3 8-1m-5-5 1-6"/>',
    briar_bind:'<path d="M17 3v16m0-7C8 12 5 8 5 4c7 0 12 2 12 8Zm0 4c9 0 12-4 12-8-7 0-12 2-12 8ZM17 19l-6 7-6 1m12-8 6 7 6 1m-12-5-1 9m-5-5 1 5m11-5-1 5"/>',
    seed_bolt:'<path d="M4 26 26 7M18 7l11-4-4 11M8 24C5 14 10 8 19 10c2 9-2 14-11 14ZM3 19l-2 1m12 9-2 3"/>',
    healing_bloom:'<path d="M17 12c-11-12-18 5-7 7-8 10 8 17 9 6 10 9 19-7 8-9C31 5 17 2 17 12Z"/><path d="M16 15v9m-4-4h9"/>',
    thorn_wall:'<path d="M5 30V8m8 22V4m8 26V7m8 23V3M2 16h29M2 24h29M5 10l4-4m4 8-5-4m13 11 4-5m4-5-5-5"/>',
    stormy:'<path d="M3 12h18c8 0 8-10 1-9-4 1-4 5-1 5M3 18h23c7 0 8 10 1 11-4 0-5-4-2-6M7 24h9c5 0 4 7 0 7"/>',
    stormy_gust:'<path d="M3 12h18c8 0 8-10 1-9-4 1-4 5-1 5M3 18h23c7 0 8 10 1 11-4 0-5-4-2-6M7 24h9c5 0 4 7 0 7"/>',
    gale_step:'<path d="m19 3-5 12 10 8 6 1-2 7H10l-4-7 5-3 2-9M2 11h7M1 16h6M3 5h10"/>',
    cyclone:'<path d="M27 7C17-2 1 7 5 20c4 15 29 9 24-4-3-8-18-9-20 0-2 9 15 13 15 4 0-6-11-6-10-1"/>',
    thunder_call:'<path d="M7 16C-1 14 3 5 10 7 12-1 25 0 25 8c9-1 10 9 2 10M19 12l-8 10h7l-4 12 12-15h-8Z"/>',
    frost:'<path d="M17 2v32M3 10l28 16M3 26l28-16M12 5l5 5 5-5M12 31l5-5 5 5M3 16l7-2-1-7M31 20l-7 2 1 7M3 20l7 2-1 7M31 16l-7-2 1-7"/>',
    frost_shard:'<path d="m17 2 11 15-11 17L6 17ZM17 2v32M6 17h22M17 10l6 7-6 9-5-9Z"/>',
    ice_ring:'<circle cx="17" cy="18" r="13"/><path d="M17 7v22M7 13l20 11M7 24l20-11M13 9l4 4 4-4M13 27l4-4 4 4"/>',
    winter_ward:'<path d="M17 3 29 8v9c0 7-7 12-12 15C12 29 5 24 5 17V8Z"/><path d="M17 10v16M11 14l12 8M11 22l12-8M13 11l4 4 4-4"/>',
    glacial_path:'<path d="m5 31 8-9-3-8L20 4l8 2-9 10 4 7-8 9M4 23l5 3M20 8l5 3M16 20l5 2M3 9l4 2m20 19 4 1"/>',
    ember:'<path d="M18 2C21 14 29 15 29 23 29 37 5 37 5 23c0-7 5-9 7-16 1 9 3 9 6 13 4-6 4-10 0-18Z"/>',
    ember_bolt:'<path d="M4 29 27 6M18 5l12-3-3 12M9 28C-1 21 3 11 13 8c-3 6 1 6 3 9 5-4 4-7 4-7 7 8-2 20-11 18Z"/>',
    flame_fan:'<path d="M16 31C7 30 1 21 3 13c6 1 9 5 11 10C6 13 12 4 17 1c4 10 7 12 4 22 2-6 6-9 11-9 1 9-6 16-16 17Z"/>',
    cinder_trap:'<path d="m17 18 14 8-14 8L3 26ZM17 3c1 6 9 8 6 14-2 7-13 5-13-1 0-4 4-5 3-9 3 3 4 5 4 7 4-5 0-11 0-11ZM3 18l4 2m20 0 4-2"/>',
    phoenix_pulse:'<path d="M17 18C9 4 5 5 2 3c0 12 3 18 12 19l-6 9 9-5 9 5-6-9c9-1 12-7 12-19-4 3-10 2-15 15ZM17 10v8M4 10l8 7m18-7-8 7"/><circle cx="17" cy="20" r="3"/>',
    finishing_cut:'<path d="M8 27 26 5l3-1-1 4L11 29M6 24l7 6M4 30l4 2 4-5M8 7l1-4m-5 8-3-1m21 16 4 2m-6 2 1 3"/>',
    petal_return:'<path d="M10 7C2 12 3 26 15 29c9 2 17-6 15-14M9 2l1 6-7 1"/><path d="m17 8 6 8-6 8-6-8Z"/>',
    lingering_roots:'<path d="M17 3v16m0-7c-9 0-12-4-12-8 7 0 12 2 12 8Zm0 4c9 0 12-4 12-8-7 0-12 2-12 8ZM17 19l-6 7-6 1m12-8 6 7 6 1m-12-5-1 9m-5-5 1 5m11-5-1 5"/>',
    deep_roots:'<path d="M17 3C6 4 5 18 17 22c12-4 11-18 0-19Zm0 5v23m0-8-7 6-5-1m12-5 7 6 5-1"/>',
    tailwind:'<path d="M2 10h18c7 0 7-8 1-8-3 0-4 3-2 4M2 17h25M2 24h15c6 0 6 8 1 8"/><path d="m23 12 6 5-6 5"/>',
    wind_ward:'<path d="M17 3 29 8v9c0 7-7 12-12 15C12 29 5 24 5 17V8Z"/><path d="M10 14h11c6 0 5-6 1-5M10 20h12m-12 5h7"/>'
  };
  let config={},configured=false,bound=false,opened=false,selected='petal_sweep',previousFocus=null,treeSignature='',school='all',query='';
  const text=(id,value)=>{const element=$(id),next=String(value);if(element&&element.textContent!==next)element.textContent=next;};
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));
  const icon=kind=>'<svg viewBox="0 0 34 36" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(ICON_PATHS[kind]||ICON_PATHS.katana)+'</svg>';
  const iconKind=node=>ICON_PATHS[node?.id]?node.id:node?.branch||'katana';
  const number=value=>Number.isInteger(value)?String(value):String(Math.round(Number(value)*10)/10);
  function elements(tag,className,content){const element=doc.createElement(tag);if(className)element.className=className;if(content!==undefined)element.textContent=String(content);return element;}
  function definitions(){return global.BloomProgression?.definitions||[];}
  function branches(){return global.BloomProgression?.branches||[];}
  function rankOf(p,node){return node.kind==='active'?(p.ranks?.[node.id]||(p.skills?.[node.id]?1:0)):(p.skills?.[node.id]?1:0);}
  function resolved(state,node,rank){return global.BloomProgression?.spell?.(state,node.id)||global.BloomSpells?.resolve?.(node.id,Math.max(1,rank))||node;}
  function visibleNodes(){return definitions().filter(node=>(school==='all'||node.branch===school)&&(!query||(node.name+' '+node.description+' '+node.branch+' '+(node.effect||'')).toLowerCase().includes(query)));}
  function model(){
    const state=config.getState?.();if(!state)return null;
    const progression=global.BloomProgression?.snapshot?.(state)||{level:1,xp:0,xpIntoLevel:0,xpForNext:60,points:0,skills:{},ranks:{},loadout:[]};
    const combat=config.getCombat?.()||{};
    return{state,progression,combat,enabled:configured&&combat.enabled!==false};
  }
  function feedback(message,error=false){text('skill-feedback',message||'');$('skill-feedback')?.classList?.toggle('skill-feedback-error',Boolean(error));}
  function result(action){
    try{const value=action?.();feedback(value?.message||'Your path is saved.',value?.ok===false);treeSignature='';update();return value;}
    catch(error){feedback(error?.message||'That spell could not be changed.',true);return{ok:false};}
  }
  function action(key){const current=model();if(current?.enabled&&!opened)config.onAction?.(key);}
  function configure(options={}){config=options;configured=true;bind();renderFilters();update();}
  function filterChanged(){
    query=String($('spell-search')?.value||'').trim().toLowerCase();
    const visible=visibleNodes();if(!visible.some(node=>node.id===selected))selected=visible[0]?.id||'';
    treeSignature='';renderFilters();update();
  }
  function renderFilters(){
    const target=$('spell-school-filters');if(!target||!doc?.createElement)return;
    const focus=doc.activeElement?.dataset?.schoolFilter;
    target.replaceChildren?.();if(!target.replaceChildren)target.innerHTML='';
    for(const branch of [{id:'all',name:'All schools'},...branches()]){
      const button=elements('button','school-filter',branch.name);button.type='button';button.dataset.schoolFilter=branch.id;button.setAttribute('aria-pressed',String(branch.id===school));
      button.style.setProperty?.('--school-color',COLORS[branch.id]||'#d5c18c');button.onclick=()=>{school=branch.id;filterChanged();};target.appendChild(button);
    }
    if(focus)target.querySelector?.('[data-school-filter="'+focus+'"]')?.focus?.({preventScroll:true});
  }
  function bind(){
    if(bound||!doc)return;bound=true;
    if($('open-skills'))$('open-skills').onclick=()=>open();
    if($('close-skills'))$('close-skills').onclick=()=>close();
    if($('combat-dodge'))$('combat-dodge').onclick=()=>action('q');
    for(let i=0;i<5;i++){
      if($('combat-slot-'+i))$('combat-slot-'+i).onclick=()=>action(String(i+1));
      if($('equip-skill-'+i))$('equip-skill-'+i).onclick=()=>{if(opened)result(()=>config.onEquip?.(selected,i));};
    }
    if($('learn-skill'))$('learn-skill').onclick=()=>{if(opened)result(()=>config.onLearn?.(selected));};
    if($('upgrade-skill'))$('upgrade-skill').onclick=()=>{if(opened)result(()=>config.onUpgrade?.(selected));};
    if($('respec-skills'))$('respec-skills').onclick=()=>{if(opened)result(()=>config.onRespec?.());};
    if($('spell-search'))$('spell-search').oninput=filterChanged;
    $('skill-overlay')?.addEventListener?.('click',event=>{if(event.target===$('skill-overlay'))close();});
    doc.addEventListener?.('keydown',event=>{
      if(!opened)return;
      const target=event.target||doc.activeElement,editing=Boolean(target?.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName||''));
      if(event.key==='Escape'||!editing&&event.key?.toLowerCase()==='k'){
        event.preventDefault();event.stopImmediatePropagation?.();event.stopPropagation?.();close();return;
      }
      // Native editing stays available; every event remains inside the grimoire.
      if(event.key==='Tab'){
        const focusable=[...($('skill-overlay')?.querySelectorAll?.('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]')||[])].filter(element=>!element.closest?.('[hidden]')&&(typeof element.getClientRects!=='function'||element.getClientRects().length));
        if(focusable.length){const first=focusable[0],last=focusable.at(-1),active=doc.activeElement;
          if(event.shiftKey&&(active===first||!focusable.includes(active))){event.preventDefault();last.focus?.();}
          else if(!event.shiftKey&&(active===last||!focusable.includes(active))){event.preventDefault();first.focus?.();}
        }
      }else if(!editing&&!['Enter',' '].includes(event.key)){event.preventDefault();}
      event.stopPropagation?.();
    },true);
  }
  function open(){
    if(opened)return true;
    if(!configured||!$('skill-overlay')||!model()?.enabled)return false;
    if(config.onPause?.()===false)return false;
    previousFocus=doc?.activeElement||$('open-skills');opened=true;treeSignature='';
    $('skill-overlay').hidden=false;$('open-skills')?.setAttribute?.('aria-expanded','true');
    $('play-area')?.classList?.toggle('skills-open',true);feedback('Twenty spells, five schools. Learn a spell, then grow it through three ranks.');update();$('close-skills')?.focus?.({preventScroll:true});return true;
  }
  function close(){
    if(!opened)return false;opened=false;
    if($('skill-overlay'))$('skill-overlay').hidden=true;$('open-skills')?.setAttribute?.('aria-expanded','false');
    $('play-area')?.classList?.toggle('skills-open',false);config.onResume?.();update();
    previousFocus?.focus?.({preventScroll:true});previousFocus=null;return true;
  }
  function meter(id,fill,value,maximum){const target=$(id),max=Math.max(1,Number(maximum)||1),amount=clamp(value,0,max);if(target){target.setAttribute?.('aria-valuemax',String(max));target.setAttribute?.('aria-valuenow',String(Math.round(amount*10)/10));}if($(fill))$(fill).style.width=(amount/max*100).toFixed(1)+'%';}
  function update(){
    const current=model();if(!current)return;
    const{state,progression:p,combat:c,enabled}=current,nodes=definitions();
    text('combat-level',String(p.level).padStart(2,'0'));text('stamina-value',Math.ceil(clamp(c.stamina,0,c.maxStamina||100))+' / '+(c.maxStamina||100));
    meter('health-meter','health-fill',state.hp??5,5);meter('stamina-meter','stamina-fill',c.stamina??100,c.maxStamina||100);meter('xp-meter','xp-fill',p.level>=p.maxLevel?1:p.xpIntoLevel,p.level>=p.maxLevel?1:p.xpForNext||1);
    text('combat-state',(c.status|| (c.guarding?'GUARDING':c.dodging?'DODGING':'READY FOR THE ROAD'))+(c.queued?' · QUEUED':''));
    if($('cast-display'))$('cast-display').hidden=!c.casting;
    if(c.casting){const id=c.currentSpell?.id||c.currentSpell||c.casting?.id;const spell=nodes.find(node=>node.id===id);text('cast-spell-name',spell?.name||c.currentSpell?.name||'Casting');meter('cast-meter','cast-fill',c.castProgress||0,1);}
    if($('enemy-target'))$('enemy-target').hidden=!c.target;
    if(c.target){text('enemy-name',c.target.name);text('enemy-health',c.target.hp+' / '+c.target.maxHp);meter('enemy-meter','enemy-fill',c.target.hp,c.target.maxHp);}
    doc?.querySelector?.('.combat-vitals')?.classList?.toggle('is-guarding',Boolean(c.guarding));
    doc?.querySelector?.('.combat-vitals')?.classList?.toggle('is-exhausted',Number(c.stamina)<24);
    for(const id of ['combat-dodge','combat-guard'])if($(id))$(id).disabled=!enabled||opened;
    if($('open-skills'))$('open-skills').disabled=!enabled&&!opened;
    const badge=$('skill-point-badge');if(badge){badge.hidden=!p.points;text('skill-point-badge',p.points);}
    for(let i=0;i<5;i++){
      const button=$('combat-slot-'+i);if(!button)continue;
      const id=p.loadout?.[i],node=nodes.find(node=>node.id===id),rank=node?rankOf(p,node):0,spell=node?resolved(state,node,rank):null,remaining=Math.max(0,Number(c.cooldowns?.[id])||0);
      text('slot-name-'+i,node?.name||'Empty slot');text('slot-cost-'+i,spell?(spell.stamina+' sta · R'+rank):'Learn a spell');
      const mark=$('slot-icon-'+i),kind=iconKind(node),signature=node?.id||'empty';
      if(mark&&mark.dataset?.icon!==signature){mark.innerHTML=node?icon(kind):'✧';if(mark.dataset)mark.dataset.icon=signature;}
      button.style.setProperty?.('--skill-color',COLORS[node?.branch]||'#9cac8e');button.classList?.toggle('is-empty',!node);button.classList?.toggle('is-casting',Boolean(c.casting&&(c.currentSpell===id||c.currentSpell?.id===id)));
      button.disabled=!enabled||opened||!node||remaining>0||Number(c.stamina)<spell.stamina;
      button.setAttribute?.('aria-label',node?node.name+', rank '+rank+', '+spell.stamina+' stamina'+(remaining>0?', ready in '+Math.ceil(remaining)+' seconds':''):'Spell slot '+(i+1)+' is empty. Open Skills to learn an ability.');
      const cooldown=$('slot-cooldown-'+i);if(cooldown){cooldown.hidden=remaining<=0;text('slot-cooldown-'+i,remaining>=1?Math.ceil(remaining):remaining.toFixed(1));}
    }
    if(opened){
      text('tree-level','Level '+p.level);text('tree-xp',p.level>=p.maxLevel?p.xp+' XP · maximum level':p.xpIntoLevel+' / '+p.xpForNext+' XP');
      text('tree-points',p.points);text('tree-points-plural',p.points===1?'':'s');
      const signature=JSON.stringify([p.skills,p.ranks,p.loadout,p.points,selected,school,query]);
      if(signature!==treeSignature){renderTree(p);renderDetail(p,state);treeSignature=signature;}
    }
  }
  function renderTree(p){
    const target=$('skill-branches');if(!target||!doc?.createElement)return;
    const remembered=doc.activeElement?.dataset?.skillNode,visible=visibleNodes();
    target.replaceChildren?.();if(!target.replaceChildren)target.innerHTML='';
    const spellCount=visible.filter(node=>node.kind==='active').length,passiveCount=visible.length-spellCount;
    text('spell-results',spellCount+' spell'+(spellCount===1?'':'s')+' · '+passiveCount+' passive upgrade'+(passiveCount===1?'':'s')+(query?' matching “'+query+'”':''));
    if(!visible.length)target.appendChild(elements('p','spell-empty','No spells match. Try another name or choose All schools.'));
    for(const branch of branches()){
      const own=visible.filter(node=>node.branch===branch.id);if(!own.length)continue;
      const group=elements('div','skill-branch'),learned=p.skills||{};group.dataset.branch=branch.id;group.style.setProperty?.('--branch-color',COLORS[branch.id]||branch.color);
      const emblem=elements('span','branch-emblem');emblem.innerHTML=icon(branch.id);emblem.setAttribute('aria-hidden','true');group.appendChild(emblem);
      group.appendChild(elements('h3','',branch.name));group.appendChild(elements('p','',branch.subtitle||''));
      for(const kind of ['active','passive']){
        const ownKind=own.filter(node=>node.kind===kind);if(!ownKind.length)continue;
        if(kind==='passive')group.appendChild(elements('span','passive-heading','Supporting upgrades'));
        const graph=elements('div',kind==='active'?'branch-graph':'branch-passives');
        for(const node of ownKind){
          const isLearned=Boolean(learned[node.id]),rank=rankOf(p,node),available=!isLearned&&(node.requires||[]).every(id=>learned[id])&&p.points>=node.cost;
          const button=elements('button','skill-node');button.type='button';button.dataset.skillNode=node.id;button.setAttribute('aria-pressed',String(selected===node.id));
          button.setAttribute('aria-label',node.name+', '+(isLearned?(kind==='active'?'rank '+rank+' of 3':'learned'):available?'available to learn':(node.requires||[]).some(id=>!learned[id])?'requires '+(node.requires||[]).map(id=>definitions().find(other=>other.id===id)?.name||id).join(', '):'needs a skill point'));
          button.classList?.toggle('is-learned',isLearned);button.classList?.toggle('is-available',available);button.classList?.toggle('is-selected',node.id===selected);
          const gem=elements('span','node-gem');gem.innerHTML=icon(iconKind(node));gem.setAttribute('aria-hidden','true');const status=elements('span','node-state',isLearned?'✓':available?'+':'·');gem.appendChild(status);button.appendChild(gem);button.appendChild(elements('span','node-title',node.name));
          button.appendChild(elements('span','node-rank',kind==='active'?(rank?'Rank '+rank+' / 3':'Unlearned'):'Passive'));
          button.onclick=()=>{selected=node.id;treeSignature='';update();};graph.appendChild(button);
        }
        group.appendChild(graph);
      }
      target.appendChild(group);
    }
    if(remembered)target.querySelector?.('[data-skill-node="'+remembered+'"]')?.focus?.({preventScroll:true});
    if($('skill-detail'))$('skill-detail').hidden=!visible.length;
  }
  function renderDetail(p,state){
    const nodes=definitions(),node=nodes.find(node=>node.id===selected)||visibleNodes()[0];if(!node)return;selected=node.id;
    const learned=Boolean(p.skills?.[node.id]),rank=rankOf(p,node),missing=(node.requires||[]).filter(id=>!p.skills?.[id]),active=node.kind==='active',spell=active?resolved(state,node,rank):node;
    const branch=branches().find(branch=>branch.id===node.branch);text('skill-detail-branch',branch?.name||node.branch);text('skill-detail-name',node.name);text('skill-detail-description',node.description);
    if($('skill-detail-icon'))$('skill-detail-icon').innerHTML=icon(iconKind(node));
    const meta=$('skill-detail-meta');if(meta){meta.replaceChildren?.();if(!meta.replaceChildren)meta.innerHTML='';for(const label of active?[spell.stamina+' STAMINA',number(spell.cooldown)+'s COOLDOWN','SPELL']:['PASSIVE','ALWAYS APPLIED'])meta.appendChild(elements('span','',label));}
    text('skill-rank-label',active?(learned?'Rank '+rank+' of 3':'Three ranks to master'):'One permanent upgrade');
    const stats=$('skill-stat-lines');if(stats){stats.replaceChildren?.();if(!stats.replaceChildren)stats.innerHTML='';
      for(const[key,label,suffix]of [['damage','Damage',''],['heal','Healing',' hearts'],['range','Reach',' px'],['radius','Radius',' px'],['duration','Duration','s'],['castTime','Wind-up','s']])if(typeof spell[key]==='number'&&spell[key]>0){const line=elements('div','spell-stat-line');line.appendChild(elements('span','',label));line.appendChild(elements('b','',number(spell[key])+suffix));stats.appendChild(line);}
    }
    text('skill-prerequisite',learned?(active?'Learned · equip in any of your five slots.':'Learned · this upgrade is already active.'):missing.length?'First learn '+missing.map(id=>nodes.find(other=>other.id===id)?.name||id).join(' and ')+'.':p.points?'Ready to learn · costs 1 skill point.':'Fight monsters or break camps to earn more skill points.');
    const learn=$('learn-skill');if(learn){learn.disabled=learned||missing.length>0||p.points<node.cost;learn.textContent=learned?'Learned ✓':'Learn · 1 point';}
    if($('spell-upgrade'))$('spell-upgrade').hidden=!active||!learned;
    const upgrade=$('upgrade-skill');if(upgrade){upgrade.disabled=!active||!learned||rank>=3||p.points<1;upgrade.textContent=rank>=3?'Mastered · rank 3':'Upgrade to rank '+(rank+1)+' · 1 point';}
    let improvement=node.upgradeDescription||'Improve this spell’s strength and reach.';
    if(rank>=3)improvement='Fully mastered. '+improvement;
    else if(active&&learned){
      const next=global.BloomSpells?.resolve?.(node.id,rank+1),base=global.BloomSpells?.resolve?.(node.id,rank),changes=[];
      if(next&&base)for(const[key,label,suffix]of [['damage','Damage',''],['heal','Healing',''],['range','Reach','px'],['radius','Radius','px'],['duration','Duration','s'],['cooldown','Cooldown','s'],['force','Push','px']]){
        if(typeof next[key]==='number'&&typeof base[key]==='number'&&next[key]!==base[key]){const from=Number(spell[key])||base[key],to=next[key]+from-base[key];changes.push(label+' '+number(from)+' → '+number(to)+suffix);}
      }
      if(changes.length)improvement+=' Next: '+changes.slice(0,3).join(' · ')+'.';
    }
    text('spell-upgrade-description',improvement);
    if($('skill-equip'))$('skill-equip').hidden=!learned||!active;
    for(let i=0;i<5;i++){const button=$('equip-skill-'+i);if(button){const equipped=p.loadout?.[i]===node.id;button.setAttribute('aria-pressed',String(equipped));button.setAttribute('aria-label',(equipped?'Equipped in slot ':'Equip '+node.name+' to slot ')+(i+1));button.textContent=String(i+1)+(equipped?' ✓':'');}}
  }
  global.BloomCombatUI={configure,update,open,close,isOpen:()=>opened};
})(window);
