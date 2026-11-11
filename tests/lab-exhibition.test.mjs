import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MATERIALS,materialKind,studioLighting} from '../static/js/lab-v3/studio.js';
import {THREE,SoftwareRenderer,CameraRig,mesh} from '../static/js/lab-v3/graphics.js';
import {HoverTilt,FaceController} from '../static/js/lab-v3/motion.js';
import {CodeRain,RAIN,readingMasks} from '../static/js/lab-rain.js';

const point=new THREE.Vector3(),eye=new THREE.Vector3(0,0,1),front=new THREE.Vector3(0,0,1);
test('studio diffuse follows transformed geometric normals and material occlusion',()=>{
  const a=studioLighting(front,point,eye),b=studioLighting(new THREE.Vector3(0,-1,0),point,eye);
  assert.ok(a.diffuse>b.diffuse);assert.ok(studioLighting(front,point,eye,'recess').diffuse<a.diffuse);
});
test('specular and softbox response changes with viewpoint and roughness',()=>{
  const n=new THREE.Vector3(-.2,.35,1).normalize(),a=studioLighting(n,point,eye,'metal'),b=studioLighting(n,point,new THREE.Vector3(.7,0,1),'metal');
  assert.notEqual(a.specular,b.specular);assert.ok(studioLighting(n,point,eye,'rubber').specular<a.specular);
});
test('glass keeps display energy and strictly bounds reflection in all quality modes',()=>{
  for(const quality of ['low','balanced','high','adaptive'])for(let i=0;i<90;i++){
    const n=new THREE.Vector3(Math.sin(i*Math.PI/180),0,Math.cos(i*Math.PI/180)),l=studioLighting(n,point,eye,'glass',quality);
    assert.ok(l.diffuse>=.82&&l.diffuse<=1);assert.ok(l.specular>=0&&l.specular<=.065);
    if(quality==='low')assert.equal(l.specular,0);
  }
});
test('material families are assigned from real hardware identity, not one universal gloss',()=>{
  const kinds={Screen_Surface:'glass',Joystick_Cap:'rubber',a_cap:'button',Contact_0:'metal',Power_Track:'housing',Screen_Bezel:'recess',Shell_Front:'housing'};
  for(const [name,kind] of Object.entries(kinds))assert.equal(materialKind({name,userData:name==='Screen_Surface'?{texture:'screen'}:{}}),kind);
  assert.equal(materialKind({name:'cloth_body',userData:{},parent:{userData:{cartridge:'cloth'}}}),'cartridge');assert.equal(Object.keys(MATERIALS).length,8);
});
test('CPU rasterization lights actual pixels, preserves geometry IDs and invalidates static lighting cache',()=>{
  const canvas={getContext:()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:()=>{}})},r=new SoftwareRenderer(canvas),rig=new CameraRig('console'),scene=new THREE.Group();
  r.setSize(160,120);r.setStudio(true);r.setBackground('#101418');rig.theta=0;rig.phi=Math.PI/2;rig.target.set(0,0,0);rig.update();
  const object=mesh(new THREE.PlaneGeometry(.15,.15).toNonIndexed(),'#b0aaa0','Shell_Front',scene);r.render(scene,rig,{mode:'surface',staticKey:'front'});const before=r.image.data.slice(),ids=r.ids.slice();assert.ok(ids.some(v=>v===0));assert.equal(r.stats.shadedVertices,4);assert.equal(object.geometry.attributes.position.count,6);
  r.render(scene,rig,{mode:'surface',staticKey:'front'});assert.equal(r.stats.cached,true);r.setStudio(false);r.render(scene,rig,{mode:'surface',staticKey:'front'});assert.equal(r.stats.cached,false);assert.notDeepEqual(r.image.data,before);assert.deepEqual(r.ids,ids);
  object.rotation.y=.2;r.setStudio(true);r.render(scene,rig,{mode:'surface',staticKey:'tilt'});assert.notDeepEqual(r.image.data,before);
});
test('stronger hover remains bounded, damped, fixed-position and separate from face snapping',()=>{
  const card=new HoverTilt();card.point(1,-1);for(let i=0;i<90;i++)card.step(1/60);assert.ok(card.yaw.value>.27&&card.yaw.value<.281);assert.ok(card.pitch.value<-.24&&card.pitch.value>-.245);
  const root=new THREE.Group(),pose=new FaceController(root);pose.point(1,1);for(let i=0;i<90;i++)pose.update(1/60);assert.equal(pose.face,'front');assert.ok(pose.hover.yaw.value>.13);assert.ok(pose.hover.pitch.value>.12);assert.deepEqual(root.position.toArray(),[0,0,0]);pose.lock();const q=root.quaternion.clone();pose.update(1);assert.deepEqual(root.quaternion.toArray(),q.toArray());pose.unlock();for(let i=0;i<90;i++)pose.update(1/60);assert.ok(root.quaternion.angleTo(new THREE.Quaternion())<1e-5);
});
test('gallery is registry-driven, buildable static routes and does not start a second simulation',()=>{
  const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8'),gallery=read('templates/lab-gallery.html'),registry=read('data/exhibits.toml');
  assert.match(gallery,/load_data\(path="data\/exhibits.toml"\)/);assert.match(gallery,/for exhibit in collection.exhibits/);assert.doesNotMatch(gallery,/lab-v3\/app|WorldSimulator|<canvas/);
  assert.equal((registry.match(/\[\[exhibits\]\]/g)||[]).length,1);assert.match(registry,/route = "lab\/world-simulator\/"/);
  assert.match(read('content/lab/_index.md'),/template = "lab-gallery.html"/);assert.match(read('content/lab/world-simulator/_index.md'),/template = "lab.html"/);assert.match(read('templates/lab.html'),/All Projects/);
});
test('visitor-facing captions and asset generation no longer use the obsolete model designation',()=>{
  const paths=['templates/lab.html','templates/lab-gallery.html','content/lab/_index.md','content/lab/world-simulator/_index.md','static/js/lab-v3/app.js','static/js/lab-v3/console.js','static/js/lab-v3/mechanics.js','tools/tc06/process_assets.py'];
  paths.forEach(p=>assert.doesNotMatch(readFileSync(new URL('../'+p,import.meta.url),'utf8'),/TC-06|tc-06/));
});
test('code rain is throttled, clears hardware masks, respects reduced motion and releases resources',()=>{
  const originals={document:globalThis.document,matchMedia:globalThis.matchMedia,ResizeObserver:globalThis.ResizeObserver},calls=[];
  let removed=false,disconnected=false;const context={clearRect:(...r)=>calls.push(['clear',...r]),fillText:(...args)=>calls.push(['glyph',...args])},canvas={setAttribute:()=>{},getContext:()=>context,remove:()=>removed=true};
  try{
    globalThis.document={createElement:()=>canvas};globalThis.matchMedia=()=>({matches:false});globalThis.ResizeObserver=class{observe(){}disconnect(){disconnected=true;}};
    const rain=new CodeRain({append:()=>{},getBoundingClientRect:()=>({width:900,height:600})},true),holes=[{x:250,y:200,width:300,height:250}];
    assert.equal(rain.paint(1000,holes),true);const glyphs=calls.filter(c=>c[0]==='glyph').length;assert.equal(glyphs,Math.ceil(900/RAIN.spacing)*RAIN.tail);assert.ok(RAIN.opacity<=.5&&RAIN.headOpacity<=.6);
    assert.equal(rain.paint(1001,holes),false);assert.equal(calls.filter(c=>c[0]==='glyph').length,glyphs);assert.deepEqual(calls.at(-1),['clear',250,200,300,250]);
    rain.paint(1200,holes,true);assert.equal(canvas.hidden,true);assert.equal(calls.filter(c=>c[0]==='glyph').length,glyphs);rain.dispose();assert.equal(removed,true);assert.equal(disconnected,true);
  }finally{for(const [k,v] of Object.entries(originals)){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}
});
test('page rain protects reading areas and remains scheduled offscreen in either workspace',()=>{
  let selector='';const root={querySelectorAll:s=>{selector=s;return[{getBoundingClientRect:()=>({x:100,y:20,width:200,height:30})}];}};
  assert.deepEqual(readingMasks(root),[{x:92,y:14,width:216,height:42}]);
  assert.match(selector,/portfolio-nav-link/);assert.match(selector,/lab-collection-heading/);assert.match(selector,/tc-heading/);assert.match(selector,/footer/);
  const app=readFileSync(new URL('../static/js/lab-v3/app.js',import.meta.url),'utf8');
  assert.match(app,/const pageRain=new CodeRain\(document.body\)/);assert.match(app,/pageRain.paint\(now,readingMasks\(\),reduced.matches\)/);assert.match(app,/pageRain.dispose\(\)/);
  assert.match(app,/if\(!visible\)\{last=0;if\(!reduced.matches\)schedule\(\);return;\}/);
  assert.doesNotMatch(app,/function schedule\(\)\{[^\n]*&&visible/);
});
