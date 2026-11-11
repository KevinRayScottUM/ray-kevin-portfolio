export const RAIN={interval:100,spacing:28,font:13,opacity:.42,headOpacity:.55,tail:10,speed:30};
export function readingMasks(root=document){
  return [...root.querySelectorAll('#header .portfolio-brand a,#header .portfolio-nav-link,.lab-collection-heading,.lab-project-index,.lab-preview-header,.lab-preview-copy,.lab-back,.tc-heading,.tc-statusbar,.tc-research summary,.tc-sidebar,.tc-inspector,.tc-performance,[data-inspector-tools],.tc-foot,.tc-method p,body>footer>div')].map(e=>{
    const r=e.getBoundingClientRect();return {x:r.x-8,y:r.y-6,width:r.width+16,height:r.height+12};
  });
}
export class CodeRain {
  constructor(parent,contained=false){
    this.canvas=document.createElement('canvas');this.canvas.className='lab-code-rain'+(contained?' is-contained':'');this.canvas.setAttribute('aria-hidden','true');parent.append(this.canvas);
    this.context=this.canvas.getContext('2d');this.parent=parent;this.contained=contained;this.media=matchMedia('(prefers-reduced-motion: reduce)');this.last=-Infinity;this.seed=73;
    this.resize=()=>{
      const r=contained?parent.getBoundingClientRect():{width:innerWidth,height:innerHeight},width=Math.ceil(r.width),height=Math.ceil(r.height),ratio=Math.min(1.5,typeof devicePixelRatio==='number'?devicePixelRatio:1),spacing=width<=700?40:RAIN.spacing;
      if(width===this.width&&height===this.height&&ratio===this.ratio)return;
      this.width=width;this.height=height;this.ratio=ratio;this.spacing=spacing;
      this.canvas.width=Math.ceil(width*ratio);this.canvas.height=Math.ceil(height*ratio);this.context.setTransform?.(ratio,0,0,ratio,0,0);
      const count=Math.ceil(width/spacing);this.columns=(this.columns||[]).slice(0,count);
      while(this.columns.length<count)this.columns.push({phase:this.random()*height,speed:RAIN.speed*(.7+this.random()*.6)});
      this.last=-Infinity;
    };
    this.observer=new ResizeObserver(this.resize);this.observer.observe(contained?parent:document.documentElement);if(!contained)window.addEventListener('resize',this.resize);this.resize();
  }
  random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
  paint(now,holes=[],reduced=this.media.matches){
    this.canvas.hidden=reduced;if(reduced)return false;
    const c=this.context,changed=now-this.last>=RAIN.interval;
    if(changed){this.last=now;c.clearRect(0,0,this.width,this.height);c.font=RAIN.font+'px ui-monospace, monospace';
      this.columns.forEach((column,i)=>{const y=(now/1000*column.speed+column.phase)%(this.height+RAIN.tail*20)-40;for(let j=0;j<RAIN.tail;j++){c.fillStyle=j===0?`rgba(137,242,171,${RAIN.headOpacity})`:`rgba(60,195,105,${RAIN.opacity*(1-j/RAIN.tail)})`;const glyph='01ABCDEF<>/[]'[(Math.floor(now/450)+i*7+j*3)%13];c.fillText(glyph,i*this.spacing+10,y-j*20);}});
    }
    for(const r of holes)c.clearRect(r.x,r.y,r.width,r.height);
    return changed;
  }
  dispose(){this.observer.disconnect();if(!this.contained)window.removeEventListener('resize',this.resize);this.canvas.remove();}
}

const collection=typeof document==='undefined'?null:document.querySelector('.lab-collection');
if(collection){
  const rain=new CodeRain(document.body);let frame=0,stopped=false;
  const tick=now=>{frame=0;if(stopped||document.hidden)return;rain.paint(now,readingMasks());if(!rain.media.matches)frame=requestAnimationFrame(tick);};
  const schedule=()=>{if(!frame&&!stopped&&!document.hidden)frame=requestAnimationFrame(tick);};
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else schedule();});
  rain.media.addEventListener('change',schedule);
  window.addEventListener('pagehide',event=>{cancelAnimationFrame(frame);frame=0;if(!event.persisted){stopped=true;rain.dispose();}});
  window.addEventListener('pageshow',schedule);schedule();
}
