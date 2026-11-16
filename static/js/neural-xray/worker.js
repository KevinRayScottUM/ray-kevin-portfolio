import {ModelAdapter} from './adapter.js';
const adapter=new ModelAdapter();let architecture='',signature='',recording,queue=Promise.resolve();
self.onmessage=({data})=>{queue=queue.then(async()=>{
  const {request,id,input,options={},train=0,reset=false}=data;
  try{
    const key=JSON.stringify(options);
    if(architecture!==id||signature!==key||reset){await adapter.load(id,options);architecture=id;signature=key;}
    let o=options;
    if(id==='transformer'&&options.source==='recorded'){
      recording??=fetch('../../lab/neural-xray/gpt2-example.json').then(r=>{if(!r.ok)throw Error('Recorded trace unavailable');return r.json();}).catch(e=>{recording=null;throw e;});
      o={...options,recording:await recording};
    }
    if(train)adapter.train(train);
    self.postMessage({request,trace:adapter.run(input,o)});
  }catch(e){self.postMessage({request,error:String(e.message||e)});}
});};
