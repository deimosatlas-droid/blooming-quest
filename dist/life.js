/* Town routines use the same directional character proportions as Amaal. */
(function (global) {
  'use strict';
  const ROLE_ROWS = { herbalist:0, worker:1, merchant:2, blacksmith:3, elder:4, dockworker:5, child:6, villager:7, guard:1 };
  const DIRECTIONS = { down:0, right:1, up:2, left:3 };
  let map, residentsImage, animalsImage, animalLayout, people = [], animals = [], companion = null;
  let stand = () => true, navigation = [], columns = 0, rows = 0, chimneys = [], gardens = [], time = 0;
  let links=new Uint8Array(0),components=new Int32Array(0),sprites={},texture=null,rememberTime=0;
  let worldClock={day:1,minutes:480,actors:{},stationState:{}},onClockProgress=null,onClockChange=null,lastClockMinute=-1,lastSaveBucket=-1;
  const STEPS=[[1,0],[0,1],[-1,0],[0,-1]];
  let reservations=new Map(),waitingSpots=new Map(),stationQueues=new Map(),idleBounds=[];
  let partCache=new Map(),partCanvas=null;
  const HUMAN_GAP=16,STATION_GAP=23,IDLE_GAP=23;
  function normalizeClock(value){
    const clock=value&&typeof value==='object'?value:{};
    let day=Math.max(1,Math.floor(Number(clock.day)||1)),minutes=Number(clock.minutes);
    if(!Number.isFinite(minutes)||minutes<0)minutes=480;
    day+=Math.floor(minutes/1440);clock.day=day;clock.minutes=minutes%1440;
    if(!clock.actors||typeof clock.actors!=='object'||Array.isArray(clock.actors))clock.actors={};
    if(!clock.stationState||typeof clock.stationState!=='object'||Array.isArray(clock.stationState))clock.stationState={};
    return clock;
  }
  function clock(){
    const minute=Math.floor(worldClock.minutes),hour=Math.floor(minute/60);
    const phase=hour<5||hour>=21?'night':hour<8?'dawn':hour<12?'morning':hour<17?'afternoon':'evening';
    return {day:worldClock.day,minutes:worldClock.minutes,hour,label:String(hour).padStart(2,'0')+':'+String(minute%60).padStart(2,'0'),phase,period:phase[0].toUpperCase()+phase.slice(1)};
  }
  function absoluteMinute(){return(worldClock.day-1)*1440+worldClock.minutes;}
  function rememberPeople(){
    if(!map)return;
    for(const actor of people)if(actor.plan)worldClock.actors[map.id+':'+actor.id]={x:actor.x,y:actor.y,face:actor.face,task:actor.task?.key,gait:actor.steps,cooldownUntil:actor.cooldownUntil||0,at:absoluteMinute()};
    if(map.kind==='town')worldClock.stationState[map.id]={day:worldClock.day,at:absoluteMinute(),claims:[...reservations.values()].map(claim=>({...claim,point:claim.point.slice(),task:people.find(p=>p.id===claim.owner)?.desiredTaskKey})),queues:[...stationQueues].map(([key,queue])=>[key,queue.map(q=>({...q}))]),waits:[...waitingSpots].map(([id,spot])=>[id,{...spot,point:spot.point.slice(),task:people.find(p=>p.id===id)?.desiredTaskKey}])};
  }
  function advanceClock(dt){
    worldClock.minutes+=Math.max(0,dt)*.8;
    if(worldClock.minutes>=1440){worldClock.day+=Math.floor(worldClock.minutes/1440);worldClock.minutes%=1440;}
    const minute=Math.floor(absoluteMinute()),bucket=Math.floor(minute/30);
    if(minute!==lastClockMinute){lastClockMinute=minute;onClockChange?.(clock());}
    if(bucket!==lastSaveBucket){lastSaveBucket=bucket;rememberPeople();onClockProgress?.(clock());}
  }

  function seed(value) {
    let n = 2166136261;
    for (const ch of String(value)) n = Math.imul(n ^ ch.charCodeAt(0), 16777619);
    return (n >>> 0) / 4294967296;
  }
  function roleOf(person) {
    for (const candidate of [person.type, person.role]) {
      const text = String(candidate || '').toLowerCase();
      if (ROLE_ROWS[text] !== undefined) return text;
      if (/smith|forge/.test(text)) return 'blacksmith';
      if (/sail|dock|fisher|boat/.test(text)) return 'dockworker';
      if (/herb|garden|flower|healer/.test(text)) return 'herbalist';
      if (/merchant|baker|seller|shop/.test(text)) return 'merchant';
      if (/child|school/.test(text)) return 'child';
    }
    return 'villager';
  }
  function animalEntry(type) {
    const entry = animalLayout?.types?.[type];
    return typeof entry === 'number' ? { row:entry } : entry;
  }
  function configure(options = {}) {
    if(residentsImage!==(options.residentsImage||null)){partCache=new Map();partCanvas=null;}
    residentsImage = options.residentsImage || null;
    animalsImage = options.animalsImage || null;
    animalLayout = options.animalLayout || null;
    if(options.texture)texture=options.texture;
    if(options.clockState){if(options.clockState!==worldClock)rememberPeople();worldClock=normalizeClock(options.clockState);}
    else worldClock=normalizeClock(worldClock);
    if('onClockProgress'in options)onClockProgress=options.onClockProgress;
    if('onClockChange'in options)onClockChange=options.onClockChange;
    lastClockMinute=Math.floor(absoluteMinute());lastSaveBucket=Math.floor(lastClockMinute/30);
    onClockChange?.(clock());
  }
  function node(x,y) { return y*columns+x; }
  function nearestNode(x,y) {
    const tx = Math.max(0,Math.min(columns-1,Math.floor(x/16)));
    const ty = Math.max(0,Math.min(rows-1,Math.floor(y/16)));
    if (navigation[node(tx,ty)]) return node(tx,ty);
    for (let r=1;r<Math.max(columns,rows);r++) {
      let best=-1,distance=Infinity;
      for (let yy=Math.max(0,ty-r);yy<=Math.min(rows-1,ty+r);yy++) {
        for (let xx=Math.max(0,tx-r);xx<=Math.min(columns-1,tx+r);xx++) {
          if (Math.abs(xx-tx)!==r && Math.abs(yy-ty)!==r) continue;
          const index=node(xx,yy),d=Math.hypot(xx*16+8-x,yy*16+8-y);
          if (navigation[index] && d<distance) { best=index;distance=d; }
        }
      }
      if (best>=0) return best;
    }
    return -1;
  }
  function point(index) { return [(index%columns)*16+8,Math.floor(index/columns)*16+8]; }
  function safePoint(x,y) {
    if (stand(x,y)) return [x,y];
    if(!navigation.length)return null;
    const index=nearestNode(x,y);
    return index<0 ? null : point(index);
  }
  function clearLine(from,to) {
    const distance=Math.hypot(to[0]-from[0],to[1]-from[1]),steps=Math.max(1,Math.ceil(distance/5));
    for(let i=1;i<=steps;i++) if(!stand(from[0]+(to[0]-from[0])*i/steps,from[1]+(to[1]-from[1])*i/steps)) return false;
    return true;
  }
  function buildNavigation(){
    navigation=Array.from({length:columns*rows},(_,i)=>stand((i%columns)*16+8,Math.floor(i/columns)*16+8));
    links=new Uint8Array(navigation.length);components=new Int32Array(navigation.length);components.fill(-1);
    for(let i=0;i<navigation.length;i++)if(navigation[i]){
      const x=i%columns,y=Math.floor(i/columns);
      for(const d of [0,1]){
        const [dx,dy]=STEPS[d],nx=x+dx,ny=y+dy;if(nx>=columns||ny>=rows)continue;
        const next=node(nx,ny);
        if(navigation[next]&&clearLine(point(i),point(next))){links[i]|=1<<d;links[next]|=1<<(d+2);}
      }
    }
    let group=0;
    for(let i=0;i<navigation.length;i++)if(navigation[i]&&components[i]<0){
      const queue=[i];components[i]=group;
      for(let head=0;head<queue.length;head++){
        const current=queue[head],x=current%columns,y=Math.floor(current/columns);
        for(let d=0;d<4;d++)if(links[current]&(1<<d)){
          const next=node(x+STEPS[d][0],y+STEPS[d][1]);
          if(components[next]<0){components[next]=group;queue.push(next);}
        }
      }
      group++;
    }
  }
  function anchorNode(position){
    const first=nearestNode(...position);
    if(first>=0&&clearLine(position,point(first)))return first;
    const tx=Math.floor(position[0]/16),ty=Math.floor(position[1]/16);let best=-1,distance=Infinity;
    for(let yy=Math.max(0,ty-3);yy<=Math.min(rows-1,ty+3);yy++)for(let xx=Math.max(0,tx-3);xx<=Math.min(columns-1,tx+3);xx++){
      const index=node(xx,yy),p=point(index),d=Math.hypot(p[0]-position[0],p[1]-position[1]);
      if(navigation[index]&&d<distance&&clearLine(position,p)){best=index;distance=d;}
    }
    return best;
  }
  function terrainCost(index){const p=point(index),t=map.tiles?.[Math.floor(p[1]/16)]?.[Math.floor(p[0]/16)];return 'dcbi'.includes(t)?1:t==='a'?1.3:t==='f'?3.1:2.2;}
  function preferredLine(from,to){
    if(!clearLine(from,to))return false;
    if(Math.abs(from[0]-to[0])<.5||Math.abs(from[1]-to[1])<.5||Math.hypot(from[0]-to[0],from[1]-to[1])<36)return true;
    const steps=Math.ceil(Math.hypot(from[0]-to[0],from[1]-to[1])/8);
    for(let i=1;i<steps;i++){
      const x=Math.floor((from[0]+(to[0]-from[0])*i/steps)/16),y=Math.floor((from[1]+(to[1]-from[1])*i/steps)/16);
      if(!'dcbi'.includes(map.tiles?.[y]?.[x]||'x'))return false;
    }
    return true;
  }
  function humanSpace(actor,x,y,gap=HUMAN_GAP){
    return !people.some(other=>other!==actor&&other.positionReady!==false&&Math.hypot(other.x-x,other.y-y)<gap-.001);
  }
  function peopleLine(actor,from,to){
    if(!actor)return true;const steps=Math.max(1,Math.ceil(Math.hypot(to[0]-from[0],to[1]-from[1])/5));
    for(let i=1;i<=steps;i++)if(!humanSpace(actor,from[0]+(to[0]-from[0])*i/steps,from[1]+(to[1]-from[1])*i/steps))return false;
    return true;
  }
  function pathBetween(from,to,actor=null) {
    if(preferredLine(from,to)&&peopleLine(actor,from,to))return[to];
    const start=anchorNode(from),end=anchorNode(to);
    if(start<0||end<0||components[start]!==components[end])return[];
    const previous=new Int32Array(columns*rows);previous.fill(-1);
    const cost=new Float64Array(columns*rows);cost.fill(Infinity);cost[start]=0;previous[start]=start;
    const heap=[];
    const push=(index,score)=>{let i=heap.length;heap.push({index,score});while(i){const p=(i-1)>>1;if(heap[p].score<=score)break;heap[i]=heap[p];i=p;}heap[i]={index,score};};
    const pop=()=>{const top=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1].score<heap[c].score)c++;if(heap[c].score>=last.score)break;heap[i]=heap[c];i=c;}heap[i]=last;}return top;};
    const ex=end%columns,ey=Math.floor(end/columns);push(start,0);
    while(heap.length){
      const current=pop().index;if(current===end)break;
      const x=current%columns,y=Math.floor(current/columns);
      for(let d=0;d<4;d++)if(links[current]&(1<<d)){
        const nx=x+STEPS[d][0],ny=y+STEPS[d][1],next=node(nx,ny),nextPoint=point(next);if(actor&&next!==start&&!humanSpace(actor,...nextPoint))continue;const nextCost=cost[current]+terrainCost(next);
        if(nextCost<cost[next]){cost[next]=nextCost;previous[next]=current;push(next,nextCost+Math.abs(nx-ex)+Math.abs(ny-ey));}
      }
    }
    if(previous[end]<0)return[];
    const result=[to];for(let i=end;i!==start;i=previous[i])result.push(point(i));result.push(point(start));result.reverse();
    const smooth=[];let origin=from;
    for(let i=0;i<result.length;){let next=i;while(next+1<result.length&&preferredLine(origin,result[next+1])&&peopleLine(actor,origin,result[next+1]))next++;smooth.push(result[next]);origin=result[next];i=next+1;}
    return smooth;
  }
  function makeActor(source,index,isAnimal) {
    const id=source.id||((isAnimal?'animal':'resident')+'-'+index);
    const start=safePoint(Number(source.x),Number(source.y));
    if(!start)return null;
    const phase=seed(id),route=(source.route||[]).map(p=>safePoint(Number(p[0]),Number(p[1]))).filter(Boolean);
    const actor={...source,id,x:start[0],y:start[1],kind:isAnimal?'animal':'resident',
      type:isAnimal?(source.type||'chicken'):roleOf(source),face:source.face||'down',
      route:route.length?route:[start],routeIndex:0,path:[],pause:phase*3.5,
      phase,steps:phase*6,walking:false,talkCount:0,blocked:0,cooldownUntil:0,
      speed:source.speed||(isAnimal?12+phase*7:18+phase*6),positionReady:true};
    if(!isAnimal&&map.kind==='town'&&global.BloomRoutines){
      const initial=anchorNode(start),group=initial>=0?components[initial]:-1;
      actor.plan=global.BloomRoutines.create(map,source,index,{atlas:sprites,safePoint,reachable:p=>{const n=anchorNode(p);return n>=0&&components[n]===group;}});
      actor.task=global.BloomRoutines.at(actor.plan,clock());actor.state=actor.task.state;actor.navGroup=group;actor.positionReady=false;actor.spawnOrigin=start;
      const remembered=worldClock.actors[map.id+':'+id];
      const fresh=remembered&&remembered.task===actor.task.key&&absoluteMinute()-remembered.at>=0&&absoluteMinute()-remembered.at<20&&stand(remembered.x,remembered.y);
      const position=fresh?[remembered.x,remembered.y]:actor.task.node.point;
      actor.materializeAt=position;actor.rememberedFace=fresh?remembered.face:'down';if(fresh&&Number.isFinite(remembered.gait))actor.steps=remembered.gait;actor.pause=0;
      actor.working=false;actor.talkPause=0;if(remembered&&remembered.task===actor.task.key&&remembered.cooldownUntil>absoluteMinute())actor.cooldownUntil=remembered.cooldownUntil;
    }
    return actor;
  }
  function enter(nextMap,options={}) {
    rememberPeople();reservations=new Map();waitingSpots=new Map();stationQueues=new Map();map=nextMap;time=0;rememberTime=0;sprites=options.atlas||{};if(options.texture)texture=options.texture;
    const physical=options.canStand||(()=>true);
    const buildings=(map.objects||[]).filter(o=>/^(town_house_|house_)/.test(o.sprite)||['rose_tower','estate_barn','estate_greenhouse','lighthouse'].includes(o.sprite)).map(o=>{
      const a=sprites[o.sprite];if(!a)return null;const scale=o.scale||1;
      return[o.x-a.anchor[0]*scale-2,o.y-a.anchor[1]*scale-1,a.rect[2]*scale+4,a.rect[3]*scale-3];
    }).filter(Boolean);
    stand=(x,y)=>physical(x,y)&&!buildings.some(([bx,by,bw,bh])=>x>bx&&x<bx+bw&&y>by&&y<by+bh);
    columns=map.w;rows=map.h;
    const hasRoutines=(map.residents?.length||0)+(map.animals?.length||0)>0;
    if(hasRoutines)buildNavigation();else{navigation=[];links=new Uint8Array(0);components=new Int32Array(0);}
    idleBounds=(map.objects||[]).map(o=>{const a=sprites[o.sprite],scale=o.scale??1;if(!a||scale<.2)return null;return[o.x-a.anchor[0]*scale-2,o.y-a.anchor[1]*scale-1,a.rect[2]*scale+4,a.rect[3]*scale+3];}).filter(Boolean);
    people=(map.residents||[]).map((p,i)=>makeActor(p,i,false)).filter(Boolean);
    for(const actor of people)if(actor.plan){actor.scheduledTask=global.BloomRoutines.at(actor.plan,clock());actor.desiredTaskKey=actor.scheduledTask.key;}
    restoreStations();
    for(const actor of people)if(actor.plan){
      const desired=actor.scheduledTask;if(!actor.stationKey)assignTask(actor,desired,true);
      const remembered=actor.materializeAt,target=actor.task.node.point;
      const point=remembered&&stand(...remembered)&&humanSpace(actor,...remembered,HUMAN_GAP)?remembered:target;
      actor.x=point[0];actor.y=point[1];actor.face=actor.rememberedFace||'down';actor.positionReady=true;
    }
    animals=(map.animals||[]).map((p,i)=>makeActor(p,i,true)).filter(Boolean);
    companion=null;
    const catType=animalEntry('stormy')?'stormy':animalEntry('cat')?'cat':null;
    if(animalsImage&&catType&&options.hero) {
      const hero=options.hero,p=safePoint(hero.x-15,hero.y+12)||[hero.x,hero.y];
      companion={id:'stormy-companion',name:'Stormy',kind:'animal',type:catType,x:p[0],y:p[1],
        face:'down',phase:.7,steps:0,walking:false,flying:true,trail:[],speed:44,talkCount:0};
    }
    chimneys=[];gardens=[];
    if(map.kind!=='interior')for(const [index,o]of(map.objects||[]).entries()) {
      const sprite=sprites[o.sprite],scale=o.scale||1;
      if(!sprite)continue;
      if(/^(house_|town_house_)/.test(o.sprite)&&index%3!==1)chimneys.push({x:o.x+sprite.rect[2]*scale*.16,y:o.y-sprite.rect[3]*scale+13*scale,phase:seed(o.sprite+index)});
      if(/flower|planter|crop|garden|estate_bed/.test(o.sprite)&&index%5===0)gardens.push({x:o.x,y:o.y-5,phase:seed(index)});
    }
    // A few insects belong to planted beds rather than to random screen positions.
    gardens=gardens.slice(0,7);
  }
  function faceToward(actor,dx,dy) {
    if(Math.abs(dx)>Math.abs(dy))actor.face=dx>0?'right':'left';
    else if(dy)actor.face=dy>0?'down':'up';
  }
  function updateActor(actor,dt) {
    actor.walking=false;
    if(actor.pause>0){actor.pause-=dt;return;}
    if(!actor.path.length) {
      let target=actor.route[actor.routeIndex];
      if(Math.hypot(target[0]-actor.x,target[1]-actor.y)<3) {
        actor.routeIndex=(actor.routeIndex+1)%actor.route.length;
        actor.pause=2.5+seed(actor.id+actor.routeIndex)*4;
        if(actor.route.length===1)actor.pause=6;
        return;
      }
      actor.path=pathBetween([actor.x,actor.y],target);
      if(!actor.path.length){actor.routeIndex=(actor.routeIndex+1)%actor.route.length;actor.pause=2;return;}
    }
    const target=actor.path[0],dx=target[0]-actor.x,dy=target[1]-actor.y,distance=Math.hypot(dx,dy);
    if(distance<.6){actor.path.shift();return;}
    const step=Math.min(distance,actor.speed*dt),nx=actor.x+dx/distance*step,ny=actor.y+dy/distance*step;
    if(stand(nx,ny)&&clearLine([actor.x,actor.y],[nx,ny])) {
      actor.x=nx;actor.y=ny;actor.steps+=dt;actor.walking=true;actor.blocked=0;faceToward(actor,dx,dy);
    }else {
      actor.blocked+=dt;
      if(actor.blocked>.5){actor.path=[];actor.routeIndex=(actor.routeIndex+1)%actor.route.length;actor.pause=1;actor.blocked=0;}
    }
  }
  function restoreStations(){
    const saved=worldClock.stationState?.[map.id],now=absoluteMinute();
    if(!saved||saved.day!==worldClock.day||saved.at>now)return;
    const byId=new Map(people.filter(p=>p.plan).map(p=>[p.id,p]));
    for(const [key,entries]of saved.queues||[]){
      const queue=entries.filter(q=>byId.get(q.id)?.desiredTaskKey===q.task).map(q=>({...q}));
      if(queue.length){stationQueues.set(key,queue);for(const q of queue)byId.get(q.id).queuedStationKey=key;}
    }
    for(const claim of saved.claims||[]){
      const actor=byId.get(claim.owner);if(!actor||actor.desiredTaskKey!==claim.task)continue;
      const desired=actor.scheduledTask,node=(desired.candidates||[desired.node]).find(n=>stationKey(n)===claim.stationKey&&Math.hypot(n.point[0]-claim.point[0],n.point[1]-claim.point[1])<8&&n.stationKind===claim.kind);
      if(!node||!stand(...node.point))continue;
      const deadline=claim.leaseUntil??claim.approachUntil;
      if(deadline<=now){actor.cooldownUntil=Math.max(actor.cooldownUntil||0,deadline+8+actor.phase*6);continue;}
      if(nearClaim(actor,node.point,STATION_GAP))continue;
      reservations.set(claim.stationKey,{...claim,point:node.point.slice()});actor.stationKey=claim.stationKey;actor.reservationStatus=claim.status;actor.waitingFor=null;
      actor.task=global.BloomRoutines.forNode?global.BloomRoutines.forNode(actor.plan,desired,node):{...desired,node};removeQueued(actor);
    }
    for(const [id,spot]of saved.waits||[]){
      const actor=byId.get(id);if(!actor||actor.stationKey||actor.desiredTaskKey!==spot.task||!idleSafe(actor,spot.point))continue;
      waitingSpots.set(id,{point:spot.point.slice(),label:spot.label});actor.waitingFor=stationKey(actor.scheduledTask.node);
    }
  }
  function stationKey(node){return node.stationKey||(map.id||'town')+':point-'+Math.round(node.point[0]/8)*8+'-'+Math.round(node.point[1]/8)*8;}
  function removeQueued(actor){
    for(const [key,queue]of stationQueues){const remaining=queue.filter(q=>q.id!==actor.id);if(remaining.length)stationQueues.set(key,remaining);else stationQueues.delete(key);}
    actor.queuedStationKey=null;
  }
  function releaseStation(actor){
    if(actor.stationKey&&reservations.get(actor.stationKey)?.owner===actor.id)reservations.delete(actor.stationKey);
    waitingSpots.delete(actor.id);removeQueued(actor);actor.stationKey=null;actor.reservationStatus=null;actor.waitingFor=null;
  }
  function queueAt(actor,desired){
    const key=stationKey(desired.node);if(actor.queuedStationKey===key)return;
    removeQueued(actor);const queue=stationQueues.get(key)||[];queue.push({id:actor.id,task:desired.key,since:absoluteMinute()});stationQueues.set(key,queue);actor.queuedStationKey=key;
  }
  function nearClaim(actor,p,gap){
    for(const claim of reservations.values())if(claim.owner!==actor.id&&Math.hypot(claim.point[0]-p[0],claim.point[1]-p[1])<gap)return true;
    for(const [id,spot]of waitingSpots)if(id!==actor.id&&Math.hypot(spot.point[0]-p[0],spot.point[1]-p[1])<gap)return true;
    return false;
  }
  function canReserve(actor,node){
    const key=stationKey(node),owner=reservations.get(key);if(owner&&owner.owner!==actor.id)return false;
    const queue=(stationQueues.get(key)||[]).filter(q=>people.some(p=>p.id===q.id&&p.desiredTaskKey===q.task));
    if(queue.length){stationQueues.set(key,queue);if(queue[0].id!==actor.id)return false;}
    return stand(...node.point)&&!nearClaim(actor,node.point,STATION_GAP)&&humanSpace(actor,...node.point,IDLE_GAP);
  }
  function idleSafe(actor,p){
    const tile=map.tiles?.[Math.floor(p[1]/16)]?.[Math.floor(p[0]/16)]||'g';if(tile!=='g'&&tile!=='a')return false;
    if(!stand(...p)||nearClaim(actor,p,IDLE_GAP)||!humanSpace(actor,...p,IDLE_GAP))return false;
    if(idleBounds.some(([x,y,w,h])=>p[0]>x&&p[0]<x+w&&p[1]>y&&p[1]<y+h))return false;
    const n=anchorNode(p);return n>=0&&components[n]===actor.navGroup;
  }
  function waitingPoint(actor,desired){
    const centre=desired.node.point;
    for(const radius of[30,46,64,88,116,152,200,264])for(let i=0;i<20;i++){
      const angle=(i/20+actor.phase)*Math.PI*2,p=[Math.floor((centre[0]+Math.cos(angle)*radius)/16)*16+8,Math.floor((centre[1]+Math.sin(angle)*radius)/16)*16+8];
      if(idleSafe(actor,p))return p;
    }
    const candidates=[];for(let i=0;i<navigation.length;i++)if(navigation[i]&&components[i]===actor.navGroup){const p=point(i);if(idleSafe(actor,p))candidates.push(p);}
    candidates.sort((a,b)=>Math.hypot(a[0]-centre[0],a[1]-centre[1])-Math.hypot(b[0]-centre[0],b[1]-centre[1]));
    return candidates[0]||safePoint(...actor.spawnOrigin)||[actor.x,actor.y];
  }
  function waitNearby(actor,desired,initial=false){
    if(!actor.waitingFor||!waitingSpots.has(actor.id)){
      const p=waitingPoint(actor,desired);waitingSpots.set(actor.id,{point:p,label:desired.node.label});
    }
    const p=waitingSpots.get(actor.id).point;actor.waitingFor=stationKey(desired.node);actor.reservationStatus='waiting';
    actor.task={...desired,node:{...desired.node,point:p,label:'a quiet spot near '+desired.node.label},action:'rest',label:actor.cooldownUntil>absoluteMinute()?'Taking a short work break':'Waiting for '+desired.node.label,state:'waiting',waitingFor:desired.node.label};
    actor.path=[];actor.pause=0;actor.state='waiting';actor.working=false;actor.waitRetry=2+actor.phase*1.5;
    if(initial){actor.x=p[0];actor.y=p[1];}
  }
  function assignTask(actor,desired,initial=false){
    if(actor.cooldownUntil>absoluteMinute()){waitNearby(actor,desired,initial);return false;}
    for(const candidate of desired.candidates||[desired.node])if(canReserve(actor,candidate)){
      const key=stationKey(candidate);removeQueued(actor);waitingSpots.delete(actor.id);actor.stationKey=key;actor.waitingFor=null;actor.reservationStatus='approaching';
      reservations.set(key,{stationKey:key,owner:actor.id,point:candidate.point.slice(),label:candidate.label,kind:candidate.stationKind||'place',status:'approaching',since:absoluteMinute(),approachUntil:absoluteMinute()+90,leaseUntil:null,capacity:1});
      actor.task=global.BloomRoutines.forNode?global.BloomRoutines.forNode(actor.plan,desired,candidate):{...desired,node:candidate};actor.path=[];actor.pause=0;actor.state=actor.task.state;actor.working=false;return true;
    }
    queueAt(actor,desired);waitNearby(actor,desired,initial);return false;
  }
  function moveResident(actor,target,dt){
    const dx=target[0]-actor.x,dy=target[1]-actor.y,distance=Math.hypot(dx,dy);if(distance<.6){actor.path.shift();return;}
    actor.brisk=actor.state==='travel'&&distance>28&&actor.phase>.55;const step=Math.min(distance,actor.speed*(actor.brisk?1.18:1)*dt),ux=dx/distance,uy=dy/distance;
    const alternatives=[[ux,uy],[ux*.4-uy*.91,uy*.4+ux*.91],[ux*.4+uy*.91,uy*.4-ux*.91]];
    let moved=false;
    for(const [vx,vy]of alternatives){
      const nx=actor.x+vx*step,ny=actor.y+vy*step;
      if(stand(nx,ny)&&clearLine([actor.x,actor.y],[nx,ny])&&humanSpace(actor,nx,ny)){
        actor.x=nx;actor.y=ny;actor.steps+=dt*(actor.brisk?1.2:1);actor.walking=true;actor.blocked=0;faceToward(actor,dx,dy);moved=true;break;
      }
    }
    if(!moved){actor.blocked+=dt;if(actor.blocked>.7){actor.path=[];actor.pause=.25+actor.phase*.35;actor.blocked=0;}}
  }
  function updateRoutine(actor,dt){
    const desired=global.BloomRoutines.at(actor.plan,clock());actor.walking=false;actor.brisk=false;
    if(actor.desiredTaskKey!==desired.key){releaseStation(actor);actor.cooldownUntil=0;actor.desiredTaskKey=desired.key;actor.scheduledTask=desired;assignTask(actor,desired);actor.blocked=0;}
    else actor.scheduledTask=desired;
    const claim=actor.stationKey?reservations.get(actor.stationKey):null;
    if(claim&&((claim.leaseUntil!==null&&absoluteMinute()>=claim.leaseUntil)||(claim.status==='approaching'&&absoluteMinute()>claim.approachUntil))){
      releaseStation(actor);actor.cooldownUntil=absoluteMinute()+8+actor.phase*6;waitNearby(actor,desired);
    }
    if(actor.waitingFor){
      actor.waitRetry-=dt;
      if(actor.waitRetry<=0&&actor.cooldownUntil<=absoluteMinute())assignTask(actor,desired);
    }
    if(actor.talkPause>0){actor.talkPause-=dt;actor.working=false;return;}
    const target=actor.task.node.point,d=Math.hypot(target[0]-actor.x,target[1]-actor.y);
    if(d<=2.5){
      actor.state=actor.waitingFor?'waiting':actor.task.state;actor.working=actor.state==='work';actor.path=[];actor.blocked=0;
      const current=actor.stationKey?reservations.get(actor.stationKey):null;
      if(current){
        current.status='occupied';actor.reservationStatus='occupied';
        if(current.leaseUntil===null&&!['home','breakfast'].includes(actor.task.phase))current.leaseUntil=absoluteMinute()+18+actor.phase*8;
      }
      const focus=actor.task.node.focus;faceToward(actor,focus[0]-actor.x,focus[1]-actor.y);
      if(actor.task.action==='watch')actor.face=['left','down','right','down'][Math.floor(absoluteMinute()/4.8+actor.phase*4)%4];
      return;
    }
    actor.state=actor.waitingFor?'waiting':'travel';actor.working=false;
    if(actor.pause>0){actor.pause-=dt;return;}
    if(!actor.path.length){actor.path=pathBetween([actor.x,actor.y],target,actor);if(!actor.path.length){actor.pause=.7+actor.phase;return;}}
    moveResident(actor,actor.path[0],dt);
  }
  function update(dt,hero) {
    if(!map)return;
    time+=dt;advanceClock(dt);rememberTime+=dt;
    for(const actor of people){if(actor.plan)updateRoutine(actor,dt);else updateActor(actor,dt);}
    for(const actor of animals)updateActor(actor,dt);
    if(rememberTime>=2){rememberTime=0;rememberPeople();}
    if(companion&&hero) {
      const trail=companion.trail;
      if(!trail.length||Math.hypot(hero.x-trail[trail.length-1][0],hero.y-trail[trail.length-1][1])>5)trail.push([hero.x,hero.y]);
      companion.walking=false;
      if(trail.length>3) {
        const target=trail[0],dx=target[0]-companion.x,dy=target[1]-companion.y,d=Math.hypot(dx,dy);
        const gap=Math.hypot(hero.x-companion.x,hero.y-companion.y);
        const speed=gap>52?Math.min(140,companion.speed+(gap-35)*1.5):companion.speed;
        const step=Math.min(d,speed*dt);
        if(d<3)trail.shift();
        else{companion.x+=dx/d*step;companion.y+=dy/d*step;faceToward(companion,dx,dy);companion.steps+=dt;companion.walking=true;}
      }
      if(trail.length>55)trail.splice(0,trail.length-55);
    }
  }
  function actors(camera={x:0,y:0},width=384,height=256) {
    return [...(residentsImage?people:[]),...(animalsImage?animals.filter(a=>animalEntry(a.type)):[]),...(companion?[companion]:[])]
      .filter(a=>a.x>camera.x-24&&a.x<camera.x+width+24&&a.y>camera.y-12&&a.y<camera.y+height+48)
      .map(actor=>({life:true,sort:actor.y,actor}));
  }
  function spriteParts(row,col){
    const key=row+':'+col;if(partCache.has(key))return partCache.get(key);
    let left=9,right=30,top=8,bottom=39;
    if(residentsImage?.width&&typeof document!=='undefined')try{
      partCanvas=partCanvas||document.createElement('canvas');partCanvas.width=40;partCanvas.height=48;
      const ctx=partCanvas.getContext('2d');ctx.clearRect(0,0,40,48);ctx.drawImage(residentsImage,col*40,row*48,40,48,0,0,40,48);
      if(ctx.getImageData){const data=ctx.getImageData(0,0,40,48).data;let l=40,r=-1,t=48,b=-1;
        for(let y=0;y<48;y++)for(let x=0;x<40;x++)if(data[(y*40+x)*4+3]>24){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}
        if(r>=l){left=l;right=r;top=t;bottom=b;}
      }
    }catch(e){}
    const height=bottom-top+1,headEnd=Math.min(bottom-7,top+Math.round(height*.58)),bodyStart=Math.max(top,headEnd-4),bodyEnd=bottom-2,legStart=Math.max(bodyStart+2,bodyEnd-5);
    const leftArm=Math.max(13,Math.min(19,Math.round(left+(right-left+1)*.32))),rightArm=Math.max(21,Math.min(27,Math.round(right-(right-left+1)*.32)));
    const parts={left,right,top,bottom,headEnd,bodyStart,bodyEnd,legStart,leftArm,rightArm};partCache.set(key,parts);return parts;
  }
  function animationPose(actor){
    const t=absoluteMinute()/.8,offset=actor.phase*Math.PI*2,gait=actor.steps*10.5,walk=Boolean(actor.walking),working=Boolean(actor.working&&!walk),action=actor.task?.action||'rest';
    const breathe=Math.sin(t*.9+offset)>.55?1:0;
    const pose={motion:walk?(actor.brisk?'brisk-walk':'walk'):working?'work-'+action:'idle',baseX:walk?0:Math.round(Math.sin(t*.42+offset)*.6),torsoX:walk?Math.round(Math.sin(gait)*.8):0,torsoY:walk?-Math.round(Math.abs(Math.sin(gait))*(actor.brisk?2:1.4)):0,stretch:walk?0:breathe,headX:0,headY:walk?-Math.round(Math.abs(Math.sin(gait))):(-breathe),headFace:actor.face,leftArmX:0,rightArmX:0,leftArmY:0,rightArmY:0,leftLegX:0,rightLegX:0,leftLegY:0,rightLegY:0,clothSway:0};
    if(walk){
      pose.leftLegX=Math.round(Math.sin(gait));pose.rightLegX=-pose.leftLegX;
      pose.leftLegY=-Math.round(Math.max(0,Math.sin(gait))*(actor.brisk?3:2));pose.rightLegY=-Math.round(Math.max(0,-Math.sin(gait))*(actor.brisk?3:2));
      pose.leftArmY=-Math.round(Math.max(0,-Math.sin(gait))*2);pose.rightArmY=-Math.round(Math.max(0,Math.sin(gait))*2);
      pose.leftArmX=-Math.round(Math.sin(gait)*.8);pose.rightArmX=Math.round(Math.sin(gait)*.8);pose.clothSway=-pose.torsoX;
    }else if(working){
      const side=actor.face==='left'?-1:1;
      if(action==='hammer'){pose.rightArmY=-Math.round((Math.sin(t*7+offset)+1)*1.5);pose.torsoY=Math.sin(t*7+offset)<-.6?1:0;pose.headY=pose.torsoY;}
      else if(action==='craft'){pose.leftArmY=-1;pose.rightArmY=-1-Math.round(Math.max(0,Math.sin(t*4+offset)));pose.headY=1;}
      else if(action==='water'||action==='fill'){pose.rightArmY=-1;pose.rightArmX=side*Math.round(1+Math.sin(t*2+offset));pose.torsoX=side;pose.headY=0;}
      else if(action==='sweep'){pose.rightArmX=Math.round(Math.sin(t*3+offset)*2);pose.leftArmY=-1;pose.torsoX=Math.round(Math.sin(t*3+offset));}
      else if(action==='read'){pose.leftArmY=-1;pose.rightArmY=-1;pose.headY=1;}
      else if(action==='carry'||action==='serve'){pose.leftArmY=-1;pose.rightArmY=-1;pose.rightArmX=action==='serve'?Math.round(Math.sin(t*2+offset)):0;}
      else if(action==='lamp'){pose.rightArmY=-2;pose.headY=-1;}
      else if(action==='tend'){pose.rightArmX=Math.round(Math.sin(t*2+offset));pose.rightArmY=-1;}
    }else if(actor.talkPause<=0&&(t+actor.phase*13)%13>8.5&&(t+actor.phase*13)%13<10.8){
      pose.headFace=actor.phase>.5?'left':'right';pose.headX=actor.phase>.5?-1:1;
    }
    if(actor.plan?.job==='dock'&&walk||actor.task?.phase==='shopping'){pose.leftArmY=-1;pose.rightArmY=-1;}
    return pose;
  }
  function drawResident(actor,ctx,x,y){
    const col=DIRECTIONS[actor.face]??0,row=Number.isInteger(actor.spriteRow)?actor.spriteRow:(ROLE_ROWS[actor.type]??7),parts=spriteParts(row,col),pose=animationPose(actor),baseX=x-20+pose.baseX,baseY=y-40;
    const piece=(sourceCol,sx,sy,w,h,dx=0,dy=0,stretch=0)=>{if(w>0&&h>0)ctx.drawImage(residentsImage,sourceCol*40+sx,row*48+sy,w,h,Math.round(baseX+sx+dx),Math.round(baseY+sy+dy),w,h+stretch);};
    // Overlapping attachment bands cover every source pixel. Limbs move beneath
    // the torso/head, so bends never expose a cut seam or a detached sprite part.
    piece(col,0,parts.legStart,22,48-parts.legStart,pose.leftLegX,pose.leftLegY);
    piece(col,18,parts.legStart,22,48-parts.legStart,pose.rightLegX,pose.rightLegY);
    const height=parts.bodyEnd-parts.bodyStart+1,bodyY=pose.torsoY-pose.stretch;
    piece(col,0,parts.bodyStart,parts.leftArm,height,pose.torsoX+pose.leftArmX+pose.clothSway,bodyY+pose.leftArmY,pose.stretch);
    piece(col,parts.rightArm,parts.bodyStart,40-parts.rightArm,height,pose.torsoX+pose.rightArmX+pose.clothSway,bodyY+pose.rightArmY,pose.stretch);
    piece(col,parts.leftArm-4,parts.bodyStart,parts.rightArm-parts.leftArm+8,height,pose.torsoX,bodyY,pose.stretch);
    const headCol=DIRECTIONS[pose.headFace]??col,head=spriteParts(row,headCol);
    piece(headCol,0,0,40,head.headEnd+1,pose.headX,pose.headY);
    return pose;
  }
  function draw(entry,ctx,camera) {
    const actor=entry.actor,x=Math.round(actor.x-camera.x),y=Math.round(actor.y-camera.y);
    const walkingBob=actor.walking?Math.round(Math.sin(actor.steps*12)*.8):actor.working&&['hammer','craft','sweep'].includes(actor.task?.action)?Math.round(Math.sin(time*5+actor.phase)*.6):0;
    ctx.fillStyle='#193c2944';ctx.beginPath();ctx.ellipse(x,y+1,actor.kind==='resident'?5:4,1.7,0,0,Math.PI*2);ctx.fill();
    if(actor.kind==='resident'&&residentsImage) {
      const pose=drawResident(actor,ctx,x,y);
      if(actor.plan)workEffect(actor,ctx,x+pose.baseX,y,pose);
      return;
    }
    const sprite=animalEntry(actor.type);
    if(!animalsImage||!sprite)return;
    const [cw,ch]=animalLayout.cell||[32,32],anchor=sprite.anchor||animalLayout.anchor||[cw/2,ch-4];
    const directions=sprite.directions??animalLayout.directions??4;
    const col=directions===1?(sprite.column||0):(DIRECTIONS[actor.face]??0);
    const floating=actor.flying?-9+Math.round(Math.sin(time*3)*1.5):walkingBob;
    ctx.drawImage(animalsImage,col*cw,sprite.row*ch,cw,ch,x-anchor[0],y-anchor[1]+floating,cw,ch);
  }
  function workEffect(actor,ctx,x,y,pose=animationPose(actor)){
    const animTime=absoluteMinute()/.8;
    const action=actor.task?.action,working=actor.working&&!actor.walking,carrying=actor.plan.job==='dock'&&actor.state==='travel'||actor.task?.phase==='shopping'||working&&['carry','serve','shop'].includes(action);
    const side=actor.face==='left'?-1:1,handX=x+side*6+pose.torsoX+(side<0?pose.leftArmX:pose.rightArmX),handY=y-13+pose.torsoY+(side<0?pose.leftArmY:pose.rightArmY);
    ctx.save();
    if(carrying){
      const a=sprites.port_cargo_sack;if(a&&texture)ctx.drawImage(texture,...a.rect,x-4+pose.torsoX,y-15+pose.torsoY,9,9);
      else{ctx.fillStyle='#9d7347';ctx.fillRect(x-4,y-14+pose.torsoY,8,6);ctx.fillStyle='#d4b774';ctx.fillRect(x-4,y-14+pose.torsoY,8,1);}
    }
    if(working&&(action==='water'||action==='fill')){
      const a=sprites.port_barrel;if(a&&texture)ctx.drawImage(texture,...a.rect,handX-3,handY-3,6,6);
      const focus=actor.task.node.focus||[handX+({left:-1,right:1}[actor.face]||0)*12,handY+({up:-1,down:1}[actor.face]||0)*12];
      const from=action==='fill'?focus:[handX,handY],to=action==='fill'?[handX,handY]:focus;
      const dx=to[0]-from[0],dy=to[1]-from[1],distance=Math.max(1,Math.hypot(dx,dy)),length=Math.min(16,Math.max(4,distance));
      for(let i=0;i<3;i++){
        const p=(animTime*.75+i/3+actor.phase)%1,travel=2+(length-2)*p;
        ctx.fillStyle=i%2?'#c6e6da':'#83bed0';ctx.fillRect(Math.round(from[0]+dx/distance*travel),Math.round(from[1]+dy/distance*travel-Math.sin(p*Math.PI)*2),1,2);
      }
    }else if(working&&(action==='hammer'||action==='craft')){
      const swing=Math.sin(animTime*7+actor.phase*4);ctx.strokeStyle='#a67c4c';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(handX,handY);ctx.lineTo(handX+side*4,handY-4-swing*3);ctx.stroke();ctx.fillStyle='#a3a5a0';ctx.fillRect(handX+side*4-2,Math.round(handY-6-swing*3),4,2);
      if(action==='hammer'&&swing<-.7){ctx.fillStyle='#efc37c';ctx.fillRect(handX+side*8,handY,1,1);ctx.fillRect(handX+side*6,handY-2,1,1);}
    }else if(working&&action==='sweep'){
      const dx=Math.round(Math.sin(animTime*3+actor.phase)*3);ctx.strokeStyle='#9d774a';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(handX,handY);ctx.lineTo(x+side*10+dx,y-1);ctx.stroke();ctx.fillStyle='#bca36c';ctx.fillRect(x+side*10+dx-2,y-2,5,2);
    }else if((working&&action==='read')||actor.state==='evening'&&action==='read'){
      ctx.fillStyle='#e5d7aa';ctx.fillRect(x-5,y-14,4,4);ctx.fillRect(x,y-14,4,4);ctx.fillStyle='#6e7655';ctx.fillRect(x-1,y-14,1,5);
    }else if(working&&action==='lamp'){
      ctx.fillStyle='#ba8d44';ctx.fillRect(handX-1,handY-2,3,5);ctx.fillStyle='#f4d98e';ctx.fillRect(handX,handY-1,1,3);
    }else if(working&&action==='tend'){
      ctx.fillStyle='#d5b67a';ctx.fillRect(handX,Math.round(handY+Math.sin(animTime*3+actor.phase)),3,2);
    }
    ctx.restore();
  }
  function interaction(hero) {
    let closest=null;
    const interactable=[...(residentsImage?people:[]),...(animalsImage?animals.filter(a=>animalEntry(a.type)):[]),...(companion?[companion]:[])];
    for(const actor of interactable) {
      const d=Math.hypot(hero.x-actor.x,hero.y-actor.y);
      const priority=d+(actor.kind==='animal'?5:0);
      if(d<27&&(!closest||priority<closest.d))closest={type:'resident',id:actor.id,name:actor.name||'Neighbour',label:(actor.kind==='animal'?'Greet ':'Talk to ')+(actor.name||'neighbour'),d:priority,actor};
    }
    return closest;
  }
  function talk(id,hero) {
    const actor=[...people,...animals,...(companion?[companion]:[])].find(p=>p.id===id);
    if(!actor)return [];
    actor.path=[];actor.pause=3.5;actor.talkPause=3.5;actor.walking=false;actor.working=false;faceToward(actor,hero.x-actor.x,hero.y-actor.y);
    const lines=actor.lines?.length?actor.lines:actor.id==='stormy-companion'?['He said before dinner. I think he owes us two.', 'I am following you. For the adventure. And the possibility of snacks.', 'Home will still be there, Amaal. Let’s bring him back to it.']:actor.kind==='animal'?['A curious nose turns toward you, then goes back to its very busy day.']:['Beautiful day for a walk. The roads between towns are long; rest here as long as you need.'];
    let line=lines[actor.talkCount++%lines.length];
    if(actor.plan&&typeof line==='string'&&clock().hour>=12)line=line.replace(/^Morning([,!])/i,(m,p)=>(clock().hour>=17?'Evening':'Afternoon')+p);
    const result=[[actor.name||'Neighbour',line]];
    if(actor.plan&&actor.task)result.push([actor.name||'Neighbour',global.BloomRoutines.context(actor.plan,actor.task,actor.state)]);
    return result;
  }
  function ambient(ctx,camera) {
    if(!map||map.kind==='interior')return;
    for(const chimney of chimneys) {
      if(chimney.x<camera.x-20||chimney.x>camera.x+404||chimney.y<camera.y||chimney.y>camera.y+280)continue;
      for(let i=0;i<3;i++) {
        const age=(time*.14+chimney.phase+i/3)%1,x=Math.round(chimney.x-camera.x+Math.sin(age*5+chimney.phase)*3+age*6),y=Math.round(chimney.y-camera.y-age*23);
        ctx.fillStyle='rgba(235,225,211,'+(1-age)*.25+')';ctx.fillRect(x,y,3+Math.floor(age*3),2+Math.floor(age*2));
      }
    }
    const night=map.theme==='moon'||map.theme==='night'||clock().phase==='night'||clock().phase==='evening';
    for(const garden of gardens) {
      const x=Math.round(garden.x-camera.x+Math.sin(time*.8+garden.phase*7)*13),y=Math.round(garden.y-camera.y-9+Math.cos(time+garden.phase*6)*5);
      if(x<0||x>384||y<0||y>256)continue;
      if(night){ctx.fillStyle='rgba(248,234,155,'+(.35+Math.sin(time*2+garden.phase*8)*.25)+')';ctx.fillRect(x,y,1,1);}
      else{
        ctx.fillStyle=garden.phase>.5?'#edd899':'#b9bcf0';
        const wing=Math.sin(time*11+garden.phase)>0?2:1;
        ctx.fillRect(x-wing,y,wing,2);ctx.fillRect(x+1,y,wing,2);ctx.fillStyle='#6d624d';ctx.fillRect(x,y+1,1,2);
      }
    }
  }
  function snapshot() {
    return [...people,...animals,...(companion?[companion]:[])].map(actor=>({id:actor.id,x:actor.x,y:actor.y,face:actor.face,type:actor.type,walking:actor.walking,pause:actor.pause,state:actor.state||'routine',activity:actor.task?.action||null,task:actor.task?.label||null,destination:actor.task?.node.label||null,target:actor.task?.node.point?.slice()||null,personality:actor.plan?.personality||null,job:actor.plan?.job||null,stationKey:actor.stationKey||null,reservationStatus:actor.reservationStatus||null,waitingFor:actor.waitingFor||null,breakUntil:actor.cooldownUntil||null,brisk:Boolean(actor.brisk)}));
  }
  function inspectRoutines(){return people.filter(p=>p.plan).map(p=>({id:p.id,job:p.plan.job,personality:p.plan.personality,home:p.plan.home,work:p.plan.work,lunch:p.plan.lunch,shops:p.plan.shops,evening:p.plan.evening,times:p.plan.times}));}
  function animation(id){const actor=people.find(p=>p.id===id);if(!actor)return null;const col=DIRECTIONS[actor.face]??0,row=Number.isInteger(actor.spriteRow)?actor.spriteRow:(ROLE_ROWS[actor.type]??7);return{...animationPose(actor),parts:{...spriteParts(row,col)},spriteRow:row,face:actor.face};}
  function inspectReservations(){return [...reservations.values()].map(claim=>({...claim,point:claim.point.slice()}));}
  global.BloomLife={configure,enter,update,actors,draw,interaction,talk,ambient,snapshot,clock,inspectRoutines,inspectReservations,animation};
})(window);
