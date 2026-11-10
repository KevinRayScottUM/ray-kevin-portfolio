import {writeFile,readFile} from 'node:fs/promises';
import os from 'node:os';
import {performance} from 'node:perf_hooks';
import {WorldSimulator} from '../../static/js/lab-v3/simulation.js';
import {SoftwareRenderer,GeometrySampler,CameraRig,QUALITY} from '../../static/js/lab-v3/graphics.js';

const registry=JSON.parse(await readFile(new URL('../../static/lab/tc06/experiments.json',import.meta.url)));
const context={createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:()=>{}};
const canvas={getContext:type=>{if(type!=='2d')throw new Error('Non-CPU context');return context;}};
const renderer=new SoftwareRenderer(canvas),rig=new CameraRig('lab'),sampler=new GeometrySampler();
const percentile=(values,q)=>[...values].sort((a,b)=>a-b)[Math.floor((values.length-1)*q)];
const report={date:new Date().toISOString(),environment:{runtime:process.version,cpu:os.cpus()[0].model,platform:os.platform(),arch:os.arch(),logicalCores:os.cpus().length},protocol:'Node CPU rasterizer + Cannon physics; no browser upload/compositing. 5 warmups + 20 measured frames. 1800-step automatic runs, balanced default physics; not a browser FPS claim.',profiles:[],automatic:[]};
for(const quality of ['low','balanced','high'])for(const task of ['cloth','box','rope']) {
  renderer.setQuality(quality);const world=new WorldSimulator(task,{quality}),samples=[],physics=[];
  for(let i=0;i<25;i++) {
    let start=performance.now();world.step();if(i>=5)physics.push(performance.now()-start);
    start=performance.now();const points=sampler.sampleScene(world.scene,QUALITY[quality].points,7);
    renderer.render(world.scene,rig,{points});if(i>=5)samples.push(performance.now()-start);
  }
  report.profiles.push({quality,task,width:renderer.width,height:renderer.height,frameP50ms:percentile(samples,.5),frameP95ms:percentile(samples,.95),physicsP50ms:percentile(physics,.5),triangles:renderer.stats.triangles});world.dispose();
}
for(const task of registry) {
  const world=new WorldSimulator(task.id);world.command('auto');let firstSuccess=null;
  for(let i=0;i<1800;i++){world.step();if(world.metrics().success&&firstSuccess===null)firstSuccess=world.time;}
  report.automatic.push({task:task.id,firstSuccessSeconds:firstSuccess,final:world.metrics()});world.dispose();
}
await writeFile(new URL('../../docs/lab-v3-benchmark.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
