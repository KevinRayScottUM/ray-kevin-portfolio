import {tf,Trace,weights,normalization,probabilities} from './common.js';
export const VOCAB=['<unk>','the','cat','learns','from','data','a','model','can','think','and','predict','next','token','attention','is','.','TensorCat','研究','智能','学习','模型'];
export function tokenize(text){const tokens=(text.match(/[A-Za-z]+|[\u3400-\u9fff]+|[^\sA-Za-z\u3400-\u9fff]/g)||['the']).slice(0,12);return {tokens,ids:tokens.map(t=>Math.max(0,VOCAB.indexOf(t)))};}
export function analyticalTransformer(input='the cat learns from data',options={}){
  return tf.tidy(()=>{
    const trace=new Trace('transformer'),{tokens,ids}=tokenize(input),n=ids.length,d=8,heads=2,layers=2,layer=Math.max(0,Math.min(1,options.layer||0)),head=Math.max(0,Math.min(1,options.head||0));
    const table=weights([VOCAB.length,d],19,.3),position=weights([12,d],20,.15),token=tf.gather(table,tf.tensor1d(ids,'int32')),pos=position.slice([0,0],[n,d]);let x=token.add(pos);
    trace.record('tokens',tf.tensor1d(ids,'int32'),'input');trace.record('token-embedding',token);trace.record('position-embedding',pos);trace.record('embedding',x);
    trace.step('tokens',['Tokens','分词'],['Small fixed word vocabulary; unknown words map to <unk>. Not GPT-2 BPE.','小型固定词表；未知词映射为 <unk>，不是 GPT-2 BPE。'],String.raw`\mathrm{id}(w)\in\{0,\ldots,V-1\}`,[],['tokens']);
    trace.step('embedding',['Embedding','嵌入'],['Token and position vectors are added elementwise.','词向量与位置向量逐元素相加。'],'X=E_{token}+E_{position}',['tokens'],['token-embedding','position-embedding','embedding']);
    trace.parameters=table.size+position.size;
    for(let l=0;l<layers;l++){
      const normalized=normalization(x),wq=weights([d,d],100+l,.22),wk=weights([d,d],110+l,.22),wv=weights([d,d],120+l,.22),wo=weights([d,d],130+l,.22),q=normalized.matMul(wq),k=normalized.matMul(wk),v=normalized.matMul(wv),outputs=[];
      for(let h=0;h<heads;h++){
        const query=q.slice([0,h*4],[n,4]),key=k.slice([0,h*4],[n,4]),value=v.slice([0,h*4],[n,4]),scores=query.matMul(key,false,true),scaled=scores.div(2),mask=tf.tensor2d(Array.from({length:n*n},(_,i)=>Math.floor(i/n)>=i%n?0:-1e9),[n,n]),masked=scaled.add(mask),attention=tf.softmax(masked),context=attention.matMul(value);outputs.push(context);
        if(l===layer&&h===head){for(const [id,t]of Object.entries({'layer-input':x,normalized,q:query,k:key,v:value,scores,scaled,mask,masked,attention,context}))trace.record(id,t,id==='attention'?'attention':id==='mask'?'mask':'activation');for(const [id,w]of Object.entries({Wq:wq,Wk:wk,Wv:wv}))trace.record(id,w.slice([0,h*4],[d,4]),'weight');trace.record('Wo',wo,'weight');}
      }
      const attentionOut=tf.concat(outputs,1).matMul(wo),residual=x.add(attentionOut),norm2=normalization(residual),w1=weights([d,16],140+l,.2),b1=tf.zeros([16]),w2=weights([16,d],150+l,.2),up=norm2.matMul(w1).add(b1),gelu=up.mul(.5).mul(tf.tanh(up.add(up.pow(3).mul(.044715)).mul(Math.sqrt(2/Math.PI))).add(1)),mlp=gelu.matMul(w2);x=residual.add(mlp);
      trace.record('block-'+l,x);if(l===layer){trace.record('all-head-context',tf.concat(outputs,1));trace.record('attention-output',attentionOut);trace.record('residual',residual);trace.record('mlp-up',up);trace.record('gelu',gelu);trace.record('mlp',mlp);trace.record('block',x);trace.record('W1',w1,'weight');trace.record('b1',b1,'weight');trace.record('W2',w2,'weight');}
      trace.parameters+=4*d*d+d*16+16+16*d;
    }
    trace.step('ln',['Layer norm','层归一化'],['Selected block input; statistics are computed per token across features. Block 1 receives block 0 output, not the original embedding.','选定层输入沿特征维独立归一化。第 1 层接收第 0 层的输出，而非原始嵌入。'],String.raw`\hat X=(X-\mu)/\sqrt{\sigma^2+10^{-5}}`,[layer?'block-0':'embedding'],['layer-input','normalized']);
    trace.step('qkv',['Q / K / V','Q / K / V 投影'],['Selected head projections and sliced weight matrices, from the same computation.','来自同一次计算的选定头投影，以及该头对应的权重切片。'],String.raw`Q=\hat XW_Q,\ K=\hat XW_K,\ V=\hat XW_V`,['normalized'],['q','k','v','Wq','Wk','Wv']);
    trace.step('scores',['Dot product','点积'],['Each row compares one query with all keys.','每行比较一个查询与全部键。'],String.raw`S=QK^\top`,['q','k'],['scores','scaled']);
    trace.step('attention',['Causal attention','因果注意力'],['Future positions have exactly zero attention after softmax.','softmax 后，未来位置的注意力严格为零。'],String.raw`A=\operatorname{softmax}(S/\sqrt{d_k}+M)`,['scaled'],['mask','masked','attention']);
    trace.step('context',['Value aggregation','值聚合'],['Each head computes AV; all heads are concatenated, projected and added to this block input.','每个头计算 AV；全部头拼接、投影后，加到本层输入上。'],String.raw`C_h=A_hV_h,\quad R=X+[C_1,C_2]W_O`,['attention','v','layer-input'],['context','all-head-context','Wo','attention-output','residual']);
    trace.step('mlp',['Feed-forward','前馈网络'],['GELU expansion, projection and residual addition.','GELU 扩维、投影及残差相加。'],String.raw`Y=R+\operatorname{GELU}(\operatorname{LN}(R)W_1+b_1)W_2`,['residual'],['W1','b1','W2','mlp-up','gelu','mlp','block']);
    const outputW=weights([d,VOCAB.length],190,.3),finalNorm=normalization(x),last=finalNorm.slice([n-1,0],[1,d]),logits=last.matMul(outputW).reshape([VOCAB.length]);trace.parameters+=outputW.size;trace.record('final-normalized',finalNorm);trace.record('last-token',last);trace.record('unembedding',outputW,'weight');trace.record('logits',logits);const p=probabilities(logits.dataSync(),options);trace.record('probabilities',tf.tensor1d(p.items.map(v=>v.p)),'probability');
    trace.step('output',['Logits / sampling','Logits / 采样'],['Final block output, normalized last-token projection, then sampling. Untrained toy predictions are not meaningful language generation. Sampling never changes hidden states.','最终层输出归一化后，取末 token 投影并采样。未训练网络不具备语言生成能力，采样不改变隐藏状态。'],String.raw`\ell=\operatorname{LN}(X_L)_{n-1}W_U,\quad p_i=\operatorname{softmax}(\ell/T)_i`,['block-1'],['final-normalized','last-token','unembedding','logits','probabilities']);
    trace.visual={kind:'transformer',tokens,ids,layers,heads,layer,head,sampling:p.items.map(v=>({...v,token:VOCAB[v.id]})),sample:VOCAB[p.sample.id]};return trace;
  });
}
export function recordedTransformer(data,options={}){
  return tf.tidy(()=>{
    const trace=new Trace('transformer',data.provenance.source,'recorded-real-trace'),layer=Math.max(0,Math.min(11,options.layer||0)),head=Math.max(0,Math.min(11,options.head||0)),prefix=`block_${layer}_attn_head_${head}_`,n=data.tokens.length;
    trace.record('tokens',tf.tensor1d(data.tokenIds,'int32'),'input');
    for(const [id,key]of [['scores','attn'],['scaled','attn_scaled'],['masked','attn_masked'],['attention','attn_softmax']])trace.record(id,tf.tensor2d(data.outputs[prefix+key].data.map(row=>row.map(Number)),[n,n]),id==='attention'?'attention':'activation');
    trace.record('logits',tf.tensor1d(data.logits));
    trace.step('tokens',['GPT-2 tokens','GPT-2 分词记录'],[data.prompt,data.prompt],String.raw`\mathrm{BPE}(\mathrm{fixed\ prompt})`,[],['tokens']);
    trace.step('scores',['Recorded scores','真实点积记录'],['Authentic upstream fixed-prompt run. Embeddings and Q/K/V were not recorded.','上游固定提示词真实运行记录；未记录嵌入与 Q/K/V，故不展示虚构值。'],String.raw`S=QK^\top`,[],['scores','scaled']);
    trace.step('attention',['Recorded attention','真实注意力记录'],['All 12 blocks and 12 heads are available for this prompt only.','仅限此固定提示词，可检查全部 12 层、每层 12 个头。'],String.raw`A=\operatorname{softmax}(S/\sqrt{64}+M)`,['scores'],['masked','attention']);
    trace.step('output',['GPT-2 logits','GPT-2 logits 记录'],['Resampling this recording is not a new model inference.','对记录重新采样，不代表重新运行模型。'],String.raw`p_i=\operatorname{softmax}(\ell/T)_i`,[],['logits']);
    const p=probabilities(data.logits,options),known=new Map(data.probabilities.map(v=>[v.tokenId,v.token]));trace.parameters=124439808;trace.visual={kind:'transformer',tokens:data.tokens,ids:data.tokenIds,layers:12,heads:12,layer,head,sampling:p.items.map(v=>({...v,token:known.get(v.id)||`ID ${v.id}`})),sample:known.get(p.sample.id)||`ID ${p.sample.id}`,sourceHash:data.provenance.sha256};return trace;
  });
}
