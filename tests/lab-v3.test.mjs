import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {THREE,GeometrySampler,CameraRig,SoftwareRenderer,coordinateInFrame,mesh} from '../static/js/lab-v3/graphics.js';
import {WorldSimulator,Timeline,insertionMetrics,crossingRing,containedInBox,exportPoints,pointsCSV,pointsPLY} from '../static/js/lab-v3/simulation.js';
import {CartridgeMachine,normalizeJoystick,CARTRIDGE_TIMES} from '../static/js/lab-v3/console.js';
import {solveArm,forwardArm} from '../static/js/lab-v3/robot.js';
const near=(a,b,epsilon=1e-8)=>assert.ok(Math.abs(a-b)<epsilon,`${a} != ${b}`);
const v=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const tasks=JSON.parse(await readFile(new URL('../static/lab/tc06/experiments.json',import.meta.url)));

test('six distinct registered experiments',()=>assert.deepEqual(tasks.map(t=>t.id),['cloth','plug','pusht','box','marker','rope']));
test('TC-06 asset contains addressable geometry, exact texture and real controls',async()=>{
  const data=JSON.parse(await readFile(new URL('../static/lab/tc06/console-mesh.json',import.meta.url)));
  assert.equal(data.up,'Y');assert.equal(data.handedness,'right');
  for(const name of ['Button_A','Button_B','Button_Start','Button_Select','Joystick_Pivot','Power_Track','Power_Slider','Power_OFF','Power_ON','Screen_Surface',...tasks.map(t=>'Cartridge_'+t.id)])assert.ok(data.nodes.some(n=>n.name===name),name);
  assert.ok(data.nodes.some(n=>n.texture==='logo-badge.png'));assert.ok(data.nodes.reduce((n,o)=>n+(o.positions?.length||0)/9,0)>5000);
});
test('cartridge insertion, busy guard and reverse ejection',()=>{
  const m=new CartridgeMachine();m.select(2);assert.ok(m.insert());assert.equal(m.select(4),false);assert.equal(m.insert(),false);
  for(let i=0;i<150;i++)m.advance(1/60);assert.equal(m.state,'READY');assert.equal(m.inserted,2);
  m.select(4);m.insert();assert.equal(m.state,'EJECTING');for(let i=0;i<240;i++)m.advance(1/60);assert.equal(m.state,'READY');assert.equal(m.inserted,4);
  m.eject();for(let i=0;i<Math.ceil(CARTRIDGE_TIMES.EJECTING*60)+1;i++)m.advance(1/60);assert.equal(m.inserted,null);
});
test('joystick radial clamping and dead zone',()=>{assert.deepEqual(normalizeJoystick(.01,.03),{x:0,y:0});const j=normalizeJoystick(3,4);near(Math.hypot(j.x,j.y),1);assert.ok(normalizeJoystick(.5,0).x>0);});
test('analytic IK preserves link lengths and reaches target',()=>{
  const base=v(-.52,.25,-.12),target=v(.12,.5,.2),solution=solveArm(base,target),fk=forwardArm(base,solution);
  near(fk.hand.distanceTo(target),0);near(base.distanceTo(fk.joint),.46);near(fk.joint.distanceTo(fk.hand),.44);
  assert.equal(solveArm(base,v(5,5,5)).reachable,false);
});
test('coordinate frames use actual object and camera matrices',()=>{
  const object=new THREE.Object3D();object.position.set(1,2,3);object.rotation.y=.5;object.updateMatrixWorld();
  const local=v(.2,.3,.4),world=local.clone().applyMatrix4(object.matrixWorld),rig=new CameraRig('lab');
  near(coordinateInFrame(world,object,'local',rig.camera).distanceTo(local),0);
  near(coordinateInFrame(world,object,'relative',rig.camera,object).distanceTo(local),0);
  const before=coordinateInFrame(world,object,'camera',rig.camera);rig.orbit(40,10);
  assert.ok(before.distanceTo(coordinateInFrame(world,object,'camera',rig.camera))>.01);near(coordinateInFrame(world,object,'world',rig.camera).distanceTo(world),0);
});
test('barycentric samples are deterministic and follow actual geometry',()=>{
  const group=new THREE.Group(),object=mesh(new THREE.BoxGeometry(1,1,1),'#63a0af','cube',group),sampler=new GeometrySampler();
  const first=sampler.sampleScene(group,200,7),second=sampler.sampleScene(group,200,7);assert.equal(first.length,200);
  assert.deepEqual(first.map(p=>p.local.toArray()),second.map(p=>p.local.toArray()));
  object.position.x=2;const moved=sampler.sampleScene(group,200,7);near(moved[0].world.x-first[0].world.x,2);assert.equal(first[0].id,moved[0].id);
  assert.notDeepEqual(first[0].local.toArray(),sampler.sampleScene(group,200,9)[0].local.toArray());
  group.visible=false;assert.equal(sampler.sampleScene(group,200).length,0);
});
test('point exports preserve frame, values and vertex count',()=>{
  const group=new THREE.Group();mesh(new THREE.BoxGeometry(1,1,1),'#fff','cube',group);const points=new GeometrySampler().sampleScene(group,30,3),rows=exportPoints(points);
  near(rows[0].x,points[0].world.x);assert.equal(pointsCSV(rows).split('\n').length,31);assert.ok(pointsPLY(rows).includes('element vertex 30'));assert.ok(pointsCSV(rows).includes('world,m'));
});
test('insertion rejects radial and angular mismatch',()=>{
  const target=v(),identity=new THREE.Quaternion(),center=v(0,.02,0);
  assert.ok(insertionMetrics(center,identity,.20,target,identity,.02,.03,.10).success);
  assert.equal(insertionMetrics(v(.04,.02,0),identity,.20,target,identity,.02,.03,.10).valid,false);
  assert.equal(insertionMetrics(center,new THREE.Quaternion().setFromAxisAngle(v(0,0,1),.5),.2,target,identity,.02,.03,.1).valid,false);
});
test('rope crossing is directed and must pass through aperture',()=>{
  assert.equal(crossingRing(v(-1,0,0),v(1,0,0),v(),v(1,0,0),.1),true);
  assert.equal(crossingRing(v(-1,1,0),v(1,1,0),v(),v(1,0,0),.1),false);
  assert.equal(crossingRing(v(1,0,0),v(-1,0,0),v(),v(1,0,0),.1),false);
});
test('packing containment uses dimensions, not centers alone',()=>{assert.equal(containedInBox(v(0,.05,0),v(.02,.02,.02),v(),v(.1,.1,.1)),true);assert.equal(containedInBox(v(.09,.05,0),v(.02,.02,.02),v(),v(.1,.1,.1)),false);});
for(const task of tasks)test(`${task.id}: bounded stepping, snapshots and independent rollouts`,()=>{
  const world=new WorldSimulator(task.id,{quality:'low',resolution:10});for(let i=0;i<120;i++)world.step();
  const snapshot=world.snapshot();assert.equal(world.metrics().success,false);assert.ok(snapshot.bodies.every(b=>b.p.every(Number.isFinite)));
  const before=JSON.stringify(snapshot),prediction=world.predict({arm:0,target:[.1,.5,.1],opening:.1},.25);
  assert.equal(JSON.stringify(world.snapshot()),before);assert.ok(prediction.path.length>1);assert.ok(prediction.terminal.time>world.time);
  world.restore(snapshot);snapshot.bodies.forEach((data,i)=>assert.deepEqual(world.physics.bodies[i].position.toArray(),data.p));
  assert.throws(()=>world.step(.1),/fixed/);world.dispose();
});
test('cloth release changes a real constraint and gravity moves nodes',()=>{
  const world=new WorldSimulator('cloth',{resolution:10}),count=world.physics.constraints.length,y=world.particleBodies[0].position.y;
  world.command('release');assert.equal(world.physics.constraints.length,count-2);for(let i=0;i<60;i++)world.step();assert.ok(world.particleBodies[0].position.y<y-.05);world.dispose();
});
test('cloning preserves a rigid grasp frame rather than recomputing its rest pose',()=>{
  const world=new WorldSimulator('box');world.command('auto');let frames=0;
  while(!world.grasps[0]&&frames++<600)world.step();assert.ok(world.grasps[0]);
  const snapshot=world.snapshot(),clone=world.clone();
  assert.deepEqual(clone.snapshot().grasps,snapshot.grasps);
  for(let i=0;i<10;i++){world.step();clone.step();}
  const a=world.records.get('packing-0').body.position,b=clone.records.get('packing-0').body.position;
  assert.ok(a.distanceTo(b)<.0001);clone.dispose();world.dispose();
});
test('timeline bounds memory and restores exact positions',()=>{
  const w=new WorldSimulator('box'),timeline=new Timeline(3);timeline.recording=true;for(let i=0;i<5;i++){w.step();timeline.record(w);}assert.equal(timeline.frames.length,3);
  const state=timeline.frames[0];timeline.restore(w,0);near(w.time,state.time);assert.deepEqual(w.tool?.body.position.toArray(),undefined);timeline.clear();assert.equal(timeline.frames.length,0);w.dispose();
});
test('a held rigid body wakes and follows again after a stationary grasp',()=>{
  const world=new WorldSimulator('box');world.command('auto');let i=0;while(!world.grasps[0]&&i++<600)world.step();
  world.auto=false;world.arms[0].target.copy(world.arms[0].hand);for(let frame=0;frame<120;frame++)world.step();
  const body=world.records.get(world.grasps[0].bodyId).body,before=body.position.clone();
  world.arms[0].target.y+=.2;for(let frame=0;frame<60;frame++)world.step();assert.ok(body.position.y>before.y+.1);
  world.command('release');assert.equal(body.sleepState,0);world.dispose();
});
test('software depth buffer occludes and picks nearest triangle',()=>{
  const context={createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:()=>{}};
  const canvas={getContext:type=>{assert.equal(type,'2d');return context;},getBoundingClientRect:()=>({left:0,top:0,width:canvas.width,height:canvas.height})};
  const renderer=new SoftwareRenderer(canvas);renderer.resizeAspect(1);
  renderer.depth.fill(Infinity);renderer.ids.fill(-1);renderer.pointIds.fill(-1);
  const a=[10,10,.5,1,0,0],b=[50,10,.5,1,0,0],c=[10,50,.5,1,0,0];
  renderer.triangle(a,b,c,[255,0,0],null,0);renderer.triangle(a.map((v,i)=>i===2?.2:v),b.map((v,i)=>i===2?.2:v),c.map((v,i)=>i===2?.2:v),[0,255,0],null,1);
  renderer.objects=[{name:'far'},{name:'near'}];assert.equal(renderer.pick(20,20,renderer.width,renderer.height).object.name,'near');assert.equal(renderer.image.data[(20*renderer.width+20)*4+1],255);
});
