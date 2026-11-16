import * as tf from '../../vendor/tfjs-cpu/tf.js';
export {tf};
export async function cpu(){await tf.setBackend('cpu');await tf.ready();}
export function random(seed=42){let s=seed>>>0;return ()=>((s=(Math.imul(1664525,s)+1013904223)>>>0)+.5)/4294967296;}
export function gaussian(rng){return Math.sqrt(-2*Math.log(rng()))*Math.cos(2*Math.PI*rng());}
export function weights(shape,seed=42,scale=1){const rng=random(seed),size=shape.reduce((a,b)=>a*b,1);return tf.tensor(Float32Array.from({length:size},()=>gaussian(rng)*scale),shape);}
export function values(t){return new Float32Array(t.dataSync());}
export function tensorRecord(id,t,role='activation'){
  const data=values(t),finite=Array.from(data).filter(Number.isFinite),min=finite.length?Math.min(...finite):0,max=finite.length?Math.max(...finite):0,mean=finite.reduce((a,b)=>a+b,0)/(finite.length||1);
  return {id,shape:[...t.shape],dtype:t.dtype,values:data,min,max,mean,role,complete:true};
}
export class Trace {
  constructor(id,provenance='TensorCat / TensorFlow.js CPU / seeded untrained illustrative network',mode='analytical-demonstration'){this.architecture=id;this.executionMode=mode;this.provenance=provenance;this.steps=[];this.tensors={};this.parameters=0;this.iteration=0;this.metrics={};this.visual={};}
  record(id,t,role){this.tensors[id]=tensorRecord(id,t,role);return id;}
  step(id,title,description,formula,inputs,outputs,operation=id){this.steps.push({id,layerId:id,operation,title,description,formula,inputs,outputs});return this;}
}
export const activate=(x,name)=>name==='relu'?tf.relu(x):name==='sigmoid'?tf.sigmoid(x):tf.tanh(x);
export function normalization(x){const {mean,variance}=tf.moments(x,-1,true);return x.sub(mean).div(variance.add(1e-5).sqrt());}
export function probabilities(logits,{temperature=1,topK=10,topP=1,seed=42}={}){
  const t=Math.max(.05,temperature),max=Math.max(...logits),all=Array.from(logits,(v,id)=>({id,logit:v,p:Math.exp((v-max)/t)}));
  let sum=all.reduce((s,v)=>s+v.p,0);all.forEach(v=>v.p/=sum);all.sort((a,b)=>b.p-a.p);
  let selected=topK>0?all.slice(0,topK):all;let mass=0,cut=selected.length;
  const retainedMass=selected.reduce((s,v)=>s+v.p,0);
  for(let i=0;i<selected.length;i++){mass+=selected[i].p/retainedMass;if(mass>=topP){cut=i+1;break;}}selected=selected.slice(0,cut);sum=selected.reduce((s,v)=>s+v.p,0);selected=selected.map(v=>({...v,p:v.p/sum}));
  let u=random(seed)(),sample=selected.at(-1);for(const item of selected){u-=item.p;if(u<=0){sample=item;break;}}return {items:selected,sample};
}
export function imageInput(preset='cross',size=12){return Float32Array.from({length:size*size},(_,i)=>{const x=i%size,y=Math.floor(i/size);if(preset==='ring')return Math.abs(Math.hypot(x-size/2,y-size/2)-size*.3)<1?1:0;if(preset==='diagonal')return Math.abs(x-y)<2?1:0;return Math.abs(x-size/2)<1.5||Math.abs(y-size/2)<1.5?1:0;});}
