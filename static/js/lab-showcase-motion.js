import {Spring} from './lab-v3/motion.js';

export const TOUR_POSES=Object.freeze([
  {name:'Front overview',progress:0,pitch:0,distance:.5,targetY:.045},
  {name:'Front three-quarter',progress:32/360,pitch:-.045,distance:.535,targetY:.036},
  {name:'Side profile',progress:90/360,pitch:.035,distance:.55,targetY:.035},
  {name:'Rear three-quarter',progress:140/360,pitch:.025,distance:.535,targetY:.036},
  {name:'Rear overview',progress:180/360,pitch:0,distance:.5,targetY:.045},
  {name:'Opposite side',progress:235/360,pitch:-.035,distance:.54,targetY:.035},
  {name:'Return to front',progress:310/360,pitch:.035,distance:.535,targetY:.036},
  {name:'Full circle',progress:1,pitch:0,distance:.5,targetY:.045},
]);
export const TOUR_INPUT=Object.freeze({turnsPerPixel:.00085,intentThreshold:6,intentRatio:1.3,linePixels:16,gestureGap:140,releaseDelay:.12,maxDelta:.06,maxVelocity:.55,inertiaDamping:12,maxCoast:.035,springFrequency:17});
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
export function nearestPose(progress){return TOUR_POSES.reduce((best,pose,index)=>Math.abs(pose.progress-progress)<Math.abs(TOUR_POSES[best].progress-progress)?index:best,0);}
export function tourPose(progress){
  const p=clamp(progress,0,1);let i=0;while(i<TOUR_POSES.length-2&&p>TOUR_POSES[i+1].progress)i++;
  const a=TOUR_POSES[i],b=TOUR_POSES[i+1],t=clamp((p-a.progress)/(b.progress-a.progress),0,1),s=t*t*(3-2*t);
  return {progress:p,yaw:p*Math.PI*2,pitch:a.pitch+(b.pitch-a.pitch)*s,distance:a.distance+(b.distance-a.distance)*s,targetY:a.targetY+(b.targetY-a.targetY)*s,index:nearestPose(p)};
}
export function normalizedWheel(event,width){
  const scale=event.deltaMode===1?TOUR_INPUT.linePixels:event.deltaMode===2?width:1;
  return {x:(event.deltaX||(event.shiftKey?event.deltaY:0))*scale,y:(event.shiftKey&&!event.deltaX?0:event.deltaY)*scale};
}
export class HorizontalIntent {
  constructor(){this.reset();}
  reset(){this.accumulated=0;this.locked=false;this.last=-Infinity;}
  feed(event,width,now){
    if(event.ctrlKey||event.metaKey){this.reset();return 0;}
    const {x,y}=normalizedWheel(event,width);
    if(now-this.last>TOUR_INPUT.gestureGap){this.accumulated=0;this.locked=false;}this.last=now;
    if(Math.abs(x)<.05||Math.abs(x)<Math.abs(y)*(this.locked ? .85 : TOUR_INPUT.intentRatio)){this.accumulated=0;this.locked=false;return 0;}
    this.accumulated+=x;
    if(!this.locked&&Math.abs(this.accumulated)<TOUR_INPUT.intentThreshold)return 0;
    this.locked=true;const delta=this.accumulated;this.accumulated=0;return delta;
  }
}
export class ShowcaseMotion {
  constructor(){this.spring=new Spring(0,TOUR_INPUT.springFrequency);this.held=false;this.wheelUntil=0;this.lastInput=0;this.inputVelocity=0;this.coast=0;this.coasted=0;this.reduced=false;}
  get progress(){return this.spring.value;}
  get phase(){return this.held?'DRAGGING':this.wheelUntil?'SCRUBBING':this.coast?'COASTING':this.settled?'IDLE':'SETTLING';}
  get settled(){return this.spring.value===this.spring.target&&this.spring.velocity===0;}
  get needsFrame(){return Boolean(this.wheelUntil||this.coast||!this.settled);}
  begin(now){this.held=true;this.wheelUntil=0;this.coast=0;this.coasted=0;this.inputVelocity=0;this.lastInput=now;this.spring.target=this.spring.value;}
  nudge(turns,now){
    const change=clamp(turns,-TOUR_INPUT.maxDelta,TOUR_INPUT.maxDelta),dt=clamp((now-this.lastInput)/1000,.008,.08);
    this.spring.target=clamp(this.spring.target+change,0,1);this.inputVelocity=clamp(this.inputVelocity*.5+change/dt*.5,-TOUR_INPUT.maxVelocity,TOUR_INPUT.maxVelocity);this.lastInput=now;
    if(this.reduced){this.spring.value=this.spring.target;this.spring.velocity=0;}
  }
  wheel(pixels,now){
    if(!this.wheelUntil){this.coast=0;this.coasted=0;this.inputVelocity=0;this.lastInput=now-16;}
    this.held=false;this.nudge(pixels*TOUR_INPUT.turnsPerPixel,now);this.wheelUntil=now+TOUR_INPUT.releaseDelay*1000;
  }
  end(cancel=false,now=this.lastInput){
    this.held=false;this.wheelUntil=0;this.coasted=0;
    if(cancel){this.coast=0;this.spring.target=this.spring.value;this.spring.velocity=0;return;}
    this.coast=this.reduced?0:this.inputVelocity*Math.exp(-Math.max(0,(now-this.lastInput)/1000)*TOUR_INPUT.inertiaDamping);
    if(Math.abs(this.coast)<.015||this.reduced)this.snap();
  }
  snap(){this.coast=0;this.spring.target=TOUR_POSES[nearestPose(this.spring.target)].progress;if(this.reduced){this.spring.value=this.spring.target;this.spring.velocity=0;}}
  to(progress){this.held=false;this.wheelUntil=0;this.coast=0;this.inputVelocity=0;this.spring.target=clamp(progress,0,1);if(this.reduced){this.spring.value=this.spring.target;this.spring.velocity=0;}}
  advance(direction){
    const target=this.spring.target;
    const pose=direction>0?TOUR_POSES.find(p=>p.progress>target+1e-5):[...TOUR_POSES].reverse().find(p=>p.progress<target-1e-5);
    this.to(pose?.progress??(direction>0?1:0));
  }
  setReduced(value){this.reduced=value;if(value){this.snap();this.spring.value=this.spring.target;this.spring.velocity=0;}}
  step(dt,now){
    if(this.wheelUntil&&now>=this.wheelUntil)this.end(false,now);
    if(this.coast){
      const decay=Math.exp(-TOUR_INPUT.inertiaDamping*dt),raw=this.coast*(1-decay)/TOUR_INPUT.inertiaDamping,delta=Math.sign(raw)*Math.min(Math.abs(raw),Math.max(0,TOUR_INPUT.maxCoast-this.coasted));
      this.coasted+=Math.abs(delta);this.spring.target=clamp(this.spring.target+delta,0,1);this.coast*=decay;
      if(this.coasted+1e-9>=TOUR_INPUT.maxCoast||Math.abs(this.coast)<.015)this.snap();
    }
    const changed=this.spring.step(dt,this.reduced);
    if(this.spring.value<0||this.spring.value>1){this.spring.value=clamp(this.spring.value,0,1);this.spring.velocity=0;}
    return changed;
  }
  snapshot(){return{progress:this.progress,target:this.spring.target,velocity:this.spring.velocity,phase:this.phase,stage:nearestPose(this.progress),needsFrame:this.needsFrame};}
}
