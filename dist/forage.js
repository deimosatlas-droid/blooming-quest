/* Gathered plants use the same saved game day as the townspeople's routines. */
(function(global){
  'use strict';
  const TYPES={
    apple:{label:'apple',plant:'Apple tree'},
    pear:{label:'pear',plant:'Pear tree'},
    berry:{label:'berries',plant:'Wild berry bush'},
    poison_amanita:{label:'Rosecap Amanita',plant:'Rosecap Amanita patch',poisonous:true},
    poison_bellcap:{label:'Violet Bellcap',plant:'Violet Bellcap patch',poisonous:true},
    poison_inkcap:{label:'Inky Puffcap',plant:'Inky Puffcap patch',poisonous:true}
  };
  let plants=[],sources=new Map(),options={},state=null,areaId='';
  function object(value){return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}
  function day(){return Math.max(1,Math.floor(Number(options.getDay?.())||1));}
  function enter(area,config={}){
    options=config;state=config.state||{};areaId=config.id||area.id||area.name||'world';sources=new Map();
    state.inventory=object(state.inventory);state.foragePicked=object(state.foragePicked);
    plants=(area.objects||[]).filter(source=>source.forage).map((source,index)=>{
      const detail=typeof source.forage==='object'?source.forage:source;
      const fruit=typeof source.forage==='string'?source.forage:detail.fruit||source.fruit;
      const type=TYPES[fruit];if(!type)return null;
      const id=String(detail.id||source.id||source.sprite+':'+source.x+':'+source.y+':'+index);
      sources.set(id,source);
      return {id,key:areaId+':'+id,x:source.x,y:source.y,fruit,sprite:source.sprite,
        pickedSprite:detail.pickedSprite||source.pickedSprite||source.sprite+'_picked',
        name:detail.name||source.label||type.plant,poisonous:!!type.poisonous,craftingIngredient:!!type.poisonous,
        amount:Math.max(1,Math.min(20,Math.floor(Number(detail.yield??source.yield)||1))),
        regrowDays:Math.max(1,Math.floor(Number(detail.regrowDays??source.regrowDays)||1)),
        range:Math.max(24,Math.min(60,Number(detail.range||source.forageRange)||36))};
    }).filter(Boolean);
  }
  function ready(plant){const picked=state.foragePicked[plant.key];return picked===undefined||day()-Number(picked)>=plant.regrowDays;}
  function reachable(plant,hero){return !options.canReach||options.canReach(hero,plant,sources.get(plant.id));}
  function interaction(hero){
    let nearest=null;
    for(const plant of plants){
      const distance=Math.hypot(hero.x-plant.x,hero.y-plant.y);
      const type=TYPES[plant.fruit],ingredient=type.poisonous?' · poisonous crafting ingredient':'';
      if(distance<plant.range&&reachable(plant,hero)&&(!nearest||distance<nearest.d))nearest={type:'forage',id:plant.id,d:distance,
        label:(ready(plant)?(type.poisonous?'Collect ':'Pick ')+type.label:plant.name+' · growing')+ingredient,
        fruit:plant.fruit,poisonous:!!type.poisonous,craftingIngredient:!!type.poisonous};
    }
    return nearest;
  }
  function harvest(id,hero){
    const plant=plants.find(p=>p.id===id);
    if(!plant||!hero||Math.hypot(hero.x-plant.x,hero.y-plant.y)>=plant.range||!reachable(plant,hero))return {picked:false};
    if(!ready(plant)){
      const remaining=plant.regrowDays-(day()-Number(state.foragePicked[plant.key]));
      options.onMessage?.(plant.name+(plant.poisonous?' is regrowing.':' is growing new fruit.')+' Come back '+
        (remaining<=1?'tomorrow.':'in '+remaining+' days.')+(plant.poisonous?' Poisonous crafting ingredient.':''));
      return {picked:false,regrowIn:remaining};
    }
    state.inventory[plant.fruit]=Math.max(0,Math.floor(Number(state.inventory[plant.fruit])||0))+plant.amount;
    state.foragePicked[plant.key]=day();
    options.onChange?.();
    options.onMessage?.((plant.poisonous?'Collected ':'Picked ')+TYPES[plant.fruit].label+' ×'+plant.amount+'. '+
      (plant.poisonous?'Poisonous crafting ingredient added to your bag. ':'')+
      'In your bag: '+state.inventory[plant.fruit]+'. J opens the journal.');
    return {picked:true,fruit:plant.fruit,amount:plant.amount,total:state.inventory[plant.fruit],
      poisonous:plant.poisonous,craftingIngredient:plant.craftingIngredient};
  }
  function inventory(){return Object.fromEntries(Object.keys(TYPES).map(key=>[key,Math.max(0,Math.floor(Number(state?.inventory?.[key])||0))]));}
  function spriteFor(source){
    if(!source.forage)return source.sprite;
    const detail=typeof source.forage==='object'?source.forage:source,id=detail.id||source.id;
    const plant=plants.find(p=>id?p.id===String(id):p.x===source.x&&p.y===source.y&&p.sprite===source.sprite);
    return plant&&!ready(plant)?plant.pickedSprite:source.sprite;
  }
  function summary(){
    const bag=inventory(),ingredients=Object.keys(TYPES).filter(key=>TYPES[key].poisonous&&bag[key]>0)
      .map(key=>TYPES[key].label+' ×'+bag[key]);
    return 'Apples ×'+bag.apple+' · pears ×'+bag.pear+' · berries ×'+bag.berry+
      (ingredients.length?'. Poisonous crafting ingredients: '+ingredients.join(' · '):'');
  }
  function catalogue(){return Object.entries(TYPES).map(([id,type])=>({id,name:type.label,
    poisonous:!!type.poisonous,craftingIngredient:!!type.poisonous}));}
  function snapshot(){return plants.map(plant=>({...plant,ready:ready(plant),pickedDay:state.foragePicked[plant.key]??null}));}
  global.BloomForage={enter,interaction,harvest,inventory,summary,snapshot,spriteFor,catalogue};
})(window);
