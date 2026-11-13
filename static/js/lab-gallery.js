import {t,bindTranslations} from './i18n.js';
export const EXHIBIT_MOTION={duration:760,easing:'cubic-bezier(0.22, 1, 0.36, 1)'};

export function previewFrames(direction,distance){
  const travel=Math.sign(direction||1)*distance;
  return {
    outgoing:[{transform:'translate3d(0,0,0) scale(1)',opacity:1},{offset:.48,opacity:.55},{transform:`translate3d(0,${-travel}px,0) scale(.985)`,opacity:0}],
    incoming:[{transform:`translate3d(0,${travel}px,0) scale(1.01)`,opacity:0},{offset:.48,opacity:.85},{transform:'translate3d(0,0,0) scale(1)',opacity:1}],
  };
}

// One serialized lifecycle owns preparation and motion; only the latest request is retained.
export class ExhibitSwitcher {
  constructor(entries,view,initialId=entries[0]?.id){
    this.entries=new Map(entries.filter(e=>e.available!==false).map(e=>[e.id,e]));
    this.view=view;this.activeProjectId=initialId;this.requestedProjectId=initialId;
    this.outgoingProjectId=null;this.transitionDirection=1;this.phase='IDLE';this.pending=null;this.preparation=null;this.disposed=false;
  }
  setPhase(phase){if(this.phase===phase)return;this.phase=phase;this.view.phase?.(phase);}
  request(id){
    if(this.disposed||!this.entries.has(id)||id===this.requestedProjectId)return this.pending||Promise.resolve();
    this.requestedProjectId=id;this.view.select?.(id);
    if(this.phase==='PREPARING_NEXT')this.preparation?.abort();
    if(!this.pending)this.pending=this.run().finally(()=>{this.pending=null;});
    return this.pending;
  }
  async run(){
    while(!this.disposed&&this.requestedProjectId!==this.activeProjectId){
      const id=this.requestedProjectId,entry=this.entries.get(id);
      this.preparation=new AbortController();this.setPhase('PREPARING_NEXT');
      try{
        const prepared=await this.view.prepare(entry,this.preparation.signal);
        if(this.disposed)return;
        if(id!==this.requestedProjectId)continue;
        this.outgoingProjectId=this.activeProjectId;
        this.transitionDirection=Math.sign(entry.order-this.entries.get(this.activeProjectId).order)||1;
        this.setPhase('TRANSITIONING');
        await this.view.transition(prepared,this.transitionDirection);
        if(this.disposed)return;
        this.setPhase('SETTLING');this.view.commit(prepared,entry);
        this.activeProjectId=id;this.outgoingProjectId=null;
      }catch(error){
        if(this.disposed)return;
        if(error.name==='AbortError')continue;
        this.view.rollback?.();this.view.error?.(entry,error);
        this.outgoingProjectId=null;
        if(id===this.requestedProjectId)this.requestedProjectId=this.activeProjectId;
      }
      this.setPhase('IDLE');this.view.select?.(this.requestedProjectId);
    }
    if(!this.disposed){this.setPhase('IDLE');this.view.select?.(this.activeProjectId);}
  }
  snapshot(){return{activeProjectId:this.activeProjectId,requestedProjectId:this.requestedProjectId,outgoingProjectId:this.outgoingProjectId,transitionDirection:this.transitionDirection,phase:this.phase};}
  dispose(){if(this.disposed)return;this.disposed=true;this.preparation?.abort();this.view.dispose?.();}
}

function aborted(){const error=new Error('Preview preparation cancelled');error.name='AbortError';return error;}
function untilReady(promise,signal){
  if(signal.aborted)return Promise.reject(aborted());
  return new Promise((resolve,reject)=>{
    const stop=()=>reject(aborted());signal.addEventListener('abort',stop,{once:true});
    promise.then(value=>{signal.removeEventListener('abort',stop);resolve(value);},error=>{signal.removeEventListener('abort',stop);reject(error);});
  });
}

export class ExhibitGallery {
  constructor(host){
    this.host=host;this.viewport=host.querySelector('[data-preview-viewport]');
    this.activeLayer=this.viewport.querySelector('[data-preview-id]');
    this.templates=new Map([...host.querySelectorAll('[data-preview-template]')].map(t=>[t.dataset.previewTemplate,t]));
    this.entries=[...this.templates].map(([id,t])=>({id,order:Number(t.dataset.order)}));
    this.buttons=[...host.querySelectorAll('[data-exhibit-select]')];
    this.list=host.querySelector('[data-project-list]');this.status=host.querySelector('[data-gallery-status]');
    this.media=matchMedia('(prefers-reduced-motion: reduce)');this.compact=matchMedia('(max-width:800px)');
    this.abort=new AbortController();this.animations=[];this.images=new Map();this.disposed=false;this.measureFrame=0;this.width=0;this.showcase=null;this.showcaseEpoch=0;
    const on=(target,event,fn)=>target.addEventListener(event,fn,{signal:this.abort.signal});
    this.switcher=new ExhibitSwitcher(this.entries,{
      prepare:(entry,signal)=>this.prepare(entry,signal),transition:(layer,direction)=>this.transition(layer,direction),
      commit:(layer,entry)=>this.commit(layer,entry),select:id=>this.selectRow(id),rollback:()=>this.rollback(),
      phase:phase=>{host.dataset.transitionPhase=phase;this.viewport.setAttribute('aria-busy',String(phase!=='IDLE'));if(phase==='PREPARING_NEXT')this.status.classList.remove('is-error');},
      error:entry=>{this.status.textContent=t('gallery.failed');this.status.classList.add('is-error');},
      dispose:()=>this.disposeView(),
    },this.activeLayer.dataset.previewId);
    on(this.list,'click',event=>{const b=event.target.closest('[data-exhibit-select]');if(b&&!b.disabled)this.switcher.request(b.dataset.exhibitSelect);});
    on(this.list,'keydown',event=>this.moveFocus(event));
    const warm=event=>{const b=event.target.closest('[data-exhibit-select]');if(b&&!b.disabled)this.warm(b.dataset.exhibitSelect);};
    on(this.list,'pointerover',warm);on(this.list,'focusin',warm);
    on(this.media,'change',()=>{if(this.media.matches)this.finishMotion();});
    on(document,'visibilitychange',()=>{if(document.hidden)this.finishMotion();});
    on(window,'pagehide',event=>{if(event.persisted)this.finishMotion();else this.dispose();});
    on(window,'pageshow',()=>this.scheduleMeasure());
    on(window,'tensorcat:preferences',()=>{bindTranslations(this.host);this.scheduleMeasure();});
    this.observer=new ResizeObserver(entries=>{const width=entries[0].contentRect.width;if(Math.abs(width-this.width)>.5){this.width=width;this.finishMotion();this.scheduleMeasure();}});
    this.observer.observe(this.viewport);this.measure();
    document.fonts?.ready.then(()=>this.scheduleMeasure());
    host.exhibitGalleryDiagnostics=()=>({...this.switcher.snapshot(),layers:this.viewport.querySelectorAll(':scope>[data-preview-id]').length,animations:this.animations.length});
    this.preloadNeighbors(this.switcher.activeProjectId);
    this.mountShowcase(this.activeLayer);
  }
  async mountShowcase(layer){
    const epoch=++this.showcaseEpoch,stage=layer.querySelector('[data-showcase]');
    if(!stage)return;
    try{
      const {HardwareShowcase}=await import('./lab-showcase.js');
      if(this.disposed||epoch!==this.showcaseEpoch||layer!==this.activeLayer)return;
      this.showcase=new HardwareShowcase(stage);await this.showcase.start();
    }catch(error){if(!this.disposed)console.warn('Hardware showcase unavailable:',error.message);}
  }
  clone(id){const layer=document.importNode(this.templates.get(id).content.firstElementChild,true);bindTranslations(layer);return layer;}
  loadImage(src){
    if(this.images.has(src))return this.images.get(src).promise;
    const image=new Image();let fail;
    const record={image,promise:null,cancel:()=>fail?.(aborted())};
    record.promise=new Promise((resolve,reject)=>{
      let done=false;
      const finish=(error)=>{if(done)return;done=true;clearTimeout(timer);image.onload=image.onerror=null;error?reject(error):resolve(image);};
      const timer=setTimeout(()=>finish(new Error('Preview load timed out')),8000);fail=finish;
      image.onload=()=>{if(!image.naturalWidth){finish(new Error('Empty preview'));return;}image.decode().then(()=>finish(),finish);};
      image.onerror=()=>finish(new Error('Preview image unavailable'));image.src=src;
    });
    record.promise.catch(()=>{if(this.images.get(src)===record)this.images.delete(src);});
    this.images.set(src,record);return record.promise;
  }
  async prepare(entry,signal){
    const layer=this.clone(entry.id),image=layer.querySelector('[data-preview-visual] img');
    if(image){await untilReady(this.loadImage(image.src),signal);await untilReady(image.decode(),signal);}
    return layer;
  }
  warm(id){const image=this.templates.get(id)?.content.querySelector('[data-preview-visual] img');if(image&&!navigator.connection?.saveData)this.loadImage(image.src).catch(()=>{});}
  preloadNeighbors(id){const index=this.entries.findIndex(e=>e.id===id);[this.entries[index-1],this.entries[index+1]].filter(Boolean).forEach(e=>this.warm(e.id));}
  selectRow(id){this.buttons.forEach(b=>{const selected=b.dataset.exhibitSelect===id;b.classList.toggle('is-selected',selected);b.setAttribute('aria-pressed',String(selected));});}
  async transition(incoming,direction){
    this.showcase?.pause();
    const outgoing=this.activeLayer;
    outgoing.classList.add('is-outgoing');outgoing.inert=true;outgoing.setAttribute('aria-hidden','true');
    incoming.classList.add('is-incoming');this.viewport.append(incoming);
    const visual=outgoing.querySelector('[data-preview-visual]');
    const distance=(visual?.getBoundingClientRect().height||this.viewport.clientWidth*9/16)*(this.compact.matches ? .32 : .55);
    if(this.media.matches||document.hidden||!incoming.animate)return;
    const frames=previewFrames(direction,distance),options={...EXHIBIT_MOTION,fill:'both'};
    this.animations=[outgoing.animate(frames.outgoing,options),incoming.animate(frames.incoming,options)];
    const time=document.timeline.currentTime;if(time!==null)this.animations.forEach(a=>{a.startTime=time;});
    await Promise.allSettled(this.animations.map(a=>a.finished));
  }
  commit(layer,entry){
    this.showcaseEpoch++;this.showcase?.dispose();this.showcase=null;
    layer.classList.remove('is-incoming','is-outgoing');layer.inert=false;layer.removeAttribute('aria-hidden');
    this.viewport.replaceChildren(layer);this.activeLayer=layer;this.clearMotion();
    this.status.classList.remove('is-error');this.status.textContent=t('gallery.selected',{title:layer.querySelector('h2').textContent.trim()});this.preloadNeighbors(entry.id);
    this.mountShowcase(layer);
  }
  rollback(){this.activeLayer.classList.remove('is-outgoing');this.activeLayer.inert=false;this.activeLayer.removeAttribute('aria-hidden');this.viewport.replaceChildren(this.activeLayer);this.clearMotion();this.showcase?.resume();}
  clearMotion(){this.animations.forEach(a=>a.cancel());this.animations=[];}
  finishMotion(){this.animations.forEach(a=>{try{a.finish();}catch{a.cancel();}});}
  scheduleMeasure(){if(!this.disposed&&!this.measureFrame)this.measureFrame=requestAnimationFrame(()=>{this.measureFrame=0;this.measure();});}
  measure(){
    if(this.disposed)return;
    const probe=document.createElement('div');probe.className='lab-preview-probe';probe.inert=true;probe.setAttribute('aria-hidden','true');
    for(const entry of this.entries){const layer=this.clone(entry.id);layer.removeAttribute('id');layer.querySelectorAll('[id]').forEach(e=>e.removeAttribute('id'));layer.querySelectorAll('img').forEach(e=>{e.removeAttribute('src');e.removeAttribute('srcset');});probe.append(layer);}
    this.viewport.append(probe);
    const height=Math.max(400,...[...probe.children].map(e=>e.getBoundingClientRect().height));
    probe.remove();this.viewport.style.height=Math.ceil(height)+'px';
  }
  moveFocus(event){
    if(!event.target.closest('[data-exhibit-select]'))return;
    const rows=this.buttons.filter(b=>!b.disabled),index=rows.indexOf(event.target.closest('[data-exhibit-select]'));
    const step={ArrowDown:1,ArrowRight:1,ArrowUp:-1,ArrowLeft:-1}[event.key];
    if(!step&&event.key!=='Home'&&event.key!=='End')return;
    event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?rows.length-1:(index+step+rows.length)%rows.length;
    rows[next].focus({preventScroll:true});
    if(this.compact.matches)this.list.scrollTo({left:rows[next].offsetLeft-this.list.offsetLeft,behavior:this.media.matches?'instant':'smooth'});
  }
  disposeView(){
    if(this.disposed)return;this.disposed=true;this.abort.abort();this.observer.disconnect();cancelAnimationFrame(this.measureFrame);
    this.showcaseEpoch++;this.showcase?.dispose();this.showcase=null;
    this.rollback();for(const record of this.images.values())record.cancel();this.images.clear();delete this.host.exhibitGalleryDiagnostics;
  }
  dispose(){this.switcher.dispose();}
}

const galleries=new WeakMap();
export function unmountGallery(host){galleries.get(host)?.dispose();galleries.delete(host);}
export function mountGallery(host){
  unmountGallery(host);
  if(!host.querySelector('[data-preview-id]'))return null;
  const gallery=new ExhibitGallery(host);galleries.set(host,gallery);return gallery;
}
if(typeof document!=='undefined'){
  const host=document.querySelector('[data-exhibit-gallery]');if(host)mountGallery(host);
}
