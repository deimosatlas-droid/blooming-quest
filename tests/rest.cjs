const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=require('node:path').resolve(__dirname,'../dist')+'/';
const maps=JSON.parse(fs.readFileSync(root+'fixed-maps.json')),atlas=JSON.parse(fs.readFileSync(root+'assets/world-v05.json'));
const objects=Object.values(maps).flatMap(area=>area.objects);
const garden=objects.find(o=>o.sprite==='estate_bed'&&/bed/i.test(o.label||''));
const fence=objects.find(o=>/wall|fence/.test(o.sprite)&&/beds/i.test(o.label||''));
const inn=objects.find(o=>/Hill Rest Inn/.test(o.label||''));
const bed=objects.find(o=>o.sprite==='bed');
const bench=objects.find(o=>/bench/.test(o.sprite));
assert(garden&&fence&&inn&&bed&&bench,'current map supplies all regression examples');
const elements={},storage={},gradient={addColorStop(){}};
const ctx=new Proxy({createRadialGradient:()=>gradient},{get:(o,k)=>o[k]??(()=>{})});
const element=()=>({style:{},textContent:'',hidden:false,getContext:()=>ctx,addEventListener(){}});
const C={console,Math,JSON,Image:class{},Promise,URLSearchParams,fetch:()=>new Promise(()=>{}),
  localStorage:{getItem:key=>storage[key]??null,setItem:(key,value)=>storage[key]=value},
  document:{getElementById:id=>elements[id]??=element(),createElement:element,querySelectorAll:()=>[]},
  window:{addEventListener(){}},location:{search:'',href:''},requestAnimationFrame(){},setInterval(){},testAtlas:atlas};
vm.createContext(C);vm.runInContext(fs.readFileSync(root+'adventure.js','utf8'),C);
vm.runInContext('atlas=testAtlas;texture={};amaal={};playing=true;ready=true;',C);
const cases=[
  ['vegetable flower bed',garden,false],['garden bed fence',fence,false,false],['Hill Rest Inn exterior',inn,false],
  ['ordinary bench',{...bench,label:'A place to sit'},false],['bedroom bed',bed,true],
  ['explicit rest flag',{...bench,label:'Shaded bench',rest:true},true],
  ['explicit rest action',{...bench,label:'Quiet seat',action:'rest'},true]
];
for(const[label,source,shouldRest,shouldInspect=true]of cases){
  const object={...source,x:200,y:160};
  if(source.hit)object.hit=[source.hit[0]+200-source.x,source.hit[1]+160-source.y,...source.hit.slice(2)];
  C.fixture={id:'rest-regression',name:'Rest regression',kind:'interior',w:30,h:20,theme:'inside',
    tiles:Array.from({length:20},()=> 'g'.repeat(30)),objects:[object],portals:[],signs:[],exits:[],spawn:[200,184]};
  C.testInspect=shouldInspect;
  vm.runInContext(`
    while(speaking){typed=fullText.length;nextLine()}
    maps={'rest-regression':fixture};enter('rest-regression');state.hp=2;state.food=0;
    if((findInteraction()?.type==='object')!==testInspect)throw Error('only purposeful fixtures offer an inspection');
    keyAction('e');if(!testInspect)save();
  `,C);
  assert.equal(vm.runInContext('state.hp',C),shouldRest?5:2,label+' health behavior');
  assert.equal(vm.runInContext('state.food',C),shouldRest?3:0,label+' noodle behavior');
  vm.runInContext('while(speaking){typed=fullText.length;nextLine()}',C);
  const saved=JSON.parse(storage['blooming-world-v05']);
  assert.equal(saved.hp,shouldRest?5:2);assert.equal(saved.food,shouldRest?3:0);
}
C.fixture={id:'rest-regression',name:'Blocked bed',kind:'interior',w:30,h:20,theme:'inside',tiles:Array.from({length:20},()=> 'g'.repeat(30)),objects:[{sprite:'bed',label:'A sleeping bed',x:200,y:160,hit:[186,147,28,8]},{sprite:'bookshelf',x:200,y:175,hit:[192,169,16,5]}],portals:[],signs:[],exits:[],spawn:[200,184]};
vm.runInContext("maps={'rest-regression':fixture};enter('rest-regression');state.hp=2;state.food=0;if(findInteraction())throw Error('bed must not be reached through furniture');keyAction('e')",C);
assert.equal(vm.runInContext('state.hp',C),2,'an obstructed bed cannot heal through furniture');
assert.equal(vm.runInContext('state.food',C),0,'an obstructed bed cannot refill supplies');
console.log('PASS: vegetable-bed/inn labels inspect without healing, fences stay quiet, benches do not heal, unobstructed beds/explicit rest restore supplies, and furniture blocks resting through it.');
