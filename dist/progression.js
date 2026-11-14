/* Saved choices, twenty ranked spells and five equipped slots. */
(function(global){
  'use strict';
  const LEVELS=Array.from({length:30},(_,index)=>index*60),MAX_XP=1000000000;
  const catalog=global.BloomSpells;
  if(!catalog)throw Error('Load the spell catalogue before progression.');
  const branches=catalog.branches;
  const passives=[
    {id:'finishing_cut',branch:'katana',name:'Finishing Cut',requires:['petal_sweep'],description:'The third strike of your basic katana combo deals 1 extra damage.',effect:'finisherDamage'},
    {id:'petal_return',branch:'katana',name:'Petal Return',requires:['petal_sweep'],description:'A successful parry restores 18 stamina. Time the start of your guard to an incoming strike.',effect:'parryReturn'},
    {id:'lingering_roots',branch:'bloomcraft',name:'Lingering Roots',requires:['briar_bind'],description:'Briar Bind lasts 2 seconds longer at every rank.',effect:'bindDuration'},
    {id:'deep_roots',branch:'bloomcraft',name:'Deep Roots',requires:['briar_bind'],description:'Increase maximum stamina from 100 to 120.',effect:'maxStamina'},
    {id:'tailwind',branch:'stormy',name:'Tailwind',requires:['stormy_gust'],description:'After Stormy’s Gust, move 30% faster for 2.5 seconds.',effect:'gustHaste'},
    {id:'wind_ward',branch:'stormy',name:'Wind Ward',requires:['stormy_gust'],description:'Stormy’s Gust grants a ward for 3 seconds that absorbs one hit.',effect:'windWard'}
  ].map(node=>Object.freeze({...node,kind:'passive',cost:1,maxRank:1,requires:Object.freeze(node.requires)}));
  const all=Object.fromEntries([...catalog.spells,...passives].map(node=>[node.id,node]));
  // Keep the original nine choices first when sanitizing old saves.
  const oldIds=['petal_sweep','finishing_cut','petal_return','briar_bind','lingering_roots','deep_roots','stormy_gust','tailwind','wind_ward'];
  const definitions=Object.freeze([...oldIds.map(id=>all[id]),...catalog.spells.filter(node=>!oldIds.includes(node.id))]);
  const byId=Object.fromEntries(definitions.map(node=>[node.id,node]));
  const legacyCamps=['lavenderway','foxglove','marigold','coastroad','nightshade','moonpath'].flatMap(area=>[1,2,3,4].map(index=>area+':camp-'+index));
  const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
  const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
  const integer=(value,max=MAX_XP)=>typeof value==='number'&&Number.isFinite(value)?Math.min(max,Math.max(0,Math.floor(value))):0;
  const levelFor=xp=>Math.min(LEVELS.length,Math.floor(xp/60)+1);
  const pointsFor=xp=>3+(levelFor(xp)-1)*2;
  const normalized=new WeakMap();
  function mark(p){normalized.set(p,{xp:p.xp,skills:p.skills,ranks:p.ranks,loadout:p.loadout,claims:p.claimedRewards});return p;}
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
    const p={...saved,xp:integer(saved.xp),skills:{},ranks:{},loadout:[null,null,null,null,null],claimedRewards:flags(saved.claimedRewards)};
    for(const key of legacyCamps)if(isCleared(state,key)&&!p.claimedRewards['camp:'+key]){
      p.xp=Math.min(MAX_XP,p.xp+35);p.claimedRewards['camp:'+key]=true;
    }
    const known=object(saved.skills)?saved.skills:{},ranks=object(saved.ranks)?saved.ranks:{};
    let available=pointsFor(p.xp);
    for(const node of definitions)if(own(known,node.id)&&known[node.id]===true&&available>=node.cost&&node.requires.every(id=>p.skills[id])){
      p.skills[node.id]=true;if(node.kind==='active')p.ranks[node.id]=1;available-=node.cost;
    }
    // Preserve all affordable learned spells before allocating rank upgrades.
    for(const node of definitions)if(p.skills[node.id]&&node.kind==='active'){
      const wanted=own(ranks,node.id)?Math.max(1,integer(ranks[node.id],3)):1,extra=Math.min(wanted-1,available);
      p.ranks[node.id]+=extra;available-=extra;
    }
    if(Array.isArray(saved.loadout))for(let slot=0;slot<5;slot++){
      const id=saved.loadout[slot];if(typeof id==='string'&&p.skills[id]&&byId[id]?.kind==='active'&&!p.loadout.includes(id))p.loadout[slot]=id;
    }
    p.version=2;state.progression=mark(p);return state;
  }
  function ready(state){
    if(!object(state))throw new TypeError('A game save is required for progression.');
    const p=state.progression,known=object(p)?normalized.get(p):null;
    if(!known||known.xp!==p.xp||known.skills!==p.skills||known.ranks!==p.ranks||known.loadout!==p.loadout||known.claims!==p.claimedRewards)migrate(state);
    return state.progression;
  }
  function spent(p){return definitions.reduce((sum,node)=>sum+(p.skills[node.id]?(node.kind==='active'?p.ranks[node.id]||1:node.cost):0),0);}
  function snapshot(state){
    const p=ready(state),level=levelFor(p.xp),next=LEVELS[level];
    return{level,xp:p.xp,xpIntoLevel:p.xp-LEVELS[level-1],xpForNext:next===undefined?0:next-LEVELS[level-1],points:pointsFor(p.xp)-spent(p),
      skills:{...p.skills},ranks:{...p.ranks},loadout:[...p.loadout],maxLevel:LEVELS.length,spellCount:20,slots:5};
  }
  function learn(state,id){
    const current=snapshot(state),node=typeof id==='string'&&own(byId,id)?byId[id]:null;
    if(!node)return{ok:false,message:'Choose a spell or upgrade from the tree.'};
    if(current.skills[id])return{ok:false,message:node.name+' is already learned.'};
    if(!node.requires.every(required=>current.skills[required]))return{ok:false,message:'Learn '+node.requires.map(required=>byId[required].name).join(' and ')+' first.'};
    if(current.points<node.cost)return{ok:false,message:'Earn a skill point by gaining a level.'};
    const p=state.progression;p.skills[id]=true;if(node.kind==='active'){
      p.ranks[id]=1;const empty=p.loadout.indexOf(null);if(empty>=0)p.loadout[empty]=id;
    }
    return{ok:true,message:node.name+' learned.'};
  }
  function upgrade(state,id){
    const current=snapshot(state),node=typeof id==='string'&&own(byId,id)?byId[id]:null;
    if(!node||node.kind!=='active'||!current.skills[id])return{ok:false,message:'Learn an active spell before upgrading it.'};
    const rank=current.ranks[id]||1;if(rank>=3)return{ok:false,message:node.name+' is already mastered.'};
    if(current.points<1)return{ok:false,message:'Earn a skill point to upgrade this spell.'};
    state.progression.ranks[id]=rank+1;return{ok:true,message:node.name+' upgraded to rank '+(rank+1)+'.'};
  }
  function equip(state,id,slot){
    const p=ready(state);
    if(!Number.isInteger(slot)||slot<0||slot>4)return{ok:false,message:'Choose skill slot 1–5.'};
    if(id===null){p.loadout[slot]=null;return{ok:true,message:'Skill slot cleared.'};}
    const node=typeof id==='string'&&own(byId,id)?byId[id]:null;
    if(!node||node.kind!=='active'||!p.skills[id])return{ok:false,message:'Learn an active spell before equipping it.'};
    const previous=p.loadout.indexOf(id),displaced=p.loadout[slot];p.loadout[slot]=id;
    if(previous>=0&&previous!==slot)p.loadout[previous]=displaced;
    return{ok:true,message:node.name+' equipped in slot '+(slot+1)+'.'};
  }
  function respec(state){
    const p=ready(state);p.skills={};p.ranks={};p.loadout=[null,null,null,null,null];mark(p);
    return{ok:true,message:'Spells reset. All earned skill points are available again.'};
  }
  function grant(state,rewardId,xp){
    if(typeof rewardId!=='string'||!rewardId||rewardId.length>240||['__proto__','constructor','prototype'].includes(rewardId)||
      !Number.isInteger(xp)||xp<=0||xp>1000000||!object(state))return{ok:false,xp:0,levels:0};
    const prior=object(state.progression)?state.progression:{},claimed=flags(prior.claimedRewards);
    if(claimed[rewardId]){ready(state);return{ok:false,xp:0,levels:0};}
    const beforeXP=integer(prior.xp),beforeLevel=levelFor(beforeXP);
    // Mark the semantic reward before migration can credit the same camp.
    claimed[rewardId]=true;state.progression={...prior,xp:Math.min(MAX_XP,beforeXP+xp),claimedRewards:claimed};migrate(state);
    return{ok:true,xp:Math.min(xp,MAX_XP-beforeXP),levels:levelFor(state.progression.xp)-beforeLevel};
  }
  function modifiers(state){
    const skills=ready(state).skills;
    return{finisherDamage:skills.finishing_cut?1:0,parryReturn:skills.petal_return?18:0,bindDuration:skills.lingering_roots?4.5:2.5,
      maxStamina:skills.deep_roots?120:100,gustHaste:skills.tailwind?.3:0,windWard:Boolean(skills.wind_ward)};
  }
  function spell(state,id){
    const p=ready(state);if(!p.skills[id]||!own(catalog.byId,id))return null;
    const result=catalog.resolve(id,p.ranks[id]||1);
    if(id==='briar_bind'&&p.skills.lingering_roots)result.duration+=2;
    if(id==='stormy_gust'){result.gustHaste=p.skills.tailwind?.3:0;result.windWard=p.skills.wind_ward?1:0;}
    return result;
  }
  global.BloomProgression=Object.freeze({definitions,branches,migrate,snapshot,learn,upgrade,equip,respec,grant,modifiers,spell});
})(window);
