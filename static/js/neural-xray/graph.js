import {tf,Trace,weights} from './common.js';
export function normalizedAdjacency(count,edges){const a=Array.from({length:count},(_,i)=>Array.from({length:count},(_,j)=>i===j?1:0));for(const [u,v]of edges)if(u!==v&&u>=0&&v>=0&&u<count&&v<count)a[u][v]=a[v][u]=1;const degree=a.map(row=>row.reduce((s,v)=>s+v,0));return {adjacency:a,degree,normalized:a.map((row,i)=>row.map((v,j)=>v/Math.sqrt(degree[i]*degree[j])))};}
export function gnn(input,options={}){
  return tf.tidy(()=>{
    const count=options.count||6,edges=options.edges||[[0,1],[1,2],[2,3],[3,4],[4,5],[5,0],[1,4]],features=input||Array.from({length:count},(_,i)=>[i%2?0:1,i%2?1:0]),target=Math.min(count-1,options.target||0),depth=options.depth||2,t=new Trace('gnn'),{adjacency,degree,normalized}=normalizedAdjacency(count,edges),A=tf.tensor2d(normalized),x=tf.tensor2d(features),ws=Array.from({length:depth},(_,i)=>weights([2,2],60+i,.6));let h=x;
    t.record('input',x,'input');t.record('adjacency',tf.tensor2d(adjacency));t.record('degree',tf.tensor1d(degree));t.record('normalized',A,'weight');t.step('graph',['Graph / features','图与特征'],['Undirected graph with self-loops added exactly once.','无向图，每个节点只添加一次自环。'],String.raw`\tilde A=A+I,\quad \tilde D_{ii}=\sum_j\tilde A_{ij}`,[],['input','adjacency','degree','normalized']);
    for(let l=0;l<depth;l++){
      const projected=h.matMul(ws[l]),messages=tf.stack(Array.from({length:count},(_,j)=>projected.slice([j,0],[1,2]).reshape([2]).mul(normalized[target][j]))),sum=A.matMul(projected);h=tf.tanh(sum);t.record('messages'+l,messages,'message');t.record('aggregate'+l,sum);t.record('state'+l,h);t.record('W'+l,ws[l],'weight');
      t.step('state'+l,['Message layer '+(l+1),'消息层 '+(l+1)],['Rows of messages are the actual normalized contributions to the selected target, including its self-message.','消息矩阵各行是对选定目标的归一化贡献，包括自身消息。'],String.raw`H^{l+1}=\tanh(\tilde D^{-1/2}\tilde A\tilde D^{-1/2}H^lW^l)`,l?['state'+(l-1)]:['input'],['messages'+l,'aggregate'+l,'state'+l,'W'+l]);
    }
    const sensitivity=tf.grad(value=>{let hh=value;for(const w of ws)hh=tf.tanh(A.matMul(hh.matMul(w)));return hh.slice([target,0],[1,2]).sum();})(x);t.record('sensitivity',sensitivity,'gradient');t.steps.at(-1).outputs.push('sensitivity');
    t.parameters=ws.reduce((s,w)=>s+w.size,0);t.visual={kind:'graph',count,edges,target,depth,normalized,features};t.provenance+=' / forward GCN, input Jacobian; not GNNExplainer or causal attribution';return t;
  });
}
