const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const base=require('node:path').resolve(__dirname,'../dist')+'/';
const C={window:{},Math,JSON};vm.createContext(C);
for(const file of ['hero-animation.js','training.js','combat.js'])vm.runInContext(fs.readFileSync(base+file,'utf8'),C);
const heroAPI=C.window.BloomHero,training=C.window.BloomTraining,combat=C.window.BloomCombat;
const hero={x:100,y:100,face:'right'},events=[];
const context={hero,canStand:()=>true,onActive:(attacker,spec)=>events.push({...spec,phase:heroAPI.status().phase,x:attacker.x})};
heroAPI.requestAttack(hero);heroAPI.requestAttack(hero);heroAPI.requestAttack(hero);
assert.equal(heroAPI.status().phase,'anticipation');assert.equal(heroAPI.status().queuedCount,2);
heroAPI.update(.10,context);assert.equal(events.length,0,'anticipation cannot cause damage');
heroAPI.update(.10,context);assert.equal(events.length,1);assert.equal(events[0].phase,'active');
heroAPI.update(.16,context);assert.equal(events.length,1,'recovery never applies another hit');
assert.equal(heroAPI.status().id,'return');
heroAPI.update(.34,context);assert.equal(heroAPI.status().id,'thrust');
heroAPI.update(.46,context);assert.equal(heroAPI.busy(),false);
assert.deepEqual(events.map(e=>e.id),['sweep','return','thrust']);
assert.deepEqual(events.map(e=>e.damage),[1,1,2]);
assert(events.every(e=>e.phase==='active'));assert.equal(new Set(events.map(e=>e.activationId)).size,3);
assert(Math.abs(hero.x-132)<.001,'three moves have visibly different lunges');
heroAPI.reset();hero.x=100;hero.face='right';
heroAPI.requestAttack(hero);heroAPI.update(.54,{hero,canStand:x=>x<=104,onActive(){}});
assert(hero.x<=104,'lunge cannot tunnel through a wall');
heroAPI.update(1,{hero});heroAPI.requestAttack(hero);assert.equal(heroAPI.status().id,'sweep','combo expires after resting');

const walk={name:'walk'},actions={name:'actions'},draws=[];
const ctx=new Proxy({globalAlpha:1,drawImage(...args){draws.push(args);}},{get:(o,k)=>o[k]??(()=>{})});
heroAPI.reset();heroAPI.configure({walkImage:walk});heroAPI.draw(ctx,100,100,hero,{clock:0});assert.equal(draws.at(-1)[0],walk,'missing action art preserves walking fallback');
heroAPI.configure({image:actions,walkImage:walk,layout:{anchor:[32,52],clips:{idle:{directions:{right:[[0,0,64,64],[64,0,64,64],[128,0,64,64],[192,0,64,64]]},durations:[1.4,.35,.45,.12]}}}});
heroAPI.draw(ctx,100,100,hero,{clock:.8});assert.equal(draws.at(-1)[1],0,'open idle pose holds naturally');
heroAPI.draw(ctx,100,100,hero,{clock:2.25});assert.equal(draws.at(-1)[1],192,'short authored blink pose is selected');

const actionLayout=JSON.parse(fs.readFileSync(base+'assets/amaal-actions.json'));
const actionPNG=fs.readFileSync(base+'assets/amaal-actions.png'),actualImage={name:'actual-actions'};
let actualPoses=0;heroAPI.configure({image:actualImage,layout:actionLayout,walkImage:walk});
for(const face of ['down','right','up','left'])for(const [index,id]of ['idle','sweep','return','thrust'].entries()){
  heroAPI.reset();hero.face=face;
  if(id==='idle'){
    let elapsed=0;const durations=actionLayout.clips.idle.frameDurations||[.3,.3,.3,.3];
    for(let frame=0;frame<4;frame++){
      heroAPI.draw(ctx,100,100,hero,{clock:elapsed+durations[frame]/2});elapsed+=durations[frame];
      assert.deepEqual(draws.at(-1).slice(1,5),actionLayout.clips.idle.directions[face][frame]);actualPoses++;
    }
  }else{
    for(let move=0;move<index;move++){heroAPI.requestAttack(hero);if(move<index-1)heroAPI.update(heroAPI.moves()[move].duration,{hero,canStand:()=>true});}
    const spec=heroAPI.moves()[index-1],times=[0,spec.anticipation+spec.active*.25,spec.anticipation+spec.active*.75,spec.anticipation+spec.active+.05];
    let previous=0;
    for(let frame=0;frame<times.length;frame++){
      heroAPI.update(times[frame]-previous,{hero,canStand:()=>true});previous=times[frame];heroAPI.draw(ctx,100,100,hero,{clock:0});
      const rect=draws.at(-1).slice(1,5);assert.deepEqual(rect,actionLayout.clips[id].directions[face][frame]);
      assert(rect[0]>=0&&rect[1]>=0&&rect[0]+rect[2]<=actionPNG.readUInt32BE(16)&&rect[1]+rect[3]<=actionPNG.readUInt32BE(20));actualPoses++;
    }
  }
}

const dummy={id:'target',sprite:'training_dummy',x:130,y:100,training:{id:'target',maxHealth:3,resetSeconds:2},hit:[124,92,12,8]};
const practice={kind:'home',objects:[dummy,{id:'neighbor',sprite:'person',x:130,y:90},{sprite:'cow',x:130,y:110}]};
const before=JSON.stringify(practice);training.enter(practice);hero.x=100;hero.y=100;hero.face='right';
assert.equal(training.strike(hero,{id:'sweep',activationId:'first',damage:1,range:40,arc:1.45}).hits,1);
assert.equal(training.strike(hero,{activationId:'first',damage:1}).hits,0,'an activation cannot hit a dummy twice');
assert.equal(training.snapshot()[0].hp,2);training.update(.03);assert.notEqual(training.offset(dummy).x,0,'dummy visibly recoils');
training.strike(hero,{activationId:'second',damage:1});training.strike(hero,{activationId:'third',damage:2});
assert.equal(training.snapshot()[0].hp,0);assert.equal(training.snapshot()[0].hits,3);
training.update(2.01);assert.equal(training.snapshot()[0].hp,3);assert.equal(training.snapshot()[0].hits,0,'practice target resets its hit counter');
assert.equal(JSON.stringify(practice),before,'practice never modifies persistent map state or nearby people/animals');

const road={kind:'road',safe:false,camps:[{id:'front',x:145,y:100,health:8,totalSpawns:0},{id:'side',x:120,y:130,health:8,totalSpawns:0},{id:'back',x:80,y:100,health:8,totalSpawns:0}]};
const progress={};combat.enter(road,{id:'test',hero,state:progress,canStand:()=>true});
const hp=id=>combat.snapshot().camps.find(c=>c.id===id).hp;
combat.swing(hero,{activationId:'sweep',damage:1,range:40,arc:1.45});assert.equal(hp('front'),7);assert.equal(hp('side'),7);assert.equal(hp('back'),8);
combat.swing(hero,{activationId:'sweep',damage:1,range:40,arc:1.45});assert.equal(hp('front'),7,'combat also deduplicates activation IDs');
combat.swing(hero,{activationId:'thrust',damage:2,range:56,arc:.5});assert.equal(hp('front'),5);assert.equal(hp('side'),7,'thrust trades width for reach');
combat.enter({...road,kind:'home',safe:true},{id:'home',hero,state:progress});assert.equal(combat.snapshot().camps.length,0,'home remains safe from encounters');

// Exercise the actual Space key hook and old estate-save migration.
const elements={},storage={},gradient={addColorStop(){}};
const gameCtx=new Proxy({createRadialGradient:()=>gradient},{get:(o,k)=>o[k]??(()=>{})});
const element=()=>({style:{},textContent:'',hidden:false,getContext:()=>gameCtx,addEventListener(){},requestFullscreen(){}});
Object.assign(C,{Image:class{},Promise,URLSearchParams,fetch:()=>new Promise(()=>{}),
  localStorage:{getItem:key=>storage[key]??null,setItem:(key,value)=>storage[key]=value},
  document:{getElementById:id=>elements[id]??=element(),createElement:element,querySelectorAll:()=>[]},
  location:{search:'',href:''},requestAnimationFrame(){},setInterval(){},
  testMaps:JSON.parse(fs.readFileSync(base+'fixed-maps.json')),testAtlas:JSON.parse(fs.readFileSync(base+'assets/world-v05.json')),
  practiceMap:{id:'practice',name:'Practice yard',kind:'home',safe:true,w:40,h:30,theme:'rose',tiles:Array.from({length:30},()=> 'g'.repeat(40)),spawn:[136,120],objects:[{...dummy,x:160,y:120,hit:[154,112,12,8]}],portals:[],signs:[],exits:[]}});
C.window.addEventListener=()=>{};
vm.runInContext(fs.readFileSync(base+'adventure.js','utf8'),C);
vm.runInContext(`
maps={...testMaps,practice:practiceMap,rosepetal:{...testMaps.rosepetal,kind:'home',saveAliases:{rosepetal_mira:'rosepetal'}}};atlas=testAtlas;texture={};amaal={};ready=true;playing=true;
state.note=true;state.inventory={apple:7};state.clearedCamps={'old:camp':true};
enter('rosepetal_mira',{at:[320,128]});
if(areaId!=='rosepetal'||hero.x!==area.spawn[0]||hero.y!==area.spawn[1])throw Error('retired interior save migrates to estate spawn');
if(!state.note||state.inventory.apple!==7||!state.clearedCamps['old:camp'])throw Error('migration preserves quest, inventory and camps');
enter('practice');hero.face='right';
if(state.lastSafeTown!=='practice')throw Error('home acts as a safe checkpoint');
keyAction(' ');if(training.snapshot()[0].hp!==3)throw Error('Space cannot deal damage on the anticipation frame');
update(.10);if(training.snapshot()[0].hp!==3)throw Error('anticipation remains harmless');
update(.10);if(training.snapshot()[0].hp!==2)throw Error('active Space frame hits the dummy');
update(.40);if(training.snapshot()[0].hp!==2)throw Error('recovery does not damage again');
render();
state.hp=1;damageHero(1);if(areaId!=='practice'||state.hp!==5)throw Error('defeat returns to a home checkpoint safely');
if(heroAnim.busy())throw Error('map transition clears pending combat actions');
`,C);
vm.runInContext(`
maps=testMaps;enter('rosepetal');
if(area.kind!=='home')throw Error('actual Rosepetal estate is a home');
if(training.snapshot().length!==3)throw Error('actual estate has three hittable practice targets');
const retired=area.retiredInteriorIds||area.retiredAreas;
if(!retired||retired.length!==5)throw Error('five retired Rosepetal rooms have migration metadata');
for(const id of retired){enter(id,{at:[320,128]});if(areaId!=='rosepetal'||hero.x!==area.spawn[0]||hero.y!==area.spawn[1])throw Error('actual retired room migrates safely: '+id);}
for(const target of training.snapshot()){
  const stance=[[target.x,target.y+24,'up'],[target.x-24,target.y,'right'],[target.x+24,target.y,'left'],[target.x,target.y-24,'down']].find(p=>canStand(p[0],p[1]));
  if(!stance)throw Error('actual dummy has a valid training stance: '+target.id);
  hero.x=stance[0];hero.y=stance[1];hero.face=stance[2];heroAnim.reset();
  keyAction(' ');keyAction(' ');keyAction(' ');
  for(let tick=0;tick<45;tick++)update(.04);
  const result=training.snapshot().find(t=>t.id===target.id);
  if(result.hits!==3||result.hp!==0)throw Error('actual three-part combo hits dummy: '+target.id);
  for(let tick=0;tick<55;tick++)update(.04);
  if(training.snapshot().find(t=>t.id===target.id).hits!==0)throw Error('actual dummy resets its practice counter');
}
if(!state.note||state.inventory.apple!==7||!state.clearedCamps['old:camp'])throw Error('practice preserves all old progression');
if(resolveAreaId('rosepetal_0')!=='rosepetal_0')throw Error('retained tower interior and its story note stay accessible');
`,C);
console.log('PASS: three staged combo attacks, active-frame-only/deduplicated damage, collision-safe lunges, '+actualPoses+' actual source poses, idle timing/fallback, distinct hit areas, three real estate dummy combos/reset, safe home checkpoints and five retired-save migrations with progress preserved.');
