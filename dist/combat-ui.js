/* The field journal and hotbar only present state; the game owns every action. */
(function(global){
  'use strict';
  const doc=typeof document==='undefined'?null:document;
  const $=id=>doc?.getElementById?.(id)||null;
  const COLORS={katana:'#dda6a1',bloomcraft:'#b4cb8a',stormy:'#9cc8ca'};
  const ICON_PATHS={
    katana:'<path d="M8 27 25 5l3-1-1 4L10 29M6 24l7 6M4 30l3 2 4-5"/><path d="m18 7 1-3m7 15 4-1M6 15l-3-1"/>',
    bloomcraft:'<path d="M7 28C4 15 14 6 28 5c1 15-7 23-21 23Z"/><path d="M5 31 23 11M11 25l-1-8m6 3 8-1m-5-5 1-6"/>',
    stormy:'<path d="M3 12h18c8 0 8-10 1-9-4 1-4 5-1 5M3 18h23c7 0 8 10 1 11-4 0-5-4-2-6M7 24h9c5 0 4 7 0 7"/>',
    finishing_cut:'<path d="M8 27 26 5l3-1-1 4L11 29M6 24l7 6M4 30l4 2 4-5M8 7l1-4m-5 8-3-1m21 16 4 2m-6 2 1 3"/>',
    petal_return:'<path d="M10 7C2 12 3 26 15 29c9 2 17-6 15-14M9 2l1 6-7 1"/><path d="m17 8 6 8-6 8-6-8Z"/>',
    lingering_roots:'<path d="M17 3v16m0-7c-9 0-12-4-12-8 7 0 12 2 12 8Zm0 4c9 0 12-4 12-8-7 0-12 2-12 8ZM17 19l-6 7-6 1m12-8 6 7 6 1m-12-5-1 9m-5-5 1 5m11-5-1 5"/>',
    deep_roots:'<path d="M17 3C6 4 5 18 17 22c12-4 11-18 0-19Zm0 5v23m0-8-7 6-5-1m12-5 7 6 5-1"/>',
    tailwind:'<path d="M2 10h18c7 0 7-8 1-8-3 0-4 3-2 4M2 17h25M2 24h15c6 0 6 8 1 8"/><path d="m23 12 6 5-6 5"/>',
    wind_ward:'<path d="M17 3 29 8v9c0 7-7 12-12 15C12 29 5 24 5 17V8Z"/><path d="M10 14h11c6 0 5-6 1-5M10 20h12m-12 5h7"/>'
  };
  let config={},configured=false,bound=false,opened=false,selected='petal_sweep',previousFocus=null,treeSignature='',lastFeedback='';
  const text=(id,value)=>{const element=$(id),next=String(value);if(element&&element.textContent!==next)element.textContent=next;};
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));
  const icon=kind=>'<svg viewBox="0 0 34 36" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(ICON_PATHS[kind]||ICON_PATHS.katana)+'</svg>';
  const iconKind=node=>ICON_PATHS[node?.id]?node.id:node?.branch||'katana';
  function elements(tag,className,content){const element=doc.createElement(tag);if(className)element.className=className;if(content!==undefined)element.textContent=String(content);return element;}
  function definitions(){return global.BloomProgression?.definitions||[];}
  function branches(){return global.BloomProgression?.branches||[{id:'katana',name:'Katana',subtitle:'Precision in every petal.'},{id:'bloomcraft',name:'Bloomcraft',subtitle:'A wild and patient strength.'},{id:'stormy',name:'Stormy',subtitle:'Never walk the road alone.'}];}
  function model(){
    const state=config.getState?.();if(!state)return null;
    const progression=global.BloomProgression?.snapshot?.(state)||{level:1,xp:0,xpIntoLevel:0,xpForNext:60,points:0,skills:{},loadout:[]};
    const combat=config.getCombat?.()||{};
    return{state,progression,combat,enabled:configured&&combat.enabled!==false};
  }
  function feedback(message,error=false){lastFeedback=message||'';text('skill-feedback',lastFeedback);$('skill-feedback')?.classList?.toggle('skill-feedback-error',Boolean(error));}
  function result(action){
    try{const value=action?.();feedback(value?.message||'Your path is saved.',value?.ok===false);treeSignature='';update();return value;}
    catch(error){feedback(error?.message||'That skill could not be changed.',true);return{ok:false};}
  }
  function action(key){const current=model();if(current?.enabled&&!opened)config.onAction?.(key);}
  function configure(options={}){config=options;configured=true;bind();update();}
  function bind(){
    if(bound||!doc)return;bound=true;
    if($('open-skills'))$('open-skills').onclick=()=>open();
    if($('close-skills'))$('close-skills').onclick=()=>close();
    if($('combat-dodge'))$('combat-dodge').onclick=()=>action('q');
    for(let i=0;i<3;i++){
      if($('combat-slot-'+i))$('combat-slot-'+i).onclick=()=>action(String(i+1));
      if($('equip-skill-'+i))$('equip-skill-'+i).onclick=()=>{if(opened)result(()=>config.onEquip?.(selected,i));};
    }
    if($('learn-skill'))$('learn-skill').onclick=()=>{if(opened)result(()=>config.onLearn?.(selected));};
    if($('respec-skills'))$('respec-skills').onclick=()=>{if(opened)result(()=>config.onRespec?.());};
    $('skill-overlay')?.addEventListener?.('click',event=>{if(event.target===$('skill-overlay'))close();});
    doc.addEventListener?.('keydown',event=>{
      if(!opened)return;
      if(event.key==='Escape'||event.key?.toLowerCase()==='k'){
        event.preventDefault();event.stopImmediatePropagation?.();event.stopPropagation?.();close();return;
      }
      // A modal journal must never pass movement, guard or attacks to the world.
      if(event.key==='Tab'){
        const focusable=[...($('skill-overlay')?.querySelectorAll?.('button:not(:disabled), [tabindex="0"]')||[])].filter(element=>!element.closest?.('[hidden]')&&(typeof element.getClientRects!=='function'||element.getClientRects().length));
        if(focusable.length){const first=focusable[0],last=focusable.at(-1),active=doc.activeElement;
          if(event.shiftKey&&(active===first||!focusable.includes(active))){event.preventDefault();last.focus?.();}
          else if(!event.shiftKey&&(active===last||!focusable.includes(active))){event.preventDefault();first.focus?.();}
        }
      }else if(!['Enter',' '].includes(event.key)){event.preventDefault();}
      if(!['Enter',' '].includes(event.key))event.stopPropagation?.();
    },true);
  }
  function open(){
    if(opened)return true;
    if(!configured||!$('skill-overlay')||!model()?.enabled)return false;
    if(config.onPause?.()===false)return false;
    previousFocus=doc?.activeElement||$('open-skills');opened=true;treeSignature='';
    $('skill-overlay').hidden=false;$('open-skills')?.setAttribute?.('aria-expanded','true');
    $('play-area')?.classList?.toggle('skills-open',true);feedback('Select a node to learn its effect.');update();$('close-skills')?.focus?.({preventScroll:true});return true;
  }
  function close(){
    if(!opened)return false;opened=false;
    if($('skill-overlay'))$('skill-overlay').hidden=true;$('open-skills')?.setAttribute?.('aria-expanded','false');
    $('play-area')?.classList?.toggle('skills-open',false);config.onResume?.();update();
    previousFocus?.focus?.({preventScroll:true});previousFocus=null;return true;
  }
  function meter(id,fill,value,maximum){const target=$(id),max=Math.max(1,Number(maximum)||1),amount=clamp(value,0,max);if(target){target.setAttribute?.('aria-valuemax',String(max));target.setAttribute?.('aria-valuenow',String(Math.round(amount)));}if($(fill))$(fill).style.width=(amount/max*100).toFixed(1)+'%';}
  function update(){
    const current=model();if(!current)return;
    const{progression:p,combat:c,enabled}=current,nodes=definitions();
    text('combat-level',String(p.level).padStart(2,'0'));text('stamina-value',Math.ceil(clamp(c.stamina,0,c.maxStamina||100))+' / '+(c.maxStamina||100));
    meter('health-meter','health-fill',current.state.hp??5,5);meter('stamina-meter','stamina-fill',c.stamina??100,c.maxStamina||100);meter('xp-meter','xp-fill',p.level>=p.maxLevel?1:p.xpIntoLevel,p.level>=p.maxLevel?1:p.xpForNext||1);
    text('combat-state',c.status|| (c.guarding?'GUARDING':c.dodging?'DODGING':'READY FOR THE ROAD'));
    if($('enemy-target'))$('enemy-target').hidden=!c.target;
    if(c.target){text('enemy-name',c.target.name);text('enemy-health',c.target.hp+' / '+c.target.maxHp);meter('enemy-meter','enemy-fill',c.target.hp,c.target.maxHp);}
    doc?.querySelector?.('.combat-vitals')?.classList?.toggle('is-guarding',Boolean(c.guarding));
    doc?.querySelector?.('.combat-vitals')?.classList?.toggle('is-exhausted',Number(c.stamina)<24);
    for(const id of ['combat-dodge','combat-guard'])if($(id))$(id).disabled=!enabled||opened;
    if($('open-skills'))$('open-skills').disabled=!enabled&&!opened;
    const badge=$('skill-point-badge');if(badge){badge.hidden=!p.points;text('skill-point-badge',p.points);}
    for(let i=0;i<3;i++){
      const button=$('combat-slot-'+i);if(!button)continue;
      const id=p.loadout?.[i],node=nodes.find(node=>node.id===id),remaining=Math.max(0,Number(c.cooldowns?.[id])||0);
      const display=node?.name||'Empty slot';text('slot-name-'+i,display);text('slot-cost-'+i,node?(node.stamina+' stamina'):'Learn a skill');
      const mark=$('slot-icon-'+i),kind=iconKind(node),signature=node?.id||'empty';
      if(mark&&mark.dataset?.icon!==signature){mark.innerHTML=node?icon(kind):'✧';if(mark.dataset)mark.dataset.icon=signature;}
      button.style.setProperty?.('--skill-color',COLORS[node?.branch]||'#9cac8e');button.classList?.toggle('is-empty',!node);
      button.disabled=!enabled||opened||!node||remaining>0||Number(c.stamina)<node.stamina;
      button.setAttribute?.('aria-label',node?node.name+', '+node.stamina+' stamina'+(remaining>0?', ready in '+Math.ceil(remaining)+' seconds':''):'Skill slot '+(i+1)+' is empty. Open Skills to learn an ability.');
      const cooldown=$('slot-cooldown-'+i);if(cooldown){cooldown.hidden=remaining<=0;text('slot-cooldown-'+i,remaining>=1?Math.ceil(remaining):remaining.toFixed(1));}
    }
    if(opened){
      text('tree-level','Level '+p.level);text('tree-xp',p.level>=p.maxLevel?p.xp+' XP · maximum level':p.xpIntoLevel+' / '+p.xpForNext+' XP');
      text('tree-points',p.points);text('tree-points-plural',p.points===1?'':'s');
      const signature=JSON.stringify([p.skills,p.loadout,p.points,selected]);
      if(signature!==treeSignature){renderTree(p);renderDetail(p);treeSignature=signature;}
    }
  }
  function renderTree(p){
    const target=$('skill-branches');if(!target||!doc?.createElement)return;
    const remembered=doc.activeElement?.dataset?.skillNode;
    target.replaceChildren?.();if(!target.replaceChildren)target.innerHTML='';
    for(const branch of branches()){
      const group=elements('div','skill-branch'),learned=p.skills||{};group.dataset.branch=branch.id;group.style.setProperty?.('--branch-color',COLORS[branch.id]||branch.color);
      const own=definitions().filter(node=>node.branch===branch.id),base=own.find(node=>!node.requires?.length);
      group.classList?.toggle('has-root',Boolean(base&&learned[base.id]));
      const emblem=elements('span','branch-emblem');emblem.innerHTML=icon(branch.id);emblem.setAttribute('aria-hidden','true');group.appendChild(emblem);
      group.appendChild(elements('h3','',branch.name));group.appendChild(elements('p','',branch.subtitle||''));
      const graph=elements('div','branch-graph');
      for(const node of own){
        const isLearned=Boolean(learned[node.id]),available=!isLearned&&(node.requires||[]).every(id=>learned[id])&&p.points>=node.cost;
        const button=elements('button','skill-node');button.type='button';button.dataset.skillNode=node.id;button.setAttribute('aria-pressed',String(selected===node.id));
        button.setAttribute('aria-label',node.name+', '+(isLearned?'learned':available?'available to learn':(node.requires||[]).some(id=>!learned[id])?'requires '+(node.requires||[]).map(id=>definitions().find(other=>other.id===id)?.name||id).join(', '):'needs a skill point'));
        button.classList?.toggle('is-learned',isLearned);button.classList?.toggle('is-available',available);button.classList?.toggle('is-selected',node.id===selected);
        const gem=elements('span','node-gem');gem.innerHTML=icon(iconKind(node));gem.setAttribute('aria-hidden','true');const status=elements('span','node-state',isLearned?'✓':available?'+':'·');gem.appendChild(status);button.appendChild(gem);button.appendChild(elements('span','node-title',node.name));
        button.onclick=()=>{selected=node.id;treeSignature='';update();};graph.appendChild(button);
      }
      group.appendChild(graph);target.appendChild(group);
    }
    if(remembered)target.querySelector?.('[data-skill-node="'+remembered+'"]')?.focus?.({preventScroll:true});
  }
  function renderDetail(p){
    const nodes=definitions(),node=nodes.find(node=>node.id===selected)||nodes[0];if(!node)return;selected=node.id;
    const learned=Boolean(p.skills?.[node.id]),missing=(node.requires||[]).filter(id=>!p.skills?.[id]),active=node.kind==='active';
    const branch=branches().find(branch=>branch.id===node.branch);text('skill-detail-branch',branch?.name||node.branch);text('skill-detail-name',node.name);text('skill-detail-description',node.description);
    if($('skill-detail-icon'))$('skill-detail-icon').innerHTML=icon(iconKind(node));
    const meta=$('skill-detail-meta');if(meta){meta.replaceChildren?.();if(!meta.replaceChildren)meta.innerHTML='';for(const label of active?[node.stamina+' STAMINA',node.cooldown+'s COOLDOWN','ACTIVE']:['PASSIVE','ALWAYS APPLIED'])meta.appendChild(elements('span','',label));}
    text('skill-prerequisite',learned?(active?'Learned · equip below to use it on the road.':'Learned · this upgrade is already active.'):missing.length?'First learn '+missing.map(id=>nodes.find(other=>other.id===id)?.name||id).join(' and ')+'.':p.points?'Ready to learn · costs 1 skill point.':'Earn XP by fighting monsters or breaking camps for another point.');
    const learn=$('learn-skill');if(learn){learn.disabled=learned||missing.length>0||p.points<node.cost;learn.textContent=learned?'Learned ✓':'Learn · 1 point';}
    if($('skill-equip'))$('skill-equip').hidden=!learned||!active;
    for(let i=0;i<3;i++){const button=$('equip-skill-'+i);if(button){const equipped=p.loadout?.[i]===node.id;button.setAttribute('aria-pressed',String(equipped));button.setAttribute('aria-label',(equipped?'Equipped in slot ':'Equip '+node.name+' to slot ')+(i+1));button.textContent=String(i+1)+(equipped?' ✓':'');}}
  }
  global.BloomCombatUI={configure,update,open,close,isOpen:()=>opened};
})(window);
