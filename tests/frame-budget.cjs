'use strict';
const assert=require('node:assert/strict');
const {game}=require('./helpers/arpg-game.cjs');
const results=[];
for(const fps of [5,10,30,60]){
 const g=game();g.evaluate("area.objects=[];combat.enter({kind:'town',safe:true},{hero,state});hero.x=280;hero.y=180;motion.reset({camera:true});keys.arrowright=true;clock=0;last=1000");
 for(let frame=1;frame<=fps;frame++)g.evaluate('frame('+(1000+frame*1000/fps)+')');
 const seconds=g.evaluate('clock');assert(Math.abs(seconds-1)<1e-8,'one real second advances one simulation second at '+fps+' scheduled frames/s');results.push(g.evaluate('hero.x'));
 const before=g.evaluate('clock');g.evaluate('frame(20000)');assert(g.evaluate('clock')-before<=.2500001,'a long stall has a bounded catch-up budget');
}
assert(Math.max(...results)-Math.min(...results)<.04,'swept movement remains consistent across the catch-up range');
console.log('PASS: actual frame loop keeps simulated time and movement at 5/10/30/60 scheduled FPS while bounding long-stall catch-up. This is not a device FPS benchmark.');
