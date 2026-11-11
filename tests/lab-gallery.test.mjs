import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ExhibitSwitcher,EXHIBIT_MOTION,previewFrames} from '../static/js/lab-gallery.js';

const entries=[{id:'a',order:1},{id:'b',order:2},{id:'c',order:3},{id:'d',order:4},{id:'reserved',order:5,available:false}];
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
function harness(overrides={}){
  const calls=[],view={prepare:async e=>e,transition:async(e,d)=>calls.push(['transition',e.id,d]),commit:e=>calls.push(['commit',e.id]),select:id=>calls.push(['select',id]),phase:p=>calls.push(['phase',p]),rollback:()=>calls.push(['rollback']),error:e=>calls.push(['error',e.id]),...overrides};
  return {calls,view,controller:new ExhibitSwitcher(entries,view,'a')};
}
test('same project and unavailable entries never start preparation or motion',async()=>{
  const {controller,calls}=harness();await controller.request('a');await controller.request('reserved');await controller.request('missing');assert.deepEqual(calls,[]);assert.equal(controller.phase,'IDLE');
});
test('selection, preparation, overlapping motion and commit follow one explicit lifecycle',async()=>{
  const {controller,calls}=harness();await controller.request('b');
  assert.deepEqual(calls.filter(c=>c[0]==='phase').map(c=>c[1]),['PREPARING_NEXT','TRANSITIONING','SETTLING','IDLE']);
  assert.deepEqual(calls.filter(c=>c[0]==='transition'),[['transition','b',1]]);
  assert.equal(controller.activeProjectId,'b');assert.equal(controller.outgoingProjectId,null);assert.equal(controller.pending,null);
});
test('rapid clicks retain only the latest request, with at most one transition at a time',async()=>{
  const motions=[],h=harness({transition:(entry,d)=>{const wait=deferred();motions.push({id:entry.id,d,...wait});return wait.promise;}});
  const done=h.controller.request('b');await flush();h.controller.request('c');h.controller.request('d');
  assert.equal(motions.length,1);assert.equal(h.controller.requestedProjectId,'d');motions[0].resolve();await flush();
  assert.deepEqual(motions.map(m=>m.id),['b','d']);motions[1].resolve();await done;
  assert.equal(h.controller.activeProjectId,'d');assert.equal(h.controller.phase,'IDLE');
});
test('reverse navigation derives direction from registry order',async()=>{
  const {controller,calls}=harness();await controller.request('d');await controller.request('a');
  assert.deepEqual(calls.filter(c=>c[0]==='transition').map(c=>c[2]),[1,-1]);assert.equal(controller.activeProjectId,'a');
});
test('clicking the original project during motion returns to it without corrupting state',async()=>{
  const motions=[],h=harness({transition:e=>{const wait=deferred();motions.push({id:e.id,...wait});return wait.promise;}});
  const done=h.controller.request('b');await flush();h.controller.request('a');motions[0].resolve();await flush();
  assert.deepEqual(motions.map(m=>m.id),['b','a']);motions[1].resolve();await done;assert.equal(h.controller.activeProjectId,'a');
});
test('a superseded slow preparation is aborted and never replaces newer content',async()=>{
  let slow;const h=harness({prepare:(entry,signal)=>{if(entry.id!=='b')return Promise.resolve(entry);slow=deferred();signal.addEventListener('abort',()=>{const error=new Error('aborted');error.name='AbortError';slow.reject(error);});return slow.promise;}});
  const done=h.controller.request('b');await flush();h.controller.request('c');await done;
  assert.equal(h.controller.activeProjectId,'c');assert.deepEqual(h.calls.filter(c=>c[0]==='transition').map(c=>c[1]),['c']);
});
test('cancelling preparation by requesting the active project restores idle without a slide',async()=>{
  const h=harness({prepare:(entry,signal)=>new Promise((_,reject)=>signal.addEventListener('abort',()=>{const e=new Error();e.name='AbortError';reject(e);}))});
  const done=h.controller.request('b');await flush();h.controller.request('a');await done;assert.equal(h.controller.phase,'IDLE');assert.equal(h.controller.activeProjectId,'a');
});
test('failed preview loading retains the old content and permits a subsequent selection',async()=>{
  const h=harness({prepare:async e=>{if(e.id==='b')throw Error('image missing');return e;}});
  await h.controller.request('b');assert.equal(h.controller.activeProjectId,'a');assert.equal(h.controller.requestedProjectId,'a');assert.ok(h.calls.some(c=>c[0]==='error'));
  await h.controller.request('c');assert.equal(h.controller.activeProjectId,'c');
});
test('animation failure rolls back and releases the transition lock',async()=>{
  const h=harness({transition:async()=>{throw Error('animation interrupted');}});await h.controller.request('b');
  assert.ok(h.calls.some(c=>c[0]==='rollback'));assert.equal(h.controller.activeProjectId,'a');assert.equal(h.controller.phase,'IDLE');assert.equal(h.controller.pending,null);
});
test('dispose during preparation prevents all later UI commits',async()=>{
  const wait=deferred(),h=harness({prepare:()=>wait.promise});const done=h.controller.request('b');h.controller.dispose();wait.resolve(entries[1]);await done;
  assert.equal(h.calls.filter(c=>c[0]==='commit').length,0);assert.equal(h.controller.activeProjectId,'a');await h.controller.request('c');assert.equal(h.controller.requestedProjectId,'b');
});
test('dispose during motion prevents a late animation callback from committing',async()=>{
  const wait=deferred(),h=harness({transition:()=>wait.promise,dispose:()=>wait.resolve()});const done=h.controller.request('b');await flush();h.controller.dispose();await done;
  assert.equal(h.calls.filter(c=>c[0]==='commit').length,0);assert.equal(h.controller.activeProjectId,'a');
});
test('both keyframe sequences share a 760ms decelerating timeline and maintain crossfade continuity',()=>{
  assert.ok(EXHIBIT_MOTION.duration>=650&&EXHIBIT_MOTION.duration<=850);assert.equal(EXHIBIT_MOTION.easing,'cubic-bezier(0.22, 1, 0.36, 1)');
  const f=previewFrames(1,250),r=previewFrames(-1,250);assert.match(f.outgoing.at(-1).transform,/-250px/);assert.match(f.incoming[0].transform,/,250px/);assert.match(r.incoming[0].transform,/-250px/);
  for(let i=0;i<3;i++)assert.ok(f.incoming[i].opacity+f.outgoing[i].opacity>=1);assert.equal(f.incoming.at(-1).opacity,1);
});
test('gallery templates remain registry driven, with real routes and disabled future slots',()=>{
  const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8'),template=read('templates/lab-gallery.html'),source=read('static/js/lab-gallery.js'),css=read('static/styles/lab-exhibition.css');
  assert.match(template,/data-preview-template/);assert.match(template,/data-exhibit-select/);assert.match(template,/Future exhibit/);assert.match(template,/lab-project-reserved" disabled/);
  assert.doesNotMatch(source,/WorldSimulator|lab-v3|new CodeRain|setInterval|requestAnimationFrame\(tick/);
  assert.match(source,/Promise.allSettled/);assert.match(source,/document.hidden/);assert.match(source,/prefers-reduced-motion/);assert.match(source,/replaceChildren\(layer\)/);
  assert.match(css,/grid-template-columns:minmax\(240px,28%\) minmax\(0,1fr\)/);assert.match(css,/aspect-ratio:16\/9/);assert.match(css,/@media\(max-width:800px\)/);
  assert.match(template,/slot not in registered_numbers/);assert.match(source,/document.importNode/);
});
test('the actual preview is a high-resolution 16:9 project render, not a stretched placeholder',()=>{
  const png=readFileSync(new URL('../static/img/lab/world-simulator.png',import.meta.url));
  assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),1440);assert.equal(png.readUInt32BE(20),810);assert.ok(png.length<500000);
});
