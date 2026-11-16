import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cpu,tf,probabilities} from '../static/js/neural-xray/common.js';
import {ModelAdapter} from '../static/js/neural-xray/adapter.js';
import {analyticalTransformer,recordedTransformer,tokenize} from '../static/js/neural-xray/transformer.js';
import {DenseNetwork,XOR} from '../static/js/neural-xray/dense.js';
import {cnn,unet} from '../static/js/neural-xray/vision.js';
import {recurrent} from '../static/js/neural-xray/recurrent.js';
import {gnn,normalizedAdjacency} from '../static/js/neural-xray/graph.js';
import {GAN,diffusion} from '../static/js/neural-xray/generative.js';
import {catalog,copy} from '../static/js/neural-xray/catalog.js';
import katex from '../static/vendor/katex/katex.mjs';
await cpu();
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8'),near=(a,b,e=1e-5)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`),sum=a=>a.reduce((s,v)=>s+v,0),sig=x=>1/(1+Math.exp(-x));
const sample=JSON.parse(read('static/lab/neural-xray/gpt2-example.json'));

test('all eleven architectures return real typed tensors, valid operations and strict KaTeX',async()=>{
  assert.equal(catalog.length,11);const adapter=new ModelAdapter();
  for(const model of catalog){await adapter.load(model.id);const trace=adapter.run();assert.ok(trace.steps.length>1,model.id);assert.ok(Object.keys(trace.tensors).length>1);assert.ok(trace.metrics.computationMs>=0);for(const r of Object.values(trace.tensors)){assert.ok(r.values instanceof Float32Array);assert.equal(r.values.length,r.shape.reduce((a,b)=>a*b,1));assert.ok([...r.values].every(Number.isFinite),model.id+'/'+r.id);}for(const s of trace.steps){assert.equal(s.title.length,2);katex.renderToString(s.formula,{throwOnError:true,strict:'error'});for(const output of s.outputs)assert.ok(trace.tensors[output],output);}}
  adapter.dispose();assert.equal(tf.memory().numTensors,0);
});
test('toy tokenizer is bounded and unknown tokens are explicit, not GPT-2 BPE',()=>{assert.deepEqual(tokenize('the cat').ids,[1,2]);assert.deepEqual(tokenize('unknown').ids,[0]);assert.equal(tokenize('cat '.repeat(100)).ids.length,12);assert.ok(tokenize('').ids.length>0);});
test('causal attention rows normalize and exclude every future position for each toy head',()=>{
  for(let layer=0;layer<2;layer++)for(let head=0;head<2;head++){const t=analyticalTransformer(undefined,{layer,head}),n=t.visual.ids.length,a=t.tensors.attention.values,q=t.tensors.q.values,k=t.tensors.k.values;for(let i=0;i<n;i++){near(sum(Array.from(a.slice(i*n,(i+1)*n))),1);for(let j=i+1;j<n;j++)near(a[i*n+j],0);for(let j=0;j<n;j++){let dot=0;for(let d=0;d<4;d++)dot+=q[i*4+d]*k[j*4+d];near(t.tensors.scores.values[i*n+j],dot);near(t.tensors.scaled.values[i*n+j],dot/2);}}}
});
test('sampling temperature, top-k, top-p only change logits distribution, never hidden tensors',()=>{
  const a=analyticalTransformer(undefined,{temperature:.2,topK:1}),b=analyticalTransformer(undefined,{temperature:2,topK:10,topP:.7});for(const key of ['embedding','q','k','attention','block','logits'])assert.deepEqual(a.tensors[key].values,b.tensors[key].values);assert.equal(a.visual.sampling.length,1);near(sum(b.visual.sampling.map(v=>v.p)),1);assert.notDeepEqual(a.visual.sampling,b.visual.sampling);
  const p=probabilities([1,2,3],{topK:2,topP:.7});assert.equal(p.items.length,1);assert.equal(p.sample.id,2);
});
test('selected Transformer block/head shapes preserve projection, residual and final-logit lineage',()=>{
  const t=analyticalTransformer(undefined,{layer:1,head:1}),n=t.visual.ids.length;
  assert.deepEqual(t.tensors['layer-input'].values,t.tensors['block-0'].values);assert.deepEqual(t.tensors.Wq.shape,[8,4]);
  for(const [projection,weight]of [['q','Wq'],['k','Wk'],['v','Wv']])for(let i=0;i<n;i++)for(let j=0;j<4;j++){let value=0;for(let d=0;d<8;d++)value+=t.tensors.normalized.values[i*8+d]*t.tensors[weight].values[d*4+j];near(value,t.tensors[projection].values[i*4+j]);}
  for(let i=0;i<n*8;i++){near(t.tensors.residual.values[i],t.tensors['layer-input'].values[i]+t.tensors['attention-output'].values[i]);near(t.tensors.block.values[i],t.tensors.residual.values[i]+t.tensors.mlp.values[i]);}
  assert.deepEqual(t.steps.at(-1).inputs,['block-1']);for(let j=0;j<22;j++){let value=0;for(let d=0;d<8;d++)value+=t.tensors['last-token'].values[d]*t.tensors.unembedding.values[d*22+j];near(value,t.tensors.logits.values[j]);}
});
test('recorded GPT-2 trace preserves upstream token IDs, twelve blocks/heads and masks',()=>{
  assert.deepEqual(sample.tokenIds,[6601,32704,795,30132,2985,284]);assert.equal(sample.logits.length,50257);assert.match(sample.provenance.sha256,/^[a-f0-9]{64}$/);assert.equal(sample.provenance.commit,'bfe50afba10b9b560b84143ee1107d977defa74f');
  for(let layer=0;layer<12;layer++)for(let head=0;head<12;head++){const t=recordedTransformer(sample,{layer,head,topK:3}),n=sample.tokens.length;assert.equal(t.executionMode,'recorded-real-trace');assert.equal(t.tensors.q,undefined);assert.equal(t.tensors.embedding,undefined);for(let i=0;i<n;i++){near(sum(Array.from(t.tensors.attention.values.slice(i*n,(i+1)*n))),1,1e-4);for(let j=i+1;j<n;j++)near(t.tensors.attention.values[i*n+j],0);}}
});
test('CNN kernel dot products, valid/same stride shapes and max/average pooling are numeric',()=>{
  const x=Float32Array.from({length:144},(_,i)=>i/144);
  for(const padding of ['same','valid'])for(const stride of [1,2])for(const kernelSize of [3,5])for(const pool of ['max','average']){
    const t=cnn(x,{padding,stride,kernelSize,pool,bias:.2}),r=t.tensors.conv,k=t.tensors.kernel.values,w=r.shape[2],expected=padding==='same'?Math.ceil(12/stride):Math.floor((12-kernelSize)/stride)+1;assert.equal(w,expected);
    const pad=padding==='same'?Math.floor(Math.max(0,(w-1)*stride+kernelSize-12)/2):0;
    for(let y=0;y<w;y++)for(let xx=0;xx<w;xx++){let v=.2;for(let u=0;u<kernelSize;u++)for(let z=0;z<kernelSize;z++){const row=y*stride+u-pad,col=xx*stride+z-pad;if(row>=0&&row<12&&col>=0&&col<12)v+=x[row*12+col]*k[u*kernelSize+z];}near(v,r.values[y*w+xx],2e-5);}
    const values=[t.tensors.activation.values[0],t.tensors.activation.values[1],t.tensors.activation.values[w],t.tensors.activation.values[w+1]];near(t.tensors.pool.values[0],pool==='max'?Math.max(...values):sum(values)/4);
  }
});
test('CNN kernel and image interventions actually change computed outputs',()=>{const a=cnn(undefined,{filter:'edge'}),b=cnn(undefined,{filter:'blur'}),c=cnn(undefined,{preset:'ring'});assert.notDeepEqual(a.tensors.conv.values,b.tensors.conv.values);assert.notDeepEqual(a.tensors.conv.values,c.tensors.conv.values);});
test('MLP autodiff agrees with centered finite differences and an SGD step',()=>{
  const m=new DenseNetwork(),before=m.run(),r=before.tensors.gradient0.values[0],weight=m.variables[0],original=Array.from(weight.dataSync()),eps=.003;
  const set=value=>tf.tidy(()=>{const next=[...original];next[0]=value;weight.assign(tf.tensor(next,weight.shape));});
  const loss=()=>tf.tidy(()=>m.loss().dataSync()[0]);set(original[0]+eps);const plus=loss();set(original[0]-eps);const minus=loss();set(original[0]);near(r,(plus-minus)/(2*eps),2e-5);m.train(1);near(weight.dataSync()[0],original[0]-m.options.learningRate*r);assert.equal(m.iteration,1);m.dispose();
});
test('XOR training reduces actual MSE, and DNN initialization/depth alter gradient flow',()=>{
  const m=new DenseNetwork('mlp',{width:6,learningRate:.3}),initial=m.run().metrics.loss;for(let i=0;i<30;i++)m.train(100);assert.ok(m.run().metrics.loss<initial*.4);m.dispose();
  const a=new DenseNetwork('dnn',{depth:2,initialization:'xavier'}),b=new DenseNetwork('dnn',{depth:7,initialization:'small'});assert.notEqual(a.run().parameters,b.run().parameters);assert.ok(b.run().visual.gradientNorms[0]<a.run().visual.gradientNorms[0]);a.dispose();b.dispose();
});
test('RNN recurrence and local Jacobian match manual equations; input gradient matches finite difference',()=>{
  const seq=[.7,-.2,.1],t=recurrent('rnn',seq,{width:2}),wx=t.tensors.Wx0.values,wh=t.tensors.Wh0.values;let prev=[0,0];for(let i=0;i<seq.length;i++){const h=[0,1].map(j=>Math.tanh(seq[i]*wx[j]+sum(prev.map((v,k)=>v*wh[k*2+j]))));h.forEach((v,j)=>near(v,t.visual.states[i][j]));prev=h;}
  const eps=.001,plus=recurrent('rnn',[seq[0]+eps,...seq.slice(1)],{width:2}),minus=recurrent('rnn',[seq[0]-eps,...seq.slice(1)],{width:2});near(t.tensors['sequence-gradient'].values[0],(sum(plus.visual.states.at(-1))-sum(minus.visual.states.at(-1)))/(2*eps),1e-4);
  const h=t.visual.states[0],jac=t.tensors['t0-jacobian'].values;for(let j=0;j<2;j++)for(let k=0;k<2;k++)near(jac[j*2+k],(1-h[j]*h[j])*wh[k*2+j]);
});
test('LSTM gates and cell update use independent parameters and explicit retention intervention',()=>{
  const t=recurrent('lstm',[1,0,-1],{width:3,retention:.7});assert.notDeepEqual(t.tensors.Wx0.values,t.tensors.Wx1.values);for(let i=0;i<3;i++)for(let j=0;j<3;j++){const v=n=>t.tensors[`t${i}-${n}`].values[j];for(const key of ['forget','input-gate','output-gate'])assert.ok(v(key)>0&&v(key)<1);near(v('cell'),.7*(v('forget')*v('previous-cell')+v('input-gate')*v('candidate')));near(v('hidden'),v('output-gate')*Math.tanh(v('cell')));}assert.equal(t.visual.intervention,true);assert.match(t.steps[1].description[0],/not a learned gate/);
});
test('GRU reset-before convention, gates and hidden interpolation match equations',()=>{
  const t=recurrent('gru',[1,.3,-.2],{width:3});for(let i=0;i<3;i++)for(let j=0;j<3;j++){const v=n=>t.tensors[`t${i}-${n}`].values[j];near(v('hidden'),(1-v('update'))*v('candidate')+v('update')*v('previous'));const previous=t.tensors[`t${i}-previous`].values,reset=t.tensors[`t${i}-reset`].values;near(v('candidate'),Math.tanh([1,.3,-.2][i]*t.tensors.Wx2.values[j]+sum(Array.from(previous,(h,k)=>h*reset[k]*t.tensors.Wh2.values[k*3+j]))));}
});
test('GCN adds self loops once; normalization is symmetric, and messages sum to preactivation',()=>{
  const count=4,edges=[[0,1],[1,2],[2,3],[0,1]],a=normalizedAdjacency(count,edges);assert.deepEqual(a.degree,[2,3,3,2]);for(let i=0;i<count;i++)for(let j=0;j<count;j++)near(a.normalized[i][j],a.normalized[j][i]);
  const t=gnn(undefined,{count,edges,target:1,depth:2});for(let l=0;l<2;l++)for(let c=0;c<2;c++)near(sum(Array.from({length:count},(_,j)=>t.tensors['messages'+l].values[j*2+c])),t.tensors['aggregate'+l].values[2+c]);
});
test('GCN graph topology changes states; a one-hop target has zero remote input Jacobian',()=>{
  const a=gnn(undefined,{count:4,edges:[[0,1],[1,2],[2,3]],target:0,depth:1}),b=gnn(undefined,{count:4,edges:[[0,1],[0,3]],target:0,depth:1});assert.notDeepEqual(a.tensors.state0.values,b.tensors.state0.values);near(a.tensors.sensitivity.values[6],0);near(a.tensors.sensitivity.values[7],0);
});
test('GAN discriminator-only gradients leave G unchanged; alternating steps update both networks',()=>{
  const m=new GAN({batchSize:16}),g0=m.g.map(v=>Array.from(v.dataSync())),d0=m.d.map(v=>Array.from(v.dataSync())),before=m.run();near(before.metrics.discriminatorLoss,-sum(Array.from(before.tensors['D-real'].values,p=>Math.log(p)))/64-sum(Array.from(before.tensors['D-fake'].values,p=>Math.log(1-p)))/64);assert.ok(before.metrics.generatorLoss>0);tf.tidy(()=>{const z=tf.zeros([16,2]),real=tf.ones([16,2]),{grads}=tf.variableGrads(()=>tf.softplus(m.discriminator(real).neg()).mean().add(tf.softplus(m.discriminator(m.generator(z))).mean()),m.d);for(const v of m.d)v.assign(v.sub(grads[v.name].mul(.02)));});assert.deepEqual(m.g.map(v=>Array.from(v.dataSync())),g0);assert.notDeepEqual(m.d.map(v=>Array.from(v.dataSync())),d0);m.train(20);const after=m.run();assert.notDeepEqual(m.g.map(v=>Array.from(v.dataSync())),g0);assert.notDeepEqual(before.visual.fake,after.visual.fake);assert.ok(after.visual.losses.flat().every(Number.isFinite));assert.equal(after.iteration,20);m.dispose();
});
test('diffusion forward process and deterministic DDIM update match the displayed equations',()=>{
  const t=diffusion({seed:42}),{alphas,forward,reverse,clean}=t.visual;for(let time=1;time<=24;time++){assert.ok(alphas[time]<alphas[time-1]&&alphas[time]>0);for(let j=0;j<2;j++){near(forward[time][0][j],Math.sqrt(alphas[time])*clean[0][j]+Math.sqrt(1-alphas[time])*t.tensors.epsilon.values[j]);const predicted=t.tensors['prediction'+time].values[j],xt=t.tensors['reverse'+time].values[j],x0=(xt-Math.sqrt(1-alphas[time])*predicted)/Math.sqrt(alphas[time]);near(t.tensors['clean-estimate'+time].values[j],x0);near(t.tensors['next'+time].values[j],Math.sqrt(alphas[time-1])*x0+Math.sqrt(1-alphas[time-1])*predicted);}}assert.equal(reverse.at(-1).time,0);assert.deepEqual(t.tensors.epsilon.values,diffusion({seed:42}).tensors.epsilon.values);assert.notDeepEqual(t.tensors.epsilon.values,diffusion({seed:7}).tensors.epsilon.values);assert.match(t.provenance,/No trained neural denoiser/);
});
test('U-Net shapes, skip concatenation, upsampling and pixel outputs remain consistent',()=>{
  const t=unet(),off=unet(undefined,{skip:false});for(const [key,shape]of Object.entries({encoder1:[1,16,16,2],encoder2:[1,8,8,4],bottleneck:[1,4,4,8],merge2:[1,8,8,12],merge1:[1,16,16,6],output:[1,16,16,1]}))assert.deepEqual(t.tensors[key].shape,shape);
  for(let i=0;i<64;i++)for(let c=0;c<4;c++)near(t.tensors.merge2.values[i*12+8+c],t.tensors.encoder2.values[i*4+c]);assert.notDeepEqual(t.tensors.output.values,off.tensors.output.values);assert.ok([...t.tensors.output.values].every(v=>v>0&&v<1));assert.match(t.steps[0].description[0],/not a medical or semantic segmentation/);
});
test('repeated adapter switching/training releases tensors rather than growing GPU/CPU resources',async()=>{
  const a=new ModelAdapter();for(let i=0;i<3;i++)for(const m of catalog){await a.load(m.id);if(a.model)a.train(3);a.run();a.dispose();assert.equal(tf.memory().numTensors,0,m.id);}
});
test('all app bindings and control labels are bilingual; runtime is CPU-only and local',()=>{
  for(const pair of Object.values(copy))assert.ok(pair.length===2&&pair.every(v=>v.length));for(const m of catalog){assert.equal(m.description.length,2);for(const c of m.controls)assert.equal(c.label.length,2);}
  for(const match of read('templates/neural-xray.html').matchAll(/data-nx(?:-title)?="([\w-]+)"/g))assert.ok(copy[match[1]],match[1]);
  const worker=read('static/js/neural-xray/worker.js'),app=read('static/js/neural-xray/app.js');assert.match(worker,/gpt2-example\.json/);assert.doesNotMatch(worker,/onnx|webgpu|api\//i);assert.match(app,/worker\?\.terminate\(\)/);assert.match(app,/events\.abort\(\)/);assert.match(app,/document.hidden/);assert.match(app,/changed.includes\('language'\)/);assert.equal((app.match(/new CodeRain/g)||[]).length,1);
});
