/* Local schedule planning. No network, language model, account or runtime dependency. */
(function(global){
  'use strict';
  const PERSONALITIES=['warm','practical','curious','patient','spirited','thoughtful'];
  const TONES={warm:'There is always time for a neighbour.',practical:'One small job at a time keeps the town going.',curious:'There is always something new to notice here.',patient:'Good things usually need a little patience.',spirited:'A busy day is a good day, if you leave room for a laugh.',thoughtful:'The little things are worth looking after.'};
  function hash(value){let n=2166136261;for(const ch of String(value))n=Math.imul(n^ch.charCodeAt(0),16777619);return(n>>>0)/4294967296;}
  function distance(a,b){return Math.hypot(a[0]-b[0],a[1]-b[1]);}
  function text(value){return String(value||'').toLowerCase();}
  function jobFor(person){
    const role=text(person.role),type=text(person.type),s=role+' '+type;
    if(/lamplight|lantern keeper|lightkeeper|lighthouse keeper/.test(role))return'lamplighter';
    if(/smith|forge/.test(s))return'smith';
    if(/garden|herbal|florist|flower|beekeeper/.test(s))return'gardener';
    if(/farm|stable|goatkeeper|orchard|shepherd/.test(s))return'farmer';
    if(/carpenter|wheelwright|weav|cooper|stoneworker|sailmaker|candle|craft/.test(s))return'craft';
    if(/watch|guard|bridgekeeper/.test(s))return'watch';
    if(/dock|cargo|harbour|sailor|ferry|fisher|netmend|ship/.test(s))return'dock';
    if(/child|school|listener/.test(s))return'child';
    if(/elder|storytell/.test(s))return'elder';
    if(/baker|merchant|seller|shop|innkeeper|tea|supply|trader|clerk|market/.test(s))return'merchant';
    if(type==='worker')return'craft';
    return'homemaker';
  }
  function fixtureTags(sprite,label=''){
    const key=text(sprite);
    if(/workbench|^table$/.test(key))return['craft'];
    if(/bench/.test(key))return['rest'];
    if(/market_stall|flower_cart/.test(key))return['market'];
    if(/flora|planter|estate_bed/.test(key))return['garden'];
    if(/well|fountain|trough/.test(key))return['water'];
    if(/barrel/.test(key)&&/water|trough/.test(text(label)))return['water'];
    if(/crate|barrel|sack|crane|fishing_net|drying_rack|rope|estate_hay/.test(key))return['cargo'];
    if(/lamp_post/.test(key))return['lamp'];
    return null;
  }
  function tagsFor(label,sprite=''){
    const physical=fixtureTags(sprite,label);if(physical)return physical;
    const s=text(label)+' '+text(sprite),tags=[];
    if(/flora|flower|herb|garden|greenhouse|estate_bed|planter/.test(s))tags.push('garden');
    if(/forge|blacksmith/.test(s))tags.push('forge');
    if(/workbench|table|workshop|carpenter|weav|craft|wheel|stoneworker/.test(s))tags.push('craft');
    if(/crate|barrel|sack|warehouse|crane|net|rope|cargo|hay|barn|stable|orchard|fish/.test(s))tags.push('cargo');
    if(/market|shop|bak|inn|tea|florist|suppl|trader/.test(s))tags.push('market');
    if(/lamp|lantern|lighthouse/.test(s))tags.push('lamp');
    if(/bench|seat|reading|story/.test(s))tags.push('rest');
    if(/well|fountain|trough|water/.test(s))tags.push('water');
    if(/sign|gate|watch|road to|bridge/.test(s))tags.push('watch');
    return tags;
  }
  const JOB_TAGS={gardener:['garden','water'],farmer:['cargo','garden'],smith:['forge','craft'],craft:['craft','cargo'],dock:['cargo','watch'],lamplighter:['lamp','craft'],watch:['watch','lamp'],merchant:['market','cargo'],child:['rest','garden'],elder:['rest','garden'],homemaker:['craft','garden']};
  const ACTIONS={gardener:'water',farmer:'tend',smith:'hammer',craft:'craft',dock:'carry',lamplighter:'mend',watch:'watch',merchant:'serve',child:'read',elder:'read',homemaker:'sweep'};
  function create(area,person,index,options={}){
    const id=person.id||'resident-'+index,origin=[Number(person.x),Number(person.y)],job=jobFor(person),phase=hash(id),personality=person.personality||PERSONALITIES[Math.floor(hash(id+'personality')*PERSONALITIES.length)];
    const resolve=point=>options.safePoint?options.safePoint(...point):point;
    const valid=point=>!options.reachable||options.reachable(point);
    const destinations=[];
    function add(point,label,tags,focus,source,stationPoint,kindOverride){
      const p=resolve(point);if(!p||!valid(p)||focus&&distance(p,focus)>48)return null;
      const station=stationPoint||focus||point;
      let owner=-1,bestDistance=15;
      for(const [i,o]of(area.objects||[]).entries()){
        const d=Math.hypot(o.x-station[0],o.y-station[1]);if(d<bestDistance){bestDistance=d;owner=i;}
      }
      const ownerSprite=owner>=0?area.objects[owner].sprite:'',physicalTags=fixtureTags(ownerSprite,label);if(physicalTags)tags=physicalTags;
      const fixtureKind=/workbench|^table$/.test(ownerSprite)?'craft':/bench/.test(ownerSprite)?'seat':/flora|estate_bed|planter/.test(ownerSprite)?'plant':null;
      const lower=text(label),kind=fixtureKind||kindOverride||(tags.includes('home')?'home':tags.includes('water')&&!tags.includes('garden')?'water':tags.includes('forge')?'forge':tags.includes('craft')?'craft':tags.includes('cargo')?'cargo':tags.includes('market')?'shop':tags.includes('garden')?'plant':tags.includes('lamp')?'lamp':tags.includes('rest')?'seat':tags.includes('watch')?'watch':/bench|seat/.test(lower)?'seat':'place');
      const stationKey=(area.id||'town')+':'+(owner>=0?'object-'+owner:'place-'+Math.round(station[0]/8)*8+'-'+Math.round(station[1]/8)*8);
      const node={point:p,label:label||'the neighbourhood',tags,focus:focus||point,source,stationKey,stationKind:kind,capacity:1};destinations.push(node);return node;
    }
    for(const [i,station]of(area.workstations||[]).entries()){
      const kind=text(station.kind),tags=tagsFor(station.label,kind);
      const alias={plant:'garden',seat:'rest',shop:'market'}[kind];if(alias&&!tags.includes(alias))tags.push(alias);
      for(const tag of ['garden','water','forge','craft','cargo','market','lamp','rest','watch'])if(kind.includes(tag)&&!tags.includes(tag))tags.push(tag);
      add([station.x,station.y],station.label,tags,station.target||[station.x,station.y-16],'station-'+(station.id||i),station.target||[station.x,station.y-16],alias==='rest'?'seat':undefined);
    }
    for(const [i,o]of(area.objects||[]).entries()){
      const tags=tagsFor(o.label,o.sprite);if(!tags.length)continue;
      const isBuilding=/^(town_house_|house_)/.test(o.sprite)||['rose_tower','estate_barn','estate_greenhouse','lighthouse'].includes(o.sprite);
      if(isBuilding){
        const door=(area.portals||[]).find(p=>p.kind==='door'&&(p.label==='Enter '+o.label||Math.hypot(p.x-o.x,p.y-o.y)<24));
        add([door?.x??o.x,(door?.y??o.y)+18],o.label,tags,[o.x,o.y-8],'building-'+i,[o.x,o.y]);
      }else add([o.x,o.y+17],o.label||o.sprite.replaceAll('_',' '),tags,[o.x,o.y-7],'object-'+i,[o.x,o.y]);
    }
    const doors=[];
    for(const [i,p]of(area.portals||[]).entries())if(p.kind==='door'){
      const label=(p.label||'Home').replace(/^Enter /,'');
      const building=(area.objects||[]).find(o=>o.label===label);
      const node=add([p.x,p.y+18],label,['home'],[p.x,p.y-8],'door-'+i,building?[building.x,building.y]:[p.x,p.y],'home');if(node)doors.push(node);
    }
    for(const [i,e]of(area.exits||[]).entries())add([e.side==='west'?56:area.w*16-56,e.y],'the road gate',['watch'],[e.side==='west'?8:area.w*16-8,e.y],'exit-'+i);
    const fallbackPoints=person.authoredRoute?.length?person.authoredRoute:person.route?.length?person.route:[origin];
    const fallback=[];
    for(const p of fallbackPoints){
      const point=resolve(p);if(point&&valid(point)&&!fallback.some(node=>distance(node.point,point)<20))fallback.push({point,label:'the '+(person.role||'neighbourhood').toLowerCase()+' work area',tags:[],focus:[point[0],point[1]-16],source:'authored',stationKey:(area.id||'town')+':authored-'+Math.round(point[0]/8)*8+'-'+Math.round(point[1]/8)*8,stationKind:'place',capacity:1});
    }
    const original=resolve(origin)||origin,defaultNode=fallback[0]||{point:original,label:'the neighbourhood',tags:[],focus:[original[0],original[1]-16],source:'start',stationKey:(area.id||'town')+':start-'+id,stationKind:'place',capacity:1};
    function best(tags,from=origin,exclude=[],limit=3){
      const candidates=destinations.filter(n=>n.tags.some(t=>tags.includes(t))&&!exclude.includes(n)&&(tags!==JOB_TAGS[job]||n.stationKind!=='seat'||job==='child'||job==='elder')&&(tags!==JOB_TAGS[job]||job!=='gardener'||distance(n.point,n.focus)<=32));
      candidates.sort((a,b)=>{
        const score=n=>distance(n.point,from)+(n.source.startsWith('station-')?-55:0)+(n.tags.includes(tags[0])?-90:0);
        return score(a)-score(b);
      });
      const out=[];
      for(const n of candidates)if(!out.some(p=>distance(n.point,p.point)<28)){out.push(n);if(out.length===limit)break;}
      return out;
    }
    const pureHomes=doors.filter(n=>!/workshop|warehouse|storehouse|inn|shop|forge|florist|book|hall|market|herbal|glass|barn|lighthouse/i.test(n.label));
    const byName=doors.find(n=>text(n.label).includes(text(person.name))&&person.name);
    let home=byName||[...(pureHomes.length?pureHomes:doors)].sort((a,b)=>distance(a.point,origin)-distance(b.point,origin))[0]||defaultNode;
    // Neighbours sharing a home use different safe porch positions, not one stack of sprites.
    const porch=resolve([home.point[0]+(Math.floor(phase*3)-1)*10,home.point[1]+Math.floor(hash(id+'porch')*2)*8]);
    if(porch&&valid(porch))home={...home,point:porch};
    let work=best(JOB_TAGS[job],origin,[],job==='lamplighter'?4:3);
    if(!work.length)work=fallback.slice(0,3);
    if(!work.length)work=[defaultNode];
    // A distant second job station is not a patrol destination: choose the actual local yard.
    if(job!=='lamplighter'&&job!=='watch')work=work.filter(n=>distance(n.point,work[0].point)<260);
    let lunch=best(['rest'],work[0].point,[],2),shops=best(['market'],work[0].point,[],2),evening=best(job==='child'?['rest','garden']:['rest'],home.point,[],2);
    function explicit(value,label,tag){
      if(!value)return[];
      const items=Array.isArray(value)&&typeof value[0]==='number'?[value]:Array.isArray(value)?value:[value],nodes=[];
      for(const item of items){const p=Array.isArray(item)?item:item.point;if(!Array.isArray(p)||!p.slice(0,2).every(Number.isFinite))continue;const n=add(p,item.label||label,[tag],item.focus||[p[0],p[1]-16],'authored-routine');if(n)nodes.push(n);}
      return nodes;
    }
    const authored=person.routine||{},h=explicit(authored.home,'the home porch','home'),w=explicit(authored.work,'the workplace',JOB_TAGS[job][0]),l=explicit(authored.lunch,'the lunch seat','rest'),sh=explicit(authored.shop,'the neighbourhood shop','market'),e=explicit(authored.evening,'the evening resting place','rest');
    if(h.length)home=h[0];if(w.length)work=w;if(l.length)lunch=l;if(sh.length)shops=sh;if(e.length)evening=e;
    const plan={id,job,personality,tone:TONES[personality]||TONES.warm,phase,home,work,lunch:lunch.length?lunch:[home],shops:shops.length?shops:[home],evening:evening.length?evening:[home],action:ACTIONS[job],nightShift:job==='watch'&&phase>.52};
    const stagger=Math.floor(phase*42),lunchStagger=Math.floor(hash(id+'lunch')*70),cycle=job==='dock'||job==='merchant'?24:job==='gardener'||job==='watch'?32:42;
    plan.stations=destinations;
    plan.times={wake:360+stagger,start:450+stagger*2,lunch:690+lunchStagger,lunchEnd:745+lunchStagger,shop:1000+stagger,evening:1065+stagger,rest:1220+stagger,cycle};
    return plan;
  }
  function at(plan,clock){
    const minute=clock.minutes,t=plan.times;let phase,start,nodes,action,label;
    if(plan.nightShift&&(minute<360||minute>=1200)){phase='night-watch';start=minute<360?0:1200;nodes=plan.work;action='watch';label='Keeping the night watch';}
    else if(plan.nightShift&&minute<t.lunch){phase='home';start=360;nodes=[plan.home];action='rest';label='Resting by the porch';}
    else if(minute<t.wake||minute>=t.rest){phase='home';start=minute<t.wake?0:t.rest;nodes=[plan.home];action='rest';label='Resting by the porch';}
    else if(minute<t.start){phase='breakfast';start=t.wake;nodes=[plan.home];action='break';label='Taking a breakfast break';}
    else if(minute<t.lunch){phase='morning-work';start=t.start;nodes=plan.work;action=plan.action;label=workLabel(action,plan.job);}
    else if(minute<t.lunchEnd){phase='lunch';start=t.lunch;nodes=plan.lunch;action='break';label='Taking a midday break';}
    else if(minute<t.shop){phase='afternoon-work';start=t.lunchEnd;nodes=plan.work;action=plan.job==='child'?'play':plan.action;label=workLabel(action,plan.job);}
    else if(minute<t.evening){phase='shopping';start=t.shop;nodes=plan.shops;action='shop';label='Picking up supplies';}
    else if(plan.job==='lamplighter'&&minute<1240){phase='lamplighting';start=t.evening;nodes=plan.work;action='lamp';label='Tending the evening lanterns';}
    else{phase='evening';start=t.evening;nodes=plan.evening;action=plan.job==='child'?'read':plan.job==='elder'?'read':'rest';label=plan.job==='elder'?'Reading by the evening square':'Taking an evening rest';}
    const cycle=(phase.includes('work')||phase==='lamplighting'||phase==='night-watch')?t.cycle:60;
    const slot=Math.max(0,Math.floor((minute-start)/cycle));
    const node=nodes[(slot+Math.floor(plan.phase*nodes.length))%nodes.length];
    const alternatives=phase==='home'||phase==='breakfast'?[]:(plan.stations||[]).filter(other=>other.stationKind===node.stationKind&&other.stationKey!==node.stationKey&&distance(other.point,node.point)<=340).sort((a,b)=>distance(a.point,node.point)-distance(b.point,node.point));
    const candidates=[node,...nodes.filter(other=>other!==node&&other.stationKind===node.stationKind),...alternatives];
    const unique=[];for(const other of candidates)if(!unique.some(n=>n.stationKey===other.stationKey))unique.push(other);
    return forNode(plan,{key:clock.day+':'+phase+':'+slot,phase,action,baseAction:action,label,baseLabel:label,node,candidates:unique,state:['home','breakfast','lunch','shopping','evening'].includes(phase)?phase:'work'},node);
  }
  function canWater(node){
    const dx=node.focus[0]-node.point[0],dy=node.focus[1]-node.point[1],left=Math.abs(dx)>Math.abs(dy)&&dx<0;
    const hands=left?[-10,-6]:[6,10];
    return hands.every(x=>Math.hypot(dx-x,dy+14)<=20);
  }
  function forNode(plan,task,node){
    let action=task.baseAction||task.action,label=task.baseLabel||task.label,state=task.state;
    if(task.phase.includes('work')){
      if(node.stationKind==='seat'&&!['child','elder'].includes(plan.job)){action='rest';label='Taking a quiet moment';state='idle';}
      else if((node.source==='authored'||node.source==='start'||node.stationKind==='place'||node.source?.startsWith('building-'))&&['water','fill','hammer','craft','carry','serve','tend'].includes(action)){action='inspect';label='Checking the work area';}
      else if(action==='water'&&(distance(node.point,node.focus)>32||!canWater(node))){action='inspect';label='Checking the growing beds';}
      else if(action==='water'&&node.tags.includes('water')&&!node.tags.includes('garden')){action='fill';label='Filling the watering can';}
      else if(['hammer','craft'].includes(action)&&node.tags.includes('cargo')&&!node.tags.includes('craft')&&!node.tags.includes('forge')){action='carry';label='Collecting workshop supplies';}
      else if(action==='carry'&&node.tags.includes('watch')&&!node.tags.includes('cargo')){action='watch';label='Checking the quay';}
    }
    return {...task,node,action,label,state};
  }
  function workLabel(action,job){
    return {water:'Watering the plants',tend:'Tending the farm',hammer:'Working on repairs',craft:'Mending and making',carry:'Moving supplies',mend:'Checking the lamp fittings',watch:'Watching the town gate',serve:'Serving the neighbourhood',read:job==='child'?'Reading by the square':'Enjoying a quiet book',sweep:'Sweeping the doorstep',play:'Playing by the square'}[action]||'Looking after the neighbourhood';
  }
  function context(plan,task,state){
    const destination=task.node.label;
    if(state==='waiting')return (task.waitingFor?'That spot is in use. I will wait nearby for '+task.waitingFor+'.':'I am leaving a little room for the neighbours.')+' '+plan.tone;
    if(state==='travel')return 'I am on my way to '+destination+'. '+plan.tone;
    const intro={inspect:'I am checking that the work area is ready before the next job.',water:'A little water at the roots, never on the petals.',fill:'I am filling the watering can for the next growing bed.',tend:'The animals and growing beds need a little care every day.',hammer:'A steady hand makes a repair last.',craft:'There is always something worth mending.',carry:'These supplies have a place waiting for them.',mend:'I am checking the fittings before the lamps are needed.',watch:'Someone should keep an eye on the road gate.',serve:'I am keeping the stall ready for the neighbours.',read:'Just a few quiet pages before the next part of the day.',sweep:'A clear doorstep is a small welcome.',play:'There is still time to play before heading home.',lamp:'One wick at a time. The evening is brighter for it.',break:task.phase==='lunch'?'A midday break, then back to work.':'A little breakfast break before the day begins.',shop:'I am picking up a few supplies before I head back.',rest:task.phase==='home'?'I am taking a quiet moment by my door.':'I am taking a little rest here.'}[task.action]||task.label+'.';
    return intro+' '+plan.tone;
  }
  global.BloomRoutines={create,at,forNode,context,jobFor};
})(window);
