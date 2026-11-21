/* The six Thornhearts continue the opening chapter; story guardians never replay. */
(function(global){
  'use strict';
  const ARENA='medusa_garden',BOSS='medusa-thornheart',REMEDY='herbalists_remedy';
  const GUARDIANS=Object.freeze([
    {id:'medusa',name:'Medusa',road:'lavenderway',town:'lavendyr',quest:REMEDY,route:'combat-or-quest',power:'medusa_blessing',powerName:'Medusa’s Blessing',memory:'The Lord of Thorns’ first appearance',implemented:true},
    {id:'nemean_lion',name:'Nemean Lion',road:'foxglove',town:'sunveil',quest:'forgotten_sanctuary',route:'combat-or-quest',power:'lionheart',powerName:'Lionheart',memory:'The ruined sanctuaries',implemented:false},
    {id:'hydra',name:'Hydra',road:'marigold',town:'tidepetal',quest:null,route:'mandatory-battle',power:'hydras_renewal',powerName:'Hydra’s Renewal',memory:'The poisoned river',implemented:false},
    {id:'scylla',name:'Scylla',road:'coastroad',town:'hydrangea',quest:'song_beneath_the_waves',route:'combat-or-quest',power:'tidal_grace',powerName:'Tidal Grace',memory:'The corrupted song',implemented:false},
    {id:'asterion',name:'Asterion',road:'nightshade',town:'thornrose',quest:'warriors_oath',route:'combat-or-quest',power:'asterions_resolve',powerName:'Asterion’s Resolve',memory:'The failed rebellion',implemented:false},
    {id:'chimera',name:'Chimera',road:'moonpath',town:'moonblossom',quest:null,route:'mandatory-battle',power:'chimeras_trinity',powerName:'Chimera’s Trinity',memory:'The final path to Raeez',implemented:false}
  ].map(Object.freeze));
  const QUESTS=Object.freeze([
    {id:REMEDY,name:'The Herbalist’s Remedy',guardian:'medusa',implemented:true},
    {id:'forgotten_sanctuary',name:'The Forgotten Sanctuary',guardian:'nemean_lion',implemented:false},
    {id:'song_beneath_the_waves',name:'The Song Beneath the Waves',guardian:'scylla',implemented:false},
    {id:'warriors_oath',name:'The Warrior’s Oath',guardian:'asterion',implemented:false}
  ].map(Object.freeze));
  const HERBS=Object.freeze([
    {id:'remedy_sage',node:'remedy-sage',landmark:'remedySage',name:'Silver Sage',at:[480,240]},
    {id:'remedy_rosemary',node:'remedy-rosemary',landmark:'remedyRosemary',name:'Sun Rosemary',at:[768,536]},
    {id:'remedy_thyme',node:'remedy-thyme',landmark:'remedyThyme',name:'Clear Thyme',at:[1632,288]}
  ].map(Object.freeze));
  const RESTORATIONS=['dryingShed','streamBridge','greenhouse'];
  const MEMORY='Before the roads sickened, a stranger in a thorn cloak stood in Medusa’s garden. He asked where two hearts could hide from him. When she refused, his thorns took root behind her eyes. “Amaal and Raeez,” he whispered. “Together, they could wake the sleeping tree.”';
  const object=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
  const lines=(speaker,...text)=>text.map(line=>[speaker,line]);
  let config={},maps={},world={},atlas={},time=0,pulse=0;
  const saved=()=>config.getState?.()||{},area=()=>String(config.getArea?.()||saved().area||''),hero=()=>config.getHero?.()||{x:0,y:0,face:'up'};
  const unlocked=()=>Number(saved().journey?.stage)>=7;
  function state(){
    const s=saved(),c=s.campaign=object(s.campaign);c.version=1;
    c.guardians=object(c.guardians);c.quests=object(c.quests);c.powers=object(c.powers);c.memories=object(c.memories);c.restorations=object(c.restorations);c.rewards=object(c.rewards);
    for(const def of GUARDIANS){
      const g=c.guardians[def.id]=object(c.guardians[def.id]);g.id=def.id;
      if(!['dormant','bound','exposed','purified'].includes(g.status))g.status=def.implemented&&unlocked()?'bound':'dormant';
      if(def.implemented&&unlocked()&&g.status==='dormant')g.status='bound';
      if(!['combat','remedy'].includes(g.route))g.route=null;
      if(g.status==='purified'){c.powers[def.power]=true;c.memories[def.id]=true;}
    }
    for(const def of QUESTS){
      const q=c.quests[def.id]=object(c.quests[def.id]);q.id=def.id;
      if(!['locked','available','active','ready','completed'].includes(q.status))q.status=def.implemented&&unlocked()?'available':'locked';
      if(def.implemented&&unlocked()&&q.status==='locked')q.status='available';
      q.flags=object(q.flags);q.collected=object(q.collected);
      q.stage=Math.max(0,Math.min(6,Math.floor(Number(q.stage)||0)));
    }
    s.inventory=object(s.inventory);
    if(c.guardians.medusa.status==='purified'){
      c.restorations.lavenderway=object(c.restorations.lavenderway);
      for(const id of RESTORATIONS)c.restorations.lavenderway[id]=true;
      c.restorations.lavenderway.animals=true;
    }
    return c;
  }
  const guardian=()=>state().guardians.medusa,quest=()=>state().quests[REMEDY];
  function changed(){config.onSave?.();}
  function reward(id,xp){
    const c=state(),key='campaign:'+id;
    if(c.rewards[id]===true||saved().progression?.claimedRewards?.[key]===true){c.rewards[id]=true;return false;}
    c.rewards[id]=true;config.onReward?.({id:key,xp,kind:'guardian'});return true;
  }
  function landmark(id,fallback){const mark=maps.lavenderway?.questLandmarks?.[id];return Array.isArray(mark)?{x:mark[0],y:mark[1]}:Number.isFinite(mark?.x)&&Number.isFinite(mark?.y)?mark:{x:fallback[0],y:fallback[1]};}
  function point(id,x,y,label,range=30){return{type:'campaign',id,x,y,label,range};}
  function roadPoint(id,key,fallback,label,range=30){const at=landmark(key,fallback);return point(id,at.x,at.y,label,range);}
  function arena(){
    const w=36,h=28,tiles=Array.from({length:h},(_,y)=>Array.from({length:w},(_,x)=>Math.hypot(x-17.5,y-12.5)<11.5||x>=16&&x<=19&&y>=22&&y<=26?'c':'s').join(''));
    const objects=[];
    if(atlas.rock2)for(const[x,y]of[[144,112],[432,112],[112,256],[464,256]])objects.push({sprite:'rock2',x,y,scale:.75,hit:[x-10,y-6,20,6],label:'A stone from the garden’s broken ring',campaignDecor:true});
    return{id:ARENA,name:'Medusa’s Ruined Garden',kind:'dungeon',theme:'lavender',safe:false,w,h,tiles,spawn:[288,384],objects,signs:[],exits:[],residents:[],animals:[],camps:[],tilePalette:{c:'cobble_mossy',s:'stone'},portals:[{x:288,y:408,target:'lavenderway',at:[2112,312],label:'Return to Lavenderway Fields',kind:'return'}],storyGuardian:'medusa'};
  }
  function bossCamp(){return{id:BOSS,name:'Medusa',guardianId:'medusa',storyGuardian:true,boss:true,hidden:true,clearOnDefeat:true,monster:'medusa',monsterName:'Medusa',monsterHealth:34,monsterDamage:2,monsterSpeed:25,totalSpawns:1,maxAlive:1,rewardXp:1,x:288,y:176,spawnPoints:[[288,176]],leash:210};}
  function applyArena(){
    const map=maps[ARENA];if(!map)return;const g=guardian();
    map.camps=config.approvedMedusaAsset===true&&g.battleStarted===true&&g.status==='bound'?[bossCamp()]:[];
    map.guardianPurified=g.status==='purified';
  }
  function applyRestoration(){
    const restored=guardian().status==='purified',road=maps.lavenderway;if(!road)return;
    road.campaignRestored=restored;
    for(const source of road.objects||[]){
      const id=source.campaignLandmark||source.questLandmark;if(!RESTORATIONS.includes(id))continue;
      if(!own(source,'campaignOriginalLabel'))source.campaignOriginalLabel=source.label;
      if(!own(source,'campaignOriginalSprite'))source.campaignOriginalSprite=source.sprite;
      source.label=restored?({dryingShed:'The reopened herb-drying shed',streamBridge:'The restored stream bridge',greenhouse:'The living greenhouse'})[id]:source.campaignOriginalLabel;
      source.sprite=restored&&atlas[source.restoredSprite]?source.restoredSprite:source.campaignOriginalSprite;
    }
  }
  function configure(options={}){config=options;state();applyArena();applyRestoration();}
  function install(nextMaps,nextWorld={},nextAtlas={}){
    maps=nextMaps||{};world=nextWorld||{};atlas=nextAtlas||{};
    if(!maps[ARENA])maps[ARENA]=arena();
    world.guardians=GUARDIANS.map(def=>({...def}));
    world.dungeons=[...(world.dungeons||[]).filter(entry=>entry.id!==ARENA),{id:ARENA,name:'Medusa’s Ruined Garden',from:'lavenderway',story:true,replayable:false,description:'One Thornheart. Remedy or battle, followed by purification.'}];
    applyArena();applyRestoration();return maps[ARENA];
  }
  function offer(){
    const g=guardian(),q=quest();if(g.status==='purified')return lines('Maera','The medicinal gardens are open. Even the stone-pale animals have begun to stir. Medusa remembers who she was.','The thorn-cloaked stranger in her memory may know where Raeez is sleeping. Follow that clue when the eastern road is ready.');
    if(g.status==='exposed')return lines('Maera','Her Thornheart is exposed. Return to the ruined garden and touch the heart to purify it.');
    if(q.status==='available'){q.status='active';q.stage=1;changed();return lines('Maera','Raeez’s field note was only the beginning. Lavenderway’s garden protector is still bound: Medusa. Her gaze was turned against the creatures she guarded.','I can teach you The Herbalist’s Remedy. Gather one Silver Sage at the western fork, one Sun Rosemary beside the drying shed, and one Clear Thyme near the greenhouse approach.','Inspect the hidden greenhouse beyond the last road bend. Its remedy bench holds the exact recipe. Brew the antidote, then offer it at the ruined circular garden. It can expose her Thornheart without a battle.','You may instead challenge her in that garden. Either way, the exposed Thornheart must be purified.');}
    return lines('Maera',q.flags.brewed?'Your antidote is ready. Take it to the ruined garden, north of Lavenderway’s eastern bend.':q.flags.greenhouse?'The greenhouse recipe needs one Silver Sage, one Sun Rosemary and one Clear Thyme. Gather the missing herbs, then use its remedy bench.':'Look for the three marked herb beds along Lavenderway. Then inspect the hidden greenhouse beside its eastern bend.','A battle and the remedy lead to the same blessing. Choose how you reach Medusa; her life can be saved in either path.');
  }
  function dialogueFor(actor){
    if(!unlocked()||!actor)return null;actor=actor.actor||actor;const id=String(actor.id||''),name=actor.name||'Neighbour';
    if(id==='lavendyr_maera'||name==='Maera')return offer();
    if(id==='stormy-companion')return lines(name,guardian().status==='purified'?'She remembered a stranger asking about two hearts. Yours and Raeez’s. We should remember that too.':'The guardian’s gaze is a curse, Amaal. There may be a gentler way to reach her.');
    if(guardian().status==='purified'&&(actor.homeTown==='lavendyr'||id.startsWith('lavendyr_')))return lines(name,'The drying shed is busy again, the stream bridge is clear, and there are new leaves in the greenhouse.','I saw a little animal shake off its stone sleep. Thank you for bringing our garden protector home.');
    return null;
  }
  function nodes(id=area()){
    if(!unlocked())return[];const g=guardian(),q=quest(),result=[];
    if(id==='lavendyr_0')return[point('remedy-ledger',224,208,'Read Maera’s next remedy ledger')];
    if(id==='lavenderway'){
      result.push(roadPoint('roadside-remedy','apothecaryWagon',[416,320],'Read the roadside herbalist’s remedy ledger'));
      if(q.status!=='available'&&g.status!=='purified')for(const herb of HERBS)result.push(roadPoint(herb.node,herb.landmark,herb.at,(q.collected[herb.id]?'Check the gathered ': 'Gather ')+herb.name));
      result.push(roadPoint('hidden-greenhouse','greenhouse',[1840,272],g.status==='purified'?'Visit the reopened greenhouse':!q.flags.greenhouse?'Inspect the hidden greenhouse':q.flags.brewed?'Check the remedy bench':'Brew Maera’s antidote · 3 herbs',36));
      result.push(roadPoint('ruined-garden','arenaApproach',[2112,288],g.status==='purified'?'Visit Medusa’s peaceful garden':'Enter Medusa’s ruined garden',34));
      if(g.status==='purified')for(const key of RESTORATIONS)if(key!=='greenhouse')result.push(roadPoint('restored-'+key,key,key==='dryingShed'?[736,488]:[904,336],key==='dryingShed'?'Visit the reopened drying shed':'Inspect the restored stream bridge'));
    }
    if(id===ARENA){
      result.push(point('garden-inscription',288,352,'Read the ruined garden’s inscription',34));
      if(g.status==='bound'&&(!g.battleStarted||config.approvedMedusaAsset!==true))result.push(point('medusa-approach',288,256,q.flags.brewed?'Offer the antidote to Medusa':'Challenge the bound garden protector',44));
      if(g.status==='bound'&&g.battleStarted&&q.flags.brewed)result.push(point('medusa-antidote',224,256,'Offer the antidote · end the battle',34));
      if(g.status==='bound'&&!g.battleStarted&&q.flags.brewed)result.push(point('medusa-challenge',352,256,'Choose battle with Medusa',30));
      if(g.status==='exposed')result.push(point('purify-medusa',288,208,'Purify Medusa’s exposed Thornheart',42));
      if(g.status==='purified')result.push(point('freed-medusa',288,208,'Listen to Medusa’s memory',42));
    }
    return result;
  }
  function nearby(from=hero(),id=area()){
    if(typeof from==='string'){const swapped=id;id=from;from=swapped&&typeof swapped==='object'?swapped:hero();}
    let nearest=null;for(const node of nodes(id)){const d=Math.hypot(from.x-node.x,from.y-node.y);if(d<node.range&&(!nearest||d<nearest.d))nearest={...node,d};}return nearest;
  }
  function ingredientsReady(){return HERBS.every(herb=>Number(saved().inventory[herb.id])>=1);}
  function expose(route){
    const g=guardian();if(!unlocked()||g.status!=='bound')return false;g.status='exposed';g.route=route;g.battleStarted=false;
    const q=quest();q.stage=5;if(q.status!=='available')q.status='ready';applyArena();pulse=2;changed();return true;
  }
  function purify(id='medusa'){
    // Later guardians remain staged definitions; no generic interaction can award them.
    if(id!=='medusa'||!unlocked()||area()!==ARENA||guardian().status!=='exposed')return{ok:false};
    const c=state(),g=c.guardians.medusa,q=c.quests[REMEDY];g.status='purified';g.battleStarted=false;
    c.powers.medusa_blessing=true;c.memories.medusa=true;c.restorations.lavenderway={...object(c.restorations.lavenderway),dryingShed:true,streamBridge:true,greenhouse:true,animals:true};
    q.status='completed';q.stage=6;q.flags.purified=true;
    saved().inventory.medusa_antidote=0;applyArena();applyRestoration();pulse=3;
    const granted=reward('guardian:medusa:purified',180);
    if(granted)config.onGrantPower?.('medusa_blessing',{guardian:'medusa',permanent:true});
    config.onHeal?.(5);changed();return{ok:true,purified:true,lines:lines('Medusa','The thorns are quiet. I can look at my garden again. You gave me back my own eyes.',MEMORY,'Medusa’s Blessing is permanent: a successful parry briefly slows nearby enemies.','On Lavenderway, the drying shed reopens, the stream bridge clears, and the greenhouse flowers again. The petrified animals awaken.')};
  }
  function interact(target){
    if(!target||!unlocked())return{ok:false};const node=nodes().find(item=>item.id===target.id);
    if(!node||Math.hypot(hero().x-node.x,hero().y-node.y)>=node.range)return{ok:false};
    const g=guardian(),q=quest();let result;
    const herb=HERBS.find(item=>item.node===node.id);
    if(herb){
      if(q.collected[herb.id])result=lines('Herb bed','The '+herb.name+' root remains planted. You already gathered the portion for Maera’s remedy.');
      else{q.collected[herb.id]=true;saved().inventory[herb.id]=Math.max(0,Math.floor(Number(saved().inventory[herb.id])||0))+1;q.stage=Math.max(q.stage,2);result=lines('Amaal',herb.name+' gathered. The roots stay in the ground. This portion is reserved for Maera’s antidote.');}
    }else switch(node.id){
      case'remedy-ledger':case'roadside-remedy':result=offer();break;
      case'hidden-greenhouse':
        if(g.status==='purified'){result=lines('Greenhouse','Clear glass catches the light. The medicinal beds are growing again. Medusa has left rare seeds here for the village.');break;}
        if(q.status==='available'){result=lines('Amaal','A sealed remedy bench. Maera or the roadside herbalist’s ledger may explain what happened here.');break;}
        if(!q.flags.greenhouse){q.flags.greenhouse=true;q.flags.recipeRead=true;q.stage=Math.max(q.stage,3);result=lines('Greenhouse ledger','The Herbalist’s Remedy: crush one Silver Sage, steep with one Sun Rosemary, then strain through one Clear Thyme. Use the bench again to brew the three gathered herbs.','Do not drink the antidote. Offer it to the bound protector in the circular garden; it draws the curse away from her Thornheart.');break;}
        if(q.flags.brewed){result=lines('Remedy bench','The antidote is already sealed in your satchel. Take it to Medusa in the ruined garden.');break;}
        if(!ingredientsReady()){result=lines('Remedy bench','Recipe: 1 Silver Sage + 1 Sun Rosemary + 1 Clear Thyme. Missing: '+HERBS.filter(item=>!(Number(saved().inventory[item.id])>=1)).map(item=>item.name).join(', ')+'.');break;}
        for(const item of HERBS)saved().inventory[item.id]--;
        saved().inventory.medusa_antidote=1;q.flags.brewed=true;q.stage=4;q.status='ready';result=lines('Amaal','Sage crushed, rosemary steeped, thyme strained. The three herbs settle into a clear antidote.','I’ll offer it at Medusa’s ruined garden. Once her Thornheart is exposed, I can purify it.');break;
      case'ruined-garden':applyArena();config.onEnter?.(ARENA,{at:[288,384]});changed();return{ok:true,entered:true};
      case'garden-inscription':result=lines('Garden inscription','A Thornheart binds the protector. Expose it with Maera’s brewed antidote, or weaken the guardian in battle.','When the heart is bare, approach and purify it. Neither path asks you to kill the one inside.');break;
      case'medusa-approach':case'medusa-challenge':case'medusa-antidote':
        if(node.id!=='medusa-challenge'&&q.flags.brewed&&Number(saved().inventory.medusa_antidote)>0){const wasBattle=g.battleStarted===true;saved().inventory.medusa_antidote--;expose('remedy');if(wasBattle)config.onEnter?.(ARENA,{at:[288,256]});result=lines('Amaal','The antidote threads through the crystal flowers. Medusa’s gaze softens; the dark Thornheart opens before her.','No battle is needed. I can reach the exposed heart and purify it.');}
        else if(config.approvedMedusaAsset!==true)result=lines('Ruined garden','Medusa waits beyond the crystal veil. The herbalist’s remedy can reach her through it.');
        else{g.battleStarted=true;g.route='combat';applyArena();changed();config.onEnter?.(ARENA,{at:[288,304]});return{ok:true,entered:true,battle:true,lines:lines('Medusa','Stay back. These eyes are no longer mine.','Watch the gaze, evade the serpent lash, and leave the crystal marks before they bloom.')};}break;
      case'purify-medusa':return purify();
      case'freed-medusa':result=lines('Medusa',MEMORY,g.route==='remedy'?'You listened for the gardener beneath the curse. Maera’s three herbs were once the first lesson I taught her.':'You held your ground against the curse and stopped when my heart was bare. That restraint is the oath of a protector.','My garden is yours to rest in. The blessing I gave you will not fade when you change your spells.');break;
      case'restored-dryingShed':result=lines('Drying shed','Fresh sage and rosemary hang from the reopened rafters. Village remedies can travel the road again.');break;
      case'restored-streamBridge':result=lines('Stream bridge','The dark roots have drawn back from the little bridge. Clear water runs beneath its stones.');break;
      default:return{ok:false};
    }
    changed();return{ok:true,lines:result||[]};
  }
  function onCampClear(camp,id=area()){
    if(id!==ARENA||camp?.guardianId!=='medusa'&&camp?.id!==BOSS||guardian().status!=='bound'||!guardian().battleStarted)return false;
    if(expose('combat')){config.onMessage?.('Medusa’s Thornheart is exposed. Approach the heart and purify it.');return true;}return false;
  }
  function onBossDefeat(event={}){return onCampClear(event.camp||event,event.area||area());}
  function onSpell(event={}){
    const id=typeof event==='string'?event:event.id||event.spellId,from=event.hero||hero();
    if(area()!==ARENA||guardian().status!=='exposed'||!['healing_bloom','briar_bind'].includes(id)||Math.hypot(from.x-288,from.y-208)>72)return false;
    const result=purify();if(result.ok)config.onMessage?.('Medusa is free. Her blessing and first memory are recorded in the journal.');return result.ok;
  }
  function combatProfile(id=area()){
    if(id!==ARENA||config.approvedMedusaAsset!==true)return null;
    return{name:'Medusa',guardianId:'medusa',health:34,speed:25,damage:2,attackKind:'cone',combat:{poise:7,warning:1.15,recovery:.65},attackCycle:['gaze','serpent_lash','crystal_trap'],phaseTwoCycle:['gaze','serpent_lash','crystal_trap','serpent_lash'],gazeRange:110,gazeWarning:1.15,lashRange:65,crystalRadius:32,phaseTwoAt:.5};
  }
  function modifiers(){return{parrySlow:state().powers.medusa_blessing===true?.55:0,parrySlowDuration:state().powers.medusa_blessing===true?2.1:0,parrySlowRadius:state().powers.medusa_blessing===true?100:0};}
  function onParry(event={}){
    const mod=modifiers();if(!mod.parrySlow)return null;const from=event.hero||hero();pulse=.65;
    return{slow:{x:from.x,y:from.y,radius:mod.parrySlowRadius,duration:mod.parrySlowDuration,multiplier:1-mod.parrySlow,amount:mod.parrySlow},power:'medusa_blessing'};
  }
  function journal(){
    if(!unlocked())return null;const c=state(),g=c.guardians.medusa,q=c.quests[REMEDY];let objective;
    if(g.status==='purified')objective='Medusa is free. Her first memory names a thorn-cloaked stranger who feared Amaal and Raeez together. The next guardian regions are still ahead.';
    else if(g.status==='exposed')objective='Purify Medusa’s exposed Thornheart in the ruined circular garden.';
    else if(g.battleStarted)objective='Face Medusa in the ruined garden: evade her gaze, serpent lash and crystal marks. Then purify the exposed Thornheart.';
    else if(q.flags.brewed)objective='Offer Maera’s brewed antidote to Medusa in the ruined garden, north of Lavenderway’s eastern bend.';
    else if(q.flags.greenhouse)objective='Brew the greenhouse recipe: 1 Silver Sage + 1 Sun Rosemary + 1 Clear Thyme. Gather missing herbs from the marked roadside beds.';
    else if(q.status==='available')objective='Raeez’s trail continues. Ask Maera about Lavenderway’s bound garden protector, or read the roadside herbalist’s ledger.';
    else objective='Gather Silver Sage (western fork), Sun Rosemary (drying shed), and Clear Thyme (greenhouse approach). Inspect the hidden greenhouse on eastern Lavenderway.';
    return{title:'The Six Thornhearts · Lavenderway',chapter:2,stage:q.stage,objective,entries:[
      'The Briarvault Guardian was a root-cellar trial; it was not Asterion, the guardian of Nightshade Woods.',
      'Medusa: '+g.status+(g.route?' · '+g.route+' route':' · remedy or battle')+'.',
      'Remedy herbs: '+HERBS.map(item=>item.name+' '+(q.collected[item.id]?'gathered':'needed')).join(' · ')+'.',
      ...(g.status==='purified'?['Memory — '+MEMORY,'Permanent power — Medusa’s Blessing: successful parries slow nearby enemies for 2.1 seconds.','Restored: herb-drying shed, stream bridge, hidden greenhouse; petrified animals awaken.']:[]),
      'Later: Nemean Lion, Hydra, Scylla, Asterion, Chimera. These five guardian chapters are staged; their encounters and quests are not open yet.',
      'Hydra and Chimera require battle. The Lion, Scylla and Asterion will also have quest paths.'
    ],guardians:GUARDIANS.map(def=>({id:def.id,name:def.name,status:c.guardians[def.id].status,implemented:def.implemented,route:def.route}))};
  }
  function itemInfo(id){
    const herb=HERBS.find(item=>item.id===id);if(herb)return{name:herb.name,category:'quest',description:'One measured herb portion reserved for Maera’s greenhouse antidote. Not food.'};
    if(id==='medusa_antidote')return{name:'Medusa’s Antidote',category:'quest',description:'Silver Sage, Sun Rosemary and Clear Thyme, brewed at the hidden greenhouse. Offer to Medusa; do not drink.'};return null;
  }
  function update(dt){const step=Math.max(0,Math.min(.1,Number(dt)||0));time+=step;pulse=Math.max(0,pulse-step);}
  function draw(g,cam={x:0,y:0}){
    if(!g||!unlocked())return;const current=area(),c=state(),medusa=c.guardians.medusa;g.save();
    if(current==='lavenderway'&&medusa.status==='purified')for(const[key,fallback]of[['dryingShed',[736,488]],['streamBridge',[904,336]],['greenhouse',[1840,272]]]){
      const at=landmark(key,fallback),x=Math.round(at.x-cam.x),y=Math.round(at.y-cam.y);g.fillStyle='#6c9a5b';
      for(let i=0;i<13;i++)g.fillRect(x-25+(i*17)%51,y-8+(i*11)%23,2,5);
      g.fillStyle='#eadc9a';for(let i=0;i<6;i++)g.fillRect(x-22+i*9,y+3+(i%2)*5,3,2);
    }
    if(current===ARENA){
      const x=288-cam.x,y=208-cam.y;
      if(!medusa.battleStarted&&config.approvedMedusaAsset===true)config.drawGuardian?.(g,cam,{x:288,y:208,status:medusa.status});
      g.strokeStyle=medusa.status==='purified'?'#b9d894':'#9384b2';g.lineWidth=1;g.beginPath();g.ellipse(x,y+2,48,16,0,0,Math.PI*2);g.stroke();
      if(medusa.status==='exposed'){
        const bob=Math.sin(time*3)*2;g.fillStyle='#f0bbc5';g.fillRect(Math.round(x-5),Math.round(y-26+bob),10,12);g.fillRect(Math.round(x-3),Math.round(y-29+bob),6,18);g.fillStyle='#fff0cc';g.fillRect(Math.round(x-1),Math.round(y-25+bob),2,8);
      }
      if(medusa.status==='purified'){g.fillStyle='#8db56d';for(let i=0;i<20;i++)g.fillRect(x-60+(i*19)%120,y-8+(i*13)%32,2,6);g.fillStyle='#eadc9a';for(let i=0;i<9;i++)g.fillRect(x-48+i*12,y+(i%3)*7,3,2);}
    }
    if(pulse>0&&c.powers.medusa_blessing===true){const h=hero();g.strokeStyle='#d0d7f0';g.globalAlpha=Math.min(.6,pulse);g.beginPath();g.ellipse(h.x-cam.x,h.y-cam.y,24+(1-Math.min(1,pulse))*18,8,0,0,Math.PI*2);g.stroke();}
    g.restore();
  }
  global.BloomCampaign=Object.freeze({configure,install,nodes,nearby,interact,dialogueFor,journal,itemInfo,onSpell,onCampClear,onBossDefeat,update,draw,modifiers,onParry,combatProfile,purify,definitions:GUARDIANS,questDefinitions:QUESTS,ingredients:HERBS,arenaId:ARENA,bossId:BOSS});
})(window);
