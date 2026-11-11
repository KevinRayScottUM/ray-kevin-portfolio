import {THREE,SoftwareRenderer,loadConsole} from './lab-v3/graphics.js';
import {CartridgeGallery} from './lab-v3/gallery.js';
import {drawConsoleHome} from './lab-v3/home-screen.js';
import {compileHardware,createHardwareScene,ShowcaseRig} from './lab-showcase-scene.js';
import {ShowcaseMotion,HorizontalIntent,TOUR_INPUT,TOUR_POSES} from './lab-showcase-motion.js';

const banks=new Map();
async function hardwareAssets(base){
  if(!banks.has(base))banks.set(base,(async()=>{
    const [model,response]=await Promise.all([loadConsole(base+'console-mesh.json'),fetch(base+'experiments.json')]);
    if(!response.ok)throw Error('Cartridge metadata unavailable');
    const registry=await response.json();compileHardware(model);
    const decoder=new SoftwareRenderer(document.createElement('canvas'));
    await Promise.all([...model.textures].map(name=>decoder.loadTexture(name,base+name)));
    const logoTexture=decoder.textures.get('logo-badge.png'),logo=document.createElement('canvas');logo.width=logoTexture.width;logo.height=logoTexture.height;
    const logoContext=logo.getContext('2d'),logoPixels=logoContext.createImageData(logo.width,logo.height);logoPixels.data.set(logoTexture.data);logoContext.putImageData(logoPixels,0,0);
    const screen=document.createElement('canvas');screen.width=1024;screen.height=576;
    const c=screen.getContext('2d');c.scale(2,2);c.fillStyle='#17242a';c.fillRect(0,0,512,288);c.strokeStyle='#40565e';c.strokeRect(12,12,488,264);
    drawConsoleHome(c,logo,(name,index,x,y,w,h)=>{c.fillStyle=index===0?'#4b7774':'#e7eeeb';c.fillRect(x,y,w,h);c.fillStyle=index===0?'#fff':'#294644';c.font='13px system-ui, sans-serif';c.fillText(name,x+10,y+h*.65);});
    decoder.updateTexture('screen',screen);
    return {model,registry,textures:decoder.textures};
  })().catch(error=>{banks.delete(base);throw error;}));
  return banks.get(base);
}

export class HardwareShowcase {
  constructor(stage){
    this.stage=stage;this.outer=stage.closest('.lab-showcase');this.canvas=stage.querySelector('[data-showcase-canvas]');
    this.fallback=stage.querySelector('[data-showcase-fallback]');this.label=this.outer.querySelector('[data-showcase-pose]');this.progress=this.outer.querySelector('[data-showcase-progress]');this.buttons=[...this.outer.querySelectorAll('[data-showcase-step]')];
    this.motion=new ShowcaseMotion();this.intent=new HorizontalIntent();this.media=matchMedia('(prefers-reduced-motion: reduce)');this.motion.setReduced(this.media.matches);
    this.abort=new AbortController();this.disposed=false;this.suspended=false;this.ready=false;this.dirty=true;this.frame=0;this.last=0;this.pointer=null;this.frames=0;this.galleryFrames=0;this.frameTimes=[];this.responseTimes=[];this.scale=1;this.average=0;this.inputAt=null;this.inputCounts={horizontal:0,vertical:0,drags:0};
    const r=stage.getBoundingClientRect();this.visible=r.bottom>0&&r.top<innerHeight;
    stage.dataset.showcaseState='loading';stage.setAttribute('aria-busy','true');this.fallback.hidden=false;
    const on=(element,name,fn,options={})=>element.addEventListener(name,fn,{...options,signal:this.abort.signal});
    on(stage,'wheel',event=>this.wheel(event),{passive:false});
    on(stage,'pointerdown',event=>this.pointerDown(event));on(stage,'pointermove',event=>this.pointerMove(event));
    on(stage,'pointerup',event=>this.pointerEnd(event));on(stage,'pointercancel',event=>this.pointerEnd(event,true));on(stage,'lostpointercapture',event=>this.pointerEnd(event,true));
    on(this.outer,'keydown',event=>this.key(event));
    this.buttons.forEach(button=>on(button,'click',()=>{if(this.canOwn()){this.releaseInput();this.motion.advance(Number(button.dataset.showcaseStep));this.markInput();}}));
    on(this.media,'change',()=>{this.motion.setReduced(this.media.matches);this.dirty=true;this.schedule();});
    on(window,'blur',()=>this.releaseInput(true));
    on(document,'visibilitychange',()=>{if(document.hidden)this.stopFrame();else{this.last=0;this.dirty=true;this.schedule();}});
    on(window,'pagehide',event=>{if(event.persisted)this.stopFrame();else this.dispose();});
    on(window,'pageshow',()=>{const b=stage.getBoundingClientRect();this.visible=b.bottom>0&&b.top<innerHeight;this.last=0;this.dirty=true;this.schedule();});
    this.resizeObserver=new ResizeObserver(()=>{this.dirty=true;this.schedule();});this.resizeObserver.observe(stage);
    this.intersectionObserver=new IntersectionObserver(entries=>{this.visible=entries[0].isIntersecting;if(this.visible){this.last=0;this.dirty=true;this.schedule();}else this.stopFrame();});this.intersectionObserver.observe(stage);
    stage.showcaseDiagnostics=()=>this.diagnostics();
  }
  async start(){
    try{
      const base=this.stage.dataset.showcaseAssets.replace(/\/?$/,'/'),assets=await hardwareAssets(base);
      if(this.disposed)return;
      this.hardware=createHardwareScene(assets.model);this.rig=new ShowcaseRig();
      this.renderer=new SoftwareRenderer(this.canvas);this.renderer.textures=assets.textures;this.renderer.setStudio(true);this.renderer.setBackground('#101418');
      this.gallery=new CartridgeGallery(this.stage.querySelector('.lab-showcase-cartridges'),this.hardware,assets.registry,assets.textures);
      this.ready=true;this.dirty=true;this.schedule();
    }catch(error){
      if(this.disposed)return;this.stage.dataset.showcaseState='error';this.stage.setAttribute('aria-busy','false');this.label.textContent='Hardware preview unavailable';console.warn('TensorCat hardware preview:',error.message);
    }
  }
  canOwn(){return this.ready&&!this.disposed&&!this.suspended&&!document.hidden;}
  markInput(){if(this.inputAt===null)this.inputAt=performance.now();this.dirty=true;this.schedule();}
  wheel(event){
    if(!this.canOwn())return;
    const delta=this.intent.feed(event,this.stage.clientWidth,performance.now());
    if(!delta){this.inputCounts.vertical++;return;}
    event.preventDefault();this.inputCounts.horizontal++;this.motion.wheel(delta,performance.now());this.markInput();
  }
  pointerDown(event){
    if(!this.canOwn()||event.button!==0||this.pointer||event.target.closest('button,a'))return;
    this.stage.focus({preventScroll:true});this.pointer={id:event.pointerId,type:event.pointerType,x:event.clientX,y:event.clientY,lastX:event.clientX,locked:false,rejected:false};
    if(event.pointerType==='mouse'){this.pointer.locked=true;this.stage.setPointerCapture(event.pointerId);this.motion.begin(performance.now());}
  }
  pointerMove(event){
    const p=this.pointer;if(!p||p.id!==event.pointerId||p.rejected)return;
    const dx=event.clientX-p.x,dy=event.clientY-p.y;
    if(!p.locked){
      if(Math.abs(dy)>8&&Math.abs(dy)>Math.abs(dx)*TOUR_INPUT.intentRatio){p.rejected=true;return;}
      if(Math.abs(dx)<8||Math.abs(dx)<Math.abs(dy)*TOUR_INPUT.intentRatio)return;
      p.locked=true;this.stage.setPointerCapture(p.id);this.motion.begin(performance.now());
    }
    const movement=event.clientX-p.lastX;p.lastX=event.clientX;
    if(movement){this.motion.nudge(-movement*TOUR_INPUT.turnsPerPixel,performance.now());this.inputCounts.drags++;this.markInput();}
  }
  pointerEnd(event,cancel=false){
    const p=this.pointer;if(!p||p.id!==event.pointerId)return;
    this.pointer=null;if(p.locked){if(this.stage.hasPointerCapture(p.id))this.stage.releasePointerCapture(p.id);this.motion.end(cancel,performance.now());this.schedule();}
  }
  releaseInput(cancel=true){
    const p=this.pointer;this.pointer=null;
    if(p&&this.stage.hasPointerCapture(p.id))this.stage.releasePointerCapture(p.id);
    this.intent.reset();this.motion.end(cancel,performance.now());
  }
  key(event){
    if(!this.canOwn()||event.altKey||event.ctrlKey||event.metaKey||!['ArrowRight','ArrowLeft','Home','End'].includes(event.key))return;
    event.preventDefault();this.releaseInput();
    if(event.key==='Home')this.motion.to(0);else if(event.key==='End')this.motion.to(1);else this.motion.advance(event.key==='ArrowRight'?1:-1);
    this.markInput();
  }
  size(moving){
    const width=this.stage.clientWidth,height=this.stage.clientHeight,dpr=window.devicePixelRatio||1;
    const ratio=moving?Math.min(1.5,Math.max(1,dpr))*this.scale:Math.min(1.75,Math.max(1.25,dpr)),cap=moving?1000000:1700000;
    const factor=Math.min(ratio,Math.sqrt(cap/(width*height))),w=Math.max(1,Math.round(width*factor)),h=Math.max(1,Math.round(height*factor));
    const changed=w!==this.renderer.width||h!==this.renderer.height;if(changed)this.renderer.setSize(w,h);
    const rectKey=width+':'+height+':'+dpr;
    if(rectKey!==this.gallerySize){this.gallerySize=rectKey;this.gallery.resize(dpr,'high');if(this.gallery.update(0,true))this.galleryFrames++;}
    return changed;
  }
  tick(now){
    this.frame=0;if(!this.canOwn()||!this.visible)return;
    const dt=this.last?Math.min((now-this.last)/1000,.08):1/60;this.last=now;
    const changed=this.motion.step(dt,now),moving=this.motion.needsFrame,resized=this.size(moving);
    if(this.dirty||changed||resized){
      const pose=this.rig.pose(this.motion.progress,this.hardware.pivot);
      this.renderer.render(this.hardware.scene,this.rig,{mode:'surface',vertexCache:true,fastClip:true});
      this.frames++;this.dirty=false;this.frameTimes.push(this.renderer.stats.ms);if(this.frameTimes.length>180)this.frameTimes.shift();
      if(moving)this.average=this.average?this.average*.85+this.renderer.stats.ms*.15:this.renderer.stats.ms;
      if(moving&&this.average>28&&this.scale>.75)this.scale=Math.max(.75,this.scale-.05);
      this.label.textContent=TOUR_POSES[pose.index].name;this.progress.textContent=String(pose.index+1).padStart(2,'0')+' / 08';
      this.stage.dataset.showcaseState='ready';this.stage.setAttribute('aria-busy','false');this.fallback.hidden=true;this.buttons.forEach(b=>b.disabled=false);
      if(this.inputAt!==null){this.responseTimes.push(performance.now()-this.inputAt);if(this.responseTimes.length>80)this.responseTimes.shift();this.inputAt=null;}
    }
    if(moving)this.schedule();else this.last=0;
  }
  schedule(){if(!this.frame&&this.canOwn()&&this.visible)this.frame=requestAnimationFrame(now=>this.tick(now));}
  stopFrame(){this.releaseInput();cancelAnimationFrame(this.frame);this.frame=0;this.last=0;}
  pause(){if(this.disposed)return;this.suspended=true;this.stopFrame();}
  resume(){if(this.disposed)return;this.suspended=false;this.dirty=true;this.schedule();}
  diagnostics(){
    return {ready:this.ready,disposed:this.disposed,suspended:this.suspended,visible:this.visible,frameScheduled:Boolean(this.frame),...this.motion.snapshot(),frames:this.frames,galleryFrames:this.galleryFrames,input:{...this.inputCounts},renderer:this.renderer?{...this.renderer.stats,width:this.renderer.width,height:this.renderer.height,scale:this.scale}:null,frameTimes:[...this.frameTimes],inputToPaintMs:[...this.responseTimes],sceneId:this.hardware?.root.uuid,quaternion:this.hardware?.pivot.quaternion.toArray(),camera:this.rig?{position:this.rig.camera.position.toArray(),target:this.rig.target.toArray(),distance:this.rig.distance}:null,cartridges:this.gallery?.cards.map(c=>({position:c.position.toArray(),quaternion:c.quaternion.toArray()}))};
  }
  dispose(){
    if(this.disposed)return;this.stopFrame();this.disposed=true;this.abort.abort();this.resizeObserver.disconnect();this.intersectionObserver.disconnect();
    this.gallery?.dispose();this.hardware?.scene.clear();this.renderer=null;this.hardware=null;this.gallery=null;this.rig=null;
    this.canvas.width=this.canvas.height=1;this.fallback.hidden=false;this.stage.dataset.showcaseState='loading';this.buttons.forEach(b=>b.disabled=true);delete this.stage.showcaseDiagnostics;
  }
}
