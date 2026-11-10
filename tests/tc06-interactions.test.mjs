import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {THREE,CameraRig,SoftwareRenderer,mesh} from '../static/js/lab-v3/graphics.js';
import {CartridgeMachine,ResearchConsole} from '../static/js/lab-v3/console.js';
import {ExperimentSession} from '../static/js/lab-v3/session.js';
import {WorldSimulator} from '../static/js/lab-v3/simulation.js';
import {Spring,HoverTilt,FaceController,FACE_MOTION} from '../static/js/lab-v3/motion.js';
import {PowerSwitch} from '../static/js/lab-v3/power.js';
import {galleryCenter,galleryVacant,transferPoseFromAnchor,TransferOverlay} from '../static/js/lab-v3/gallery.js';

const near=(a,b,epsilon=1e-6)=>assert.ok(Math.abs(a-b)<epsilon,`${a} vs ${b}`);
const settle=machine=>{for(let i=0;i<1000&&machine.busy;i++)machine.advance(1/60);assert.equal(machine.busy,false);};
const settlePose=pose=>{for(let i=0;i<120;i++)pose.update(1/60);};
const pose=()=>new FaceController(new THREE.Group());

test('repeated canvas clicks never register a double-click camera reset shortcut',()=>{
  const app=readFileSync(new URL('../static/js/lab-v3/app.js',import.meta.url),'utf8');
  assert.doesNotMatch(app,/\b(?:dblclick|ondblclick)\b/);
  assert.doesNotMatch(app,/\b(?:event|e)\.detail\s*(?:>=?|===?)\s*[2-9]/);
});

for(let index=0;index<6;index++)test(`cartridge ${index+1}: one request inserts, waits for front, never launches`,()=>{
  const m=new CartridgeMachine();assert.equal(m.request(index),true);assert.equal(m.state,'ORIENTING');
  m.advance(10,false);assert.equal(m.state,'ORIENTING');assert.equal(m.inserted,null);
  settle(m);assert.equal(m.state,'READY');assert.equal(m.inserted,index);assert.equal(m.request(index),false);
  assert.equal(m.state,'READY');assert.equal(m.queued,null);
});
test('rapid replacement preserves the moving cartridge and latest request wins at the next safe point',()=>{
  const m=new CartridgeMachine();m.request(0);settle(m);m.request(1);m.advance(.1);assert.equal(m.inserted,0);assert.equal(m.state,'EJECTING');
  m.request(2);m.request(5);m.request(4);settle(m);assert.equal(m.inserted,4);assert.equal(m.state,'READY');assert.equal(m.pending,null);assert.equal(m.queued,null);
  m.request(3);m.advance(.8);m.advance(.6);assert.equal(m.state,'ALIGNING');m.request(2);m.request(2);settle(m);assert.equal(m.inserted,2);
});
test('same-card requests during insertion do not restart it; ejection can queue a replacement',()=>{
  const m=new CartridgeMachine();m.request(0);m.advance(.4);const elapsed=m.elapsed;m.request(0);assert.equal(m.elapsed,elapsed);settle(m);
  assert.equal(m.requestEject(),true);m.advance(.1);m.request(5);settle(m);assert.equal(m.inserted,5);
});
test('both cartridge entry points use the canonical request without an Insert action',()=>{
  const registry=['cloth','plug','pusht','box','marker','rope'].map(id=>({id}));let requests=0;
  const d=Object.create(ResearchConsole.prototype);Object.assign(d,{registry,machine:new CartridgeMachine(),session:{eject:()=>{}},pressed:new Set(),holds:new Map(),beep:()=>{},cancelInput:()=>{},onInsertionRequest:()=>requests++});
  d.press('cartridge:plug');assert.equal(d.machine.state,'ORIENTING');settle(d.machine);assert.equal(d.machine.inserted,1);
  assert.equal(d.requestCartridgeInsertion(1),false);assert.equal(requests,1);
  d.requestCartridgeInsertion(4);settle(d.machine);assert.equal(d.machine.inserted,4);assert.equal(requests,2);
});

test('critically damped hover integration is frame-rate independent',()=>{
  const a=new Spring(0,20),b=new Spring(0,20);a.target=b.target=.17;
  for(let i=0;i<30;i++)a.step(1/30);for(let i=0;i<144;i++)b.step(1/144);near(a.value,b.value);near(a.velocity,b.velocity);
});
test('hover signs, angle bounds, diagonal combination and graceful return',()=>{
  const h=new HoverTilt();h.point(10,-10);for(let i=0;i<50;i++)h.step(1/60);
  assert.ok(h.yaw.value>0);assert.ok(h.pitch.value<0);assert.ok(h.yaw.value<=10*Math.PI/180);assert.ok(Math.abs(h.pitch.value)<=8*Math.PI/180);
  h.clear();for(let i=0;i<20;i++)h.step(1/60);assert.ok(Math.abs(h.yaw.value)<.003);assert.ok(Math.abs(h.pitch.value)<.003);
  h.point(1,1,true);h.step(1/60,true);near(h.yaw.value,0);near(h.pitch.value,0);
});
for(const dx of [-25,25,290,-290])test(`casual ${dx}px body drag returns to its committed face`,()=>{
  const p=pose();p.begin(0);p.move(dx,30,1000,800);p.end();settlePose(p);assert.equal(p.face,'front');near(p.yaw,0);near(p.pitch,0);assert.equal(p.drag,null);assert.equal(p.snap,null);
});
test('deliberate front/back flips, overshoot and repeated turns never park sideways or jump a full turn',()=>{
  const p=pose();for(let i=0;i<8;i++){
    const before=p.yaw;p.begin(0);p.move(440,1000,1000,800);p.end();settlePose(p);
    near(p.yaw-before,Math.PI);near(p.pitch,0);assert.equal(p.face,i%2?'front':'back');
  }
  p.begin(0);p.move(900,0,1000,800);p.end();settlePose(p);near(p.yaw,9*Math.PI);
});
test('fast flick still requires both distance and angle; negative yaw uses the short snap',()=>{
  const a=pose();a.begin(0);a.move(50,0,500,10);a.end();settlePose(a);assert.equal(a.face,'front');
  const b=pose();b.begin(0);b.move(-150,0,500,30);b.end();settlePose(b);assert.equal(b.face,'back');near(b.yaw,-Math.PI);
  b.begin(1000);b.move(-200,0,500,1800);b.end();settlePose(b);assert.equal(b.face,'front');near(b.yaw,-2*Math.PI);
});
test('flip commitment is latched through threshold jitter and side-on release favors current face',()=>{
  const p=pose();p.begin(0);p.move(430,0,1000,800);p.move(-140,0,1000,1600);p.end();settlePose(p);assert.equal(p.face,'back');
  p.begin(2000);p.move(300,0,1000,2800);p.end();settlePose(p);assert.equal(p.face,'back');near(p.yaw,Math.PI);
});
test('screen ownership freezes outer hover and snap; reduced motion settles exactly',()=>{
  const p=pose();p.point(1,1);p.update(.1);p.lock();const q=p.root.quaternion.clone();for(let i=0;i<30;i++)p.update(1/60);near(q.angleTo(p.root.quaternion),0);
  p.unlock();settlePose(p);p.toFace('back');p.update(.01,true);near(p.yaw,Math.PI);near(p.pitch,0);assert.equal(p.snap,null);
});
test('gallery centers have uniform spacing and remain independent of handheld transforms',()=>{
  const centers=Array.from({length:6},(_,i)=>galleryCenter(i)),p=pose();
  centers.slice(1).forEach((x,i)=>near(x-centers[i],.045));near(centers[2]+centers[3],0);
  p.toFace('back');settlePose(p);assert.deepEqual(Array.from({length:6},(_,i)=>galleryCenter(i)),centers);
});
test('the transferred card leaves its gallery slot empty and returns after ejection without shifting neighbors',()=>{
  const m=new CartridgeMachine(),centers=Array.from({length:6},(_,i)=>galleryCenter(i)),vacancies=()=>centers.map((_,i)=>galleryVacant(m,i));
  assert.deepEqual(vacancies(),[false,false,false,false,false,false]);m.request(2);m.advance(.1);
  assert.deepEqual(vacancies(),[false,false,true,false,false,false]);settle(m);assert.deepEqual(vacancies(),[false,false,true,false,false,false]);
  m.eject();m.advance(.5);assert.equal(galleryVacant(m,2),true);settle(m);assert.deepEqual(vacancies(),[false,false,false,false,false,false]);
  assert.deepEqual(Array.from({length:6},(_,i)=>galleryCenter(i)),centers);
});
test('screen-anchored transfer maps into actual root coordinates after resize, zoom and hover pose',()=>{
  for(const [width,height,distance] of [[1000,580,.5],[358,390,.6],[1440,800,.8]]){
    const r=new CameraRig('console');r.resize(width,height);r.theta=0;r.phi=Math.PI/2;r.distance=distance;r.update();
    const root=new THREE.Group();root.rotation.set(.02,.04,0);root.updateMatrixWorld(true);
    const viewport={left:32,top:80,width,height},anchor={x:32+width*.25,y:160,pixelHeight:90,quaternion:new THREE.Quaternion().setFromEuler(new THREE.Euler(.05,-.08,0))};
    const transfer=transferPoseFromAnchor(anchor,r,root,viewport),world=root.localToWorld(transfer.position.clone()),pixel=r.project(world,width,height);
    near(pixel.x+32,anchor.x);near(pixel.y+80,anchor.y);near(transfer.quaternion.length(),1);assert.deepEqual(root.scale.toArray(),[1,1,1]);
  }
});
test('gallery background is truly transparent while ordinary console rendering stays opaque',()=>{
  let contextOptions;const context={createImageData:(width,height)=>({width,height,data:new Uint8ClampedArray(width*height*4)}),putImageData:()=>{}},canvas={getContext:(type,options)=>{contextOptions=options;return context;}};
  const renderer=new SoftwareRenderer(canvas,{alpha:true}),rig=new CameraRig('console'),scene=new THREE.Group();assert.equal(contextOptions.alpha,true);renderer.setSize(100,80);
  mesh(new THREE.BoxGeometry(.04,.04,.01),'#80a090','card',scene);renderer.render(scene,rig,{mode:'surface',transparent:true});
  assert.equal(renderer.image.data[3],0);assert.ok(renderer.image.data.some((value,index)=>index%4===3&&value===255));
  renderer.render(scene,rig,{mode:'surface'});assert.equal(renderer.image.data[3],255);
});
test('foreground transfer pixels contain only the real depth-visible card, never the gallery background or shell',()=>{
  const context={createImageData:(width,height)=>({width,height,data:new Uint8ClampedArray(width*height*4)}),putImageData:()=>{}},canvas={getContext:()=>context},overlay=new TransferOverlay(canvas);
  const parent=new THREE.Group();parent.userData.cartridge='plug';const card=new THREE.Object3D();parent.add(card);
  const renderer={width:3,height:1,objects:[card,new THREE.Object3D()],ids:new Int32Array([0,1,-1]),image:{data:new Uint8ClampedArray([20,80,150,255,200,200,190,255,255,255,255,255])}};
  overlay.present(renderer,true);assert.deepEqual([...overlay.image.data],[20,80,150,255,0,0,0,0,0,0,0,0]);
  assert.equal(canvas.hidden,false);overlay.present(renderer,false);assert.equal(canvas.hidden,true);
});

test('power slider has two endpoints, midpoint policy and cancellation restores committed state',()=>{
  let transitions=0;const power=new PowerSwitch(true,()=>transitions++);power.begin();power.move(.2);power.release();for(let i=0;i<45;i++)power.update(1/60);
  assert.equal(power.state,'OFF');near(power.slider.value,0);assert.equal(transitions,1);
  power.begin();power.move(.9);power.release(true);for(let i=0;i<45;i++)power.update(1/60);assert.equal(power.on,false);near(power.slider.value,0);
  power.begin();power.move(.5);power.release();power.update(.1,true);assert.equal(power.on,true);near(power.slider.value,1);assert.equal(transitions,2);
});
for(const task of ['cloth','plug','pusht','box','marker','rope'])test(`${task}: power OFF blocks launch, freezes physics; ON requires A while mechanics remain usable`,()=>{
  const cache=new Map(),s=new ExperimentSession(id=>{if(!cache.has(id))cache.set(id,new WorldSimulator(id,{quality:'low',resolution:10}));return cache.get(id);});
  s.power=new PowerSwitch(true,()=>s.returnMenu());s.launch(task);s.advance(1);s.world.step();const before=JSON.stringify(s.world.snapshot());
  s.power.set(false);assert.equal(s.running,false);assert.equal(s.launch(task),false);assert.equal(s.dispatch('a'),false);
  for(let i=0;i<30;i++){s.advance(1/60);if(s.running)s.world.step();}assert.equal(JSON.stringify(s.world.snapshot()),before);
  const m=new CartridgeMachine();m.request(3);settle(m);assert.equal(m.inserted,3);
  s.power.set(true);assert.equal(s.running,false);assert.equal(s.state,'CARTRIDGE_MENU');assert.equal(s.launch(task),true);s.advance(1);assert.equal(s.running,true);assert.equal(JSON.stringify(s.world.snapshot()),before);cache.forEach(w=>w.dispose());
});
