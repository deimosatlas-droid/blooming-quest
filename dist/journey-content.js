/* Authored first chapter, a replayable root cellar, and small home rituals. */
(function(global){
  'use strict';
  let config={},maps={},world={},atlas={},time=0,bridgeUntil=0;
  const DUNGEON='briarvault',FLOWERS={x:504,y:320},ENTRANCE={x:352,y:224};
  const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key),object=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  const saved=()=>config.getState?.()||{},area=()=>String(config.getArea?.()||saved().area||''),hero=()=>config.getHero?.()||{x:0,y:0,face:'up'};
  const day=()=>Math.max(1,Math.floor(Number(saved().worldClock?.day)||1));
  const absoluteMinute=()=>day()*1440+(Number(saved().worldClock?.minutes)||480);
  function state(){
    const s=saved();s.journey=object(s.journey);const q=s.journey;
    q.stage=Math.max(s.note?1:0,Math.min(7,Math.floor(Number(q.stage)||0)));q.run=Math.max(1,Math.min(1000000,Math.floor(Number(q.run)||1)));
    q.rewards=object(q.rewards);q.friends=object(q.friends);q.metDays=object(q.metDays);q.care=object(q.care);q.decorations=object(q.decorations);q.puzzles=object(q.puzzles);q.garden=object(q.garden);
    s.inventory=object(s.inventory);return q;
  }
  function changed(){config.onSave?.();}
  function tell(text){config.onMessage?.(text);}
  function reward(id,xp){const q=state();if(q.rewards[id])return false;q.rewards[id]=true;config.onReward?.({id:'journey:'+id,xp,kind:'quest'});return true;}
  function item(id,amount=1){const s=saved();s.inventory=object(s.inventory);s.inventory[id]=Math.max(0,Number(s.inventory[id])||0)+amount;}
  function cleared(id){const s=saved();return Boolean(Array.isArray(s.clearedCamps)?s.clearedCamps.includes(id):s.clearedCamps?.[id]||s.campProgress?.[id]?.cleared);}
  function roadResolved(){return cleared('lavenderway:camp-1');}
  function lines(speaker,...text){return text.map(line=>[speaker,line]);}
  function configure(options={}){config=options;state();if(maps[DUNGEON])applyPuzzleState();}
  function carve(tiles,x,y,w,h,value='c'){for(let row=y;row<y+h;row++)for(let col=x;col<x+w;col++)tiles[row][col]=value;}
  function dungeon(run){
    const tiles=Array.from({length:36},()=>Array(48).fill('s'));
    for(const rect of [[2,25,12,9],[6,21,4,5],[2,10,12,12],[14,15,5,3],[18,10,10,14],[24,6,4,5],[28,6,4,4],[31,3,15,15],[18,23,4,8],[13,28,6,3]])carve(tiles,...rect);
    carve(tiles,14,15,4,3,'w');
    const objects=[],add=(sprite,x,y,label,hit,glow=false)=>{if(atlas[sprite])objects.push({sprite,x,y,label,scale:1,glow,...(hit?{hit}:{}),journeyDecor:true});};
    add('bookshelf',64,472,'A brass plate: wake the wind, still the water, ask the roots',[50,459,28,8]);
    add('rock1',48,208,'Mineral shelf',[34,195,28,8]);add('mushroom',64,288,'Pale root-cellar mushrooms');add('mushroom',192,192,'Small cellar mushrooms');
    add('table',328,344,'Waystone checkpoint',[318,334,20,7],true);add('flowerpot2',400,184,'Living root seal');add('bookshelf',672,104,'Raeez’s field cache',[658,91,28,8]);
    for(const[x,y]of [[496,96],[704,224],[464,304],[352,368]])add('rock2',x,y,'Old cellar stone',[x-14,y-10,28,8]);
    return{id:DUNGEON,name:'Briarvault Root Cellar',kind:'dungeon',theme:'lavender',safe:false,w:48,h:36,spawn:[112,488],tiles:tiles.map(row=>row.join('')),objects,signs:[],exits:[],residents:[],animals:[],tilePalette:{c:'cobble_mossy',s:'stone',w:'water'},portals:[{x:112,y:520,target:'lavendyr',at:[352,248],label:'Return to Lavendyr',kind:'return'}],camps:[
      {id:'root-watch-'+run,name:'Briar sentry',hidden:true,clearOnDefeat:true,monster:'goblin',monsterName:'Root-cellar Sentry',monsterHealth:4,monsterDamage:1,monsterSpeed:24,totalSpawns:1,maxAlive:1,rewardXp:30,spawnEvery:4,x:144,y:240,spawnPoints:[[144,240]],leash:130},
      {id:'guardian-'+run,name:'Briarvault Guardian',boss:true,hidden:true,clearOnDefeat:true,monster:'minotaur',monsterName:'Briarvault Guardian',monsterHealth:16,monsterDamage:2,monsterSpeed:24,totalSpawns:1,maxAlive:1,rewardXp:120,x:608,y:176,spawnPoints:[[608,176]],leash:160}
    ]};
  }
  function install(nextMaps,nextWorld={},nextAtlas={}){
    maps=nextMaps||{};world=nextWorld||{};atlas=nextAtlas||{};maps[DUNGEON]=dungeon(state().run);
    const town=maps.lavendyr;if(town&&!town.objects.some(o=>o.id==='briarvault-entrance')&&atlas.camp_rock)town.objects.push({id:'briarvault-entrance',sprite:'camp_rock',x:352,y:224,scale:.65,label:'Briarvault’s old root-cellar arch',hit:[336,205,32,12],journeyDecor:true});
    world.dungeons=[...(world.dungeons||[]).filter(entry=>entry.id!==DUNGEON),{id:DUNGEON,name:'Briarvault Root Cellar',from:'lavendyr',description:'Wind, water and roots guard Raeez’s next clue.'}];applyPuzzleState();return maps[DUNGEON];
  }
  function applyPuzzleState(){
    const map=maps[DUNGEON];if(!map)return;const q=state();map.objects=map.objects.filter(o=>!o.journeyGate);
    for(const[id,open,box]of [['wind',q.puzzles.wind,[96,352,64,16]],['roots',q.puzzles.roots,[384,144,64,16]],['shortcut',q.shortcut,[208,448,32,48]]])if(!open)map.objects.push({id:'briar-gate-'+id,sprite:atlas.rock2?'rock2':'rock0',x:box[0]+box[2]/2,y:box[1]+box[3],hit:box,scale:1,label:id==='shortcut'?'Waystone shortcut':'A sealed '+id+' arch',journeyGate:id});
    const rows=map.tiles.map(row=>row.split(''));carve(rows,14,15,4,3,bridgeUntil>time?'c':'w');map.tiles=rows.map(row=>row.join(''));config.onMapChange?.(DUNGEON);
  }
  function onNote(){const q=state();q.stage=Math.max(1,q.stage);changed();return journal();}
  function maera(){
    const q=state();
    if(q.stage<1)return lines('Maera','You look as though you left a question at home. Check Raeez’s note in the tower; I’ll keep the kettle warm.');
    if(q.stage===1){q.stage=2;reward('maera-listens',20);changed();return lines('Maera','Raeez brought me a flower that would not open, even in sunlight. He was worried about the roots.','Look at the closed bluebells in my garden, just north of the south gate. Tell me what you find.');}
    if(q.stage===2)return lines('Maera','The closed bluebell patch is inside my garden. The south gate is open. Look closely at the roots.');
    if(q.stage===3&&!roadResolved())return lines('Maera','Those dark threads lead toward the Meadow Slime den on Lavenderway. Break that first roadside camp; then come back to me.');
    if(q.stage===3&&roadResolved())q.stage=4;
    if(q.stage===4){q.stage=5;item('briar_key');q.decorations.pressed_lavender=true;reward('maera-cellar-key',60);changed();return lines('Maera','The bluebells have opened. You untangled something old beneath that den.','Raeez left this root-cellar key with me. Briarvault is in the clearing northwest of the village. He tied his green cord to its arch.','Its old inscriptions lend three simple spells. Listen to the wind, still the water, and ask the roots to let you pass.');}
    if(q.stage===5)return lines('Maera','Briarvault’s entrance is northwest of the village. Use its three inscribed stones to learn the spells you need.','If the Guardian is too much, the waystone opens a shortcut and a safe place to recover.');
    if(q.stage===6)return lines('Maera','The roots are quiet. Check Raeez’s cache at the back of the Guardian’s chamber before you leave.');
    return lines('Maera','The bluebells are open again. Raeez’s trail leads toward the eastern lantern roads. Take his ribbon home before you follow it.','Briarvault can be entered again as an optional trial. The roads you made safe will stay safe.');
  }
  function dialogueFor(actor){
    if(!actor)return null;actor=actor.actor||actor;const q=state(),id=String(actor.id||''),name=actor.name||'Neighbour';
    if(id==='lavendyr_maera'||name==='Maera')return maera();
    if(actor.kind==='animal'||(maps.rosepetal?.animals||[]).some(a=>a.id===id)){
      if(q.metDays[id]!==day()){q.metDays[id]=day();q.friends[id]=Math.min(5,(Number(q.friends[id])||0)+1);if(q.friends[id]>=3){q.decorations.bramble_bell=true;reward('first-animal-friend',25);}changed();}
      return lines(name,(actor.lines||[])[0]||name+' leans into your hand.',q.friends[id]>=3?'A familiar friend. A little brass bell now hangs by the tower door.':'A quiet greeting remembered. Visit again on another day.');
    }
    if(id==='stormy-companion')return lines(name,q.stage<3?'Raeez said before dinner. I am keeping a very careful count of dinners.':q.stage<7?'Follow the clues, Amaal. I’ll watch the path behind us.':'A ribbon is a promise, not a goodbye. Let’s bring him home.');
    if(!id)return null;
    if(q.metDays[id]!==day()){q.metDays[id]=day();q.friends[id]=Math.min(5,(Number(q.friends[id])||0)+1);changed();}
    const minute=Number(saved().worldClock?.minutes)||480,weather=config.getWeather?.()||{},weatherKind=typeof weather==='string'?weather:weather.kind||weather.type||weather.weather,period=minute<660?'morning':minute<1020?'afternoon':'evening';
    const base=actor.lines?.length?actor.lines[(Number(q.friends[id])||1)%actor.lines.length]:'There is always another small job before supper.';
    let extra=q.friends[id]>=3?'Good to see you again, Amaal. There is always a place for you here.':period==='evening'?'The lamps are coming on. I’ll finish this and head home.':period==='morning'?'A fresh morning. Best get the outdoor jobs done while it lasts.':'Come sit for a moment when your feet need a rest.';
    if(weatherKind==='rain')extra='Mind the wet stones. I promised to bring the washing in before the next shower.';
    if(q.stage>=4&&String(actor.homeTown||'')==='lavendyr')extra='The bluebells are opening again. People have noticed what you did.';
    return lines(name,base,extra);
  }
  function point(id,x,y,label,range=27){return{type:'journey',id,x,y,label,range};}
  function nodes(id=area()){
    const q=state();if(id==='lavendyr')return[point('closed-flowers',FLOWERS.x,FLOWERS.y,q.stage>=4?'Inspect the reopened bluebells':'Investigate the closed bluebells'),point('cellar-entry',ENTRANCE.x,ENTRANCE.y+12,q.stage>=7&&q.runComplete?'Start another Briarvault trial':'Enter Briarvault Root Cellar')];
    if(id==='lavendyr_0')return[point('maera-ledger',224,208,'Read Maera’s signed remedy ledger')];
    if(id==='rosepetal')return[point('animal-feed',160,416,q.care.fedDay===day()?'Check the animals’ feed trough':'Feed the barn animals · 1 apple'),point('garden',688,472,gardenStage()>=3?'Harvest the kitchen garden':'Tend the kitchen garden'),point('keepsakes',480,328,'Arrange keepsakes at the tower door')];
    if(id===DUNGEON)return[point('wind-stone',128,392,'Read the hanging-chime inscription'),point('frost-west',208,264,'Read the frost-channel inscription'),point('frost-east',304,264,'Read the frost-channel inscription'),point('root-stone',416,184,'Read the living-root inscription'),point('waystone',328,360,'Rest at the waystone · open shortcut'),point('raeez-cache',672,120,q.stage>=7?'Read Raeez’s field note':'Search Raeez’s field cache')];return[];
  }
  function nearby(from=hero(),id=area()){
    let nearest=null;for(const node of nodes(id)){const d=Math.hypot(from.x-node.x,from.y-node.y);if(d<node.range&&(!nearest||d<nearest.d))nearest={...node,d};}return nearest;
  }
  function learn(id){config.onGrantSpell?.(id);}
  function interact(target){
    if(!target||!nodes().some(node=>node.id===target.id))return{ok:false};const q=state();let result;
    switch(target.id){
      case'maera-ledger':result=maera();break;
      case'closed-flowers':
        if(q.stage<2)result=lines('Amaal','Bluebells folded tight in daylight. Maera will know what to look for.');
        else if(q.stage===2){q.stage=roadResolved()?4:3;reward('bluebell-roots',30);result=lines('Amaal','Black root threads, pulling west toward Lavenderway. There’s a scrap of Raeez’s green cord caught here.',q.stage===4?'That den is already broken. I should tell Maera what I found.':'I should break the Meadow Slime den on Lavenderway, then report to Maera.');}
        else result=lines('Amaal',q.stage>=4?'Open bluebells. The change is small, but it matters.':'The dark threads still point toward the Meadow Slime den.');break;
      case'cellar-entry':
        if(q.stage<5){result=lines('Briarvault','The root-cellar lock is closed. Maera may know where its key has gone.');break;}
        if(q.stage>=7&&q.runComplete){q.run++;q.runComplete=false;q.checkpoint=false;q.shortcut=false;q.puzzles={};bridgeUntil=0;maps[DUNGEON]=dungeon(q.run);}
        applyPuzzleState();config.onEnter?.(DUNGEON,{at:q.checkpoint?[328,360]:[112,488]});changed();return{ok:true,entered:true};
      case'wind-stone':learn('stormy_gust');if(saved().inventory.wayfarer_seed){q.puzzles.wind=true;applyPuzzleState();result=lines('Chime inscription','The Wayfarer’s Seed answers. The wind arch opens.');}else result=lines('Chime inscription','Lent spell: Stormy Gust. Equip it from the Spellbook if needed.','Face north and cast at the hanging chime. A breath of wind wakes the sealed arch.');break;
      case'frost-west':case'frost-east':learn('frost_shard');if(saved().inventory.wayfarer_seed){bridgeUntil=time+45;applyPuzzleState();result=lines('Channel inscription','The Wayfarer’s Seed stills the channel for 45 seconds.');}else result=lines('Channel inscription','Lent spell: Frost Shard. Aim across the water channel and cast.','The frozen crossing lasts 45 seconds. It stays beneath your feet until you reach solid ground.');break;
      case'root-stone':learn('briar_bind');if(saved().inventory.wayfarer_seed){q.puzzles.roots=true;applyPuzzleState();result=lines('Root inscription','The Wayfarer’s Seed parts the living roots.');}else result=lines('Root inscription','Lent spell: Briar Bind. Face north and cast toward the living arch.','The old roots remember a gardener’s touch. Ask them to part.');break;
      case'waystone':
        q.checkpoint=true;q.shortcut=true;if(q.care['waystone-'+q.run]!==true){q.care['waystone-'+q.run]=true;config.onHeal?.(5);}applyPuzzleState();result=lines('Waystone','A checkpoint is kindled. The southern shortcut is open.','If you fall inside Briarvault, you can return here. This run’s first rest restores your health.');break;
      case'raeez-cache':
        if(!q.runComplete){result=lines('Amaal','The Guardian is still stirring. I should settle the roots before opening this cache.');break;}
        if(q.stage<7){q.stage=7;item('raeez_ribbon');item('wayfarer_seed');q.decorations.raeez_ribbon=true;reward('raeez-field-cache',90);}
        result=lines('Raeez’s field note','Amaal—if you found this, you followed the flowers. Of course you did. The sickness is moving east, beneath the lantern roads. I’m following it before it reaches home.','I kept the ribbon you tied to my pack. I’m leaving it here so you know I passed safely. Keep a light in the tower. — R', 'Wayfarer’s Seed found: the three cellar inscriptions can now answer Interact directly as an exploration aid.');break;
      case'animal-feed':
        if(q.care.fedDay===day())result=lines('Barnyard','The animals have fresh feed for today. Bramble gives a satisfied snuffle.');
        else if((Number(saved().inventory.apple)||0)<1)result=lines('Barnyard','Bring one wild apple to share with Bramble and the rescue animals.');
        else{saved().inventory.apple--;q.care.fedDay=day();reward('barn-feed-day-'+day(),15);result=lines('Barnyard','You share one apple among the animals and check the feed trough. Bramble noses your sleeve.');}break;
      case'garden':{
        const garden=q.garden;if(!Number.isFinite(garden.started)){garden.started=absoluteMinute();garden.watered=day();result=lines('Kitchen garden','You loosen the soil and water the seedlings. Check back as the game day passes.');}
        else if(gardenStage()>=3){item('berry',3);garden.started=absoluteMinute();q.decorations.garden_wreath=true;reward('first-garden-harvest',25);result=lines('Kitchen garden','Three portions of wild berries gathered. The plants remain; a new crop is growing. A garden wreath is ready for the tower.');}
        else{garden.watered=day();result=lines('Kitchen garden',['Small seedlings.','Healthy leaves.','Flowers and green berries.'][gardenStage()]+' The roots are watered; let them grow.');}break;}
      case'keepsakes':q.displayed=true;result=lines('Amaal',Object.keys(q.decorations).filter(id=>q.decorations[id]).length?'Lavender, bells and the things we bring home. I’ll leave a light for you, Raeez.':'A place for things worth keeping. Something from the journey will belong here.');break;
      default:return{ok:false};
    }
    changed();return{ok:true,lines:result||[]};
  }
  function gardenStage(){const start=state().garden.started;return Number.isFinite(start)?Math.max(0,Math.min(3,Math.floor((absoluteMinute()-start)/120))):0;}
  function onCampClear(camp,id=area()){
    const q=state();if(id==='lavenderway'&&String(camp.id)==='camp-1'&&q.stage===3){q.stage=4;tell('The bluebell roots relax. Return to Maera in Lavendyr.');changed();}
    if(id===DUNGEON&&camp.boss){q.runComplete=true;q.checkpoint=false;if(q.stage<6)q.stage=6;reward('cellar-trial-'+q.run,q.stage>=7?60:40);tell(q.stage<7?'The Guardian rests. Search Raeez’s field cache at the back of the chamber.':'Briarvault trial complete. Return through the shortcut; another trial is optional.');changed();}
  }
  function aimed(from,to){const distance=Math.hypot(from.x-to.x,from.y-to.y);if(distance>115)return false;if(distance<28)return true;const facing={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]}[from.face]||[0,-1];return((to.x-from.x)*facing[0]+(to.y-from.y)*facing[1])/distance>.35;}
  function onSpell(event={}){
    if(area()!==DUNGEON)return false;const id=typeof event==='string'?event:event.id||event.spellId,from=event.hero||hero(),q=state();let solved=false;
    if(['stormy_gust','gale_step','cyclone'].includes(id)&&aimed(from,{x:128,y:360})){q.puzzles.wind=true;solved=true;tell('The chime rings. The wind arch opens.');}
    if(['frost_shard','ice_ring','glacial_path'].includes(id)&&aimed(from,{x:256,y:264})){bridgeUntil=time+45;solved=true;tell('The channel freezes into a temporary crossing.');}
    if(['briar_bind','seed_bolt','thorn_wall'].includes(id)&&aimed(from,{x:416,y:152})){q.puzzles.roots=true;solved=true;tell('The living arch parts. The Guardian’s chamber is ahead.');}
    if(solved){applyPuzzleState();changed();}return solved;
  }
  function update(dt){
    time+=Math.max(0,Math.min(.1,Number(dt)||0));if(bridgeUntil&&time>=bridgeUntil){const h=hero();if(area()===DUNGEON&&h.x>=220&&h.x<=292&&h.y>=236&&h.y<=292)bridgeUntil=time+.3;else{bridgeUntil=0;applyPuzzleState();}}
  }
  function respawn(){const q=state();return area()===DUNGEON&&q.checkpoint&&!q.runComplete?{area:DUNGEON,at:[328,360]}:null;}
  function draw(g,cam){
    const id=area(),q=state();if(!g||!cam)return;g.save();
    if(maps[id]?.kind==='road'){
      for(const camp of maps[id].camps||[])if(cleared(id+':'+camp.id)){
        const x=Math.round(camp.x-cam.x),y=Math.round(camp.y-cam.y);if(x<-70||x>454||y<-50||y>306)continue;
        g.fillStyle='#729c56';for(let i=0;i<11;i++)g.fillRect(x-24+(i*13)%49,y-10+(i*7)%25,2,3);
        g.fillStyle='#9caa82';g.fillRect(x-5,y+14,10,5);g.fillStyle='#d8dbac';g.fillRect(x-3,y+15,6,1);
        if(camp.clearedLandmark){g.fillStyle='#9bbc6e';g.fillRect(x-1,y+10,2,3);g.fillRect(x-4,y+9,3,2);g.fillRect(x+1,y+7,3,2);}
      }
    }else if(id===DUNGEON){
      const map=maps[DUNGEON],left=Math.max(0,-cam.x),top=Math.max(0,-cam.y),right=Math.max(0,cam.x+384-map.w*16),bottom=Math.max(0,cam.y+256-map.h*16);
      g.fillStyle='#142c24b5';if(top)g.fillRect(0,0,384,top);if(bottom)g.fillRect(0,256-bottom,384,bottom);if(left)g.fillRect(0,top,left,256-top-bottom);if(right)g.fillRect(384-right,top,right,256-top-bottom);for(let row=Math.max(0,Math.floor(cam.y/16));row<Math.min(map.h,Math.ceil((cam.y+256)/16));row++)for(let col=Math.max(0,Math.floor(cam.x/16));col<Math.min(map.w,Math.ceil((cam.x+384)/16));col++)if(map.tiles[row][col]==='s'){
        const x=col*16-cam.x,y=row*16-cam.y;g.fillStyle='#142c24b5';g.fillRect(x,y,16,16);
        if(map.tiles[row+1]?.[col]&&map.tiles[row+1][col]!=='s'){g.fillStyle='#182a23';g.fillRect(x,y+12,16,4);g.fillStyle='#5a7150';g.fillRect(x,y+11,16,1);if((row+col)%3===0){g.fillStyle='#78935e';g.fillRect(x+3,y+9,5,2);}}
      }
      for(const[x,y,color]of [[128,360,q.puzzles.wind?'#d9d79c':'#b4c9be'],[256,264,bridgeUntil>time?'#c1eef3':'#6cb6cb'],[416,152,q.puzzles.roots?'#c5d890':'#658a59'],[328,344,q.checkpoint?'#f1d488':'#a5a7a0']]){const px=Math.round(x-cam.x),py=Math.round(y-cam.y);g.strokeStyle=color;g.lineWidth=1;g.strokeRect(px-5,py-5,10,10);g.fillStyle=color;g.fillRect(px-1,py-1,3,3);}
      for(const o of map.objects)if(o.journeyGate){const[x,y,w,h]=o.hit,px=x-cam.x,py=y-cam.y;g.fillStyle='#23382bc7';g.fillRect(px,py,w,h);g.fillStyle='#87917a';g.fillRect(px,py,3,h);g.fillRect(px+w-3,py,3,h);g.fillStyle='#56654e';g.fillRect(px,py,w,2);
        for(let i=4;i<w-3;i+=8){g.fillStyle='#6d6846';for(let step=0;step<h;step+=4){g.fillRect(px+i+((step+i)%3)-1,py+step,2,5);g.fillStyle=step%8?'#8da267':'#596b42';g.fillRect(px+i-2,py+step+1,4,2);g.fillStyle='#6d6846';}}
        if(o.journeyGate==='wind'){g.fillStyle='#bca575';g.fillRect(px+w/2,py+2,1,8);g.fillRect(px+w/2-3,py+9,7,4);g.fillStyle='#e1cf90';g.fillRect(px+w/2-2,py+9,4,1);}}
      if(bridgeUntil>time){g.fillStyle='#c6e8ed88';g.fillRect(224-cam.x,240-cam.y,64,48);g.strokeStyle='#e9f5ed';for(let i=0;i<4;i++){g.beginPath();g.moveTo(224+i*16-cam.x,240-cam.y);g.lineTo(232+i*16-cam.x,288-cam.y);g.stroke();}}
    }else if(id==='lavendyr'){
      g.fillStyle=q.stage>=4?'#b4a0d6':'#6b657c';for(let i=0;i<5;i++)g.fillRect(FLOWERS.x-12+i*6-cam.x,FLOWERS.y-12+(i%2)*3-cam.y,q.stage>=4?4:2,3);
    }else if(id==='rosepetal'){
      const count=Object.values(q.decorations).filter(Boolean).length;if(q.displayed&&count){const colors=['#b39bc9','#d3b76c','#8cba78','#92a4bc'];for(let i=0;i<Math.min(4,count);i++){g.fillStyle=colors[i];g.fillRect(464+i*9-cam.x,306-cam.y,6,11);}}
      if(Number.isFinite(q.garden.started)){g.fillStyle=['#7d9960','#678b4d','#a8b66b','#b65b81'][gardenStage()];for(let i=0;i<5;i++)g.fillRect(666+i*9-cam.x,448-cam.y,3+gardenStage(),3+gardenStage());}
    }g.restore();
  }
  function journal(){
    const q=state(),objectives=['Read Raeez’s note in Rosepetal Tower.','Find Maera in Lavendyr, or read her signed ledger inside the herbalist cottage.','Investigate the closed bluebells in Maera’s garden.','Break the Meadow Slime den on Lavenderway, then return to Maera.','Tell Maera that the bluebell roots have relaxed.','Enter Briarvault northwest of Lavendyr. Wake wind, still water, and part the roots.','Search Raeez’s field cache behind the Guardian.','Chapter one complete. Take Raeez’s ribbon home; optional Briarvault trials remain available.'];
    return{title:q.stage>=7?'Keep a light in the tower':'The flowers that forgot the sun',stage:q.stage,objective:objectives[q.stage],entries:[q.stage>=4?'Lavendyr’s bluebells are opening again.':'Dark threads close the bluebells along the old road.',q.checkpoint?'Briarvault waystone active. Southern shortcut open.':'Briarvault contains a waystone checkpoint.',q.stage>=7?'Raeez followed the sickness east beneath the lantern roads. The next chapter is still ahead.':'Raeez left a green cord to mark his trail.',q.run>1?'Optional Briarvault trial '+q.run+'. Cleared road camps stay peaceful.':'The root-cellar trial can be repeated after the first chapter.', 'Home garden: '+['seedlings','leaves','flowers','ripe berries'][gardenStage()]+'. Tower keepsakes: '+Object.values(q.decorations).filter(Boolean).length+'.']};
  }
  function itemInfo(id){return({briar_key:{name:'Briarvault Key',category:'quest',description:'Maera’s key opens the old root cellar northwest of Lavendyr. It stays safely in the satchel.'},raeez_ribbon:{name:'Raeez’s Green Ribbon',category:'quest',description:'Left in the field cache with Raeez’s promise to return. A keepsake for Rosepetal Tower.'},wayfarer_seed:{name:'Wayfarer’s Seed',category:'quest',description:'An exploration aid earned in Briarvault. Interact with its three inscriptions to wake wind, freeze water or part roots.'}})[id]||null;}
  global.BloomContent={configure,install,onNote,dialogueFor,nearby,interact,onCampClear,onSpell,update,draw,journal,respawn,gardenStage,nodes,itemInfo};
})(window);
