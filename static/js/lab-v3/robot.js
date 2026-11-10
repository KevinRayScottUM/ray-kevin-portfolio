import { THREE, mesh, clamp } from "./graphics.js";
import * as CANNON from "../../vendor/cannon-es/cannon-es.js";

export function solveArm(base, target, lengths = [.46, .44]) {
  const delta = target.clone().sub(base);
  const horizontal = Math.hypot(delta.x, delta.z);
  const yaw = Math.atan2(delta.z, delta.x);
  const distance = clamp(delta.length(), .055, lengths[0] + lengths[1] - .002);
  const elevation = Math.atan2(delta.y, horizontal);
  const shoulder = elevation + Math.acos(clamp((lengths[0]**2 + distance**2 - lengths[1]**2) / (2*lengths[0]*distance), -1, 1));
  const elbow = Math.acos(clamp((distance**2 - lengths[0]**2 - lengths[1]**2)/(2*lengths[0]*lengths[1]), -1, 1));
  return { yaw, shoulder, elbow, reachable: delta.length() <= lengths[0] + lengths[1] };
}

export function forwardArm(base, angles, lengths = [.46, .44]) {
  const { yaw, shoulder, elbow } = angles;
  const radial = new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw));
  const joint = base.clone().addScaledVector(radial, lengths[0]*Math.cos(shoulder));
  joint.y += lengths[0]*Math.sin(shoulder);
  const hand = joint.clone().addScaledVector(radial, lengths[1]*Math.cos(shoulder-elbow));
  hand.y += lengths[1]*Math.sin(shoulder-elbow);
  return { joint, hand };
}

export class RobotArm {
  constructor(index, scene, physics) {
    this.index = index;
    this.id = index ? "robot-right" : "robot-left";
    this.root = new THREE.Group();
    this.root.name = this.id;
    scene.add(this.root);
    this.base = new THREE.Vector3(index ? .52 : -.52, .25, -.12);
    this.target = new THREE.Vector3(index ? .32 : -.32, .60, .03);
    this.hand = this.target.clone();
    this.opening = .1;
    this.tilt = 0;
    this.orientation = new THREE.Quaternion();
    this.angles = solveArm(this.base, this.target);
    const make = (geometry, color, name, parent = this.root) => mesh(geometry, color, this.id+"."+name, parent, { arm: index });
    const base = make(new THREE.CylinderGeometry(.075,.085,.055,12), "#37454e", "base");
    base.position.set(this.base.x,.1075,this.base.z);
    const pedestal = make(new THREE.CylinderGeometry(.042,.055,.12,12), "#dee5e8", "pedestal");
    pedestal.position.set(this.base.x,.19,this.base.z);
    this.links = [make(new THREE.CylinderGeometry(.030,.037,1,10),"#dce4e8","upper-link"), make(new THREE.CylinderGeometry(.024,.030,1,10),"#d5e0e4","fore-link")];
    this.joints = [0,1,2].map(i => make(new THREE.SphereGeometry(i===1?.043:.035,10,7),"#405665","joint-"+i));
    this.gripper = new THREE.Group();
    this.gripper.name = this.id+".gripper";
    this.gripper.userData={id:this.gripper.name,arm:index};
    this.root.add(this.gripper);
    const palm = make(new THREE.BoxGeometry(.065,.035,.045), "#2e3a46", "palm",this.gripper);
    palm.position.y=.025;
    this.fingers = [-1,1].map(sign=>{
      const finger=make(new THREE.BoxGeometry(.010,.052,.026),index?"#4385a1":"#d38c72","finger-"+sign,this.gripper);
      finger.position.y=-.005;
      return finger;
    });
    this.body=new CANNON.Body({mass:0,type:CANNON.Body.KINEMATIC,shape:new CANNON.Box(new CANNON.Vec3(.023,.014,.020)),collisionFilterGroup:4,collisionFilterMask:1});
    this.body.tcId=this.id+".gripper";
    physics.addBody(this.body);
    this.pose(1, 1);
  }
  pose(dt, speed) {
    const goal=this.target.clone();
    goal.x=clamp(goal.x,-.78,.78); goal.y=clamp(goal.y,.105,.88); goal.z=clamp(goal.z,-.43,.43);
    const move=goal.sub(this.hand);
    const amount=Math.min(move.length(),Math.max(.001,speed)*dt);
    const old=this.hand.clone();
    if(move.lengthSq()>1e-12) this.hand.addScaledVector(move.normalize(),amount);
    this.angles=solveArm(this.base,this.hand);
    const {joint,hand}=forwardArm(this.base,this.angles);
    this.hand.copy(hand);
    const up=new THREE.Vector3(0,1,0);
    [[this.base,joint],[joint,this.hand]].forEach(([a,b],i)=>{
      this.links[i].position.copy(a).lerp(b,.5);
      this.links[i].scale.y=a.distanceTo(b);
      this.links[i].quaternion.setFromUnitVectors(up,b.clone().sub(a).normalize());
    });
    [this.base,joint,this.hand].forEach((p,i)=>this.joints[i].position.copy(p));
    this.orientation.setFromAxisAngle(new THREE.Vector3(0,0,1),this.tilt);
    this.gripper.position.copy(this.hand);
    this.gripper.quaternion.copy(this.orientation);
    this.fingers.forEach((finger,i)=>{finger.position.x=(i?1:-1)*(.014+this.opening*.025);});
    this.body.position.set(old.x,old.y,old.z);
    this.body.quaternion.set(this.orientation.x,this.orientation.y,this.orientation.z,this.orientation.w);
    this.body.velocity.set((this.hand.x-old.x)/dt,(this.hand.y-old.y)/dt,(this.hand.z-old.z)/dt);
    this.body.aabbNeedsUpdate=true;
  }
  setJoint(name, value) {
    const limits={yaw:[-Math.PI,Math.PI],shoulder:[-.2,2.8],elbow:[.05,2.9]};
    if(!limits[name]) return;
    this.angles[name]=clamp(value,...limits[name]);
    this.target.copy(forwardArm(this.base,this.angles).hand);
  }
  snapshot() { return {target:this.target.toArray(),hand:this.hand.toArray(),opening:this.opening,tilt:this.tilt,angles:{...this.angles}}; }
  restore(state) {
    this.target.fromArray(state.target); this.hand.fromArray(state.hand); this.opening=state.opening; this.tilt=state.tilt;
    const target=this.target.clone();this.target.copy(this.hand);
    this.pose(1/60,0);
    this.target.copy(target);
  }
}
