import {dimensionsOK,acquireImage} from './files.js';
import {tr} from './messages.js';
export function sourcePoint(client,rect,view){return {x:(client.x-rect.left-rect.width/2-view.panX)/view.scale+view.width/2,y:(client.y-rect.top-rect.height/2-view.panY)/view.scale+view.height/2};}
export class ImageEditor {
  constructor(root,signal,notify){
    this.root=root;this.canvas=root.querySelector('[data-editor-canvas]');this.context=this.canvas.getContext('2d');this.notify=notify;this.history=[];this.index=-1;this.zoom=1;this.pan={x:0,y:0};this.maskHistory=[];this.maskIndex=-1;this.tool='edit';this.drawing=false;this.drag=null;
    this.mask=document.createElement('canvas');this.maskContext=this.mask.getContext('2d');this.abort=signal;
    const on=(target,event,fn,options={})=>target.addEventListener(event,fn,{...options,signal});
    on(this.canvas,'pointerdown',e=>this.down(e));on(this.canvas,'pointermove',e=>this.move(e));on(this.canvas,'pointerup',e=>this.up(e));on(this.canvas,'pointercancel',e=>this.up(e));
    on(this.canvas,'wheel',e=>{e.preventDefault();if(e.ctrlKey){this.zoom=Math.min(8,Math.max(.15,this.zoom*Math.exp(-e.deltaY*.01)));this.root.querySelector('[data-zoom]').value=this.zoom;}else{this.pan.x-=e.deltaX;this.pan.y-=e.deltaY;}this.draw();},{passive:false});
    on(root.querySelector('[data-zoom]'),'input',e=>{this.zoom=+e.target.value;this.draw();});
    for(const selector of ['[data-compare]','[data-mask-opacity]','[data-fill-background]','[data-background-color]'])on(root.querySelector(selector),'input',()=>this.draw());
    this.observer=new ResizeObserver(()=>this.draw());this.observer.observe(this.canvas);
    on(this.canvas,'lostpointercapture',()=>{this.drawing=false;this.drag=null;});
    on(this.canvas,'keydown',e=>{if(!this.current)return;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();this.pan.x+=({ArrowLeft:20,ArrowRight:-20}[e.key]||0);this.pan.y+=({ArrowUp:20,ArrowDown:-20}[e.key]||0);this.draw();}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();this.moveHistory(e.shiftKey?1:-1);}});
  }
  get current(){return this.history[this.index];}
  async open(acquired,isCurrent=()=>true){const bitmap=await createImageBitmap(acquired.bitmap);if(!isCurrent()){bitmap.close();return false;}this.disposeImages();this.history=[{bitmap,label:'original'}];this.original=bitmap;this.index=0;this.root.querySelector('[data-compare]').value=0;this.fit();this.resetMask();this.renderHistory();return true;}
  async add(blob,label){const acquired=await acquireImage(new File([blob],'result',{type:blob.type}));this.history.splice(this.index+1).forEach(s=>{if(s.bitmap!==this.original)s.bitmap.close();});this.history.push({bitmap:acquired.bitmap,label});this.index=this.history.length-1;if(this.history.length>9){const old=this.history.splice(1,1)[0];old.bitmap.close();this.index--;}this.fit();this.resetMask();this.renderHistory();}
  fit(){this.zoom=1;this.pan={x:0,y:0};this.root.querySelector('[data-zoom]').value=1;this.draw();}
  view(){const r=this.canvas.getBoundingClientRect(),image=this.current?.bitmap;if(!image)return null;return {width:image.width,height:image.height,panX:this.pan.x,panY:this.pan.y,scale:Math.min((r.width-30)/image.width,(r.height-30)/image.height)*this.zoom};}
  point(e){return sourcePoint({x:e.clientX,y:e.clientY},this.canvas.getBoundingClientRect(),this.view());}
  down(e){if(!this.current)return;this.canvas.setPointerCapture(e.pointerId);if(this.tool==='inpaint'&&!e.altKey){this.drawing=true;this.lastPoint=this.point(e);this.stroke(this.lastPoint,this.lastPoint);}else this.drag={x:e.clientX,y:e.clientY,pan:{...this.pan}};}
  move(e){if(this.drawing){const point=this.point(e);this.stroke(this.lastPoint,point);this.lastPoint=point;}else if(this.drag){this.pan.x=this.drag.pan.x+e.clientX-this.drag.x;this.pan.y=this.drag.pan.y+e.clientY-this.drag.y;this.draw();}}
  up(e){if(this.drawing){this.drawing=false;this.saveMask();}this.drag=null;if(this.canvas.hasPointerCapture(e.pointerId))this.canvas.releasePointerCapture(e.pointerId);}
  stroke(a,b){
    const ctx=this.maskContext,r=+this.root.querySelector('[data-brush]').value/2,hard=+this.root.querySelector('[data-hardness]').value,erase=this.root.querySelector('[data-erase-mask]').checked;
    ctx.globalCompositeOperation=erase?'destination-out':'source-over';const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/Math.max(1,r*.3)));
    for(let i=0;i<=n;i++){const x=a.x+(b.x-a.x)*i/n,y=a.y+(b.y-a.y)*i/n,g=ctx.createRadialGradient(x,y,r*hard*.95,x,y,r);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);}this.draw();
  }
  resetMask(){const b=this.current.bitmap;this.mask.width=b.width;this.mask.height=b.height;this.maskHistory=[];this.maskIndex=-1;this.saveMask();}
  saveMask(){this.maskHistory.splice(this.maskIndex+1);this.maskHistory.push(this.maskContext.getImageData(0,0,this.mask.width,this.mask.height));const cap=Math.max(2,Math.min(8,Math.floor(32*1024*1024/(this.mask.width*this.mask.height*4))));while(this.maskHistory.length>cap)this.maskHistory.shift();this.maskIndex=this.maskHistory.length-1;}
  maskMove(delta){const next=this.maskIndex+delta;if(next<0||next>=this.maskHistory.length)return;this.maskIndex=next;this.maskContext.putImageData(this.maskHistory[next],0,0);this.draw();}
  moveHistory(delta){const next=this.index+delta;if(next<0||next>=this.history.length)return;this.index=next;this.fit();this.resetMask();this.renderHistory();}
  renderHistory(){const host=this.root.querySelector('[data-history]');host.replaceChildren(...this.history.map((state,index)=>{const b=document.createElement('button');b.textContent=(index+1)+' / '+tr(state.label);b.setAttribute('aria-current',String(index===this.index));b.addEventListener('click',()=>{this.index=index;this.fit();this.resetMask();this.renderHistory();},{signal:this.abort});return b;}));this.root.querySelector('[data-action=undo]').disabled=this.index<=0;this.root.querySelector('[data-action=redo]').disabled=this.index>=this.history.length-1;this.onChange?.();}
  draw(){
    if(!this.current)return;const r=this.canvas.getBoundingClientRect();if(!r.width||!r.height)return;const dpr=Math.min(devicePixelRatio||1,2);if(this.canvas.width!==Math.round(r.width*dpr)||this.canvas.height!==Math.round(r.height*dpr)){this.canvas.width=Math.round(r.width*dpr);this.canvas.height=Math.round(r.height*dpr);}const c=this.context,v=this.view(),b=this.current.bitmap,w=b.width*v.scale,h=b.height*v.scale,x=r.width/2+this.pan.x-w/2,y=r.height/2+this.pan.y-h/2;
    c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,r.width,r.height);if(this.root.querySelector('[data-fill-background]').checked){c.fillStyle=this.root.querySelector('[data-background-color]').value;c.fillRect(x,y,w,h);}c.drawImage(b,x,y,w,h);
    const split=this.history.length>1?+this.root.querySelector('[data-compare]').value/100:0;if(split){c.save();c.beginPath();c.rect(x,y,w*split,h);c.clip();c.clearRect(x,y,w,h);const originalScale=Math.min(w/this.original.width,h/this.original.height),ow=this.original.width*originalScale,oh=this.original.height*originalScale;c.drawImage(this.original,x+(w-ow)/2,y+(h-oh)/2,ow,oh);c.restore();c.strokeStyle='#c6efde';c.beginPath();c.moveTo(x+w*split,y);c.lineTo(x+w*split,y+h);c.stroke();}
    this.root.querySelector('[data-compare-value]').textContent=Math.round(split*100)+'%';
    if(this.tool==='inpaint'){c.save();c.globalAlpha=+this.root.querySelector('[data-mask-opacity]').value;c.drawImage(this.mask,x,y,w,h);c.restore();}
    this.root.querySelector('[data-resolution]').textContent=b.width+' × '+b.height;
  }
  async exportBlob(type='image/png',scale=1,flatten=false){const b=this.current.bitmap,w=Math.round(b.width*scale),h=Math.round(b.height*scale);if(!dimensionsOK(w,h))throw Error('tooLarge');const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const c=canvas.getContext('2d');if(type==='image/jpeg'||flatten){c.fillStyle=flatten?this.root.querySelector('[data-background-color]').value:'#ffffff';c.fillRect(0,0,w,h);}c.imageSmoothingQuality='high';c.drawImage(b,0,0,w,h);return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('format')),type,.93));}
  disposeImages(){const unique=new Set(this.history.map(s=>s.bitmap));if(this.original)unique.add(this.original);unique.forEach(b=>b.close());this.history=[];this.original=null;this.maskHistory=[];}
  dispose(){this.observer.disconnect();this.disposeImages();this.mask.width=this.mask.height=1;}
}
