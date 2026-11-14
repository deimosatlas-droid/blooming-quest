'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../dist');
function game(saved,options={}){
 const elements={},storage=saved?{'blooming-world-v05':saved}:{},events={};
 const gradient={addColorStop(){}},context=new Proxy({createRadialGradient:()=>gradient},{get:(o,k)=>o[k]??(()=>{})});
 const element=()=>({style:{},textContent:'',hidden:false,disabled:false,getContext:()=>context,addEventListener(){},focus(){},setAttribute(){}});
 const C={window:{addEventListener:(name,fn)=>(events[name]??=[]).push(fn)},Math,JSON,Image:class{},Promise,URLSearchParams,
  fetch:()=>new Promise(()=>{}),localStorage:{getItem:key=>storage[key]??null,setItem:(key,value)=>storage[key]=value},
  document:{getElementById:id=>elements[id]??=element(),createElement:element,querySelectorAll:()=>[],addEventListener(){}},location:{search:'',href:''},requestAnimationFrame(){},setInterval(){}};
 const tree={opened:false,configure(config){this.config=config;},isOpen(){return this.opened;},open(){if(this.config.onPause()===false)return false;this.opened=true;return true;},close(){if(!this.opened)return;this.opened=false;this.config.onResume();},update(){}};C.window.BloomCombatUI=tree;
 const kit=options.traveller?{opened:false,view:'bag',updates:0,configure(config){this.config=config;this.update();},isOpen(){return this.opened;},open(view){if(!this.opened){if(this.config.getEnabled()===false||this.config.onPause()===false)return false;this.opened=true;}this.view=view;this.update();return true;},close(){if(!this.opened)return false;this.opened=false;this.config.onResume();this.update();return true;},update(){this.updates++;if(!this.config)return;for(const id of['kit-map','kit-bag','kit-journal','kit-options']){elements[id]??=element();elements[id].disabled=!this.config.getEnabled()&&!this.opened;}}}:null;if(kit)C.window.BloomTraveller=kit;
 vm.createContext(C);for(const file of ['spell-catalog.js','progression.js','motion.js','abilities.js','hero-animation.js','training.js','combat.js','adventure.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),C,{filename:file});
 const evaluate=source=>vm.runInContext(source,C);
 evaluate(`const base={name:'Test',kind:'home',safe:true,w:40,h:30,theme:'rose',tiles:Array(30).fill('g'.repeat(40)),spawn:[100,100],portals:[],signs:[],exits:[],objects:[]};
 maps={rosepetal:{...base,id:'rosepetal',objects:[{id:'dummy',sprite:'training_dummy',x:130,y:100,hit:[126,94,8,6],training:{id:'dummy',maxHealth:8,resetSeconds:2}}]},lavenderway:{...base,id:'lavenderway',name:'Test road',kind:'road',safe:false,camps:[{id:'camp-1',x:150,y:80,health:4,monster:'orc',maxAlive:1,totalSpawns:1,spawnPoints:[[120,100]]}]}};
 atlas={training_dummy:{rect:[0,0,16,32],anchor:[8,32]}};texture={};amaal={};ready=true;playing=true;
 combat.configure({image:{},layout:{types:{orc:{name:'Practice Orc',health:2,damage:1,speed:20,frames:[[0,0,16,16]],attackFrames:[[0,0,16,16]],attackKind:'cone'}}}});
 enter('rosepetal');state.inventory.apple=7;`);
 return{C,evaluate,storage,elements,tree,kit,events,step:(count=1)=>{for(let i=0;i<count;i++)evaluate('update(.04)');}};
}

module.exports={game};
