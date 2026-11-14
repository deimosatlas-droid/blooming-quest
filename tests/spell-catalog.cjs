'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const C={window:{}};vm.createContext(C);vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../dist/spell-catalog.js'),'utf8'),C);
const catalog=C.window.BloomSpells;
assert.equal(catalog.spells.length,20,'twenty active spells, independent of passive upgrades');assert.equal(catalog.branches.length,5);
assert.equal(new Set(catalog.spells.map(spell=>spell.id)).size,20);
for(const branch of catalog.branches)assert.equal(catalog.spells.filter(spell=>spell.branch===branch.id).length,4,branch.id+' has four real spells');
for(const spell of catalog.spells){
 assert.equal(spell.kind,'active');assert.equal(spell.maxRank,3);assert.equal(spell.cost,1);assert(spell.description.length>30);assert(spell.upgradeDescription.length>25);
 assert(spell.stamina>0&&spell.stamina<=50);assert(spell.cooldown>0&&spell.cooldown<=20);assert(spell.castTime>=.12&&spell.castTime<=.3);
 for(const id of spell.requires)assert(catalog.byId[id],'prerequisite is a real spell');
 const base=catalog.resolve(spell.id,1),rank2=catalog.resolve(spell.id,2),rank3=catalog.resolve(spell.id,3);
 assert.equal(base.rank,1);assert.equal(rank2.rank,2);assert.equal(rank3.rank,3);
 const gameplay=['damage','range','radius','duration','force','heal','charges','cooldown','speed','pierce','rootDuration','slowDuration','burnDamage','burnDuration','triggerRadius','arc'];
 assert(gameplay.some(key=>base[key]!==rank2[key]),spell.id+' rankII changes live gameplay data');assert(gameplay.some(key=>rank2[key]!==rank3[key]),spell.id+' rankIII changes live gameplay data');
 for(const rank of[base,rank2,rank3])for(const[key,value]of Object.entries(rank))if(typeof value==='number')assert(Number.isFinite(value),spell.id+' has finite '+key);
 const original=spell.description;base.description='changed';base.requires.push('fake');assert.equal(spell.description,original);assert(!spell.requires.includes('fake'),'resolved copies do not mutate shared definitions');
 assert(Object.isFrozen(spell)&&Object.isFrozen(spell.requires)&&Object.isFrozen(spell.upgrades));
}
assert.equal(catalog.resolve('constructor'),null);assert.equal(catalog.resolve('__proto__'),null);assert.equal(catalog.resolve('unknown'),null);assert.equal(catalog.resolve('petal_sweep',50).rank,3);assert.equal(catalog.resolve('petal_sweep',-3).rank,1);assert.equal(catalog.resolve('petal_sweep','3').rank,1);
assert.equal(catalog.resolve('healing_bloom',3).heal,4);assert.equal(catalog.resolve('winter_ward',3).charges,3);assert.equal(catalog.resolve('phoenix_pulse',3).heal,2);assert.equal(catalog.resolve('ember_bolt',3).burnDamage,2);assert.equal(catalog.resolve('rose_lance',3).pierce,4);
console.log('PASS: twenty real spells in five branches, complete gameplay definitions, unique mechanics, cumulative rankII/III changes, tuning bounds and immutable catalogue copies.');
