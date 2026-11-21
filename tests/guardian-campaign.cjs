'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../dist'),read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
function fixture(old={},approved=false){
  let saved={hp:5,note:true,inventory:{apple:7,legacy_keepsake:2},journey:{stage:7,run:2,runComplete:true},clearedCamps:{'lavenderway:camp-1':true},defeatedMonsters:{},campProgress:{},worldClock:{day:4,minutes:800},...old};
  const maps=read('fixed-maps.json'),world=read('world.json'),atlas=read('assets/world-v05.json'),C={window:{},Math,JSON};vm.createContext(C);
  for(const file of ['spell-catalog.js','progression.js','combat.js','guardian-campaign.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),C,{filename:file});
  const api=C.window.BloomCampaign,combat=C.window.BloomCombat,progression=C.window.BloomProgression,hero={x:224,y:208,face:'up'};
  let areaId='lavendyr_0',saves=0,heals=0;const rewards=[],powers=[],entries=[],messages=[];
  const configure=flag=>api.configure({getState:()=>saved,getArea:()=>areaId,getHero:()=>hero,approvedMedusaAsset:flag,
    onSave:()=>saves++,onReward:r=>{rewards.push(r);progression.grant(saved,r.id,r.xp);},onGrantPower:(...args)=>powers.push(args),onMessage:text=>messages.push(text),onHeal:()=>{heals++;saved.hp=5;},
    onEnter:(id,opts)=>{areaId=id;Object.assign(hero,{x:opts.at[0],y:opts.at[1]});entries.push([id,opts]);}});
  configure(approved);api.install(maps,world,atlas);
  function move(id,x,y){areaId=id;Object.assign(hero,{x,y});}
  function use(id){const node=api.nodes().find(node=>node.id===id);assert(node,id+' is available in '+areaId);Object.assign(hero,{x:node.x,y:node.y});return api.interact(node);}
  function reload(){saved=JSON.parse(JSON.stringify(saved));configure(approved);api.install(maps,world,atlas);return saved;}
  return{api,combat,progression,maps,world,atlas,C,hero,move,use,reload,configure,rewards,powers,entries,messages,get saved(){return saved;},get areaId(){return areaId;},get saves(){return saves;},get heals(){return heals;}};
}
function prepareRemedy(g){
  g.use('remedy-ledger');assert.equal(g.saved.campaign.quests.herbalists_remedy.status,'active');
  g.move('lavenderway',0,0);
  for(const herb of g.api.ingredients){g.use(herb.node);g.use(herb.node);assert.equal(g.saved.inventory[herb.id],1,'herb bed yields one reserved portion');}
  g.use('hidden-greenhouse');assert(g.saved.campaign.quests.herbalists_remedy.flags.recipeRead);
  assert.equal(g.saved.inventory.medusa_antidote,undefined,'inspection explains the recipe before brewing');
  const result=g.use('hidden-greenhouse');assert.match(result.lines[0][1],/Sage crushed, rosemary steeped, thyme strained/);
  assert.equal(g.saved.inventory.medusa_antidote,1);for(const herb of g.api.ingredients)assert.equal(g.saved.inventory[herb.id],0);
  g.use('hidden-greenhouse');assert.equal(g.saved.inventory.medusa_antidote,1,'bench never duplicates the antidote');
  g.use('ruined-garden');assert.equal(g.areaId,g.api.arenaId);
}

// Chapter one remains authoritative until its cache is read, including old saves.
{
  const g=fixture({journey:{stage:6,run:1},campaign:{legacy_note:'keep me'}});
  assert.equal(g.api.journal(),null);assert.equal(g.api.dialogueFor({name:'Maera'}),null);assert.equal(g.api.nodes('lavenderway').length,0);
  assert.equal(g.saved.journey.stage,6);assert.equal(g.saved.campaign.legacy_note,'keep me');
  g.saved.journey.stage=7;assert.equal(g.api.journal().chapter,2);assert.match(g.api.journal().objective,/Ask Maera/);
  assert.equal(g.api.definitions.length,6);assert.equal(g.api.definitions.filter(def=>def.quest).length,4);
  for(const id of ['hydra','chimera'])assert.equal(g.api.definitions.find(def=>def.id===id).route,'mandatory-battle');
  for(const def of g.api.definitions.filter(def=>!def.implemented)){assert.equal(g.saved.campaign.guardians[def.id].status,'dormant');assert.equal(g.api.purify(def.id).ok,false);}
  assert.equal(g.saved.inventory.apple,7);assert.equal(g.saved.inventory.legacy_keepsake,2);assert(g.saved.clearedCamps['lavenderway:camp-1']);
}

// Existing camp identities, XP claims and gifted exploration ranks remain additive.
{
  const roads=['lavenderway','foxglove','marigold','coastroad','nightshade','moonpath'],clearedCamps=Object.fromEntries(roads.flatMap(id=>[1,2,3,4].map(index=>[id+':camp-'+index,true])));
  const prior={journey:{stage:7,run:4,puzzles:{wind:true},runComplete:true},clearedCamps,campMastery:{'lavenderway:camp-1':true},progression:{version:2,xp:1500,gifts:{stormy_gust:true,frost_shard:true,briar_bind:true},skills:{stormy_gust:true,frost_shard:true,briar_bind:true},ranks:{stormy_gust:2,frost_shard:1,briar_bind:1},loadout:['stormy_gust','frost_shard','briar_bind',null,null],claimedRewards:{'camp:lavenderway:camp-1':true,'monster:foxglove:camp-3:monster:2':true}}};
  const g=fixture(prior),before=JSON.stringify(g.saved.progression);g.api.install(g.maps,g.world,g.atlas);g.reload();assert.equal(JSON.stringify(g.saved.progression),before,'campaign installation does not rewrite XP or spell progression');
  assert.equal(Object.keys(g.saved.clearedCamps).length,24);for(const key of Object.keys(clearedCamps))assert(g.saved.clearedCamps[key]);
  for(const id of roads)assert.equal(g.maps[id].camps.map(camp=>camp.id).join(','),'camp-1,camp-2,camp-3,camp-4','road camp IDs remain stable');
  g.progression.respec(g.saved);for(const id of ['stormy_gust','frost_shard','briar_bind'])assert.equal(g.saved.progression.ranks[id],1,'free exploration lessons survive respec');
}

// The remedy is an explicit three-source gathering/inspection/recipe/purification route.
{
  const g=fixture(),q=g.saved.campaign.quests.herbalists_remedy;
  g.use('remedy-ledger');g.move('lavenderway',0,0);g.use('hidden-greenhouse');
  const missing=g.use('hidden-greenhouse');assert.match(missing.lines[0][1],/Missing: Silver Sage, Sun Rosemary, Clear Thyme/);
  const herb=g.api.nodes().find(node=>node.id==='remedy-sage');g.hero.x=herb.x+200;g.hero.y=herb.y;assert.equal(g.api.interact(herb).ok,false,'remote forged interaction cannot gather');
  for(const item of g.api.ingredients)g.use(item.node);g.use('hidden-greenhouse');assert.equal(q.stage,4);
  g.use('ruined-garden');assert.equal(g.maps[g.api.arenaId].camps.length,0,'remedy does not create a combat encounter');
  const exposed=g.use('medusa-approach');assert.match(exposed.lines[0][1],/antidote/);assert.equal(g.saved.campaign.guardians.medusa.status,'exposed');
  assert.equal(g.saved.campaign.guardians.medusa.route,'remedy');assert.equal(g.saved.campaign.powers.medusa_blessing,undefined,'exposure alone grants no power');
  assert.equal(g.rewards.length,0,'exposure alone grants no purification XP');
  const result=g.use('purify-medusa');assert(result.purified);assert.equal(g.saved.campaign.guardians.medusa.status,'purified');
  assert(g.saved.campaign.powers.medusa_blessing);assert(g.saved.campaign.memories.medusa);assert.equal(g.rewards.length,1);assert.equal(g.rewards[0].id,'campaign:guardian:medusa:purified');assert.equal(g.rewards[0].xp,180);assert.equal(g.powers.length,1);assert.equal(g.heals,1);
  assert.deepEqual(Object.keys(g.saved.campaign.restorations.lavenderway).sort(),['animals','dryingShed','greenhouse','streamBridge']);
  assert.match(g.api.journal().entries.join(' '),/sleeping tree/);assert.match(g.api.dialogueFor({id:'lavendyr_test',name:'Neighbour',homeTown:'lavendyr'})[0][1],/drying shed/);
  const parry=g.api.onParry();assert.equal(parry.slow.radius,100);assert.equal(parry.slow.duration,2.1);assert.equal(parry.slow.amount,.55);
  const powerBefore=JSON.stringify(g.api.modifiers());g.progression.respec(g.saved);assert.equal(JSON.stringify(g.api.modifiers()),powerBefore,'respec preserves permanent guardian power');
  const inventory=JSON.stringify(g.saved.inventory),chapter=JSON.stringify(g.saved.journey);g.reload();g.use('freed-medusa');g.api.purify();g.api.onCampClear({id:g.api.bossId,guardianId:'medusa'},g.api.arenaId);assert.equal(g.rewards.length,1);assert.equal(g.powers.length,1);assert.equal(g.heals,1);
  assert.equal(JSON.stringify(g.saved.inventory),inventory);assert.equal(JSON.stringify(g.saved.journey),chapter);assert.equal(g.maps[g.api.arenaId].camps.length,0,'purified story guardian never respawns');
  assert.equal(g.api.itemInfo('remedy_sage').category,'quest');assert.match(g.api.itemInfo('medusa_antidote').description,/do not drink/);assert.equal(g.api.itemInfo('apple'),null);
  for(const def of g.api.definitions.filter(def=>!def.implemented))assert.equal(g.saved.campaign.guardians[def.id].status,'dormant');
  const calls=[],ctx=new Proxy({},{get:(target,key)=>target[key]??((...args)=>calls.push([key,args])),set:(target,key,value)=>(target[key]=value,true)});
  g.api.update(.1);g.api.draw(ctx,{x:0,y:0});g.move('lavenderway',0,0);g.api.draw(ctx,{x:0,y:0});assert(calls.some(([name])=>name==='fillRect'),'restoration has visible map overlays');
}

// Approval is required before installing any new Medusa combat/art implementation.
{
  const g=fixture();g.use('remedy-ledger');g.move('lavenderway',0,0);g.use('ruined-garden');const response=g.use('medusa-approach');
  assert.match(response.lines[0][1],/crystal veil/);assert.equal(g.saved.campaign.guardians.medusa.battleStarted,undefined);assert.equal(g.maps[g.api.arenaId].camps.length,0);assert.equal(g.api.combatProfile(),null);
  assert(!g.maps[g.api.arenaId].camps.some(camp=>camp.monster==='minotaur'),'Briarvault art is never silently substituted for Medusa');
}

// Use real combat attacks and durable encounter IDs to expose the combat-route heart.
{
  const g=fixture({},true);g.move('lavenderway',0,0);g.use('ruined-garden');g.use('medusa-approach');
  const arena=g.maps[g.api.arenaId],camp=arena.camps[0],profile=g.api.combatProfile();assert.equal(camp.monster,'medusa');assert(camp.storyGuardian);assert.equal(camp.id,'medusa-thornheart');assert.equal(profile.guardianId,'medusa');assert.equal(profile.attackCycle.join(','),'gaze,serpent_lash,crystal_trap');
  g.saved.hp=100;g.combat.configure({image:{},layout:{types:{medusa:{...profile,frames:[[0,0,48,64]],anchor:[24,60]}}}});
  const combatRewards=[];
  g.combat.enter(arena,{id:g.api.arenaId,hero:g.hero,canStand:()=>true,state:g.saved,atlas:g.atlas,onDamage:damage=>g.saved.hp-=damage,onReward:r=>{combatRewards.push(r);g.progression.grant(g.saved,r.id,r.xp);},onClear:actor=>g.api.onCampClear(actor,g.api.arenaId)});
  const advance=seconds=>{for(let elapsed=0;elapsed<seconds;elapsed+=.04)g.combat.update(.04);};advance(.6);
  let phaseTwo=false,attacks=0;
  for(;attacks<60&&g.combat.snapshot().monsters.length;attacks++){
    const monster=g.combat.snapshot().monsters[0];phaseTwo ||= monster.phaseTwo;Object.assign(g.hero,{x:monster.x,y:monster.y+23,face:'up'});
    g.combat.swing(g.hero);advance(.6);
  }
  assert(attacks>=34,'ordinary katana attacks remove real boss HP');assert.equal(g.combat.snapshot().monsters.length,0);assert(phaseTwo,'second phase is reached during the encounter');
  assert.equal(g.saved.campaign.guardians.medusa.status,'exposed');assert.equal(g.saved.campaign.guardians.medusa.route,'combat');assert.equal(g.rewards.length,0);
  assert(g.saved.clearedCamps[g.api.arenaId+':'+camp.id]);assert(g.saved.defeatedMonsters[g.api.arenaId+':'+camp.id+':monster:1']);assert.equal(combatRewards.length,0,'story guardians reserve the same core reward for explicit purification');
  g.use('purify-medusa');assert.equal(g.rewards.length,1);assert.equal(g.rewards[0].xp,180);assert(g.saved.campaign.powers.medusa_blessing);
  g.reload();g.move('lavenderway',0,0);g.use('ruined-garden');assert.equal(g.maps[g.api.arenaId].camps.length,0);assert.equal(g.api.nodes().some(node=>node.id==='medusa-approach'),false);
}

// The prepared remedy still permits an explicit choice of the battle route.
{
  const g=fixture({},true);prepareRemedy(g);g.use('medusa-challenge');assert(g.saved.campaign.guardians.medusa.battleStarted);assert.equal(g.saved.inventory.medusa_antidote,1);
  g.api.onCampClear({id:'not-medusa'},'briarvault');assert.equal(g.saved.campaign.guardians.medusa.status,'bound');
  const entries=g.entries.length;g.use('medusa-antidote');assert.equal(g.saved.campaign.guardians.medusa.route,'remedy');assert.equal(g.saved.campaign.guardians.medusa.status,'exposed');assert.equal(g.maps[g.api.arenaId].camps.length,0);assert.equal(g.entries.length,entries+1,'switching to remedy resets the live combat scene');
}
{
  const g=fixture({},true);g.move('lavenderway',0,0);g.use('ruined-garden');g.use('medusa-approach');g.move('lavendyr_0',224,208);prepareRemedy(g);assert(g.api.nodes().some(node=>node.id==='medusa-antidote'),'retreating to gather the remedy remains possible');
  g.configure(false);g.use('medusa-antidote');g.use('purify-medusa');assert(g.saved.campaign.powers.medusa_blessing,'a saved attempt remains completable with the approval gate closed');
}

// Spatial checks use the actual maps and movement footprint, not an open-room mock.
{
  const g=fixture();
  function stand(map,x,y){
    for(const[dx,dy]of[[-4,-2],[4,-2],[-4,2],[4,2]])if(['w','x','s',undefined].includes(map.tiles[Math.floor((y+dy)/16)]?.[Math.floor((x+dx)/16)]))return false;
    return !(map.objects||[]).some(o=>o.hit&&x+4>o.hit[0]&&x-4<o.hit[0]+o.hit[2]&&y+2>o.hit[1]&&y-2<o.hit[1]+o.hit[3]);
  }
  function flood(map,from){const queue=[from],seen=new Set([from.join(',')]);for(let i=0;i<queue.length;i++){const[x,y]=queue[i];for(const[dx,dy]of[[8,0],[-8,0],[0,8],[0,-8]]){const next=[x+dx,y+dy],key=next.join(',');if(!seen.has(key)&&stand(map,...next)){seen.add(key);queue.push(next);}}}return queue;}
  const arena=g.maps[g.api.arenaId],reachable=flood(arena,arena.spawn);
  for(const at of [[288,208],[288,256],[352,256],[288,408]])assert(reachable.some(([x,y])=>Math.hypot(x-at[0],y-at[1])<12),'arena entry, choices, heart and exit are connected');
  assert(stand(arena,...arena.spawn));assert(arena.portals.every(portal=>g.maps[portal.target]));
  // The region content author owns road collision/prop changes. Exercise its metadata
  // once installed; the baseline v17 map predates the new garden branches.
  const road=g.maps.lavenderway;
  if(road.questLandmarks){g.use('remedy-ledger');const points=flood(road,road.spawn);for(const node of g.api.nodes('lavenderway'))assert(points.some(([x,y])=>Math.hypot(x-node.x,y-node.y)<node.range-2),'Lavenderway approach: '+node.id);}
}
console.log('PASS: additive six-guardian/four-quest schema, chapter continuation, three-source explicit remedy, real katana combat/exposure/purification, approval gate, permanent parry blessing/respec, one-time rewards, save reload, spatial reachability, restorations and NPC reactions.');
