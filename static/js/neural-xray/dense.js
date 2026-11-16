import {tf,Trace,weights,activate} from './common.js';
export const XOR={x:[[-1,-1],[-1,1],[1,-1],[1,1]],y:[[0],[1],[1],[0]]};
export class DenseNetwork {
  constructor(id='mlp',options={}){this.id=id;this.options={width:4,depth:id==='dnn'?5:1,activation:'tanh',initialization:'xavier',learningRate:.08,weightScale:1,bias:0,...options};this.iteration=0;this.losses=[];this.variables=[];const {width,depth,initialization,weightScale,bias}=this.options;let before=2;for(let l=0;l<=depth;l++){const after=l===depth?1:width,scale=(initialization==='large'?2:initialization==='small'?.03:Math.sqrt(2/(before+after)))*weightScale;this.variables.push(tf.tidy(()=>tf.variable(weights([before,after],42+l,scale))),tf.tidy(()=>tf.variable(tf.fill([after],bias))));before=after;}}
  forward(x,collect){let a=x;for(let l=0;l<this.variables.length/2;l++){const z=a.matMul(this.variables[l*2]).add(this.variables[l*2+1]);a=l===this.variables.length/2-1?tf.sigmoid(z):activate(z,this.options.activation);collect?.(l,z,a);}return a;}
  loss(){const x=tf.tensor2d(XOR.x),y=tf.tensor2d(XOR.y),p=this.forward(x);return tf.mean(tf.squaredDifference(p,y));}
  train(count=20){for(let i=0;i<Math.min(100,count);i++)tf.tidy(()=>{const {value,grads}=tf.variableGrads(()=>this.loss(),this.variables);for(const v of this.variables)v.assign(v.sub(grads[v.name].mul(this.options.learningRate)));this.losses.push(value.dataSync()[0]);this.iteration++;});this.losses=this.losses.slice(-200);}
  run(input=[1,-1]){
    return tf.tidy(()=>{
      const t=new Trace(this.id,'TensorCat / trainable XOR network / TensorFlow.js CPU autodiff','live-browser');t.iteration=this.iteration;t.parameters=this.variables.reduce((s,v)=>s+v.size,0);
      const x=tf.tensor2d([input]);t.record('input',x,'input');t.step('input',['Input','输入'],['A selected XOR point; training uses all four examples.','当前 XOR 输入点；训练使用四个样本。'],String.raw`x\in\mathbb R^2`,[],['input']);
      this.forward(x,(l,z,a)=>{const id='dense'+l,pre=l?'dense'+(l-1):'input';t.record(id,a);t.record('z'+l,z);t.record('W'+l,this.variables[l*2],'weight');t.record('b'+l,this.variables[l*2+1],'weight');t.step(id,[l===this.options.depth?'Output':'Hidden '+(l+1),l===this.options.depth?'输出':'隐藏层 '+(l+1)],['Dense affine transformation followed by the selected activation.','全连接仿射变换，随后应用所选激活函数。'],l===this.options.depth?String.raw`p=\sigma(aW+b)`:String.raw`a=\phi(xW+b)`,[pre],[id,'z'+l,'W'+l,'b'+l]);});
      const {value,grads}=tf.variableGrads(()=>this.loss(),this.variables),norms=[];for(let l=0;l<this.variables.length/2;l++){const g=grads[this.variables[l*2].name];t.record('gradient'+l,g,'gradient');norms.push(tf.norm(g).dataSync()[0]);}
      t.record('loss',value,'loss');t.step('backward',['Backward / loss','反向传播 / 损失'],['Exact autodiff gradients of mean squared error over all four XOR examples.','四个 XOR 样本的均方误差自动微分梯度。'],String.raw`L=\frac14\sum_i(p_i-y_i)^2,\quad W\leftarrow W-\eta\nabla_W L`,[],['loss',...norms.map((_,l)=>'gradient'+l)]);
      const predictions=this.forward(tf.tensor2d(XOR.x));t.metrics={loss:value.dataSync()[0],gradientNorm:norms[0]};t.visual={kind:'dense',width:this.options.width,depth:this.options.depth,gradientNorms:norms,predictions:Array.from(predictions.dataSync()),losses:[...this.losses],trained:this.iteration>0};return t;
    });
  }
  dispose(){this.variables.forEach(v=>v.dispose());this.variables=[];}
}
