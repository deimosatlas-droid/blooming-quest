/* Amaal's original skills and local, additive progression save. */
(function(global){
  'use strict';
  const LEVELS=[0,60,150,270,420,600,810,1050,1320,1620],MAX_XP=1000000000;
  const branches=[
    {id:'katana',name:'Katana',subtitle:'Precision, timing and the final cut.',color:'#eab69d'},
    {id:'bloomcraft',name:'Bloomcraft',subtitle:'Make the wilds your advantage.',color:'#a8cc91'},
    {id:'stormy',name:'Stormy',subtitle:'A trusted companion. A sudden gale.',color:'#a8ccdf'}
  ];
  const definitions=[
    {id:'petal_sweep',branch:'katana',name:'Petal Sweep',kind:'active',cost:1,requires:[],stamina:26,cooldown:6,description:'Sweep a broad arc with the katana, damaging and staggering nearby foes.',effect:'sweep'},
    {id:'finishing_cut',branch:'katana',name:'Finishing Cut',kind:'passive',cost:1,requires:['petal_sweep'],description:'The third strike of your basic katana combo deals 1 extra damage.',effect:'finisherDamage'},
    {id:'petal_return',branch:'katana',name:'Petal Return',kind:'passive',cost:1,requires:['petal_sweep'],description:'A successful parry restores 18 stamina. Time the start of your guard to an incoming strike.',effect:'parryReturn'},
    {id:'briar_bind',branch:'bloomcraft',name:'Briar Bind',kind:'active',cost:1,requires:[],stamina:24,cooldown:8,description:'Root nearby enemies for 2.5 seconds, giving you room to reposition.',effect:'bind'},
    {id:'lingering_roots',branch:'bloomcraft',name:'Lingering Roots',kind:'passive',cost:1,requires:['briar_bind'],description:'Briar Bind lasts 4.5 seconds instead of 2.5 seconds.',effect:'bindDuration'},
    {id:'deep_roots',branch:'bloomcraft',name:'Deep Roots',kind:'passive',cost:1,requires:['briar_bind'],description:'Increase maximum stamina from 100 to 120.',effect:'maxStamina'},
    {id:'stormy_gust',branch:'stormy',name:'Stormy’s Gust',kind:'active',cost:1,requires:[],stamina:22,cooldown:7,description:'Send a gust ahead, pushing enemies away and interrupting their attacks.',effect:'gust'},
    {id:'tailwind',branch:'stormy',name:'Tailwind',kind:'passive',cost:1,requires:['stormy_gust'],description:'After Stormy’s Gust, move 30% faster for 2.5 seconds.',effect:'gustHaste'},
    {id:'wind_ward',branch:'stormy',name:'Wind Ward',kind:'passive',cost:1,requires:['stormy_gust'],description:'Stormy’s Gust grants a ward for 3 seconds that absorbs one hit.',effect:'windWard'}
  ];
  const byId=Object.fromEntries(definitions.map(node=>[node.id,node]));
  const legacyCamps=['lavenderway','foxglove','marigold','coastroad','nightshade','moonpath'].flatMap(area=>[1,2,3,4].map(index=>area+':camp-'+index));
  const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
  const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
  const integer=(value,max=MAX_XP)=>typeof value==='number'&&Number.isFinite(value)?Math.min(max,Math.max(0,Math.floor(value))):0;
  const levelFor=xp=>{let level=1;for(let i=1;i<LEVELS.length;i++)if(xp>=LEVELS[i])level=i+1;return level;};
  function flags(value){
    const result={};
    if(object(value))for(const[key,enabled]of Object.entries(value))if(enabled===true&&key.length<=240&&!['__proto__','constructor','prototype'].includes(key))result[key]=true;
    return result;
  }
  function isCleared(state,key){
    return (Array.isArray(state.clearedCamps)?state.clearedCamps.includes(key):object(state.clearedCamps)&&own(state.clearedCamps,key)&&state.clearedCamps[key]===true)||
      (object(state.campProgress)&&own(state.campProgress,key)&&object(state.campProgress[key])&&state.campProgress[key].cleared===true);
  }
  function migrate(state){
    if(!object(state))throw new TypeError('A game save is required for progression.');
    const saved=object(state.progression)?state.progression:{};
    const p={...saved,xp:integer(saved.xp),skills:{},loadout:[null,null,null],claimedRewards:flags(saved.claimedRewards)};
    // Existing finite camp clears have a reliable value. Historical monster
    // removals also include camp cleanup, so those never imply kill rewards.
    for(const key of legacyCamps)if(isCleared(state,key)&&!p.claimedRewards['camp:'+key]){
      p.xp=Math.min(MAX_XP,p.xp+35);p.claimedRewards['camp:'+key]=true;
    }
    const known=object(saved.skills)?saved.skills:{};
    let available=levelFor(p.xp); // One starting point; one more each level.
    for(const node of definitions)if(own(known,node.id)&&known[node.id]===true&&available>=node.cost&&node.requires.every(id=>p.skills[id])){
      p.skills[node.id]=true;available-=node.cost;
    }
    if(Array.isArray(saved.loadout))for(let slot=0;slot<3;slot++){
      const id=saved.loadout[slot];
      if(typeof id==='string'&&p.skills[id]&&byId[id]?.kind==='active'&&!p.loadout.includes(id))p.loadout[slot]=id;
    }
    p.version=1;state.progression=p;
    return state;
  }
  function snapshot(state){
    migrate(state);const p=state.progression,level=levelFor(p.xp),next=LEVELS[level];
    const spent=definitions.reduce((sum,node)=>sum+(p.skills[node.id]?node.cost:0),0);
    return{level,xp:p.xp,xpIntoLevel:p.xp-LEVELS[level-1],xpForNext:next===undefined?0:next-LEVELS[level-1],points:level-spent,
      skills:{...p.skills},loadout:[...p.loadout],maxLevel:LEVELS.length};
  }
  function learn(state,id){
    const current=snapshot(state),node=typeof id==='string'&&own(byId,id)?byId[id]:null;
    if(!node)return{ok:false,message:'Choose a skill from the tree.'};
    if(current.skills[id])return{ok:false,message:node.name+' is already learned.'};
    if(!node.requires.every(required=>current.skills[required]))return{ok:false,message:'Learn '+node.requires.map(required=>byId[required].name).join(' and ')+' first.'};
    if(current.points<node.cost)return{ok:false,message:'Earn a skill point by gaining a level.'};
    const p=state.progression;p.skills[id]=true;
    if(node.kind==='active'){
      const empty=p.loadout.indexOf(null);if(empty>=0)p.loadout[empty]=id;
    }
    return{ok:true,message:node.name+' learned.'};
  }
  function equip(state,id,slot){
    snapshot(state);const p=state.progression;
    if(!Number.isInteger(slot)||slot<0||slot>2)return{ok:false,message:'Choose skill slot 1, 2 or 3.'};
    if(id===null){p.loadout[slot]=null;return{ok:true,message:'Skill slot cleared.'};}
    const node=typeof id==='string'&&own(byId,id)?byId[id]:null;
    if(!node||node.kind!=='active'||!p.skills[id])return{ok:false,message:'Learn an active skill before equipping it.'};
    // Replacing a slot moves the old skill back to the previous slot, so
    // rearranging a three-skill loadout never silently discards an ability.
    const previous=p.loadout.indexOf(id),displaced=p.loadout[slot];
    p.loadout[slot]=id;if(previous>=0&&previous!==slot)p.loadout[previous]=displaced;
    return{ok:true,message:node.name+' equipped in slot '+(slot+1)+'.'};
  }
  function respec(state){
    migrate(state);state.progression.skills={};state.progression.loadout=[null,null,null];
    return{ok:true,message:'Skills reset. All earned skill points are available again.'};
  }
  function grant(state,rewardId,xp){
    if(typeof rewardId!=='string'||!rewardId||rewardId.length>240||['__proto__','constructor','prototype'].includes(rewardId)||
      !Number.isInteger(xp)||xp<=0||xp>1000000)return{ok:false,xp:0,levels:0};
    // Claim before migrate() so a just-cleared camp is the same reward as a
    // legacy camp migration, whichever integration callback runs first.
    if(!object(state))return{ok:false,xp:0,levels:0};
    const prior=object(state.progression)?state.progression:{},claimed=flags(prior.claimedRewards);
    if(claimed[rewardId]){migrate(state);return{ok:false,xp:0,levels:0};}
    const beforeXP=integer(prior.xp),beforeLevel=levelFor(beforeXP);
    claimed[rewardId]=true;state.progression={...prior,xp:Math.min(MAX_XP,beforeXP+xp),claimedRewards:claimed};
    migrate(state);
    return{ok:true,xp:Math.min(xp,MAX_XP-beforeXP),levels:levelFor(state.progression.xp)-beforeLevel};
  }
  function modifiers(state){
    const skills=snapshot(state).skills;
    return{finisherDamage:skills.finishing_cut?1:0,parryReturn:skills.petal_return?18:0,bindDuration:skills.lingering_roots?4.5:2.5,
      maxStamina:skills.deep_roots?120:100,gustHaste:skills.tailwind?.3:0,windWard:Boolean(skills.wind_ward)};
  }
  // Definitions are shared by the tree, hotbar and combat controller.
  for(const node of definitions){Object.freeze(node.requires);Object.freeze(node);}
  for(const branch of branches)Object.freeze(branch);
  global.BloomProgression=Object.freeze({definitions:Object.freeze(definitions),branches:Object.freeze(branches),migrate,snapshot,learn,equip,respec,grant,modifiers});
})(window);
