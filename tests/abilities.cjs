'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../dist');
function fixture(){
 const C={window:{},Math,JSON};vm.createContext(C);for(const file of ['spell-catalog.js','progression.js','abilities.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),C,{filename:file});
 const state={hp:5,clearedCamps:{},inventory:{apple:7}},hero={x:100,y:100,face:'right'},casts=[],messages=[];
 const progression=C.window.BloomProgression,abilities=C.window.BloomAbilities;let enabled=true,wall=()=>true,cancelled=0;
 abilities.configure({getState:()=>state,getHero:()=>hero,canStand:(x,y)=>wall(x,y),canAct:()=>enabled,onCast:(id,spec)=>casts.push({...spec,spellKey:id}),onMessage:text=>messages.push(text),onHeal:amount=>state.hp=Math.min(5,state.hp+amount),onCancelAttack:()=>cancelled++});
 return{C,state,hero,progression,abilities,casts,messages,setEnabled:v=>enabled=v,setWall:fn=>wall=fn,cancelled:()=>cancelled};
}
const f=fixture(),a=f.abilities,p=f.progression;
const finish=(api=a)=>{for(let i=0;i<30;i++)api.update(.02);};
a.reset({refill:true});assert.equal(a.snapshot().stamina,100);
f.setEnabled(false);assert.equal(a.requestDodge(1,0),false);assert.equal(a.requestSkill(0),false);assert.equal(a.canAttack(),false);assert.equal(a.snapshot().stamina,100,'title/dialogue pause cannot spend resources');f.setEnabled(true);
assert(a.requestDodge(1,1));assert.equal(f.cancelled(),1);assert.equal(a.snapshot().stamina,80);assert(a.defend({source:{x:80,y:100},damage:1}).blocked,'dodge protects all directions at its opening');
a.update(.1);a.update(.1);assert.equal(a.defend({source:{x:200,y:100},damage:1}).blocked,false,'late dodge has a punishable recovery');a.update(.04);assert(!a.snapshot().dodging);assert.equal(a.requestDodge(1,0),false,'dodge cooldown prevents repeat spam');assert(Math.abs(Math.hypot(f.hero.x-100,f.hero.y-100)-50.6)<.01,'diagonal dodge has normalized travel');
a.reset({refill:true});f.hero.x=100;f.hero.y=100;f.setWall(x=>x<=108);assert(a.requestDodge(1,0));for(let i=0;i<6;i++)a.update(.04);assert(f.hero.x<=108,'substepped dodge cannot tunnel through a fence');f.setWall(()=>true);
a.reset({refill:true});a.update(.04,{guarding:true});assert(a.snapshot().guarding);assert(a.defend({source:{x:f.hero.x+20,y:100},parryable:true}).parried,'opening guard parries a frontal normal attack');assert.equal(a.snapshot().stamina,90);
assert.equal(a.defend({source:{x:f.hero.x-20,y:100},parryable:true}).blocked,false,'guard never protects Amaal from behind');for(let i=0;i<6;i++)a.update(.04,{guarding:true});const block=a.defend({source:{x:f.hero.x+20,y:100},parryable:true});assert(block.blocked&&!block.parried,'late guard blocks without parrying');assert.equal(a.snapshot().stamina,74);assert.equal(a.defend({source:{x:f.hero.x+20,y:100},parryable:false,heavy:true}).blocked,false,'heavy area attacks must be dodged');
a.update(.04,{guarding:false});a.update(.04,{guarding:true});assert(!a.snapshot().guarding,'rapid guard taps cannot reset the parry window without recovery');
a.reset({refill:true});for(let i=0;i<12;i++)a.commitAttack();a.update(.04,{guarding:true});for(let i=0;i<6;i++)a.update(.04,{guarding:true});assert.equal(a.defend({source:{x:f.hero.x+20,y:100},parryable:true}).blocked,false);assert(!a.snapshot().guarding,'insufficient block stamina breaks guard');a.update(.04,{guarding:true});assert(!a.snapshot().guarding,'guard break has a recovery window');
a.reset({refill:true});while(a.commitAttack()){}assert(a.snapshot().stamina<8);assert.equal(a.canAttack(),false,'stamina budgets basic combos');for(let i=0;i<40;i++)a.update(.04);assert(a.snapshot().stamina>8,'stamina regenerates after recovery');
p.grant(f.state,'test:levels',1620);for(const id of ['petal_sweep','briar_bind','stormy_gust','deep_roots','lingering_roots','tailwind','wind_ward','petal_return','finishing_cut'])assert(p.learn(f.state,id).ok,id);
assert(p.snapshot(f.state).points>0,'expanded progression leaves points for additional spells and ranks');assert.equal(p.modifiers(f.state).finisherDamage,1);
a.reset({refill:true});assert.equal(a.snapshot().maxStamina,120);assert.equal(a.snapshot().stamina,120);assert(a.requestSkill(0));assert.equal(a.snapshot().stamina,94);assert.equal(f.casts.length,0,'casting wind-up cannot hit early');finish();assert.equal(f.casts.at(-1).id,'skill-1');assert.equal(f.casts.at(-1).damage,2);assert.equal(a.requestSkill(0),false,'active cooldown cannot be bypassed');
assert(a.requestSkill(1));finish();assert.equal(f.casts.at(-1).duration,4.5,'root upgrade reaches actual cast configuration');assert(a.requestSkill(2));finish();assert(a.snapshot().haste&&a.snapshot().ward);assert.equal(a.movementMultiplier(),1.3,'Tailwind changes actual movement');assert(a.defend({source:{x:0,y:0},heavy:true}).blocked,'Wind Ward absorbs one hit');assert(!a.snapshot().ward);assert.equal(a.defend({source:{x:0,y:0},heavy:true}).blocked,false,'ward is consumed once');
const before=a.snapshot().cooldowns.petal_sweep;p.respec(f.state);assert(a.snapshot().maxStamina===100);assert.equal(a.snapshot().cooldowns.petal_sweep,before,'respec does not clear active cooldowns');assert.equal(a.requestSkill(0),false,'respec removes equipped skills');
p.learn(f.state,'petal_sweep');p.learn(f.state,'petal_return');a.reset({refill:true});a.commitAttack();a.commitAttack();a.update(.04,{guarding:true});const stamina=a.snapshot().stamina;assert(a.defend({source:{x:f.hero.x+10,y:f.hero.y},parryable:true}).parried);assert.equal(a.snapshot().stamina,Math.min(100,stamina-10+18),'Petal Return refunds stamina exactly once per combat parry callback');
a.release();assert(!a.snapshot().guarding&&!a.snapshot().dodging,'scene/blur input reset releases defensive state');assert.equal(f.state.inventory.apple,7,'abilities never disturb inventory');
const ctx=new Proxy({globalAlpha:1},{get:(o,k)=>o[k]??(()=>{})});a.draw(ctx,{x:0,y:0});
// Every named spell dispatches its resolved rank-three mechanics after casting.
for(const definition of f.C.window.BloomSpells.spells){
 const test=fixture(),api=test.abilities,prog=test.progression;prog.grant(test.state,'spell-test:levels',2000);
 for(const node of test.C.window.BloomSpells.spells)assert(prog.learn(test.state,node.id).ok,node.id);
 assert(prog.upgrade(test.state,definition.id).ok);assert(prog.upgrade(test.state,definition.id).ok);
 assert(prog.equip(test.state,definition.id,4).ok);api.reset({refill:true});test.state.hp=1;
 assert(api.requestSkill(4),definition.id+' commits in fifth slot');assert.equal(test.casts.length,0,definition.id+' has a wind-up');finish(api);
 assert.equal(test.casts.length,1,definition.id+' dispatches once');assert.equal(test.casts[0].spellKey,definition.id);assert.equal(test.casts[0].rank,3);
 if(definition.heal)assert.equal(test.state.hp,Math.min(5,1+prog.spell(test.state,definition.id).heal));
 if(definition.id==='winter_ward'){assert.equal(api.snapshot().wardCharges,3);for(let hit=0;hit<3;hit++)assert(api.defend({source:{x:0,y:0}}).blocked);assert(!api.snapshot().ward);}
 if(definition.id==='gale_step')assert(test.hero.x>100,'Gale Step moves the actual hero');
}
// Buffering pays only when execution is legal and cancellation cannot fire late.
{
 const test=fixture(),api=test.abilities,prog=test.progression;prog.learn(test.state,'petal_sweep');let ready=false;
 api.configure({getState:()=>test.state,getHero:()=>test.hero,canAct:()=>true,canSkill:()=>ready,onCast:(kind,spec)=>test.casts.push({kind,...spec})});
 assert.equal(api.requestSkill(0),false);assert(api.snapshot().queued);assert.equal(api.snapshot().stamina,100);ready=true;api.update(.02);assert(api.snapshot().casting);assert.equal(api.snapshot().stamina,74);finish(api);assert.equal(test.casts.length,1);
}
{
 const test=fixture(),api=test.abilities;test.progression.learn(test.state,'petal_sweep');assert(api.requestSkill(0));assert(api.requestDodge(1,0));finish(api);assert.equal(test.casts.length,0,'dodge cancels unreleased magic');assert(api.snapshot().cooldowns.petal_sweep>0,'interrupting does not erase paid cooldown');
}
console.log('PASS: stamina/cooldowns, normalized fence-safe dodge and protection window, directional guard/parry and guard-break recovery, every skill upgrade, ward/haste, respec persistence and title/pause guards.');
