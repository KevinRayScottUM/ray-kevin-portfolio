import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {THREE,loadConsole,SoftwareRenderer,CameraRig} from '../static/js/lab-v3/graphics.js';
import {ShowcaseMotion,HorizontalIntent,normalizedWheel,tourPose,nearestPose,TOUR_POSES,TOUR_INPUT} from '../static/js/lab-showcase-motion.js';
import {compileHardware,createHardwareScene,ShowcaseRig,indexRigidGeometry} from '../static/js/lab-showcase-scene.js';
import {drawConsoleHome} from '../static/js/lab-v3/home-screen.js';
import {HardwareShowcase} from '../static/js/lab-showcase.js';

const settle=(m,hz=60)=>{for(let i=0;i<hz*3;i++)m.step(1/hz,1000+i*1000/hz);};
const wheel=(x,y=0,deltaMode=0)=>({deltaX:x,deltaY:y,deltaMode});
test('wheel deltas normalize pixels, lines and pages without confusing pinch or vertical intent',()=>{
  assert.deepEqual(normalizedWheel(wheel(2,1,1),800),{x:32,y:16});assert.deepEqual(normalizedWheel(wheel(1,0,2),800),{x:800,y:0});
  const intent=new HorizontalIntent();assert.equal(intent.feed(wheel(2,40),800,0),0);assert.equal(intent.feed({...wheel(40),ctrlKey:true},800,16),0);
  assert.equal(intent.feed({...wheel(0,32),shiftKey:true},800,32),32);
});
test('high resolution horizontal samples accumulate before capture and release for vertical scrolling',()=>{
  const intent=new HorizontalIntent();for(let i=0;i<11;i++)assert.equal(intent.feed(wheel(.5),800,i*4),0);
  assert.equal(intent.feed(wheel(.5),800,44),6);assert.equal(intent.feed(wheel(4,1),800,48),4);assert.equal(intent.feed(wheel(1,30),800,52),0);assert.equal(intent.locked,false);
  assert.equal(intent.feed(wheel(-8),800,1000),-8);
});
test('initial showcase is exactly idle, front-facing and does not autoplay',()=>{
  const m=new ShowcaseMotion();settle(m);assert.equal(m.progress,0);assert.equal(m.needsFrame,false);assert.equal(m.phase,'IDLE');assert.equal(tourPose(0).yaw,0);assert.equal(tourPose(0).pitch,0);
});
test('small input remains small, while a longer gesture produces proportional continuous movement',()=>{
  const small=new ShowcaseMotion(),large=new ShowcaseMotion();small.begin(0);large.begin(0);small.nudge(4*TOUR_INPUT.turnsPerPixel,16);large.nudge(40*TOUR_INPUT.turnsPerPixel,16);
  for(let i=0;i<6;i++){small.step(1/60,16+i*16);large.step(1/60,16+i*16);}
  assert.ok(small.progress>0&&small.progress<.01);assert.ok(large.progress>small.progress*5&&large.progress<.05);
});
test('release has bounded inertia, frame-independent damping and an exact curated final pose',()=>{
  const run=hz=>{const m=new ShowcaseMotion();m.begin(0);m.nudge(.06,16);m.end(false,16);settle(m,hz);return m;};
  const a=run(60),b=run(120);assert.equal(a.progress,b.progress);assert.equal(a.progress,TOUR_POSES[1].progress);assert.equal(a.needsFrame,false);assert.ok(a.coasted<=TOUR_INPUT.maxCoast+1e-9);
});
test('holding a drag still before release does not cause a stale-velocity fling',()=>{
  const m=new ShowcaseMotion();m.begin(0);m.nudge(.06,16);for(let i=0;i<120;i++)m.step(1/60,16+i*16);m.end(false,2500);assert.equal(m.coast,0);settle(m);assert.equal(m.progress,TOUR_POSES[1].progress);
});
test('landmark buttons, Home/End and reverse navigation share the same bounded progress',()=>{
  const m=new ShowcaseMotion();for(let i=1;i<TOUR_POSES.length;i++){m.advance(1);settle(m);assert.equal(m.progress,TOUR_POSES[i].progress);}
  assert.equal(m.progress,1);m.advance(1);settle(m);assert.equal(m.progress,1);m.advance(-1);settle(m);assert.equal(m.progress,TOUR_POSES[6].progress);m.to(0);settle(m);assert.equal(m.progress,0);
});
test('0 to 360 uses continuous unwrapped yaw and the final quaternion is equivalent to the first',()=>{
  const scene={quaternion:new THREE.Quaternion()},rig=new ShowcaseRig();rig.pose(0,scene);const first=scene.quaternion.clone();
  const before=tourPose(.9999),end=tourPose(1);assert.ok(end.yaw-before.yaw<.001);assert.equal(end.yaw,Math.PI*2);rig.pose(1,scene);assert.ok(first.angleTo(scene.quaternion)<1e-7);
  for(const p of [.088888-.000001,.088888+.000001,.5-.000001,.5+.000001])assert.ok(Number.isFinite(tourPose(p).distance));
  assert.equal(nearestPose(.5),4);
});
test('reduced motion resolves direct choices without inertial sweeps and cancellation freezes the current angle',()=>{
  const m=new ShowcaseMotion();m.setReduced(true);m.advance(1);assert.equal(m.progress,TOUR_POSES[1].progress);assert.equal(m.needsFrame,false);
  m.setReduced(false);m.to(1);m.step(.02,10);const p=m.progress;m.end(true);settle(m);assert.equal(m.progress,p);
});
test('wheel stream release is delayed and cannot spin beyond the finite full revolution',()=>{
  const m=new ShowcaseMotion();m.wheel(50,0);m.step(.016,50);assert.equal(m.phase,'SCRUBBING');m.step(.016,200);assert.notEqual(m.phase,'SCRUBBING');
  for(let i=0;i<100;i++){m.wheel(500,i*16);m.step(.016,i*16);}m.to(1);settle(m);assert.equal(m.progress,1);
});
test('shared screen painter preserves original artwork placement and four physical screen labels',()=>{
  const calls=[],buttons=[],logo={};const context={drawImage:(...a)=>calls.push(a),fillText:(...a)=>calls.push(a)};
  drawConsoleHome(context,logo,(...args)=>buttons.push(args));assert.deepEqual(calls[0],[logo,189,13,134,134]);assert.deepEqual(buttons.map(b=>b[0]),['Labs','Cartridges','Inspector','Settings']);assert.equal(buttons[3][2],382);
});

const data=JSON.parse(readFileSync(new URL('../static/lab/tc06/console-mesh.json',import.meta.url))),originalFetch=globalThis.fetch;
let source;try{globalThis.fetch=async()=>({ok:true,json:async()=>data});source=await loadConsole('local');}finally{globalThis.fetch=originalFetch;}
compileHardware(source);
const canvas=()=>({getContext:()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){}})});
function render(progress,optimized=true){
  const hardware=createHardwareScene(source),rig=new ShowcaseRig(),r=new SoftwareRenderer(canvas());r.setSize(320,180);r.setStudio(true);r.setBackground('#101418');rig.pose(progress,hardware.pivot);
  r.render(hardware.scene,rig,{mode:'surface',vertexCache:optimized,fastClip:optimized});return {r,hardware,rig};
}
const pixelsFor=(r,name)=>{const id=r.objects.findIndex(o=>o.name===name);return id<0?0:r.ids.reduce((n,v)=>n+(v===id),0);};
test('indexed rigid geometry preserves every original position, normal and UV, not a simplified replacement',()=>{
  const original=new THREE.BoxGeometry(1,1,1).toNonIndexed(),indexed=indexRigidGeometry(original),expanded=indexed.toNonIndexed();
  for(const key of ['position','normal','uv'])assert.deepEqual(expanded.attributes[key].array,original.attributes[key].array);
  assert.ok(indexed.attributes.position.count<original.attributes.position.count);
});
test('showcase instances own transforms and cameras, while source geometry and cartridges stay unchanged',()=>{
  const a=createHardwareScene(source),b=createHardwareScene(source),rig=new ShowcaseRig(),main=new CameraRig('console'),before=main.camera.matrixWorld.toArray();
  rig.pose(.3,a.pivot);assert.notDeepEqual(a.pivot.quaternion.toArray(),b.pivot.quaternion.toArray());assert.deepEqual(source.root.quaternion.toArray(),[0,0,0,1]);assert.deepEqual(main.camera.matrixWorld.toArray(),before);
  assert.equal(a.nodes.get('Cartridges').visible,false);assert.equal(source.nodes.get('Cartridges').visible,true);assert.equal(a.nodes.get('Shell_Front').geometry,b.nodes.get('Shell_Front').geometry);
});
test('real hardware is nonblank at front, side and rear, with correct front/rear occlusion',()=>{
  const front=render(0).r,side=render(.25).r,rear=render(.5).r;
  for(const r of [front,side,rear])assert.ok(r.ids.some(id=>id>=0));
  assert.ok(pixelsFor(front,'Screen_Surface')>100);assert.equal(pixelsFor(front,'Logo_Rear'),0);assert.ok(pixelsFor(rear,'Logo_Rear')>50);assert.equal(pixelsFor(rear,'Screen_Surface'),0);
  assert.notDeepEqual(front.image.data,side.image.data);assert.notDeepEqual(front.image.data,rear.image.data);
});
test('optional projection fast path retains visible pixels and reduces work on the real double-sided model',()=>{
  for(const p of [0,.0888889,.25,.5,.86,1]){
    const a=render(p,false).r,b=render(p,true).r;let differences=0;
    for(let i=0;i<a.image.data.length;i++)if(Math.abs(a.image.data[i]-b.image.data[i])>2)differences++;
    assert.ok(differences/a.image.data.length<.01,`visible image changed at ${p}: ${differences}`);
    assert.equal(b.stats.shadedVertices,a.stats.shadedVertices);assert.ok(b.stats.projectedVertices<a.stats.projectedVertices);
  }
});
test('straight-on rear badge projects circularly and the complete revolution returns to the same pixels',()=>{
  const {r,hardware,rig}=render(.5),node=hardware.nodes.get('Rear_Badge_Disk'),box=new THREE.Box3().setFromObject(node),min=rig.project(new THREE.Vector3(box.min.x,box.min.y,box.max.z),320,180),max=rig.project(new THREE.Vector3(box.max.x,box.max.y,box.max.z),320,180);
  assert.ok(Math.abs(Math.abs(max.x-min.x)-Math.abs(max.y-min.y))<.2);
  assert.deepEqual(render(0).r.image.data,render(1).r.image.data);
});
test('all intermediate hardware views retain a safe frame margin, not only the eight landmarks',()=>{
  for(let step=0;step<=40;step++){
    const {r}=render(step/40);
    for(let i=0;i<r.ids.length;i++)if(r.ids[i]>=0){const x=i%r.width,y=Math.floor(i/r.width);assert.ok(x>3&&x<r.width-4&&y>3&&y<r.height-4,`clipped hardware at progress ${step/40}, pixel ${x},${y}`);}
  }
});
function inputHarness(){
  const captures=new Set(),stage={focus(){},setPointerCapture:id=>captures.add(id),hasPointerCapture:id=>captures.has(id),releasePointerCapture:id=>captures.delete(id)},view=Object.create(HardwareShowcase.prototype);
  Object.assign(view,{stage,motion:new ShowcaseMotion(),intent:new HorizontalIntent(),inputCounts:{drags:0},canOwn:()=>true,markInput(){this.marked=true;},schedule(){}});
  return {view,captures};
}
const pointer=(type,id,x,y)=>({button:0,pointerType:type,pointerId:id,clientX:x,clientY:y,target:{closest:()=>null}});
test('mouse drag owns and releases capture without navigation or a stale drag after release',()=>{
  const {view,captures}=inputHarness();view.pointerDown(pointer('mouse',1,200,80));assert.ok(captures.has(1));
  view.pointerMove(pointer('mouse',1,160,80));assert.ok(view.motion.spring.target>0);view.pointerEnd(pointer('mouse',1,160,80));assert.equal(captures.size,0);assert.equal(view.pointer,null);
  const target=view.motion.spring.target;view.pointerMove(pointer('mouse',1,100,80));assert.equal(view.motion.spring.target,target);
});
test('touch adapter leaves vertical movement unowned and cancels captured horizontal movement cleanly',()=>{
  const {view,captures}=inputHarness();view.pointerDown(pointer('touch',2,200,80));view.pointerMove(pointer('touch',2,198,110));assert.equal(view.pointer.rejected,true);assert.equal(captures.size,0);assert.equal(view.motion.spring.target,0);view.pointerEnd(pointer('touch',2,198,110));
  view.pointerDown(pointer('touch',3,200,80));view.pointerMove(pointer('touch',3,170,82));assert.ok(captures.has(3));assert.ok(view.motion.spring.target>0);view.pointerEnd(pointer('touch',3,170,82),true);assert.equal(captures.size,0);assert.equal(view.motion.phase,'IDLE');
});
test('gallery integration loads only hardware modules, guards async mounts and preserves independent vertical transitions',()=>{
  const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8'),showcase=read('static/js/lab-showcase.js'),gallery=read('static/js/lab-gallery.js'),template=read('templates/macros/exhibit.html');
  assert.doesNotMatch(showcase,/WorldSimulator|ExperimentSession|simulation\.js|cannon|WebGLRenderer|WebGPURenderer|FaceController/);
  assert.match(gallery,/this.showcase\?\.pause\(\)/);assert.match(gallery,/epoch!==this.showcaseEpoch/);assert.match(gallery,/import\('\.\/lab-showcase.js'\)/);assert.match(gallery,/Promise.allSettled/);
  assert.match(template,/data-showcase/);assert.match(template,/gallery\.enter/);assert.match(read('static/styles/lab-exhibition.css'),/touch-action:pan-y pinch-zoom/);
  assert.match(showcase,/if\(moving\)this.schedule\(\)/);assert.match(showcase,/intersectionObserver.disconnect\(\)/);
});
