import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {THREE,CameraRig,SoftwareRenderer,loadConsole,mesh} from '../static/js/lab-v3/graphics.js';
import {CartridgeMachine,ResearchConsole,CARTRIDGE_TIMES} from '../static/js/lab-v3/console.js';
import {CartridgeMechanism,localBounds,screenIntersection,pickGeometry} from '../static/js/lab-v3/mechanics.js';
import {ExperimentSession} from '../static/js/lab-v3/session.js';
import {WorldSimulator} from '../static/js/lab-v3/simulation.js';
import {ExperimentInteraction} from '../static/js/lab-v3/experiment-view.js';
import {sceneSignature} from '../static/js/lab-v3/embedded-display.js';

const registry=JSON.parse(await readFile(new URL('../static/lab/tc06/experiments.json',import.meta.url)));
const data=JSON.parse(await readFile(new URL('../static/lab/tc06/console-mesh.json',import.meta.url)));
const fetchOriginal=globalThis.fetch;globalThis.fetch=async()=>({ok:true,json:async()=>data});
const model=await loadConsole('local-test');globalThis.fetch=fetchOriginal;
const near=(a,b,eps=1e-6)=>assert.ok(Math.abs(a-b)<eps,`${a} vs ${b}`);
const settle=machine=>{for(let i=0;i<400&&machine.busy;i++)machine.advance(1/60);};
const createSession=()=>{const cache=new Map(),view=new CameraRig('lab');let creates=0;return{cache,view,get creates(){return creates;},session:new ExperimentSession((id,reset=false)=>{if(reset&&cache.has(id)){cache.get(id).dispose();cache.delete(id);}if(!cache.has(id)){cache.set(id,new WorldSimulator(id,{quality:'low',resolution:10}));creates++;}return cache.get(id);},{view})};};

for(const [index,task] of registry.entries())test(`${task.id}: real dimensions fit fully inside bay and eject without scaling`,()=>{
  const node=model.nodes.get('Cartridge_'+task.id),bounds=localBounds(node),size=bounds.getSize(new THREE.Vector3()),mechanism=new CartridgeMechanism(bounds,data.cartridgeBay),m=new CartridgeMachine(),rest=node.position.clone();
  m.select(index);m.insert();assert.equal(m.select((index+1)%6),false);assert.equal(m.eject(),false);
  let last=mechanism.position(rest,m.state,0,true,false);
  for(let frame=0;frame<200&&m.busy;frame++){
    m.advance(1/60);const p=mechanism.position(rest,m.state,m.elapsed,true,m.inserted===index);
    assert.ok(p.distanceTo(last)<.04,'continuous bounded insertion path');last=p;
  }
  assert.equal(m.state,'READY');assert.equal(m.inserted,index);assert.ok(mechanism.contained());
  const inserted=bounds.clone().translate(mechanism.seat);assert.ok(inserted.max.y<data.cartridgeBay.mouthY);assert.ok(inserted.max.y>data.cartridgeBay.mouthY-.001);assert.ok(inserted.min.y>=data.cartridgeBay.min[1]);
  assert.deepEqual(inserted.getSize(new THREE.Vector3()).toArray().map(v=>v.toFixed(6)),size.toArray().map(v=>v.toFixed(6)));
  m.eject();const initial=mechanism.position(rest,m.state,0,false,true);near(initial.distanceTo(mechanism.seat),0);
  const emerged=mechanism.position(rest,'EJECTING',.68,false,true);assert.ok(emerged.y>mechanism.seat.y);
  settle(m);assert.equal(m.inserted,null);assert.equal(m.state,'EMPTY');near(mechanism.position(rest,m.state,0,false,false).distanceTo(rest),0);
});

test('repeated six-cartridge replacement serializes without duplicate insertions',()=>{
  const m=new CartridgeMachine();for(let pass=0;pass<3;pass++)for(let index=0;index<6;index++){m.select(index);assert.equal(m.insert(),true);assert.equal(m.insert(),false);settle(m);assert.equal(m.inserted,index);assert.equal(m.state,'READY');}
  m.eject();m.advance(CARTRIDGE_TIMES.EJECTING);assert.equal(m.inserted,null);
});

test('all six source cartridges sit above the housing; transfer approach stays clear of the slot',()=>{
  const cards=registry.map(task=>model.nodes.get('Cartridge_'+task.id));
  for(const card of cards){
    const bounds=localBounds(card),rest=card.position.clone(),mechanism=new CartridgeMechanism(bounds,data.cartridgeBay);
    assert.ok(bounds.min.y+rest.y>.08,'presentation row is above the console, not beneath it');
    near(rest.z,mechanism.hover.z);assert.equal(model.nodes.has('Slot_Shutter'),false);
    for(let i=0;i<=100;i++){
      const position=mechanism.approach(rest).getPoint(i/100),moving=bounds.clone().translate(position);
      assert.ok(moving.min.y>data.cartridgeBay.mouthY,'alignment stays above the slot');
    }
  }
});

test('rear badge is a 128-sided circular disk with uniform axes; unwanted front mark is removed',()=>{
  assert.equal(model.nodes.has('Logo_Front'),false);assert.ok(model.nodes.has('Wordmark_Front'));assert.ok(model.nodes.has('Rear_Badge_Disk'));
  const badge=model.nodes.get('Logo_Rear'),bounds=localBounds(badge),size=bounds.getSize(new THREE.Vector3());near(size.x,.057);near(size.y,.057);near(size.z,0);
  const p=badge.geometry.attributes.position;assert.equal(p.count/3,128);
  for(let i=0;i<p.count;i++)assert.ok(Math.hypot(p.getX(i),p.getY(i))<=.028501);
  assert.equal(badge.userData.texture,'logo-badge.png');assert.equal(badge.material.side,THREE.FrontSide);
});

for(const task of registry)test(`${task.id}: A boots one canonical shared session; Start pauses and B returns without ejecting`,()=>{
  const fixture=createSession(),session=fixture.session,machine=new CartridgeMachine();machine.select(registry.indexOf(task));machine.insert();settle(machine);
  const device=Object.create(ResearchConsole.prototype);Object.assign(device,{machine,registry,session,pressed:new Set(),holds:new Map(),beep:()=>{},screenState:'cartridges',screenDirty:false,onLaunch:id=>session.launch(id)});
  device.press('start');assert.equal(session.world,null,'Start is not a launch requirement or implicit launch');device.release('start');
  device.press('a');assert.equal(session.state,'BOOTING');device.release('a');const world=session.world;
  device.press('a');device.release('a');assert.equal(fixture.creates,1);assert.equal(session.world,world);
  session.advance(.25);assert.equal(session.running,true);assert.equal(device.embedded,true);
  for(let i=0;i<10;i++)world.step();const time=world.time;
  assert.equal(session.activateLab(task.id),world);near(world.time,time);assert.equal(fixture.creates,1);
  device.press('start');device.release('start');assert.equal(session.state,'PAUSE_MENU');assert.equal(session.running,false);
  device.press('a');device.release('a');assert.equal(session.running,true);
  device.press('b');device.release('b');assert.equal(session.state,'PAUSE_MENU');device.press('b');device.release('b');assert.equal(session.state,'CARTRIDGE_MENU');assert.equal(machine.inserted,registry.indexOf(task));assert.equal(session.running,false);
  device.press('a');device.release('a');session.advance(.25);assert.equal(session.world,world);near(world.time,time);assert.equal(fixture.creates,1);
  fixture.cache.forEach(w=>w.dispose());
});

test('empty bay A cannot launch and A during insertion is ignored',()=>{
  const fixture=createSession(),device=Object.create(ResearchConsole.prototype);
  Object.assign(device,{machine:new CartridgeMachine(),registry,session:fixture.session,pressed:new Set(),holds:new Map(),beep:()=>{},screenState:'cartridges',onLaunch:id=>fixture.session.launch(id)});
  device.press('a');assert.equal(fixture.creates,0);device.machine.insert();device.press('a');assert.equal(fixture.creates,0);
});

test('changing the expanded task never displays it under the wrong inserted cartridge',()=>{
  const f=createSession(),s=f.session;s.launch('box');s.advance(1);const box=s.world;s.activateLab('plug');assert.equal(s.cartridgeId,null);assert.equal(s.embedded,false);s.launch('box');s.advance(1);assert.equal(s.world,box);f.cache.forEach(w=>w.dispose());
});

test('D-pad zoom and analog orbit the real inner camera without moving robot targets',()=>{
  const f=createSession(),s=f.session;s.launch('box');s.advance(1);const target=s.world.arms[0].target.clone(),distance=f.view.distance,theta=f.view.theta,phi=f.view.phi;
  s.dispatch('up');assert.ok(f.view.distance<distance);s.dispatch('down');near(f.view.distance,distance);
  s.dispatch('left');s.dispatch('right');near(f.view.theta,theta);near(f.view.phi,phi);
  s.analog(1,1,.1);assert.ok(f.view.theta>theta);assert.ok(f.view.phi<phi);near(s.world.arms[0].target.distanceTo(target),0);
  const opening=s.world.arms[0].opening;s.dispatch('a');assert.notEqual(s.world.arms[0].opening,opening);
  s.dispatch('select');assert.equal(s.state,'CONTROLS');s.choose(1);assert.equal(s.axes,'xz');s.choose(5);assert.equal(s.running,true);f.cache.forEach(w=>w.dispose());
});

test('perspective screen UV inverse remains correct after orbit, zoom, pan and resize',()=>{
  const screen=model.nodes.get('Screen_Surface'),rig=new CameraRig('console');screen.geometry.computeBoundingBox();const bounds=screen.geometry.boundingBox;
  for(const [theta,phi,distance,width,height] of [[0,1.57,.43,1000,600],[.75,1.2,.34,1440,900],[-.8,1.8,.52,390,500]]){
    rig.resize(width,height);rig.theta=theta;rig.phi=phi;rig.distance=distance;rig.update();
    for(const [u,v] of [[.15,.25],[.5,.5],[.8,.7]]){
      const point=new THREE.Vector3(bounds.min.x+u*(bounds.max.x-bounds.min.x),bounds.min.y+v*(bounds.max.y-bounds.min.y),bounds.max.z).applyMatrix4(screen.matrixWorld);
      const p=rig.project(point,width,height),uv=screenIntersection(rig.ray(p.x,p.y,width,height),screen);assert.ok(uv);near(uv.u,u);near(uv.v,v);
    }
  }
});

test('orthographic rays also map correctly to the same physical screen',()=>{
  const screen=model.nodes.get('Screen_Surface'),camera=new THREE.OrthographicCamera(-.2,.2,.15,-.15,.01,2);camera.position.set(.2,.2,.5);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const point=new THREE.Vector3(.02,.01,0).applyMatrix4(screen.matrixWorld),p=point.clone().project(camera);
  const nearPoint=new THREE.Vector3(p.x,p.y,-1).unproject(camera),farPoint=new THREE.Vector3(p.x,p.y,1).unproject(camera),ray=new THREE.Ray(nearPoint,farPoint.sub(nearPoint).normalize());
  const hit=screenIntersection(ray,screen);assert.ok(hit);near(hit.u,(.02+.064)/.128);near(hit.v,(.01+.036)/.072);
});

test('solid geometry prevents clicking the screen or A through the rear housing',()=>{
  const rig=new CameraRig('console');rig.preset('back');const screen=model.nodes.get('Screen_Surface'),center=screen.getWorldPosition(new THREE.Vector3()),p=rig.project(center,900,600);
  const hit=pickGeometry(model.root,rig,p.x,p.y,900,600);assert.ok(hit);assert.notEqual(hit.object.name,'Screen_Surface');assert.equal(screenIntersection(rig.ray(p.x,p.y,900,600),screen),null);
});

const fakeRenderer=()=>{
  const context={createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:()=>{}};
  const canvas={getContext:type=>{assert.equal(type,'2d');return context;},getBoundingClientRect:()=>({left:0,top:0,width:canvas.width,height:canvas.height})};return new SoftwareRenderer(canvas);
};
test('DPR-aware backing stores avoid normal-resolution upscaling and obey pixel limits',()=>{
  const r=fakeRenderer();r.resizeToViewport(600,400,2);assert.equal(r.width,900);assert.equal(r.height,600);r.setQuality('high');r.resizeToViewport(600,400,2);assert.equal(r.width,1200);assert.equal(r.height,800);
  r.resizeToViewport(4000,2000,3);assert.ok(r.width*r.height<3205000);
});
test('cached outer geometry accepts a new live screen texture without stale depth rejection',()=>{
  const r=fakeRenderer();r.setSize(320,240);const group=new THREE.Group();mesh(new THREE.BoxGeometry(.2,.12,.015),'#ddddcc','body',group);
  const screen=mesh(new THREE.PlaneGeometry(.13,.07),'#fff','Screen_Surface',group,{texture:'screen'});screen.position.z=.010;
  const rig=new CameraRig('console');rig.theta=0;rig.phi=Math.PI/2;rig.update();
  const texture=color=>({width:2,height:2,data:new Uint8ClampedArray(Array.from({length:4},()=>[...color,255]).flat())});
  r.textures.set('screen',texture([255,0,0]));r.render(group,rig,{staticKey:'same',mode:'surface'});r.textures.set('screen',texture([0,255,0]));r.render(group,rig,{staticKey:'same',mode:'surface'});
  assert.equal(r.stats.cached,true);const p=rig.project(new THREE.Vector3(0,0,.01),r.width,r.height),offset=((p.y|0)*r.width+(p.x|0))*4;assert.equal(r.image.data[offset],0);assert.equal(r.image.data[offset+1],255);
});
test('shared experiment drag moves a real gripper target and releases pointer ownership',()=>{
  const f=createSession(),session=f.session;session.launch('box');session.advance(1);const rig=new CameraRig('lab'),interaction=new ExperimentInteraction(session,rig);
  session.world.step();session.world.scene.updateMatrixWorld(true);const hand=session.world.arms[0].hand.clone(),palm=session.world.scene.getObjectByName('robot-left.palm').getWorldPosition(new THREE.Vector3()),p=rig.project(palm,1024,576);interaction.begin(p.x,p.y,1024,576);assert.equal(interaction.drag.kind,'gripper');
  interaction.move(p.x+35,p.y-20);assert.ok(session.world.arms[0].target.distanceTo(hand)>.01);interaction.end();assert.equal(interaction.drag,null);f.cache.forEach(w=>w.dispose());
});

test('embedded cache signature changes for camera, body and deformable geometry, not elapsed time alone',()=>{
  const group=new THREE.Group(),object=mesh(new THREE.PlaneGeometry(.2,.2),'#aaccbb','cloth',group,{deformable:true}),rig=new CameraRig('lab');
  const original=sceneSignature(group,rig);assert.equal(sceneSignature(group,rig),original);
  object.position.x=.01;assert.notEqual(sceneSignature(group,rig),original);object.position.x=0;
  object.geometry.attributes.position.array[0]+=.01;assert.notEqual(sceneSignature(group,rig),original);object.geometry.attributes.position.array[0]-=.01;
  const still=sceneSignature(group,rig);rig.orbit(1,0);assert.notEqual(sceneSignature(group,rig),still);
});
