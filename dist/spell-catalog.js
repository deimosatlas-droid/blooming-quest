/* Twenty original spells. Rank changes here are consumed by the live simulation. */
(function(global){
  'use strict';
  const branches=[
    {id:'katana',name:'Katana',subtitle:'Petals follow the blade.',color:'#eab69d'},
    {id:'bloomcraft',name:'Bloomcraft',subtitle:'The wilds answer your call.',color:'#a8cc91'},
    {id:'stormy',name:'Stormy',subtitle:'A companion. A gathering gale.',color:'#a8ccdf'},
    {id:'frost',name:'Frost',subtitle:'Still the rush of battle.',color:'#a4deeb'},
    {id:'ember',name:'Ember',subtitle:'A small flame, fiercely kept.',color:'#efae79'}
  ];
  const entries=[
    {id:'petal_sweep',branch:'katana',name:'Petal Sweep',description:'A broad katana arc damages and staggers nearby foes.',stamina:26,cooldown:6,castTime:.14,effect:'sweep',shape:'cone',damage:2,range:52,arc:1.65,force:8,upgradeDescription:'Each rank strengthens the cut and widens its reach.',upgrades:{2:{damage:3,range:58},3:{damage:4,range:64}}},
    {id:'rose_lance',branch:'katana',name:'Rose Lance',description:'Send a narrow lance of rose light through enemies in a straight line.',stamina:25,cooldown:5,castTime:.17,effect:'projectile',shape:'line',damage:3,range:130,radius:4,speed:220,pierce:2,upgradeDescription:'Ranks add damage, reach and another pierced target.',upgrades:{2:{damage:4,range:145,pierce:3},3:{damage:5,range:160,pierce:4}}},
    {id:'crescent_return',branch:'katana',name:'Returning Crescent',description:'A curved blade of light travels outward and returns, striking along both passes.',stamina:28,cooldown:7,castTime:.18,effect:'boomerang',shape:'line',damage:2,range:104,radius:6,speed:180,pierce:6,force:2,upgradeDescription:'Grow the crescent and strengthen both passes.',upgrades:{2:{damage:3,range:116,radius:7},3:{damage:4,range:128,radius:8}}},
    {id:'thorn_dance',branch:'katana',name:'Thorn Dance',description:'Orbiting petals repeatedly cut enemies who stay close to Amaal.',stamina:34,cooldown:10,castTime:.2,effect:'orbit',shape:'self',damage:1,range:34,radius:34,duration:3,tick:.65,force:4,upgradeDescription:'Longer dances sweep a larger circle; mastery strengthens each cut.',upgrades:{2:{duration:4,radius:39,range:39},3:{damage:2,duration:4.5,radius:44,range:44}}},
    {id:'briar_bind',branch:'bloomcraft',name:'Briar Bind',description:'Root nearby enemies, giving you room to reposition.',stamina:24,cooldown:8,castTime:.18,effect:'root',shape:'circle',damage:0,range:56,radius:56,duration:2.5,upgradeDescription:'Ranks grow the rooted area and hold enemies for longer.',upgrades:{2:{range:64,radius:64,duration:3.3},3:{range:72,radius:72,duration:4.2}}},
    {id:'seed_bolt',branch:'bloomcraft',name:'Seed Bolt',description:'Fire a living seed that damages its first target and briefly roots it.',stamina:16,cooldown:3,castTime:.12,effect:'projectile',shape:'line',damage:1,range:150,radius:4,speed:175,pierce:1,rootDuration:1.2,upgradeDescription:'Stronger seeds deal more damage and leave deeper roots.',upgrades:{2:{damage:2,rootDuration:1.8,range:165},3:{damage:3,rootDuration:2.4,range:180}}},
    {id:'healing_bloom',branch:'bloomcraft',name:'Healing Bloom',description:'Gather a flower of light to restore Amaal’s health.',stamina:32,cooldown:14,castTime:.28,effect:'heal',shape:'self',heal:2,upgradeDescription:'Restore three hearts at rank II and four hearts at rank III.',upgrades:{2:{heal:3,cooldown:13},3:{heal:4,cooldown:12}}},
    {id:'thorn_wall',branch:'bloomcraft',name:'Thorn Wall',description:'Raise a strip of briars ahead that hurts and slows enemies crossing it.',stamina:30,cooldown:10,castTime:.22,effect:'wall',shape:'line',damage:1,range:38,radius:30,duration:4,tick:.6,slow:.5,slowDuration:1,upgradeDescription:'Keep the wall alive longer and strengthen its thorns.',upgrades:{2:{duration:5.5,radius:36},3:{damage:2,duration:6.5,radius:42}}},
    {id:'stormy_gust',branch:'stormy',name:'Stormy’s Gust',description:'A directed gust pushes enemies away and interrupts their attacks.',stamina:22,cooldown:7,castTime:.14,effect:'gust',shape:'cone',damage:1,range:70,arc:1.12,force:22,upgradeDescription:'Each rank pushes farther; mastery strengthens the gust.',upgrades:{2:{range:80,force:30},3:{damage:2,range:90,force:38}}},
    {id:'gale_step',branch:'stormy',name:'Gale Step',description:'Dash through a short gust, cutting enemies along the way without crossing solid scenery.',stamina:22,cooldown:5,castTime:.12,effect:'dash',shape:'line',damage:2,range:72,radius:11,duration:.22,force:10,upgradeDescription:'Travel farther and strike harder; mastery recovers sooner.',upgrades:{2:{damage:3,range:88},3:{damage:4,range:104,cooldown:4}}},
    {id:'cyclone',branch:'stormy',name:'Cyclone',description:'A small whirlwind repeatedly draws nearby foes inward and damages them.',stamina:34,cooldown:11,castTime:.22,effect:'pull',shape:'circle',damage:1,range:64,radius:64,duration:1.4,tick:.45,force:22,upgradeDescription:'The whirlwind grows wider and lasts longer; mastery adds damage.',upgrades:{2:{range:72,radius:72,duration:1.9},3:{damage:2,range:80,radius:80,duration:2.3}}},
    {id:'thunder_call',branch:'stormy',name:'Thunder Call',description:'Mark the ground ahead; a brief warning resolves into a concentrated lightning strike.',stamina:32,cooldown:9,castTime:.24,effect:'lightning',shape:'circle',damage:3,range:96,radius:36,delay:.55,upgradeDescription:'Call a larger, stronger lightning strike.',upgrades:{2:{damage:4,radius:42},3:{damage:5,radius:48,cooldown:8}}},
    {id:'frost_shard',branch:'frost',name:'Frost Shard',description:'Launch an ice shard that damages a target and slows its movement.',stamina:18,cooldown:3.5,castTime:.13,effect:'projectile',shape:'line',damage:2,range:160,radius:5,speed:210,pierce:1,slow:.5,slowDuration:2,upgradeDescription:'Sharper shards deal more damage and keep targets chilled longer.',upgrades:{2:{damage:3,slowDuration:2.8},3:{damage:4,slowDuration:3.5,range:180}}},
    {id:'ice_ring',branch:'frost',name:'Ice Ring',description:'An expanding ring of frost damages and freezes enemies close to Amaal.',stamina:28,cooldown:8,castTime:.2,effect:'freeze',shape:'ring',damage:1,range:48,radius:48,duration:1.8,upgradeDescription:'Expand the freezing circle and lengthen the freeze.',upgrades:{2:{range:56,radius:56,duration:2.5},3:{damage:2,range:64,radius:64,duration:3.1}}},
    {id:'winter_ward',branch:'frost',name:'Winter Ward',description:'Wrap Amaal in a temporary ice ward that absorbs two incoming hits.',stamina:40,cooldown:14,castTime:.2,effect:'ward',shape:'self',charges:2,duration:5,upgradeDescription:'The ward lasts longer; mastery absorbs a third hit.',upgrades:{2:{duration:7},3:{duration:8,charges:3}}},
    {id:'glacial_path',branch:'frost',name:'Glacial Path',description:'Lay a line of frost ahead that repeatedly hurts and slows enemies standing on it.',stamina:30,cooldown:9,castTime:.22,effect:'trail',shape:'line',damage:1,range:90,radius:12,duration:4,tick:.6,slow:.55,slowDuration:2,upgradeDescription:'Lengthen the path and strengthen its lingering frost.',upgrades:{2:{range:108,duration:5.5},3:{damage:2,range:126,duration:6}}},
    {id:'ember_bolt',branch:'ember',name:'Ember Bolt',description:'Throw a glowing ember that damages its target and leaves a brief burn.',stamina:20,cooldown:4,castTime:.14,effect:'projectile',shape:'line',damage:3,range:145,radius:5,speed:200,pierce:1,burnDamage:1,burnDuration:3,burnTick:1,upgradeDescription:'A stronger impact leaves a longer, fiercer burn.',upgrades:{2:{damage:4,burnDuration:4},3:{damage:5,burnDamage:2,burnDuration:4}}},
    {id:'flame_fan',branch:'ember',name:'Flame Fan',description:'Fan a short cone of fire ahead, damaging enemies and leaving them burning.',stamina:28,cooldown:7,castTime:.19,effect:'fan',shape:'cone',damage:2,range:58,arc:1.1,burnDamage:1,burnDuration:2,burnTick:1,upgradeDescription:'A wider fan burns farther; mastery increases impact damage.',upgrades:{2:{range:68,arc:1.25,burnDuration:3},3:{damage:3,range:78,arc:1.4,burnDuration:3}}},
    {id:'cinder_trap',branch:'ember',name:'Cinder Trap',description:'Set a cinder sigil ahead. After arming, an approaching enemy triggers its blast.',stamina:26,cooldown:8,castTime:.24,effect:'trap',shape:'circle',damage:3,range:60,radius:28,duration:8,armTime:.45,triggerRadius:23,upgradeDescription:'A larger trap hits harder and remains ready longer.',upgrades:{2:{damage:4,radius:34,duration:10,triggerRadius:27},3:{damage:5,radius:40,duration:12,triggerRadius:31}}},
    {id:'phoenix_pulse',branch:'ember',name:'Phoenix Pulse',description:'Release a warm pulse that damages nearby enemies and restores one of Amaal’s hearts.',stamina:38,cooldown:15,castTime:.3,effect:'pulse',shape:'circle',damage:2,range:58,radius:58,heal:1,force:6,upgradeDescription:'The pulse grows stronger; mastery restores an extra heart.',upgrades:{2:{damage:3,range:66,radius:66},3:{damage:4,range:74,radius:74,heal:2}}}
  ];
  const rootIds={katana:'petal_sweep',bloomcraft:'briar_bind',stormy:'stormy_gust',frost:'frost_shard',ember:'ember_bolt'};
  const byId={};
  for(const entry of entries){
    const branch=branches.find(branch=>branch.id===entry.branch);
    const spell={kind:'active',cost:1,maxRank:3,damage:0,range:0,radius:0,duration:0,force:0,...entry,color:branch.color,
      requires:entry.id===rootIds[entry.branch]?[]:[rootIds[entry.branch]],upgrade:entry.upgrades};
    spell.spellId=spell.id;
    Object.freeze(spell.requires);for(const rank of Object.values(spell.upgrades))Object.freeze(rank);Object.freeze(spell.upgrades);
    byId[spell.id]=Object.freeze(spell);
  }
  function resolve(id,rank=1){
    if(typeof id!=='string'||!Object.prototype.hasOwnProperty.call(byId,id))return null;
    const source=byId[id],level=Number.isInteger(rank)?Math.max(1,Math.min(3,rank)):1;
    const result={...source,rank:level,requires:[...source.requires]};
    // Rank III contains rank II's improvements too.
    for(let current=2;current<=level;current++)Object.assign(result,source.upgrades[current]);
    delete result.upgrades;delete result.upgrade;
    return result;
  }
  const spells=Object.freeze(entries.map(entry=>byId[entry.id]));
  for(const branch of branches)Object.freeze(branch);
  global.BloomSpells=Object.freeze({spells,byId:Object.freeze(byId),branches:Object.freeze(branches),resolve});
})(window);
