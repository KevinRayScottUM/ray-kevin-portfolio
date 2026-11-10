import {THREE,clamp} from "./graphics.js";

// Exact critically damped integration, stable across variable frame lengths.
export class Spring {
  constructor(value=0,frequency=20){this.value=value;this.target=value;this.velocity=0;this.frequency=frequency;}
  step(dt,reduced=false){
    const before=this.value;if(reduced){this.value=this.target;this.velocity=0;return before!==this.value;}
    const displacement=this.value-this.target,term=this.velocity+this.frequency*displacement,decay=Math.exp(-this.frequency*Math.max(0,dt));
    this.value=this.target+(displacement+term*dt)*decay;this.velocity=(this.velocity-this.frequency*term*dt)*decay;
    if(Math.abs(this.value-this.target)<1e-5&&Math.abs(this.velocity)<1e-4){this.value=this.target;this.velocity=0;}
    return before!==this.value;
  }
}

export class HoverTilt {
  constructor(yaw=10,pitch=8,frequency=22){this.yawLimit=THREE.MathUtils.degToRad(yaw);this.pitchLimit=THREE.MathUtils.degToRad(pitch);this.yaw=new Spring(0,frequency);this.pitch=new Spring(0,frequency);}
  point(x,y,reduced=false){this.yaw.target=reduced?0:clamp(x,-1,1)*this.yawLimit;this.pitch.target=reduced?0:clamp(y,-1,1)*this.pitchLimit;}
  clear(){this.yaw.target=0;this.pitch.target=0;}
  step(dt,reduced=false){const a=this.yaw.step(dt,reduced),b=this.pitch.step(dt,reduced);return a||b;}
  get settled(){return this.yaw.value===this.yaw.target&&this.pitch.value===this.pitch.target;}
}

export const FACE_MOTION={threshold:110*Math.PI/180,flickAngle:62*Math.PI/180,flickDistance:120,flickVelocity:850,duration:.40,pitchLimit:12*Math.PI/180};
const ease=t=>t*t*t*(t*(t*6-15)+10);
export class FaceController {
  constructor(root){this.root=root;this.face="front";this.yaw=0;this.pitch=0;this.hover=new HoverTilt(4,3,17);this.drag=null;this.snap=null;this.locked=false;this.revision=0;this.apply();}
  get settled(){return !this.drag&&!this.snap&&this.hover.settled;}
  get transferReady(){return this.face==="front"&&!this.drag&&!this.snap&&Math.abs(this.yaw%(2*Math.PI))<1e-6&&this.pitch===0&&this.hover.yaw.value===0&&this.hover.pitch.value===0;}
  apply(){this.root.quaternion.setFromEuler(new THREE.Euler(this.pitch+this.hover.pitch.value,this.yaw+this.hover.yaw.value,0,"XYZ"));this.root.updateMatrixWorld(true);}
  point(x,y,reduced=false){if(!this.drag&&!this.snap&&!this.locked)this.hover.point(x,y,reduced);}
  clearHover(){this.hover.clear();}
  lock(){this.locked=true;}
  unlock(){this.locked=false;this.hover.clear();}
  begin(now=0){
    this.yaw+=this.hover.yaw.value;this.pitch+=this.hover.pitch.value;
    for(const spring of [this.hover.yaw,this.hover.pitch]){spring.value=0;spring.target=0;spring.velocity=0;}
    this.snap=null;this.locked=false;this.drag={yaw:this.yaw,pitch:this.pitch,dx:0,dy:0,velocity:0,last:now,committed:false,direction:1};
  }
  move(dx,dy,width,now){
    if(!this.drag)return;const d=this.drag,elapsed=Math.max(.008,(now-d.last)/1000);d.last=now;d.dx+=dx;d.dy+=dy;d.velocity=d.velocity*.45+dx/elapsed*.55;
    const angle=d.dx/Math.max(320,width)*Math.PI*1.65;
    this.yaw=d.yaw+clamp(angle,-Math.PI*1.12,Math.PI*1.12);this.pitch=clamp(d.pitch+d.dy*.004,-FACE_MOTION.pitchLimit,FACE_MOTION.pitchLimit);
    if(!d.committed&&Math.abs(angle)>=FACE_MOTION.threshold){d.committed=true;d.direction=Math.sign(angle)||1;}
    this.revision++;this.apply();
  }
  end(cancel=false){
    if(!this.drag)return;const d=this.drag,angle=this.yaw-d.yaw;
    const flick=Math.abs(angle)>=FACE_MOTION.flickAngle&&Math.abs(d.dx)>=FACE_MOTION.flickDistance&&Math.abs(d.velocity)>=FACE_MOTION.flickVelocity;
    let face=this.face,direction=d.direction;
    if(!cancel&&(d.committed||flick)){face=this.face==="front"?"back":"front";direction=d.committed?direction:Math.sign(angle)||1;}
    this.drag=null;this.toFace(face,direction);
  }
  toFace(face,direction=0){
    this.drag=null;this.locked=false;this.hover.clear();
    const base=face==="back"?Math.PI:0;let end=base+Math.round((this.yaw-base)/(2*Math.PI))*2*Math.PI;
    if(Math.abs(Math.abs(end-this.yaw)-Math.PI)<1e-6&&direction<0)end=this.yaw-Math.PI;
    this.face=face;this.snap={elapsed:0,startYaw:this.yaw,startPitch:this.pitch,endYaw:end};
  }
  update(dt,reduced=false){
    let changed=false;
    if(this.snap&&!this.locked){const s=this.snap;s.elapsed+=dt;const t=reduced?1:clamp(s.elapsed/FACE_MOTION.duration,0,1),f=ease(t);this.yaw=s.startYaw+(s.endYaw-s.startYaw)*f;this.pitch=s.startPitch*(1-f);if(t===1){this.yaw=s.endYaw;this.pitch=0;this.snap=null;}changed=true;}
    if(!this.locked&&!this.drag)changed=this.hover.step(dt,reduced)||changed;
    if(changed){this.revision++;this.apply();}return changed;
  }
  reset(){this.face="front";this.yaw=0;this.pitch=0;this.drag=null;this.snap=null;this.locked=false;for(const s of [this.hover.yaw,this.hover.pitch]){s.value=0;s.target=0;s.velocity=0;}this.revision++;this.apply();}
}
