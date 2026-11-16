import {catalog,byId,defaults,copy} from './catalog.js';
import {el,fmt,heatmap,renderNetwork,receptiveWindow} from './view.js';
import katex from '../../vendor/katex/katex.mjs';
import {CodeRain,readingMasks} from '../lab-rain.js';
import {acquireImage} from '../image-studio/files.js';

const root=document.querySelector('[data-neural-xray]');
if(root){
  const $=s=>root.querySelector(s),$$=s=>[...root.querySelectorAll(s)],events=new AbortController(),listen=(n,name,fn)=>n.addEventListener(name,fn,{signal:events.signal});
  let lang=document.documentElement.dataset.language==='zh-CN'?1:0,id='transformer',trace=null,step=0,tensorId='',channel=0,page=0,element=0,request=0,comparisonRequest=0,worker,compareWorker,comparison=null,inspectionTrace=null,inspectionStep=0,busy=false,playing=false,auto=false,timer=0,trainingTimer=0,changeTimer=0,stopped=false,image=null,imageRequest=0;
  const states=Object.fromEntries(catalog.map(m=>[m.id,defaults(m.id)])),t=key=>copy[key]?.[lang]||key;
  const icon=(name)=>el('img',{src:'/img/lab/icons/'+name+'.svg',width:17,height:17,alt:'','aria-hidden':true});
  const status=(key,error=false)=>{$('[data-status]').textContent=t(key);$('[data-status]').style.color=error?'#f0b49b':'';};
  const trainable=()=>['mlp','dnn','gan'].includes(id);
  function localize(){
    $$('[data-nx]').forEach(n=>n.textContent=t(n.dataset.nx));$$('[data-nx-title]').forEach(n=>{n.title=t(n.dataset.nxTitle);n.setAttribute('aria-label',t(n.dataset.nxTitle));});
    $('[data-architectures]').setAttribute('aria-label',lang?'网络架构':'Architectures');$('[data-timeline]').setAttribute('aria-label',t('step'));
    buildNav();buildControls();buildComparisonMenu();modelHeading();if(trace){draw();status(busy?'busy':'ready');}else status('busy');if(playing){const b=$('[data-action=play]');b.title=t('pause');b.setAttribute('aria-label',t('pause'));}
  }
  function buildNav(){const nav=$('[data-architectures]');nav.replaceChildren();let group='';let section;for(const model of catalog){if(model.group[0]!==group){group=model.group[0];section=el('div',{class:'nx-nav-group'});section.append(el('h3',{},model.group[lang]));nav.append(section);}const b=el('button',{type:'button','data-architecture':model.id,'aria-current':String(model.id===id)},model.name);b.onclick=()=>switchModel(model.id);section.append(b);}}
  function modelHeading(){$('[data-model-group]').textContent=byId[id].group[lang].toUpperCase();$('[data-model-title]').textContent=byId[id].name+' · '+byId[id].title[lang];$('[data-model-description]').textContent=byId[id].description[lang];$('[data-training]').hidden=!trainable();}
  function buildControls(){
    const panel=$('[data-controls]'),s=states[id];panel.replaceChildren();
    for(const base of byId[id].controls){const c={...base},label=el('label',{class:'nx-control'}),name=el('span',{},c.label[lang]);let input;
      if(c.key==='head'||c.key==='layer')c.max=s.source==='recorded'?11:1;
      if(c.key==='topK')c.max=s.source==='recorded'?100:22;
      if(c.key==='target')c.max=s.count-1;
      if(c.type==='select'){input=el('select',{'data-setting':c.key});for(const [value,title]of c.choices){const parts=title.split(' / ');input.append(el('option',{value},parts[lang]||parts[0]));}input.value=s[c.key];}
      else{input=el('input',{type:c.type,'data-setting':c.key});if(c.type==='range'){input.min=c.min;input.max=c.max;input.step=c.step;}if(c.type==='checkbox')input.checked=s[c.key];else input.value=s[c.key];}
      input.setAttribute('aria-label',c.label[lang]);if(c.type==='text')input.maxLength=c.key==='point'?64:512;if(c.key==='text'&&s.source==='recorded'){input.disabled=true;input.value='Data visualization empowers users to';}
      label.append(name);if(c.type==='range'){const output=el('output',{},fmt(Number(s[c.key])));label.append(output);input.oninput=()=>output.textContent=fmt(Number(input.value));}label.append(input);panel.append(label);
      input.addEventListener(c.type==='text'||c.type==='range'?'input':'change',()=>{
        pause();auto=false;$('[data-auto]').checked=false;request++;busy=true;status('busy');$('[data-stage]').setAttribute('aria-busy','true');$('[data-network]').classList.add('is-refreshing');s[c.key]=c.type==='checkbox'?input.checked:c.type==='range'||c.type==='select'&&typeof c.value==='number'?Number(input.value):input.value;
        if(c.key==='source'){s.layer=0;s.head=0;s.topK=10;buildControls();}
        if(c.key==='count'){s.target=Math.min(s.target,s.count-1);s.features=Array.from({length:s.count},(_,i)=>i%2?'0,1':'1,0').join(';');s.edges=Array.from({length:s.count},(_,i)=>i+'-'+((i+1)%s.count)).join(',');buildControls();}
        if(c.key==='preset'){image=null;imageRequest++;}
        clearTimeout(changeTimer);changeTimer=setTimeout(()=>{execute();if($('[data-compare]').value)compare();},c.type==='text'?240:70);
      });
    }
    if(['cnn','unet'].includes(id)){const label=el('label',{class:'nx-control'});label.append(el('span',{},t('upload')));const file=el('input',{type:'file',accept:'image/png,image/jpeg,image/webp','aria-label':t('upload')});file.onchange=()=>upload(file.files[0]);label.append(file);panel.append(label);}
  }
  function numbers(value,max=12){const p=String(value).split(',').map(v=>Number(v.trim()));if(!p.length||p.length>max||p.some(v=>!Number.isFinite(v))||String(value).split(',').some(v=>!v.trim()))throw Error('input');return p;}
  function inputs(model=id,s=states[model]){const options={...s};let input;
    if(model==='transformer'){input=s.text;delete options.text;}
    if(model==='mlp'||model==='dnn'){input=numbers(s.point,2);if(input.length!==2)throw Error('input');delete options.point;}
    if(['rnn','lstm','gru'].includes(model)){input=numbers(s.sequence);delete options.sequence;}
    if(model==='cnn'||model==='unet')input=model===id?image:null;
    if(model==='gnn'){input=s.features.split(';').map(v=>numbers(v,2));if(input.length!==s.count||input.some(v=>v.length!==2))throw Error('input');options.edges=s.edges.trim()?s.edges.split(',').map(edge=>{if(!/^\s*\d+\s*-\s*\d+\s*$/.test(edge))throw Error('input');const pair=edge.split('-').map(Number);if(pair.some(v=>v<0||v>=s.count))throw Error('input');return pair;}):[];delete options.features;}
    return {input,options};
  }
  function createWorker(){
    worker?.terminate();worker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});
    worker.onmessage=({data})=>{if(stopped||data.request!==request)return;busy=false;$('[data-stage]').setAttribute('aria-busy','false');$('[data-network]').classList.remove('is-refreshing');
      if(data.error){status('error',true);auto=false;$('[data-auto]').checked=false;return;}
      const initial=!trace;trace=data.trace;if(initial&&id==='transformer')step=trace.steps.findIndex(s=>s.id==='attention');step=Math.max(0,Math.min(step,trace.steps.length-1));if(!trace.tensors[tensorId])tensorId=trace.steps[step].outputs.at(-1);channel=0;page=0;element=0;draw();status('ready');if(auto&&!document.hidden)trainingTimer=setTimeout(()=>execute({train:5}),160);
    };
    worker.onerror=()=>{busy=false;status('error',true);auto=false;$('[data-auto]').checked=false;};
  }
  function execute({train=0,reset=false}={}){
    if(stopped)return;clearTimeout(trainingTimer);let data;try{data=inputs();}catch(_){busy=false;$('[data-stage]').setAttribute('aria-busy','false');$('[data-network]').classList.remove('is-refreshing');status('inputError',true);auto=false;$('[data-auto]').checked=false;return;}
    busy=true;status('busy');$('[data-stage]').setAttribute('aria-busy','true');if(trace)$('[data-network]').classList.add('is-refreshing');worker.postMessage({request:++request,id,...data,train,reset});
  }
  function switchModel(next){if(next===id)return;pause();auto=false;$('[data-auto]').checked=false;clearTimeout(changeTimer);clearTimeout(trainingTimer);id=next;trace=null;step=0;tensorId='';image=null;imageRequest++;comparison=null;inspectionTrace=null;comparisonRequest++;$('[data-comparison]').hidden=true;$('[data-compare]').value='';compareWorker?.terminate();createWorker();buildNav();buildControls();modelHeading();$('[data-network]').classList.add('is-refreshing');$('[data-network]').replaceChildren();$('[data-step-title]').textContent='';$('[data-step-description]').textContent=t('busy');$('[data-element-value]').textContent='';$('[data-formula]').replaceChildren();$('select[data-tensor]').replaceChildren();$('[data-tensor-map]').replaceChildren();execute();}
  function selectTensor(key,index=0){if(!trace?.tensors[key])return;const candidate=trace.steps.findIndex(s=>s.outputs.includes(key));if(candidate>=0)step=candidate;tensorId=key;channel=0;page=0;element=index;draw();}
  function sourceLabel(data=trace){return data.executionMode==='recorded-real-trace'?t('recorded'):data.executionMode==='live-browser'?t('live'):t('analytical');}
  function draw(){
    if(!trace)return;inspectionTrace=null;modelHeading();$('[data-source]').textContent=sourceLabel();$('[data-provenance]').textContent=trace.provenance+(trace.visual.sourceHash?' · SHA-256 '+trace.visual.sourceHash:'');
    renderNetwork($('[data-network]'),trace,step,selectTensor,t,lang);$('[data-network]').classList.remove('is-refreshing');
    const timeline=$('[data-timeline]');timeline.max=trace.steps.length-1;timeline.value=step;$('[data-step-count]').textContent=`${step+1} / ${trace.steps.length}`;
    const steps=$('[data-steps]');steps.replaceChildren();trace.steps.forEach((s,i)=>{const b=el('button',{type:'button','aria-current':String(i===step)},`${String(i+1).padStart(2,'0')} ${s.title[lang]}`);b.onclick=()=>setStep(i);steps.append(b);});
    $('[data-iteration]').textContent=t('iterations')+' '+trace.iteration;const metrics=$('[data-metrics]');metrics.replaceChildren();for(const [key,value]of [['parameters',trace.parameters.toLocaleString()],['iterations',trace.iteration],['CPU',fmt(trace.metrics.computationMs)+' ms'],['memory',trace.metrics.residentTensors]]){const n=el('div');n.append(el('dt',{},t(key)),el('dd',{},value));metrics.append(n);}
    inspect();if(comparison)renderComparison();
  }
  function setStep(index){if(!trace)return;step=Math.max(0,Math.min(trace.steps.length-1,index));tensorId=trace.steps[step].outputs.at(-1);channel=0;page=0;element=0;draw();}
  function inspect(){
    const data=inspectionTrace||trace,current=data.steps[inspectionTrace?inspectionStep:step];$('[data-operation-label]').textContent=byId[data.architecture].name+' / '+t('operation')+' '+String((inspectionTrace?inspectionStep:step)+1).padStart(2,'0');$('[data-step-title]').textContent=current.title[lang];$('[data-step-description]').textContent=current.description[lang];
    katex.render(current.formula,$('[data-formula]'),{throwOnError:false,strict:'ignore',trust:false,displayMode:true});
    const select=$('select[data-tensor]');select.replaceChildren();const preferred=[...new Set([...current.inputs,...current.outputs,...Object.keys(data.tensors)])];for(const key of preferred){const r=data.tensors[key];if(r)select.append(el('option',{value:key},key+' ['+r.shape.join('×')+']'));}if(!data.tensors[tensorId])tensorId=current.outputs[0];select.value=tensorId;
    const r=data.tensors[tensorId];if(!r)return;const meta=$('[data-tensor-meta]');meta.replaceChildren();for(const [key,value]of [['shape',r.shape.join(' × ')||'scalar'],['role',t('role.'+r.role)],['min',fmt(r.min)],['max',fmt(r.max)],['mean',fmt(r.mean)]]){const div=el('div');div.append(el('dt',{},t(key)),el('dd',{},value));meta.append(div);}
    const channels=r.shape.length===4?r.shape[3]:1;channel=Math.min(channel,channels-1);$('[data-channel]').max=channels-1;$('[data-channel]').value=channel;$('[data-channel]').disabled=channels===1;
    const pages=Math.ceil(r.values.length/channels/256);page=Math.min(page,Math.max(0,pages-1));$('[data-page]').max=Math.max(0,pages-1);$('[data-page]').value=page;$('[data-page]').disabled=pages<=1;
    $('[data-tensor-map]').replaceChildren(heatmap(r,{channel,page,label:r.id,onValue:setElement}));$('[data-element]').max=r.values.length-1;setElement(Math.min(element,r.values.length-1));
    $('[data-convolution]').hidden=id!=='cnn'||Boolean(inspectionTrace);if(id==='cnn'&&!inspectionTrace)convolution();
  }
  function setElement(index){const data=inspectionTrace||trace;if(!data?.tensors[tensorId])return;const r=data.tensors[tensorId];element=Math.min(r.values.length-1,Math.max(0,Math.trunc(index)));$('[data-element]').value=element;let n=element;const coords=[];for(let j=r.shape.length-1;j>=0;j--){coords.unshift(n%r.shape[j]);n=Math.floor(n/r.shape[j]);}$('[data-element-value]').textContent=`${r.id}[${coords.join(', ')}] = ${fmt(r.values[element])}`;}
  function convolution(){const o=states.cnn,r=trace.tensors.conv,k=trace.tensors.kernel.values,x=trace.tensors.input.values,size=o.kernelSize,width=r.shape[2],height=r.shape[1],pixel=$('[data-conv-pixel]');pixel.max=width*height-1;const i=Math.max(0,Math.min(Number(pixel.value)||0,width*height-1));pixel.value=i;const row=Math.floor(i/width),col=i%width,pad=o.padding==='same'?Math.floor(Math.max(0,(height-1)*o.stride+size-12)/2):0;let sum=0;const lines=[];for(let u=0;u<size;u++)for(let v=0;v<size;v++){const y=row*o.stride+u-pad,xx=col*o.stride+v-pad,value=y>=0&&y<12&&xx>=0&&xx<12?x[y*12+xx]:0,product=value*k[u*size+v];sum+=product;lines.push(`${fmt(value)} × ${fmt(k[u*size+v])} = ${fmt(product)}`);}lines.push(`Σ + b = ${fmt(sum)} + ${fmt(o.bias)} = ${fmt(r.values[i])}`);$('[data-products]').textContent=lines.join('\n');$('[data-window-map]').replaceChildren(receptiveWindow(trace,o,i));}
  function pause(){playing=false;clearTimeout(timer);const b=$('[data-action=play]');b.replaceChildren(icon('play'));b.title=t('play');b.setAttribute('aria-label',t('play'));}
  function play(){if(playing){pause();return;}if(!trace)return;playing=true;const b=$('[data-action=play]');b.replaceChildren(icon('pause'));b.title=t('pause');b.setAttribute('aria-label',t('pause'));if(step===trace.steps.length-1)setStep(0);const tick=()=>{if(!playing||document.hidden)return;if(step>=trace.steps.length-1){pause();return;}setStep(step+1);timer=setTimeout(tick,1050/Number($('[data-speed]').value));};timer=setTimeout(tick,1050/Number($('[data-speed]').value));}
  function buildComparisonMenu(){const select=$('[data-compare]'),value=select.value;select.replaceChildren(el('option',{value:''},t('none')));for(const m of catalog)select.append(el('option',{value:m.id},m.name));select.value=value;}
  function compare(){
    comparisonRequest++;compareWorker?.terminate();comparison=null;inspectionTrace=null;const target=$('[data-compare]').value;if(!target){$('[data-comparison]').hidden=true;if(trace)inspect();return;}
    compareWorker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});const req=comparisonRequest;let data;
    try{data=inputs(target,defaults(target));if(['rnn','lstm','gru'].includes(id)&&['rnn','lstm','gru'].includes(target))data.input=inputs().input;if(['mlp','dnn'].includes(id)&&['mlp','dnn'].includes(target))data.input=inputs().input;}catch(_){status('inputError',true);return;}
    compareWorker.onmessage=({data})=>{if(req!==comparisonRequest||stopped)return;if(data.error){status('error',true);return;}comparison=data.trace;renderComparison();};compareWorker.onerror=()=>status('error',true);compareWorker.postMessage({request:req,id:target,...data});
  }
  function renderComparison(){const target=comparison.architecture;$('[data-comparison]').hidden=false;$('[data-comparison-title]').textContent=byId[target].name+' · '+byId[target].title[lang];$('[data-comparison-description]').textContent=byId[target].description[lang];const metrics=$('[data-comparison-metrics]');metrics.replaceChildren();for(const [key,value]of [['parameters',comparison.parameters.toLocaleString()],['iterations',comparison.iteration],['provenance',sourceLabel(comparison)]]){const div=el('div');div.append(el('dt',{},t(key)),el('dd',{},value));metrics.append(div);}renderNetwork($('[data-comparison-network]'),comparison,Math.min(step,comparison.steps.length-1),(key,index=0)=>{inspectionTrace=comparison;inspectionStep=Math.max(0,comparison.steps.findIndex(s=>s.outputs.includes(key)));tensorId=key;element=index;channel=0;page=0;inspect();},t,lang);}
  async function upload(file){if(!file)return;const selected=id,version=++imageRequest;if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>10*1024*1024){status('localFail',true);return;}let bitmap;try{bitmap=(await acquireImage(file)).bitmap;if(selected!==id||version!==imageRequest||stopped)return;const n=id==='unet'?16:12,c=document.createElement('canvas');c.width=c.height=n;const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,n,n);ctx.drawImage(bitmap,0,0,n,n);const rgba=ctx.getImageData(0,0,n,n).data;image=Float32Array.from({length:n*n},(_,i)=>(.2126*rgba[i*4]+.7152*rgba[i*4+1]+.0722*rgba[i*4+2])/255);execute();}catch(_){status('localFail',true);}finally{bitmap?.close();}}
  $$('[data-mode-select]').forEach(b=>listen(b,'click',()=>{root.dataset.mode=b.dataset.modeSelect;$$('[data-mode-select]').forEach(n=>n.setAttribute('aria-pressed',String(n===b)));}));
  listen($('[data-action=fit]'),'click',()=>{$('[data-stage]').classList.add('is-fitted');});
  listen($('select[data-tensor]'),'change',e=>{tensorId=e.target.value;channel=0;page=0;element=0;inspect();});listen($('[data-channel]'),'change',e=>{channel=Math.max(0,Number(e.target.value)||0);inspect();});listen($('[data-page]'),'change',e=>{page=Math.max(0,Number(e.target.value)||0);inspect();});listen($('[data-element]'),'input',e=>setElement(Number(e.target.value)||0));listen($('[data-conv-pixel]'),'input',convolution);
  listen($('[data-timeline]'),'input',e=>{pause();setStep(Number(e.target.value));});listen($('[data-compare]'),'change',compare);
  listen($('[data-auto]'),'change',e=>{auto=e.target.checked;pause();if(auto&&!busy)execute({train:5});else clearTimeout(trainingTimer);});
  $$('[data-action]').forEach(b=>listen(b,'click',()=>{const action=b.dataset.action;if(action==='play')play();if(action==='next'||action==='previous'){pause();setStep(step+(action==='next'?1:-1));}if(action==='train'&&!busy)execute({train:20});if(action==='reset'){pause();auto=false;$('[data-auto]').checked=false;clearTimeout(trainingTimer);step=0;tensorId='';createWorker();execute({reset:true});}if(action==='fit'){$('[data-stage]').scrollTo({left:0,top:0,behavior:'smooth'});}if(action==='close'){$('[data-compare]').value='';compare();}if(action==='download'&&trace){const blob=new Blob([JSON.stringify(trace,(_,v)=>v instanceof Float32Array?Array.from(v):typeof v==='number'&&!Number.isFinite(v)?String(v):v)],{type:'application/json'}),url=URL.createObjectURL(blob),link=el('a',{href:url,download:`tensorcat-${id}-trace.json`});link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}}));
  listen(window,'tensorcat:preferences',e=>{if(!e.detail.changed.includes('language'))return;lang=e.detail.language==='zh-CN'?1:0;localize();});
  const rain=new CodeRain(document.body);let rainTimer=0;
  function rainTick(){if(stopped||document.hidden)return;rain.paint(performance.now(),[...readingMasks(),...$$('.nx-heading,.nx-navigator,.nx-center,.nx-inspector,.nx-credits').map(n=>{const r=n.getBoundingClientRect();return {x:r.x-5,y:r.y-5,width:r.width+10,height:r.height+10};})]);if(!rain.media.matches)rainTimer=setTimeout(rainTick,100);}
  listen(document,'visibilitychange',()=>{if(document.hidden){pause();auto=false;$('[data-auto]').checked=false;clearTimeout(trainingTimer);clearTimeout(rainTimer);}else rainTick();});listen(rain.media,'change',()=>{clearTimeout(rainTimer);rainTick();});
  listen(window,'pagehide',e=>{pause();clearTimeout(trainingTimer);clearTimeout(changeTimer);clearTimeout(rainTimer);if(!e.persisted){stopped=true;worker?.terminate();compareWorker?.terminate();rain.dispose();events.abort();}});
  listen(window,'pageshow',e=>{if(e.persisted)rainTick();});
  const refs=[['Attention Is All You Need','https://arxiv.org/abs/1706.03762'],['Generative Adversarial Nets','https://arxiv.org/abs/1406.2661'],['Graph Convolutional Networks','https://arxiv.org/abs/1609.02907'],['Long Short-Term Memory','https://doi.org/10.1162/neco.1997.9.8.1735'],['GRU / Encoder–Decoder','https://arxiv.org/abs/1406.1078'],['Understanding Deep Network Initialization','https://proceedings.mlr.press/v9/glorot10a.html'],['Denoising Diffusion Probabilistic Models','https://arxiv.org/abs/2006.11239'],['DDIM','https://arxiv.org/abs/2010.02502'],['U-Net','https://arxiv.org/abs/1505.04597']];const list=el('ul');for(const [title,href]of refs){const li=el('li');li.append(el('a',{href,target:'_blank',rel:'noopener'},title));list.append(li);}$('[data-paper-links]').append(list);
  createWorker();localize();execute();rainTick();
}
