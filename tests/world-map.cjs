'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../dist'),world=JSON.parse(fs.readFileSync(path.join(root,'world.json')));
const releaseVersion=fs.readFileSync(path.join(root,'index.html'),'utf8').match(/adventure\.js\?v=(\d+)/)[1];
class Element{
 constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.attributes={};this.dataset={};this.textContent='';this.hidden=false;this.disabled=false;this._classes=new Set();this.style={setProperty:(k,v)=>{this.style[k]=v;}};this.classList={add:k=>this._classes.add(k),remove:k=>this._classes.delete(k),contains:k=>this._classes.has(k),toggle:(k,on)=>{if(on===undefined)on=!this._classes.has(k);if(on)this._classes.add(k);else this._classes.delete(k);return on;}};}
 set className(value){this._classes=new Set(String(value).split(/\s+/).filter(Boolean));}get className(){return [...this._classes].join(' ');}
 setAttribute(k,v){this.attributes[k]=String(v);if(k==='class')this.className=v;}getAttribute(k){return this.attributes[k];}
 appendChild(child){this.children.push(child);return child;}replaceChildren(...items){this.children=items;}
}
const ids=['map-shell','map-stage','map-art','route-layer','town-hotspots','current-location','marker-legend','town-list','detailtype','detailname','safe-label','detaildesc','detaillist','town-preview','current-note','travel','map-status'];
const elements=Object.fromEntries(ids.map(id=>[id,new Element(id==='travel'?'button':'div')])),events={};
const save={area:'tidepetal',x:648,y:760,hp:2,food:1,note:true,lastSafeTown:'tidepetal',inventory:{apple:4},clearedCamps:{'lavenderway:camp-1':true}};
const storage={'blooming-world-v05':JSON.stringify(save)},originalSave=storage['blooming-world-v05'];
const sandbox={window:{},document:{getElementById:id=>elements[id],createElement:tag=>new Element(tag),createElementNS:(ns,tag)=>new Element(tag),addEventListener:(event,fn)=>events[event]=fn},localStorage:{getItem:key=>storage[key]??null,setItem:(key,value)=>storage[key]=value},location:{href:'world-map.html'},fetch:()=>new Promise(()=>{}),console,Math,JSON,Map,Set};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.join(root,'world.js'),'utf8'),sandbox);const map=sandbox.window.BloomWorldMap;
map.initialize(world);
assert.equal(elements['town-hotspots'].children.length,8,'all8 towns have large map hotspots');assert.equal(elements['town-list'].children.length,8,'all8 remain available in the text list');assert.equal(elements['route-layer'].children.length,7,'six land roads plusone ferry');
assert.equal(map.getState().selectedId,'tidepetal','initial card follows current town');assert.equal(elements['current-location'].hidden,false);assert.match(elements['current-location'].getAttribute('aria-label'),/Tidepetal/);
const routeFor=id=>elements['route-layer'].children.find(line=>line.getAttribute('data-route')===id);
const pressed=()=>elements['town-hotspots'].children.filter(button=>button.getAttribute('aria-pressed')==='true');
for(const town of world.towns){
 const point=map.layout.towns[town.id];assert(point&&point.x>0&&point.x<100&&point.y>0&&point.y<100,town.id+' has an artwork hotspot');
 const button=elements['town-hotspots'].children.find(el=>el.dataset.town===town.id);sandbox.location.href='world-map.html';
 button.onmouseenter();assert.equal(map.getState().hoveredId,town.id);assert(button.classList.contains('is-previewed'));assert.equal(sandbox.location.href,'world-map.html','hover never travels');
 for(const route of [...world.roads,...world.ferries])assert.equal(routeFor(route.id).classList.contains('is-linked'),route.from===town.id||route.to===town.id,'hover highlights only connecting routes');
 button.onmouseleave();assert.equal(map.getState().hoveredId,null);
 button.onfocus();assert.equal(map.getState().hoveredId,town.id,'keyboard focus has hover parity');button.onblur();
 button.onclick();assert.equal(map.getState().selectedId,town.id);assert.equal(pressed().length,1);assert.equal(elements.detailname.textContent,town.name);assert.equal(elements.travel.disabled,false,'every town unlocked');
 assert.equal(elements.detaillist.children.length,town.places.length);elements.travel.onclick();
 assert.equal(sandbox.location.href,'index.html?area='+town.id+'&devtravel=1&v='+releaseVersion);assert.equal(storage['blooming-world-v05'],originalSave,'fast travel preserves quest, inventory, health and camps');
}
const destination=sandbox.location.href;assert.equal(map.choose('missing-town'),false);assert.equal(map.fastTravel('missing-town'),false);assert.equal(sandbox.location.href,destination);
// A new visit restores selection, while an interior still places Amaal at its parent town.
storage['blooming-world-v05']=JSON.stringify({...save,area:'rosepetal_0'});map.initialize(world);assert.match(elements['current-location'].getAttribute('aria-label'),/Rosepetal/);assert.equal(map.getState().selectedId,'moonblossom');
elements['map-art'].onerror();assert(elements['map-shell'].classList.contains('image-error'));assert.match(elements['map-status'].textContent,/still choose/);assert.equal(map.fastTravel('seabloom'),true,'town travel works even if artwork fails');
let prevented=false;events.keydown({key:'m',target:{tagName:'BODY'},preventDefault(){prevented=true;}});assert(prevented);assert.equal(sandbox.location.href,'index.html?devtravel=1&v='+releaseVersion);
const html=fs.readFileSync(path.join(root,'world-map.html'),'utf8');assert.match(html,new RegExp('world\\.js\\?v='+releaseVersion));assert.match(html,new RegExp('assets/map-a-world\\.png\\?v='+releaseVersion));assert(!html.includes('3 days')&&!html.includes('1 day'),'no invented journey-time copy');
const home=world.towns.find(town=>town.id==='rosepetal');assert.equal(home.locationType,'home-estate');assert.equal(home.residents,0,'the private estate has no village residents');
assert.equal(world.towns.filter(town=>town.locationType==='town').length,7,'seven towns accompany the home estate');assert.match(html,/Seven towns, a home estate/);
map.choose('rosepetal');assert.match(elements.detailtype.textContent,/HOME/);assert.match(elements['safe-label'].textContent,/home estate/);assert.match(elements['town-hotspots'].children.find(button=>button.dataset.town==='rosepetal').getAttribute('aria-label'),/home estate/);
assert(fs.existsSync(path.join(root,'assets/map-a-world.png')),'final MapA artwork must exist before publishing');
const image=fs.readFileSync(path.join(root,'assets/map-a-world.png'));assert.equal(image.toString('ascii',1,4),'PNG');assert(image.readUInt32BE(16)>=1000&&image.readUInt32BE(20)>=700,'MapA artwork has sufficient resolution');
console.log('PASS: MapA seven towns + home estate hover/focus selection, six roads + ferry highlights, current-location marker, instant unlocked dev travel, save preservation, fallback and artwork existence.');
