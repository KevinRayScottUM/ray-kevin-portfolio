export const MOTION=Object.freeze({duration:580,easing:'cubic-bezier(.22,1,.36,1)'});
export function fittedRect(bounds,width,height){const scale=Math.min((bounds.width-32)/width,(bounds.height-32)/height);return {x:bounds.x+(bounds.width-width*scale)/2,y:bounds.y+(bounds.height-height*scale)/2,width:width*scale,height:height*scale};}
export function revealFrames(start,end){return [{transform:`translate3d(${start.x}px,${start.y}px,0) scale(${start.width/end.width},${start.height/end.height})`,opacity:0,borderRadius:'16px'},{offset:.15,opacity:1},{transform:`translate3d(${end.x}px,${end.y}px,0) scale(1.012)`,opacity:1,borderRadius:'5px',offset:.8},{transform:`translate3d(${end.x}px,${end.y}px,0) scale(1)`,opacity:1,borderRadius:'2px'}];}
export class ImageReveal {
  constructor(root){this.root=root;this.animations=[];this.url=null;this.ghost=null;this.version=0;this.media=matchMedia('(prefers-reduced-motion: reduce)');}
  cancel(){this.version++;this.animations.forEach(a=>a.cancel());this.animations=[];this.ghost?.remove();this.ghost=null;if(this.url)URL.revokeObjectURL(this.url);this.url=null;this.root.classList.remove('is-revealing');}
  async run(file,bitmap,point,wasEmpty){
    this.cancel();const version=this.version,canvas=this.root.querySelector('[data-editor-canvas]');if(this.media.matches||!canvas.animate)return;
    const box=canvas.getBoundingClientRect(),target=fittedRect(box,bitmap.width,bitmap.height),ratio=bitmap.height/bitmap.width,w=Math.min(130,target.width),h=w*ratio;
    const p=point||{x:box.x+box.width/2,y:box.y+box.height/2};const start={x:Math.max(box.x,Math.min(box.x+box.width-w,p.x-w/2)),y:Math.max(box.y,Math.min(box.y+box.height-h,p.y-h/2)),width:w,height:h};
    const ghost=document.createElement('img');this.url=URL.createObjectURL(file);ghost.src=this.url;ghost.alt='';ghost.className='is-image-flight';ghost.style.width=target.width+'px';ghost.style.height=target.height+'px';ghost.style.transformOrigin='0 0';this.ghost=ghost;document.body.append(ghost);
    try{await ghost.decode();if(version!==this.version)return;this.root.classList.add('is-revealing');const drop=this.root.querySelector('[data-drop-zone]');
      this.animations=[ghost.animate(revealFrames(start,target),{...MOTION,fill:'both'}),canvas.animate([{opacity:0},{offset:.7,opacity:.1},{opacity:1}],{...MOTION,fill:'both'})];
      if(wasEmpty)this.animations.push(drop.animate([{opacity:1,transform:'scale(1)'},{opacity:0,transform:'scale(.985)'}],{duration:320,easing:MOTION.easing,fill:'both'}));
      await Promise.allSettled(this.animations.map(a=>a.finished));
    }catch{}finally{if(version===this.version)this.cancel();}
  }
  dispose(){this.cancel();}
}
