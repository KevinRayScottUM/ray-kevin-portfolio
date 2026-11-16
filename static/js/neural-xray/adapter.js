import {cpu,tf} from './common.js';
import {analyticalTransformer,recordedTransformer} from './transformer.js';
import {DenseNetwork} from './dense.js';
import {cnn,unet} from './vision.js';
import {recurrent} from './recurrent.js';
import {gnn} from './graph.js';
import {GAN,diffusion} from './generative.js';

/** @implements {import('./types').ModelExplanationAdapter} */
export class ModelAdapter {
  async load(id,options={}){await cpu();this.dispose();this.id=id;this.options={...options};if(id==='mlp'||id==='dnn')this.model=new DenseNetwork(id,options);if(id==='gan')this.model=new GAN(options);}
  run(input,options={}){
    const start=performance.now(),o={...this.options,...options};let t;
    if(this.model)t=this.model.run(input);
    else if(this.id==='transformer')t=o.recording?recordedTransformer(o.recording,o):analyticalTransformer(input,o);
    else if(this.id==='cnn')t=cnn(input,o);
    else if(this.id==='unet')t=unet(input,o);
    else if(['rnn','lstm','gru'].includes(this.id))t=recurrent(this.id,input,o);
    else if(this.id==='gnn')t=gnn(input,o);
    else if(this.id==='diffusion')t=diffusion(o);
    else throw Error('Unknown architecture');
    t.metrics.computationMs=performance.now()-start;t.metrics.residentTensors=tf.memory().numTensors;this.trace=t;return t;
  }
  train(count){this.model?.train(count);}
  getTensor(id){return this.trace?.tensors[id];}
  reset(){return this.load(this.id,this.options);}
  dispose(){this.model?.dispose();this.model=null;this.trace=null;}
}
