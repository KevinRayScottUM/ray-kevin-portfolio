import {tf,Trace,weights} from './common.js';
export function recurrent(id,input=[1,0,0,0,-1,0],options={}){
  return tf.tidy(()=>{
    const width=options.width||3,retention=options.retention??1,t=new Trace(id),sequence=input.slice(0,12),count=id==='lstm'?4:id==='gru'?3:1;
    const wx=Array.from({length:count},(_,i)=>weights([1,width],31+i*3,.55)),wh=Array.from({length:count},(_,i)=>weights([width,width],32+i*3,options.recurrence??.8)),bias=Array.from({length:count},(_,i)=>tf.fill([width],id==='lstm'&&i===0?1:0));
    let h=tf.zeros([1,width]),c=tf.zeros([1,width]);
    t.record('sequence',tf.tensor1d(sequence),'input');
    for(let g=0;g<count;g++){t.record('Wx'+g,wx[g],'weight');t.record('Wh'+g,wh[g],'weight');t.record('bias'+g,bias[g],'weight');}
    t.step('sequence',['Input sequence','输入序列'],['One scalar per timestep; each gate has independent weights, reused across time.','每时间步输入一个标量；各门使用独立权重，在时间上共享。'],'x_1,\\ldots,x_T',[],['sequence',...wx.map((_,g)=>'Wx'+g),...wh.map((_,g)=>'Wh'+g)]);
    t.parameters=count*(width+width*width+width);const states=[],cells=[],gates=[];
    for(let i=0;i<sequence.length;i++){
      const x=tf.tensor2d([[sequence[i]]]),old=h,prefix='t'+i,outputs=[];
      const record=(name,value,role='activation')=>{t.record(prefix+'-'+name,value,role);outputs.push(prefix+'-'+name);return value;};
      const affine=g=>x.matMul(wx[g]).add(old.matMul(wh[g])).add(bias[g]);
      record('x',x,'input');record('previous',old,'memory');
      if(id==='rnn'){
        h=record('hidden',tf.tanh(affine(0)),'memory');
        record('jacobian',tf.diag(tf.ones([width]).sub(h.reshape([width]).square())).matMul(wh[0],false,true),'gradient');
      }else if(id==='lstm'){
        record('previous-cell',c,'memory');
        const f=record('forget',tf.sigmoid(affine(0)),'gate'),ii=record('input-gate',tf.sigmoid(affine(1)),'gate'),g=record('candidate',tf.tanh(affine(2)),'gate'),o=record('output-gate',tf.sigmoid(affine(3)),'gate');
        const natural=record('natural-cell',f.mul(c).add(ii.mul(g)),'memory');
        c=record('cell',natural.mul(retention),'memory');h=record('hidden',o.mul(tf.tanh(c)),'memory');gates.push(Array.from(f.dataSync()));cells.push(Array.from(c.dataSync()));
      }else{
        const z=record('update',tf.sigmoid(affine(0)),'gate'),r=record('reset',tf.sigmoid(affine(1)),'gate'),n=record('candidate',tf.tanh(x.matMul(wx[2]).add(r.mul(old).matMul(wh[2])).add(bias[2])),'gate');
        h=record('hidden',tf.onesLike(z).sub(z).mul(n).add(z.mul(old)),'memory');gates.push(Array.from(z.dataSync()));
      }
      states.push(Array.from(h.dataSync()));
      t.step(prefix,['Time '+(i+1),'时间步 '+(i+1)],id==='lstm'&&retention!==1?['Intervention: multiply the computed cell update by retention. This is not a learned gate.','干预：计算后的细胞更新乘以保留率，并非学习得到的门。']:['Seeded untrained weights; the next state uses this input and the previous state.','种子固定的未训练权重；当前输入与前一状态共同计算下一状态。'],id==='rnn'?'h_t=\\tanh(x_tW_x+h_{t-1}W_h+b)':id==='lstm'?'f,i,o=\\sigma(xW+hU+b),\\quad c_t=\\rho(f_t\\odot c_{t-1}+i_t\\odot g_t),\\quad h_t=o_t\\odot\\tanh(c_t)':'r,z=\\sigma(xW+hU+b),\\quad n=\\tanh(xW_n+(r\\odot h)U_n+b_n),\\quad h_t=(1-z)\\odot n+z\\odot h_{t-1}',i?['t'+(i-1)+'-hidden']:['sequence'],outputs);
    }
    if(id==='rnn'){
      const gradient=tf.grad(xs=>{let hh=tf.zeros([1,width]);for(let i=0;i<sequence.length;i++)hh=tf.tanh(xs.slice([i],[1]).reshape([1,1]).matMul(wx[0]).add(hh.matMul(wh[0])).add(bias[0]));return hh.sum();})(tf.tensor1d(sequence));t.record('sequence-gradient',gradient,'gradient');t.steps.at(-1).outputs.push('sequence-gradient');
    }
    t.visual={kind:'recurrent',states,cells,gates,sequence,width,intervention:id==='lstm'&&retention!==1};return t;
  });
}
