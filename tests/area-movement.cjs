'use strict';
const assert=require('node:assert/strict');
const {fixture,settle}=require('./helpers/full-game.cjs');
(async()=>{
 for(const touch of [false,true]){
  const g=fixture({coarse:touch});await settle();g.find('start').click();const r=g.evaluate;
  r("enter('lavenderway');hero.x=area.w*16-11;hero.y=area.exits.find(e=>e.side==='east').y;hero.face='right'");
  const button=g.find('play-area').querySelector('[data-key="arrowright"]'),event={pointerId:771,pointerType:'touch',button:0,clientX:100,clientY:100,target:button,preventDefault(){}};
  if(touch)for(const fn of button.events.pointerdown||[])fn(event);else g.key('d');
  r('update(1/60)');assert.equal(r('areaId'),'lavendyr','crossing enters the separate safe town scene');assert.equal(r('area.safe'),true);assert.equal(r('(area.camps||[]).length'),0);const x=r('hero.x');assert(r(touch?'touchKeys.arrowright':'keys.d'),'a physical movement hold survives the walking transition');g.step(8);assert(r('hero.x')>x+2,'walking continues without lifting/repressing after a route exit');
  if(touch)for(const fn of button.events.pointerup||[])fn(event);else r('keys.d=false');const stop=r('hero.x');g.step(4);assert.equal(r('hero.x'),stop,'physical release still stops immediately');
  r("keys.d=true;touchKeys.arrowright=true;keyAction('b')");assert.equal(r("held('d')||held('arrowright')"),false,'opening a menu still clears every movement hold');g.C.window.BloomTraveller.close();r("keys.d=true;enter('rosepetal')");assert.equal(r("held('d')"),false,'manual travel still clears movement');
 }
 console.log('PASS: actual keyboard/touch movement holds continue across distinct road/town scenes, physical release stops, menus and manual travel reset safely.');
})().catch(error=>{console.error(error);process.exitCode=1;});
