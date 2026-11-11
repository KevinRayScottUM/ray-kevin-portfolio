import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {THREE,CameraRig,loadConsole} from '../static/js/lab-v3/graphics.js';
import {ResearchConsole,CartridgeMachine} from '../static/js/lab-v3/console.js';
import {ExperimentSession} from '../static/js/lab-v3/session.js';
import {WorldSimulator} from '../static/js/lab-v3/simulation.js';
import {InspectorVisibility} from '../static/js/lab-v3/inspector.js';
import {screenIntersection} from '../static/js/lab-v3/mechanics.js';

const registry=JSON.parse(readFileSync(new URL('../static/lab/tc06/experiments.json',import.meta.url)));
const settle=m=>{for(let i=0;i<400&&m.busy;i++)m.advance(1/60);assert.equal(m.busy,false);};
function fixture(index){
  const worlds=new Map(),session=new ExperimentSession(id=>{if(!worlds.has(id))worlds.set(id,new WorldSimulator(id,{quality:'low',resolution:10}));return worlds.get(id);});
  const context=new Proxy({}, {get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
  const device=Object.create(ResearchConsole.prototype);let releases=0;
  Object.assign(device,{machine:new CartridgeMachine(),registry,session,power:{on:true},pressed:new Set(),holds:new Map(),beep:()=>{},screenState:'cartridges',screenDirty:true,logo:{},screen:{width:1024,height:576,getContext:()=>context},renderer:{updateTexture:()=>{}},buttons:[],settings:{quality:'balanced'},onLaunch:id=>session.launch(id),onEjectionRequest:()=>releases++,onInsertionRequest:()=>{}});
  device.machine.request(index);settle(device.machine);
  return {device,session,worlds,get releases(){return releases;},dispose:()=>worlds.forEach(w=>w.dispose())};
}
for(const [index,task] of registry.entries())test(`${task.id}: screen Eject covers Ready, Running, Pause and safe single lifecycle`,()=>{
  const f=fixture(index),d=f.device,s=f.session;
  d.drawScreen();let eject=d.buttons.find(b=>b.id==='system-eject');assert.ok(eject);assert.equal(d.buttons.some(b=>b.id==='system-focus'),false);
  assert.ok(eject.w>=48&&eject.h>=40);assert.ok(eject.x+eject.w<=512&&eject.y+eject.h<=288);
  const u=(eject.x+eject.w/2)/512,v=1-(eject.y+eject.h/2)/288;assert.equal(d.screenActionAt(u,v).id,'system-eject');
  d.screenClick(u,v);assert.equal(d.machine.state,'ORIENTING');assert.equal(f.releases,1);assert.equal(d.eject(),false);d.drawScreen();assert.equal(d.buttons.some(b=>b.id==='system-eject'),false);settle(d.machine);assert.equal(d.machine.inserted,null);
  d.machine.request(index);settle(d.machine);d.pressAndRelease('a');assert.equal(s.state,'BOOTING');d.drawScreen();assert.equal(d.buttons.some(b=>b.id==='system-eject'),false);
  s.advance(1);d.presentExperiment({});assert.ok(d.buttons.some(b=>b.id==='system-eject'));assert.ok(d.buttons.some(b=>b.id==='system-focus'));
  d.pressAndRelease('start');d.presentExperiment({});assert.equal(s.state,'PAUSE_MENU');assert.ok(d.buttons.some(b=>b.id==='system-eject'));
  d.pressAndRelease('start');d.presentExperiment({});assert.equal(s.running,true);const world=s.world;
  d.screenClick(u,v);assert.equal(s.running,false);assert.equal(s.cartridgeId,null);assert.equal(s.world,world);assert.equal(d.pressed.size,0);assert.deepEqual(d.joy,{x:0,y:0});assert.equal(f.releases,2);settle(d.machine);assert.equal(d.machine.inserted,null);
  d.machine.request(index);settle(d.machine);d.power.on=false;d.drawScreen();assert.equal(d.buttons.length,0);f.dispose();
});
test('Select opens in-console settings and preserves sound configuration',()=>{
  const f=fixture(0),d=f.device;d.pressAndRelease('select');assert.equal(d.screenState,'settings');d.drawScreen();assert.ok(d.buttons.some(b=>b.id==='sound'));d.buttons.find(b=>b.id==='sound').action();assert.equal(d.sound,true);d.pressAndRelease('select');assert.equal(d.screenState,'cartridges');assert.equal(d.sound,true);f.dispose();
});
test('system settings join the actual physical Select menu without replacing experiment controls',()=>{
  const f=fixture(3),s=f.session;let sound=false;s.systemItems=()=>[{label:'Sound',action:()=>sound=!sound}];s.launch('box');s.advance(1);s.dispatch('select');assert.equal(s.menuItems().length,7);s.menuIndex=6;s.dispatch('a');assert.equal(sound,true);assert.equal(s.state,'CONTROLS');s.menuIndex=5;s.dispatch('a');assert.equal(s.running,true);f.dispose();
});
test('Inspector preferences are mode-aware and do not alter simulation or selected state',()=>{
  const view=new InspectorVisibility(),state={point:'robot-left.sample-2',frame:'relative',timeline:7};assert.equal(view.open,false);view.set(true);view.set(false);assert.equal(view.select('lab'),true);view.set(false);assert.equal(view.select('console'),false);view.set(true);assert.equal(view.select('lab'),false);assert.equal(view.select('console'),true);assert.deepEqual(state,{point:'robot-left.sample-2',frame:'relative',timeline:7});
});
test('Console sidebar controls are removed, toolbar is reparented, native Inspector is collapsed',()=>{
  const app=readFileSync(new URL('../static/js/lab-v3/app.js',import.meta.url),'utf8'),html=readFileSync(new URL('../templates/lab.html',import.meta.url),'utf8');
  assert.doesNotMatch(app,/data-console-panel|data-machine|data-console-status|data-sound|Console controls|Cartridge bay/);
  assert.match(app,/data-inspector-tools.*data-toolbar-slot/);assert.match(app,/if\(!disclosure.open\)return/);
  assert.match(html,/<details class="tc-research" data-research-disclosure>/);assert.doesNotMatch(html,/<details class="tc-research"[^>]*\bopen\b/);
  assert.match(html,/<main[^>]*data-mode="console"/);
});
test('Eject UV center maps accurately through the real screen after hover, zoom and resize',async()=>{
  const data=JSON.parse(readFileSync(new URL('../static/lab/tc06/console-mesh.json',import.meta.url))),original=globalThis.fetch;let model;
  try{globalThis.fetch=async()=>({ok:true,json:async()=>data});model=await loadConsole('test');}finally{globalThis.fetch=original;}
  const f=fixture(1);f.device.drawScreen();const b=f.device.buttons.find(b=>b.id==='system-eject'),u=(b.x+b.w/2)/512,v=1-(b.y+b.h/2)/288;
  const screen=model.nodes.get('Screen_Surface');screen.geometry.computeBoundingBox();const box=screen.geometry.boundingBox;
  for(const [w,h,pitch,yaw,distance] of [[1440,650,.04,-.06,.5],[390,460,-.03,.05,.7],[1024,590,0,0,.4]]){
    model.root.rotation.set(pitch,yaw,0);model.root.updateMatrixWorld(true);const rig=new CameraRig('console');rig.resize(w,h);rig.theta=0;rig.phi=Math.PI/2;rig.distance=distance;rig.update();
    const p=rig.project(screen.localToWorld(new THREE.Vector3(box.min.x+u*(box.max.x-box.min.x),box.min.y+v*(box.max.y-box.min.y),box.max.z)),w,h),uv=screenIntersection(rig.ray(p.x,p.y,w,h),screen);assert.ok(uv);assert.equal(f.device.screenActionAt(uv.u,uv.v).id,'system-eject');
  }f.dispose();
});
