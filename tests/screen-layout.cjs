'use strict';
// Source/geometry checks for layouts that cannot be browser-rendered in this workspace.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../dist'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),css=fs.readFileSync(path.join(root,'play-screen.css'),'utf8'),journey=fs.readFileSync(path.join(root,'journey-ui.css'),'utf8');
assert.match(html,/<body class="play-screen">/,'the game screen is the default page mode');
assert(html.indexOf('play-screen.css')>html.indexOf('traveller-ui.css'),'screen layout overrides the earlier panel layouts');
const wrapper=html.match(/<section\b[^>]*id="play-area"[^>]*>([\s\S]*?)<\/section>/)?.[1];assert(wrapper);
for(const id of ['screen','game','system-menu','system-notice','fullscreen','kit-toggle','kit-overlay','kit-close','kit-update-dot','kit-map','kit-bag','open-skills','kit-journal','kit-options','combat-slot-0','combat-slot-1','combat-slot-2','combat-slot-3','combat-slot-4','skill-overlay','traveller-overlay','portable-tools','export-save','import-save','game-update'])assert(wrapper.includes('id="'+id+'"'),id+' remains within the fullscreen game wrapper');
assert(html.indexOf('journey-ui.css')>html.indexOf('play-screen.css'),'chosen input profile overrides capability/width fallbacks');
assert.match(html,/<div id="kit-overlay"[^>]*role="dialog"[^>]*aria-modal="true"/,'satchel menu is a proper modal');
const hubStart=html.indexOf('id="kit-overlay"'),hubEnd=html.indexOf('class="combat-hotbar"');
for(const id of['kit-map','kit-bag','open-skills','kit-journal','kit-options','system-notice'])assert(html.indexOf('id="'+id+'"')>hubStart&&html.indexOf('id="'+id+'"')<hubEnd,id+' is tucked inside the satchel');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);assert.equal(new Set(ids).size,ids.length,'all game IDs are unique');
const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function rules(selector,source=css){return[...source.matchAll(new RegExp(escape(selector)+'\\s*\\{([^}]*)\\}','g'))].map(match=>Object.fromEntries(match[1].split(';').filter(Boolean).map(entry=>{const colon=entry.indexOf(':');return[entry.slice(0,colon).trim(),entry.slice(colon+1).trim()];})));}
const one=selector=>{const values=rules(selector);assert(values.length,selector+' has an explicit screen rule');return values[0];};
const pixels=value=>Number(String(value).match(/(?:^|\+\s*)(\d+)px\)?$/)?.[1]);
const dpad=one('body.play-screen #play-area .touch-pad'),actions=one('body.play-screen #play-area .touch-actions'),kit=one('body.play-screen #play-area .traveller-kit'),spell={...one('body.play-screen #play-area .combat-hotbar'),...rules('body.play-screen #play-area .combat-hotbar').find(rule=>rule.width==='236px')};
assert(spell,'phone spell row has an explicit compact layout');assert.equal(pixels(dpad.width),140);assert.equal(pixels(dpad.height),140);assert.equal(pixels(actions.width),96);assert.equal(pixels(actions.height),140);assert.equal(pixels(spell.width),236);assert.equal(pixels(spell.height),48);
assert.equal(pixels(kit.width),70);assert.equal(pixels(kit.height),62);assert.equal(pixels(kit.right),8,'single satchel occupies the outer corner');
const touch='body.play-screen:is([data-input-profile="touch"],[data-input-profile="hybrid"]) #play-area ';
const profilePad=rules(touch+'.touch-pad',journey)[0],profileActions=rules(touch+'.touch-actions',journey)[0];assert(profilePad&&profileActions);
assert.equal(profilePad['--unit'],'calc(44px * var(--touch-scale))');assert.equal(profileActions.width,'calc(var(--unit) * 2 + 4px)');
assert.equal(rules('body.play-screen[data-input-profile="keyboard"] #play-area .touch',journey)[0].display,'none!important','keyboard profile hides touch controls even on narrow or coarse-capable devices');
assert.match(css,/grid-template-columns:repeat\(3,44px\);grid-template-rows:repeat\(3,44px\)/,'D-pad keeps 44px targets');assert.match(css,/grid-template-columns:repeat\(2,46px\);grid-template-rows:repeat\(3,44px\)/,'six action targets remain at least 44px');assert.match(css,/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/,'all five spells remain visible');
function intersects(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}
function inside(rect,width,height,label){assert(rect.x>=0&&rect.y>=0&&rect.x+rect.w<=width+.01&&rect.y+rect.h<=height+.01,label+' fits the safe viewport');}
const views=[{w:568,h:320,l:0,r:0,b:0},{w:667,h:375,l:0,r:0,b:0},{w:844,h:390,l:44,r:44,b:21}];
for(const{w,h,l,r,b}of views){
 const stageW=Math.min(w,h*1.5),stageH=stageW/1.5,stageLeft=(w-stageW)/2;
 assert(stageH>=h-.01,'sideways world uses the full screen height at '+w+'×'+h);
 const actionWidth=44*2+4,controls={dpad:{x:l+8,y:h-b-pixels(dpad.bottom)-pixels(dpad.height),w:pixels(dpad.width),h:pixels(dpad.height)},actions:{x:w-r-8-actionWidth,y:h-b-pixels(actions.bottom)-pixels(actions.height),w:actionWidth,h:pixels(actions.height)},spells:{x:(w-pixels(spell.width))/2,y:h-b-pixels(spell.bottom)-pixels(spell.height),w:pixels(spell.width),h:pixels(spell.height)},kit:{x:w-r-pixels(kit.right)-pixels(kit.width),y:8,w:pixels(kit.width),h:pixels(kit.height)}};
 for(const[name,rect]of Object.entries(controls))inside(rect,w,h,w+' '+name);
 const entries=Object.entries(controls);for(let a=0;a<entries.length;a++)for(let c=a+1;c<entries.length;c++)assert(!intersects(entries[a][1],entries[c][1]),w+' '+entries[a][0]+' and '+entries[c][0]+' do not overlap');
 const hero={x:w/2-20*stageH/256,y:180*stageH/256-40*stageH/256,w:40*stageH/256,h:40*stageH/256};
 for(const[name,rect]of entries)assert(!intersects(hero,rect),w+' '+name+' leaves the intended player body clear');
 const health={x:stageLeft+8,y:8,w:120,h:55},place={x:stageLeft+8,y:66,w:155,h:20},clock={x:stageLeft+8,y:90,w:170,h:20},cast={x:w/2-59,y:74,w:118,h:30},target={x:w/2-59,y:112,w:118,h:24},hint={x:w/2-stageW*.21,y:142,w:stageW*.42,h:24};
 const hud=Object.entries({health,place,clock,cast,target,hint});for(const[name,rect]of hud){inside(rect,w,h,w+' '+name);for(const[control,zone]of entries)assert(!intersects(rect,zone),w+' '+name+' avoids '+control);}
 for(let a=0;a<hud.length;a++)for(let c=a+1;c<hud.length;c++)assert(!intersects(hud[a][1],hud[c][1]),w+' '+hud[a][0]+' avoids '+hud[c][0]);
 const badge={x:controls.kit.x+56,y:10,w:12,h:12};inside(badge,w,h,w+' satchel update marker');
}
for(const selector of ['body.play-screen #play-area .traveller-window','body.play-screen #play-area .skill-window'])assert(one(selector)['max-height'].includes('max(6px,env(safe-area-inset-top)) - max(6px,env(safe-area-inset-bottom))'),'modal height includes actual notch/home-indicator padding');
const page=one('body.play-screen');assert.equal(page.position,'fixed');assert.equal(page.overflow,'hidden');assert.equal(page['touch-action'],'auto','page scrolling is blocked without disabling modal touch gestures');
assert.match(css,/\.traveller-body\{[^}]*min-height:0[^}]*overflow:auto[^}]*touch-action:pan-y/,'short landscape modals retain a shrinking scrollable body');
assert.match(css,/\.traveller-body \.portable-tools\{display:block!important/,'real portable controls display inside paused Options');assert.match(css,/#play-area>\.portable-tools\{display:none!important/,'save controls do not form a page panel');
assert.match(css,/#play-area\.is-dialogue \.traveller-kit/,'dialogue owns the screen without overlapping controls');assert.match(css,/landscape-hint\{display:block/,'portrait play has a gentle rotation hint');
assert.match(css,/#play-area\.satchel-ready #system-menu,body\.play-screen #play-area\.satchel-ready #fullscreen\{display:none\}/,'in-play utility menu icons are consolidated into the satchel');
assert.match(css,/\.kit-panel #system-notice\{position:static/,'full update notice takes space only inside the kit');
assert.match(journey,/\.screen\{top:calc\(env\(safe-area-inset-top\) \+ 86px\);transform:translateX\(-50%\)\}/,'portrait world anchors beneath the header instead of floating between empty bands');
console.log('PASS: fullscreen-first wrapper, single satchel and contained update notice, explicit input-profile overrides, 44px controls, default-scale568/667/844px safe-area geometry and centred-player clearance, portrait anchoring and modal scrolling. Source calculations do not replace browser/camera-edge verification.');
