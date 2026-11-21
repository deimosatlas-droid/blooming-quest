'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {fixture,settle,text}=require('./helpers/full-game.cjs');
const root=path.resolve(__dirname,'../dist');
const completedOpening=()=>({area:'lavendyr_0',x:224,y:224,face:'up',hp:5,food:3,note:true,lastSafeTown:'lavendyr',worldClock:{day:3,minutes:800},
 inventory:{apple:9,briar_key:1,raeez_ribbon:1,wayfarer_seed:1,legacy_keepsake:2},
 clearedCamps:{'lavenderway:camp-1':true,'briarvault:root-watch-1':true,'briarvault:guardian-1':true},defeatedMonsters:{},campProgress:{},
 journey:{stage:7,run:1,runComplete:true,puzzles:{wind:true,roots:true},decorations:{raeez_ribbon:true}},
 progression:{xp:600,skills:{stormy_gust:true,frost_shard:true,briar_bind:true},ranks:{stormy_gust:1,frost_shard:1,briar_bind:1},gifts:{stormy_gust:true,frost_shard:true,briar_bind:true},loadout:['stormy_gust','frost_shard','briar_bind',null,null],claimedRewards:{'camp:lavenderway:camp-1':true,'camp:briarvault:root-watch-1':true,'camp:briarvault:guardian-1':true}}});
async function boot(saved=completedOpening()){
 const game=fixture({saved:typeof saved==='string'?saved:JSON.stringify(saved)});await settle();assert(game.evaluate('ready'),game.find('loadtext').textContent);game.find('start').click();assert(game.evaluate('playing'));
 return game;
}
function finishDialogue(game){for(let n=0;n<80&&game.evaluate('speaking');n++){game.evaluate('resetInput()');game.key('e');}assert(!game.evaluate('speaking'),'the real E listener can finish campaign dialogue');}
function use(game,areaId,id){
 const r=game.evaluate;game.C.testAreaId=areaId;game.C.testNodeId=id;
 assert(r(`
  if(areaId!==testAreaId)enter(testAreaId);
  heroAnim.reset();abilities.reset({refill:true});resetInput();
  (()=>{const node=campaign.nodes().find(item=>item.id===testNodeId);if(!node)return false;
   const offsets=[];for(let dy=-24;dy<=24;dy+=4)for(let dx=-24;dx<=24;dx+=4)offsets.push([dx,dy]);offsets.sort((a,b)=>Math.hypot(...a)-Math.hypot(...b));
   for(const[dx,dy]of offsets){hero.x=node.x+dx;hero.y=node.y+dy;if(canStand(hero.x,hero.y)&&findInteraction()?.id===testNodeId)return true;}return false;})()
 `),'a standable E approach selects '+id+' in '+areaId+' '+r('JSON.stringify({hero,near:findInteraction()})'));
 game.key('e');finishDialogue(game);
}
function drawCreature(game,expected){
 const before=game.draws.length;game.evaluate('render()');const draws=game.draws.slice(before);
 assert(draws.some(args=>/lavender-creatures\.png/.test(args[0]?.src||'')&&args[2]===expected),'the approved regional image supplies the expected source row '+expected);
}
function campaignSnapshot(game){return JSON.parse(game.evaluate('JSON.stringify(state.campaign)'));}
function parryBlessing(game){
 const r=game.evaluate;
 r("enter('lavenderway',{at:[maps.lavenderway.camps[1].x+48,maps.lavenderway.camps[1].y]})");game.step(75);
 assert(r('combat.snapshot().monsters.length>0'),'an uncleared original road camp provides real nearby enemies');
 r("const parryTarget=combat.snapshot().monsters[0];hero.x=parryTarget.x;hero.y=parryTarget.y+22;hero.face='up';heroAnim.reset();abilities.reset({refill:true});abilities.update(0,{guarding:true});");
 assert(r("abilities.defend({source:{x:hero.x,y:hero.y-22},damage:1,parryable:true}).parried"),'the real defensive timing produces a parry');
 assert(r('combat.snapshot().monsters.some(monster=>Math.hypot(monster.x-hero.x,monster.y-hero.y)<=100&&monster.slowTime>0&&monster.slow>=.55)'), 'the configured abilities→campaign→combat callback slows nearby enemies');
}
function respecAndSave(game){
 const r=game.evaluate;r('resetInput();heroAnim.reset();abilities.reset({refill:true})');game.key('k');assert(r('combatUI.isOpen()'));game.find('respec-skills').click();
 assert(r('state.campaign.powers.medusa_blessing'));for(const id of ['stormy_gust','frost_shard','briar_bind'])assert.equal(r('state.progression.ranks.'+id),1,'gifted exploration spell survives the real free-respec button');
 game.C.window.BloomCombatUI.close();r('save()');return game.storage['blooming-world-v05'];
}
(async()=>{
 // The shipped JSON and actual PNG form a four-facing approved sheet, with no
 // reuse of the existing minotaur frames for Medusa or the three road species.
 const profile=JSON.parse(fs.readFileSync(path.join(root,'assets/lavender-creatures.json'),'utf8')),png=fs.readFileSync(path.join(root,'assets/lavender-creatures.png'));
 assert.equal(png.subarray(1,4).toString(),'PNG');const width=png.readUInt32BE(16),height=png.readUInt32BE(20);assert(width>=512&&height>=512);
 for(const id of ['lavender_imp','violet_brambleback','amethyst_wisp','medusa']){
  assert(profile.types[id],id+' has a real approved profile');for(const direction of ['down','left','up','right']){const frame=profile.types[id].directions[direction][0];assert.equal(frame.length,4);assert(frame[0]>=0&&frame[1]>=0&&frame[0]+frame[2]<=width&&frame[1]+frame[3]<=height,id+' source frame fits actual PNG');}
 }
 const remedy=await boot(),r=remedy.evaluate;
 assert(r('campaign.journal().chapter===2'));assert.equal(r('state.journey.stage'),7);assert(r("maps.briarvault.camps.find(camp=>camp.boss).monster==='minotaur'"),'the original Briarvault Guardian remains the original approved encounter');
 const originalChapter=r('JSON.stringify(state.journey)'),xp=r('state.progression.xp');
 use(remedy,'lavendyr_0','remedy-ledger');for(const herb of remedy.C.window.BloomCampaign.ingredients)use(remedy,'lavenderway',herb.node);
 use(remedy,'lavenderway','hidden-greenhouse');assert(r('state.campaign.quests.herbalists_remedy.flags.recipeRead'));assert(!r('state.inventory.medusa_antidote'));
 use(remedy,'lavenderway','hidden-greenhouse');assert.equal(r('state.inventory.medusa_antidote'),1);
 use(remedy,'lavenderway','ruined-garden');assert.equal(r('areaId'),'medusa_garden');drawCreature(remedy,384);assert.equal(r('combat.snapshot().monsters.length'),0,'the remedy approach stays peaceful');
 use(remedy,'medusa_garden','medusa-approach');assert.equal(r('state.campaign.guardians.medusa.status'),'exposed');drawCreature(remedy,384);assert(!r('state.campaign.powers.medusa_blessing'));
 use(remedy,'medusa_garden','purify-medusa');assert.equal(r('state.campaign.guardians.medusa.route'),'remedy');assert.equal(r('state.progression.xp'),xp+180);assert.equal(r('JSON.stringify(state.journey)'),originalChapter);
 assert(r("state.campaign.memories.medusa&&state.campaign.restorations.lavenderway.animals"));assert(r("maps.lavenderway.objects.find(object=>object.id==='lavenderway_v18_hidden_greenhouse').sprite==='lv18_conservatory'"),'purification actually replaces the ruined greenhouse artwork');
 assert.match(r("campaign.dialogueFor({id:'lavendyr_test',name:'Neighbour',homeTown:'lavendyr'})[0][1]"),/drying shed/);
 remedy.C.window.BloomTraveller.open('journal');assert.match(text(remedy.find('traveller-body')),/Medusa|Thornhearts/);remedy.C.window.BloomTraveller.close();
 parryBlessing(remedy);const remedyRaw=respecAndSave(remedy),again=await boot(remedyRaw);assert.equal(again.evaluate('state.progression.xp'),xp+180);assert(again.evaluate('campaign.modifiers().parrySlow===.55'));
 use(again,'lavenderway','ruined-garden');use(again,'medusa_garden','freed-medusa');assert.equal(again.evaluate('state.progression.xp'),xp+180);assert.equal(again.evaluate('combat.snapshot().monsters.length'),0);assert.equal(again.evaluate('state.inventory.apple'),9);assert.equal(again.evaluate('state.inventory.legacy_keepsake'),2);
 // Combat damage is moderately increased here to test the story callback chain;
 // this is not a difficulty/balance or physical-device playtest.
 const battle=await boot(),b=battle.evaluate,before=b('state.progression.xp');use(battle,'lavenderway','ruined-garden');use(battle,'medusa_garden','medusa-approach');assert(b('state.campaign.guardians.medusa.battleStarted'));
 battle.step(45);assert(b('combat.snapshot().monsters.some(monster=>monster.boss&&monster.type==="medusa")'),'the real battle creates Medusa from her regional profile');drawCreature(battle,384);assert(b('combat.bossTarget()?.name.includes("Medusa")'));
 for(let attack=0;attack<18&&b('combat.snapshot().monsters.length');attack++){
  battle.C.testAttack=attack;b("{const target=combat.snapshot().monsters[0];hero.x=target.x;hero.y=target.y+24;hero.face='up';state.hp=5;heroAnim.reset();combat.swing(hero,{activationId:'guardian-integration-'+testAttack,damage:4,range:52,arc:1.65})}");battle.step(40);
 }
 assert.equal(b('combat.snapshot().monsters.length'),0);assert.equal(b('state.campaign.guardians.medusa.status'),'exposed');assert.equal(b('state.campaign.guardians.medusa.route'),'combat');assert.equal(b('state.progression.xp'),before,'story battle reserves the single core reward for purification');
 assert(b("state.clearedCamps['medusa_garden:medusa-thornheart']"));assert(b("state.campProgress['medusa_garden:medusa-thornheart'].exposed"));b('save()');
 const exposed=await boot(battle.storage['blooming-world-v05']);assert.equal(exposed.evaluate('combat.snapshot().monsters.length'),0,'an exposed saved guardian never respawns');use(exposed,'medusa_garden','purify-medusa');assert.equal(exposed.evaluate('state.progression.xp'),before+180);
 assert.deepEqual(Object.keys(campaignSnapshot(exposed).powers),Object.keys(campaignSnapshot(remedy).powers),'both routes award the same permanent core power');
 const battleRaw=respecAndSave(exposed),restored=await boot(battleRaw);assert(restored.evaluate('state.campaign.powers.medusa_blessing'));assert.equal(restored.evaluate('state.progression.xp'),before+180);assert.equal(restored.evaluate('state.journey.stage'),7);assert(restored.evaluate("state.clearedCamps['lavenderway:camp-1']"));
 console.log('PASS: full-page E routes through three herbs, recipe, actual approved Medusa combat/exposure/purification; correct regional PNG source frames, one core reward, real parry slow callback, free-respec/reload permanence, restoration art, NPC/journal reactions, and preserved Briarvault chapter.');
})().catch(error=>{console.error(error);process.exitCode=1;});
