import * as CANNON from "../../vendor/cannon-es/cannon-es.js";
import { THREE, mesh, clamp, QUALITY } from "./graphics.js";
import { RobotArm } from "./robot.js";

const vector = value => new THREE.Vector3(value.x,value.y,value.z);
const cannon = value => new CANNON.Vec3(value.x,value.y,value.z);
const UP = new THREE.Vector3(0,1,0);
export const STEP = 1/60;
export const DEFAULTS = {gravity:9.81,friction:.45,damping:.2,stiffness:40,speed:.35,resolution:16,seed:7,quality:"balanced",solverIterations:null,contactStiffness:1e7,timeScale:1};

export function insertionMetrics(center, quaternion, length, target, targetQuaternion, radius, holeRadius, depth) {
  const axis=UP.clone().applyQuaternion(quaternion);
  const normal=UP.clone().applyQuaternion(targetQuaternion);
  const tip=center.clone().addScaledVector(axis,-length/2);
  const local=tip.clone().sub(target).applyQuaternion(targetQuaternion.clone().invert());
  const radial=Math.hypot(local.x,local.z);
  const angle=Math.acos(clamp(axis.dot(normal),-1,1));
  const valid=radial+radius<=holeRadius && angle<.15;
  const insertion=valid?clamp(-local.y,0,depth):0;
  return {radialError:radial,angularError:angle,insertionDepth:insertion,valid,tip:tip.toArray(),success:valid&&insertion>=depth*.75};
}

export function crossingRing(previous, current, center, normal, radius) {
  const a=previous.clone().sub(center),b=current.clone().sub(center);
  const da=a.dot(normal),db=b.dot(normal);
  if(da>=0||db<0||Math.abs(db-da)<1e-9) return false;
  const hit=a.lerp(b,-da/(db-da));
  return hit.addScaledVector(normal,-hit.dot(normal)).length()<radius;
}

export function containedInBox(center, halfSize, boxCenter, boxHalf) {
  return Math.abs(center.x-boxCenter.x)+halfSize.x<=boxHalf.x && Math.abs(center.z-boxCenter.z)+halfSize.z<=boxHalf.z && center.y-halfSize.y>=boxCenter.y-.008 && center.y+halfSize.y<=boxCenter.y+boxHalf.y*2;
}

export class WorldSimulator {
  constructor(task="cloth",parameters={},snapshot=null) {
    this.task=task;
    this.parameters={...DEFAULTS,...parameters};
    this.time=0; this.auto=false; this.autoPhase=0; this.autoWait=0; this.autoObject=0;
    this.action="Idle"; this.goalProgress=0; this.blocked=false;
    this.scene=new THREE.Group(); this.scene.name="Simulated world";
    this.physics=new CANNON.World({gravity:new CANNON.Vec3(0,-this.parameters.gravity,0)});
    this.physics.allowSleep=true;
    this.physics.solver.iterations=this.parameters.solverIterations||QUALITY[this.parameters.quality].iterations;
    this.physics.solver.tolerance=.0001;
    this.physics.broadphase=new CANNON.SAPBroadphase(this.physics);
    this.physics.defaultContactMaterial.friction=this.parameters.friction;
    this.physics.defaultContactMaterial.contactEquationStiffness=this.parameters.contactStiffness;
    this.physics.defaultContactMaterial.restitution=.01;
    this.records=new Map(); this.particleBodies=[]; this.structural=[]; this.grasps=[null,null];
    this.manipulables=[]; this.transients=[];
    this.addBox("worktable",[1.7,.08,1],[0,.04,0],"#e4ebed",0);
    const floor=this.addBox("floor",[2.6,.02,1.8],[0,-.075,0],"#eef2f3",0);
    floor.group.userData.floor=true;
    floor.group.children[0].userData.floor=true;
    this.grid=new THREE.Group(); this.scene.add(this.grid);
    for(let i=-8;i<=8;i++) {
      const x=mesh(new THREE.BoxGeometry(2.5,.001,.001),"#d6dfe3","grid.x"+i,this.grid,{overlay:true});x.position.set(0,-.063,i*.1);
      const z=mesh(new THREE.BoxGeometry(.001,.001,1.7),"#d6dfe3","grid.z"+i,this.grid,{overlay:true});z.position.set(i*.15,-.063,0);
    }
    this.axes=new THREE.Group(); this.scene.add(this.axes); this.axes.visible=false;
    [["#c85c57",[.25,.001,.001],[.125,.082,0]],["#438565",[.001,.25,.001],[0,.207,0]],["#4f86b0",[.001,.001,.25],[0,.082,.125]]].forEach(([color,size,pos],i)=>{
      const axis=mesh(new THREE.BoxGeometry(...size),color,"axis-"+i,this.axes,{overlay:true});axis.position.fromArray(pos);
    });
    this.arms=[new RobotArm(0,this.scene,this.physics),new RobotArm(1,this.scene,this.physics)];
    this.arms.forEach(arm=>this.records.set(arm.body.tcId,{id:arm.body.tcId,body:arm.body,group:arm.gripper,robot:true}));
    if(task!=="cloth") this.arms[1].root.visible=task==="rope";
    if(task==="cloth") this.createCloth();
    if(task==="plug"||task==="marker") this.createInsertion(task);
    if(task==="pusht") this.createPushT();
    if(task==="box") this.createPacking();
    if(task==="rope") this.createRope();
    this.updateGeometry();
    if(snapshot) this.restore(snapshot);
  }
  body(id,shape,position,mass=0) {
    const body=new CANNON.Body({mass,shape,position:new CANNON.Vec3(...position),linearDamping:this.parameters.damping,angularDamping:.3,allowSleep:true,sleepSpeedLimit:.035,sleepTimeLimit:.4});
    body.tcId=id;
    this.physics.addBody(body);
    const group=new THREE.Group();group.name=id;group.userData={id};this.scene.add(group);
    const record={id,body,group};this.records.set(id,record);
    return record;
  }
  addBox(id,size,position,color,mass=0) {
    const record=this.body(id,new CANNON.Box(new CANNON.Vec3(...size.map(v=>v/2))),position,mass);
    record.half=new THREE.Vector3(...size).multiplyScalar(.5);
    mesh(new THREE.BoxGeometry(...size),color,id+".surface",record.group,{bodyId:id});
    return record;
  }
  addCylinder(id,radius,length,position,color,mass=.08) {
    const record=this.body(id,new CANNON.Cylinder(radius,radius,length,12),position,mass);
    record.radius=radius; record.length=length;
    mesh(new THREE.CylinderGeometry(radius,radius,length,14),color,id+".surface",record.group,{bodyId:id});
    return record;
  }
  particle(id,position,radius=.006) {
    const record=this.body(id,new CANNON.Sphere(radius),position,.003);
    record.body.collisionFilterGroup=2;record.body.collisionFilterMask=1;
    record.body.allowSleep=false;
    record.particle=true; this.particleBodies.push(record.body);
    return record.body;
  }
  distance(a,b,rest) {
    const constraint=new CANNON.DistanceConstraint(a,b,rest,this.parameters.stiffness);
    this.physics.addConstraint(constraint);
    this.structural.push({constraint,a,b,rest});
  }
  createCloth() {
    this.columns=this.parameters.resolution;
    this.rows=Math.round(this.columns*10/16);
    const positions=new Float32Array(this.columns*this.rows*3),indices=[];
    const width=.64,height=.42;
    for(let row=0;row<this.rows;row++) for(let col=0;col<this.columns;col++) {
      const id=row*this.columns+col;
      this.particle("cloth.node-"+id,[-width/2+col*width/(this.columns-1),.60-row*height/(this.rows-1),.03],.003);
      if(row<this.rows-1&&col<this.columns-1) indices.push(id,id+this.columns,id+1,id+1,id+this.columns,id+this.columns+1);
    }
    for(let row=0;row<this.rows;row++) for(let col=0;col<this.columns;col++) {
      const index=row*this.columns+col,a=this.particleBodies[index];
      for(const [dc,dr] of [[1,0],[0,1],[1,1],[-1,1],[2,0],[0,2]]) {
        if(col+dc<0||col+dc>=this.columns||row+dr>=this.rows) continue;
        const b=this.particleBodies[(row+dr)*this.columns+col+dc];
        this.distance(a,b,a.position.distanceTo(b.position));
      }
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute("position",new THREE.BufferAttribute(positions,3));geometry.setIndex(indices);
    this.cloth=mesh(geometry,"#4186b5","cloth.surface",this.scene,{deformable:true});
    this.attachParticle(0,0);this.attachParticle(1,this.columns-1);
  }
  createInsertion(task) {
    const marker=task==="marker";
    const radius=marker?.009:.028,length=marker?.24:.13;
    const object=this.addCylinder(marker?"marker":"peg",radius,length,[-.25,marker?.105:.08+length/2,.17],marker?"#d08888":"#b6cbd5");
    if(marker) object.body.quaternion.setFromEuler(0,0,Math.PI/2);
    this.manipulables.push(object);
    this.tool=object;
    this.target=new THREE.Vector3(.23,marker?.205:.23,.03);
    this.targetQuaternion=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),marker?.22:0);
    this.holeRadius=radius+(marker?.006:.009);
    this.socketDepth=marker?.085:.12;
    this.socketOuter=marker?.037:.075;
    const holder=this.body("socket",null,this.target.toArray(),0);
    holder.body.quaternion.set(...this.targetQuaternion.toArray());
    const count=20;
    const wall=(this.socketOuter-this.holeRadius)/2,centerRadius=(this.socketOuter+this.holeRadius)/2;
    for(let i=0;i<count;i++) {
      const angle=i*Math.PI*2/count;
      const shape=new CANNON.Box(new CANNON.Vec3(wall,this.socketDepth/2,centerRadius*Math.sin(Math.PI/count)*1.05));
      const q=new CANNON.Quaternion();q.setFromEuler(0,-angle,0);
      holder.body.addShape(shape,new CANNON.Vec3(centerRadius*Math.cos(angle),-this.socketDepth/2,centerRadius*Math.sin(angle)),q);
    }
    holder.body.addShape(new CANNON.Box(new CANNON.Vec3(this.socketOuter,.008,this.socketOuter)),new CANNON.Vec3(0,-this.socketDepth-.008,0));
    const shape=new THREE.LatheGeometry([[this.holeRadius,0],[this.socketOuter,0],[this.socketOuter,-this.socketDepth],[this.holeRadius,-this.socketDepth],[this.holeRadius,0]].map(p=>new THREE.Vector2(...p)),24);
    mesh(shape,marker?"#bac9c1":"#cdd5d9","socket.wall",holder.group,{bodyId:"socket"});
    const tip=mesh(new THREE.ConeGeometry(radius,marker?.024:.008,12),marker?"#303d47":"#95aebb",object.id+".tip",object.group,{bodyId:object.id});
    tip.rotation.z=Math.PI;tip.position.y=-length/2+.004;
    this.arms[0].target.set(-.25,.40,.17);this.arms[0].opening=1;
  }
  createPushT() {
    const record=this.body("t-body",null,[-.12,.115,.08],.18);
    record.body.addShape(new CANNON.Box(new CANNON.Vec3(.12,.028,.04)),new CANNON.Vec3(0,0,-.065));
    record.body.addShape(new CANNON.Box(new CANNON.Vec3(.035,.028,.09)),new CANNON.Vec3(0,0,.025));
    record.body.linearFactor.set(1,0,1);record.body.angularFactor.set(0,1,0);
    record.body.linearDamping=.12;record.body.angularDamping=.18;
    const top=mesh(new THREE.BoxGeometry(.24,.056,.08),"#d5b687","t-body.crossbar",record.group,{bodyId:record.id});top.position.z=-.065;
    const stem=mesh(new THREE.BoxGeometry(.07,.056,.18),"#d5b687","t-body.stem",record.group,{bodyId:record.id});stem.position.z=.025;
    this.tool=record;
    this.target=new THREE.Vector3(.25,.115,.08);this.goalYaw=.35;
    const goal=new THREE.Group();goal.position.copy(this.target);goal.rotation.y=this.goalYaw;this.scene.add(goal);
    const goalTop=mesh(new THREE.BoxGeometry(.24,.002,.08),"#bfd6c5","goal.crossbar",goal,{overlay:true});goalTop.position.set(0,-.031,-.065);
    const goalStem=mesh(new THREE.BoxGeometry(.07,.002,.18),"#bfd6c5","goal.stem",goal,{overlay:true});goalStem.position.set(0,-.031,.025);
    this.arms[0].target.set(-.36,.12,.08);this.arms[0].opening=.1;
  }
  createPacking() {
    this.containerCenter=new THREE.Vector3(.23,.095,.03);
    this.containerHalf=new THREE.Vector3(.16,.09,.18);
    const [x,y,z]=this.containerCenter.toArray();
    this.addBox("container.bottom",[.34,.03,.38],[x,y-.015,z],"#b8c6cc");
    [[.34,.17,.018,x,y+.07,z-.19],[.34,.17,.018,x,y+.07,z+.19],[.018,.17,.38,x-.17,y+.07,z],[.018,.17,.38,x+.17,y+.07,z]].forEach((a,i)=>this.addBox("container.wall-"+i,a.slice(0,3),a.slice(3),"#cad6dc"));
    [[-.30,.13,.20],[-.27,.13,-.08],[-.10,.13,.27]].forEach((p,i)=>{
      const record=this.addBox("packing-"+i,[.065,.065,.065],p,["#83b8b0","#c4a3ba","#c9b184"][i],.10);
      this.manipulables.push(record);
    });
    this.arms[0].target.set(-.30,.42,.20);this.arms[0].opening=1;
  }
  createRope() {
    const count=this.parameters.quality==="low"?24:this.parameters.quality==="high"?48:36;
    for(let i=0;i<count;i++) {
      const t=i/(count-1);
      this.particle("rope.node-"+i,[-.32-.12*Math.sin(t*Math.PI),.60-.42*t,.03+.22*t],.006);
      if(i) this.distance(this.particleBodies[i-1],this.particleBodies[i],.70/(count-1));
    }
    this.ropeSegments=[];
    for(let i=0;i<count-1;i++) this.ropeSegments.push(mesh(new THREE.CylinderGeometry(.006,.006,1,6),"#cbb76f","rope.segment-"+i,this.scene,{deformable:true}));
    this.ringCenter=new THREE.Vector3(.12,.40,.03);this.ringNormal=new THREE.Vector3(1,0,0);this.ringRadius=.105;
    const ring=this.body("ring",null,this.ringCenter.toArray(),0);
    for(let i=0;i<20;i++) {
      const a=i*Math.PI*2/20;
      ring.body.addShape(new CANNON.Sphere(.012),new CANNON.Vec3(0,Math.sin(a)*this.ringRadius,Math.cos(a)*this.ringRadius));
    }
    const shape=mesh(new THREE.TorusGeometry(this.ringRadius,.012,6,28),"#9ebac3","ring.surface",ring.group,{bodyId:"ring"});shape.rotation.y=Math.PI/2;
    this.addBox("ring.stand",[.025,.23,.025],[.12,.195,.03],"#bccbd1");
    this.attachParticle(0,0);
    this.arms[1].target.set(-.40,.25,.25);this.arms[1].opening=1;
    this.previousEndpoint=vector(this.particleBodies[0].position);
    this.threaded=false;
  }
  attachParticle(armIndex,particleIndex) {
    this.release(armIndex);
    const body=this.particleBodies[particleIndex];
    body.wakeUp();
    const constraint=new CANNON.PointToPointConstraint(this.arms[armIndex].body,new CANNON.Vec3(),body,new CANNON.Vec3(),30);
    constraint.collideConnected=false;
    this.physics.addConstraint(constraint);
    this.grasps[armIndex]={kind:"particle",particleIndex,bodyId:body.tcId,constraint};
    this.arms[armIndex].opening=.1;
  }
  release(armIndex) {
    if(this.grasps[armIndex]) {
      this.physics.removeConstraint(this.grasps[armIndex].constraint);
      this.records.get(this.grasps[armIndex].bodyId)?.body.wakeUp();
    }
    this.grasps[armIndex]=null;
  }
  updateGrasps() {
    this.arms.forEach((arm,index)=>{
      if(arm.opening>.65) {this.release(index);return;}
      if(this.grasps[index]) {this.records.get(this.grasps[index].bodyId)?.body.wakeUp();return;}
      if(arm.opening>.25||!arm.root.visible) return;
      if(this.particleBodies.length) {
        let closest=-1,distance=.075;
        this.particleBodies.forEach((body,i)=>{const d=vector(body.position).distanceTo(arm.hand);if(d<distance&&!this.grasps.some(g=>g?.particleIndex===i)){distance=d;closest=i;}});
        if(closest>=0) this.attachParticle(index,closest);
      } else {
        const candidates=this.manipulables.filter(record=>!this.grasps.some(g=>g?.bodyId===record.id));
        candidates.sort((a,b)=>vector(a.body.position).distanceTo(arm.hand)-vector(b.body.position).distanceTo(arm.hand));
        const record=candidates[0];
        if(record&&vector(record.body.position).distanceTo(arm.hand)<.075) {
          record.body.wakeUp();
          const constraint=new CANNON.LockConstraint(arm.body,record.body,{maxForce:60});constraint.collideConnected=false;
          this.physics.addConstraint(constraint);
          this.grasps[index]={kind:"rigid",bodyId:record.id,constraint};
        }
      }
    });
  }
  applyAction(action) {
    this.auto=false;
    const arm=this.arms[action.arm||0];
    if(action.target) arm.target.fromArray(action.target);
    if(Number.isFinite(action.tilt)) arm.tilt=action.tilt;
    if(Number.isFinite(action.opening)) arm.opening=clamp(action.opening,0,1);
    this.action="Manual target";
  }
  command(name) {
    this.action=name;
    if(name==="release") {this.arms.forEach((arm,i)=>{arm.opening=1;this.release(i);});this.auto=false;return;}
    if(this.task==="cloth"&&name!=="auto") {
      this.auto=false;
      if(name==="lift") this.arms.forEach((arm,i)=>arm.target.set(i?.32:-.32,.72,.03));
      if(name==="stretch") this.arms.forEach((arm,i)=>arm.target.set(i?.41:-.41,.60,.03));
      if(name==="fold") {this.arms[0].target.set(.02,.62,.03);this.arms[1].target.set(.07,.62,.04);}
      return;
    }
    this.auto=true;this.autoPhase=0;this.autoWait=0;this.plan=null;
  }
  autoControl(dt) {
    if(!this.auto) return;
    if(this.task==="cloth") {this.command("fold");return;}
    const arm=this.arms[0];
    if(this.task==="pusht") {
      const p=vector(this.tool.body.position),direction=this.target.clone().sub(p);direction.y=0;
      if(direction.length()<.045) {this.auto=false;this.action="Position region reached; check orientation";arm.target.y=.3;return;}
      direction.normalize();
      const yaw=new THREE.Euler().setFromQuaternion(new THREE.Quaternion(...this.tool.body.quaternion.toArray()),"YXZ").y;
      const lateral=new THREE.Vector3(-direction.z,0,direction.x).multiplyScalar(clamp(this.goalYaw-yaw,-1,1)*.065);
      const behind=p.clone().addScaledVector(direction,-.16).add(lateral);behind.y=.115;
      if(this.autoPhase===0) {arm.target.copy(behind);if(arm.hand.distanceTo(behind)<.035)this.autoPhase=1;}
      else {arm.target.copy(p).addScaledVector(direction,.08).add(lateral);arm.target.y=.115;}
      this.action="Contact push";return;
    }
    if(this.task==="rope") {
      if(!this.plan) this.plan=[{p:[-.12,.52,.03],o:.1,t:0},{p:[.06,.40,.03],o:.1,t:0},{p:[.34,.40,.03],o:.1,t:0},{p:[.35,.48,.03],o:.1,t:0}];
    } else if(!this.plan) {
      const record=this.task==="box"?this.manipulables[this.autoObject%this.manipulables.length]:this.tool;
      const p=vector(record.body.position);
      const marker=this.task==="marker",angle=marker?.22:0;
      const goal=this.task==="box"?this.containerCenter.clone().add(new THREE.Vector3((this.autoObject-1)*.085,.045,0)):this.target.clone().add(new THREE.Vector3(0,-this.socketDepth*.85+record.length/2,0).applyQuaternion(this.targetQuaternion));
      const initialTilt=marker?Math.PI/2:0;
      this.plan=[{p:[p.x,.43,p.z],o:1,t:initialTilt},{p:p.toArray(),o:1,t:initialTilt},{p:p.toArray(),o:.1,t:initialTilt},{p:[p.x,.48,p.z],o:.1,t:angle},{p:[goal.x,.48,goal.z],o:.1,t:angle},{p:goal.toArray(),o:.1,t:angle},{p:goal.toArray(),o:1,t:angle},{p:[goal.x,.48,goal.z],o:1,t:angle}];
    }
    // Compensate the measured grasp offset after lifting and reorientation.
    if(this.autoPhase===4&&this.task!=="rope"&&this.task!=="pusht"&&!this.plan[4].calibrated) {
      const record=this.task==="box"?this.manipulables[this.autoObject]:this.tool;
      const offset=vector(record.body.position).sub(arm.hand);
      for(const index of [4,5,6,7])this.plan[index].p=this.plan[index].p.map((value,axis)=>value-offset.getComponent(axis));
      this.plan[4].calibrated=true;
    }
    const waypoint=this.plan[this.autoPhase];
    if(!waypoint) {
      if(this.task==="box"&&this.autoObject<2) {this.autoObject++;this.autoPhase=0;this.plan=null;return;}
      this.auto=false;this.action="Sequence complete";return;
    }
    arm.target.fromArray(waypoint.p);arm.opening=waypoint.o;
    arm.tilt+=clamp(waypoint.t-arm.tilt,-dt*1.3,dt*1.3);
    this.action="Waypoint "+(this.autoPhase+1)+" / "+this.plan.length;
    if(arm.hand.distanceTo(arm.target)<.022&&Math.abs(arm.tilt-waypoint.t)<.05) this.autoWait+=dt;
    else this.autoWait=0;
    if(this.autoWait>.35) {this.autoPhase++;this.autoWait=0;}
  }
  constrainInsertion() {
    if(this.task!=="plug"&&this.task!=="marker") return;
    const object=this.tool,position=vector(object.body.position),quaternion=new THREE.Quaternion(...object.body.quaternion.toArray());
    const metrics=insertionMetrics(position,quaternion,object.length,this.target,this.targetQuaternion,object.radius,this.holeRadius,this.socketDepth);
    const tip=new THREE.Vector3(...metrics.tip).sub(this.target).applyQuaternion(this.targetQuaternion.clone().invert());
    this.blocked=tip.y<0&&tip.y>-this.socketDepth-.08&&metrics.radialError<this.socketOuter+object.radius&&!metrics.valid;
    if(this.blocked) {
      const normal=UP.clone().applyQuaternion(this.targetQuaternion);
      position.addScaledVector(normal,-tip.y+.001);
      object.body.position.copy(cannon(position));
      const speed=vector(object.body.velocity),into=speed.dot(normal);
      if(into<0) object.body.velocity.copy(cannon(speed.addScaledVector(normal,-into)));
      object.body.aabbNeedsUpdate=true;
    }
  }
  step(dt=STEP) {
    if(Math.abs(dt-STEP)>1e-8) throw new Error("WorldSimulator requires a fixed 1/60-second timestep");
    this.autoControl(dt);
    this.arms.forEach(arm=>{arm.pose(dt,this.parameters.speed);arm.body.collisionFilterMask=arm.root.visible&&arm.opening<=.65?1:0;});
    this.updateGrasps();
    this.physics.gravity.set(0,-this.parameters.gravity,0);
    this.physics.defaultContactMaterial.friction=this.parameters.friction;
    this.physics.defaultContactMaterial.contactEquationStiffness=this.parameters.contactStiffness;
    this.physics.solver.iterations=this.parameters.solverIterations||QUALITY[this.parameters.quality].iterations;
    this.physics.bodies.forEach(body=>{if(body.mass>0)body.linearDamping=this.parameters.damping;});
    if(this.task==="pusht") {
      const body=this.tool.body,speed=Math.hypot(body.velocity.x,body.velocity.z);
      const drag=Math.min(body.mass/dt,body.mass*this.parameters.friction*this.parameters.gravity/Math.max(.02,speed));
      body.applyForce(new CANNON.Vec3(-body.velocity.x*drag,0,-body.velocity.z*drag));
    }
    this.structural.forEach(({constraint})=>constraint.equations.forEach(equation=>{equation.minForce=-this.parameters.stiffness;equation.maxForce=this.parameters.stiffness;}));
    this.physics.step(dt);
    this.constrainInsertion();
    this.time+=dt;
    if(this.task==="rope") {
      const current=vector(this.particleBodies[0].position);
      if(crossingRing(this.previousEndpoint,current,this.ringCenter,this.ringNormal,this.ringRadius-.018)) this.threaded=true;
      this.previousEndpoint.copy(current);
    }
    for(const body of this.physics.bodies) if(![body.position.x,body.position.y,body.position.z].every(Number.isFinite)) throw new Error("Non-finite state: "+body.tcId);
    this.updateGeometry();
  }
  updateGeometry() {
    for(const record of this.records.values()) {
      if(record.robot) continue;
      record.group.position.copy(vector(record.body.position));
      record.group.quaternion.set(...record.body.quaternion.toArray());
    }
    if(this.cloth) {
      const attribute=this.cloth.geometry.attributes.position;
      this.particleBodies.forEach((body,i)=>attribute.setXYZ(i,body.position.x,body.position.y,body.position.z));
      attribute.needsUpdate=true;this.cloth.geometry.computeVertexNormals();
    }
    if(this.ropeSegments) this.ropeSegments.forEach((object,i)=>{
      const a=vector(this.particleBodies[i].position),b=vector(this.particleBodies[i+1].position);
      object.position.copy(a).lerp(b,.5);object.scale.y=a.distanceTo(b);object.quaternion.setFromUnitVectors(UP,b.sub(a).normalize());
    });
    this.scene.updateMatrixWorld(true);
  }
  metrics() {
    const result={time:this.time,action:this.action,contacts:this.physics.contacts.length,grasps:this.grasps.filter(Boolean).length,particles:this.particleBodies.length,success:false};
    if(this.structural.length) result.constraintError=this.structural.reduce((sum,c)=>sum+Math.abs(c.a.position.distanceTo(c.b.position)-c.rest),0)/this.structural.length;
    if(this.task==="cloth") {
      let separation=0;
      for(let row=0;row<this.rows;row++) separation+=this.particleBodies[row*this.columns].position.distanceTo(this.particleBodies[row*this.columns+this.columns-1].position);
      result.foldProgress=clamp(1-separation/this.rows/.64,0,1);
      result.success=result.foldProgress>.80&&result.grasps===2;
      result.center=this.particleBodies.reduce((p,b)=>p.add(vector(b.position)),new THREE.Vector3()).multiplyScalar(1/this.particleBodies.length).toArray();
    }
    if(this.task==="plug"||this.task==="marker") {
      Object.assign(result,insertionMetrics(vector(this.tool.body.position),new THREE.Quaternion(...this.tool.body.quaternion.toArray()),this.tool.length,this.target,this.targetQuaternion,this.tool.radius,this.holeRadius,this.socketDepth));
      result.blocked=this.blocked;
    }
    if(this.task==="pusht") {
      result.translationError=vector(this.tool.body.position).distanceTo(this.target);
      const yaw=new THREE.Euler().setFromQuaternion(new THREE.Quaternion(...this.tool.body.quaternion.toArray()),"YXZ").y;
      result.angularError=Math.abs(Math.atan2(Math.sin(yaw-this.goalYaw),Math.cos(yaw-this.goalYaw)));
      result.success=result.translationError<.045&&result.angularError<.18;
    }
    if(this.task==="box") {
      result.packed=this.manipulables.filter(r=>containedInBox(vector(r.body.position),r.half,this.containerCenter,this.containerHalf)&&r.body.velocity.length()<.10&&!this.grasps.some(g=>g?.bodyId===r.id)).length;
      result.remaining=this.manipulables.length-result.packed;result.success=result.remaining===0;
    }
    if(this.task==="rope") {
      result.crossed=this.threaded;
      result.throughSegments=this.particleBodies.slice(1).filter((body,i)=>{
        const a=vector(this.particleBodies[i].position).sub(this.ringCenter),b=vector(body.position).sub(this.ringCenter);
        if(a.x*b.x>0)return false;
        const hit=a.lerp(b,Math.abs(a.x)/(Math.abs(a.x)+Math.abs(b.x)+1e-10));return Math.hypot(hit.y,hit.z)<this.ringRadius-.018;
      }).length;
      result.allThrough=this.particleBodies.every(body=>body.position.x>this.ringCenter.x);
      result.success=this.threaded&&(result.throughSegments>0||result.allThrough)&&this.particleBodies[0].position.x>this.ringCenter.x+.06;
    }
    return result;
  }
  snapshot() {
    return {version:3,task:this.task,parameters:{...this.parameters},time:this.time,stepNumber:this.physics.stepnumber,auto:this.auto,autoPhase:this.autoPhase,autoWait:this.autoWait,autoObject:this.autoObject,action:this.action,plan:this.plan?structuredClone(this.plan):null,threaded:this.threaded||false,previousEndpoint:this.previousEndpoint?.toArray(),arms:this.arms.map(a=>a.snapshot()),grasps:this.grasps.map(g=>g?{kind:g.kind,bodyId:g.bodyId,particleIndex:g.particleIndex,frame:Object.fromEntries(["pivotA","pivotB","xA","xB","yA","yB","zA","zB"].filter(key=>g.constraint[key]).map(key=>[key,g.constraint[key].toArray()]))}:null),bodies:this.physics.bodies.map(b=>({id:b.tcId,p:b.position.toArray(),q:b.quaternion.toArray(),v:b.velocity.toArray(),w:b.angularVelocity.toArray(),f:b.force.toArray(),torque:b.torque.toArray(),sleepState:b.sleepState,timeLastSleepy:b.timeLastSleepy}))};
  }
  restore(state) {
    if(state.task!==this.task) throw new Error("Snapshot belongs to another experiment");
    this.grasps.forEach((g,i)=>this.release(i));
    this.parameters={...state.parameters};this.time=state.time;this.auto=state.auto;this.autoPhase=state.autoPhase;this.autoWait=state.autoWait;this.autoObject=state.autoObject;this.action=state.action;this.plan=state.plan?structuredClone(state.plan):null;
    this.threaded=state.threaded;
    if(state.previousEndpoint)this.previousEndpoint=new THREE.Vector3(...state.previousEndpoint);
    this.arms.forEach((arm,i)=>arm.restore(state.arms[i]));
    const bodies=new Map(this.physics.bodies.map(body=>[body.tcId,body]));
    for(const data of state.bodies) {
      const body=bodies.get(data.id);if(!body)throw new Error("Unknown snapshot body "+data.id);
      body.position.set(...data.p);body.previousPosition.copy(body.position);body.interpolatedPosition.copy(body.position);
      body.quaternion.set(...data.q);body.previousQuaternion.copy(body.quaternion);body.interpolatedQuaternion.copy(body.quaternion);
      body.velocity.set(...data.v);body.angularVelocity.set(...data.w);body.force.set(...data.f);body.torque.set(...data.torque);body.aabbNeedsUpdate=true;body.wakeUp();
    }
    state.grasps.forEach((grasp,i)=>{
      if(!grasp)return;
      if(grasp.kind==="particle")this.attachParticle(i,grasp.particleIndex);
      else {
        const body=bodies.get(grasp.bodyId),constraint=new CANNON.LockConstraint(this.arms[i].body,body,{maxForce:60});constraint.collideConnected=false;
        this.physics.addConstraint(constraint);this.grasps[i]={...grasp,constraint};
      }
      if(grasp.frame)for(const [key,value] of Object.entries(grasp.frame))this.grasps[i].constraint[key]?.set(...value);
    });
    for(const data of state.bodies){const body=bodies.get(data.id);body.sleepState=data.sleepState||0;body.timeLastSleepy=data.timeLastSleepy||0;}
    this.physics.time=this.time;this.physics.stepnumber=state.stepNumber||0;this.physics.broadphase.dirty=true;
    this.updateGeometry();
  }
  clone() { return new WorldSimulator(this.task,this.parameters,this.snapshot()); }
  predict(action,horizon=1) {
    const branch=this.clone();branch.applyAction(action);
    const path=[];
    for(let i=0;i<Math.round(clamp(horizon,.1,4)/STEP);i++) {branch.step();if(i%4===0)path.push(branch.arms[action.arm||0].hand.toArray());}
    const result={action:structuredClone(action),path,terminal:branch.snapshot(),metrics:branch.metrics()};
    branch.dispose();return result;
  }
  objects() {
    const result=[];this.scene.traverseVisible(object=>{if(object.userData.id&&!object.userData.overlay)result.push(object);});return result;
  }
  dispose() {
    this.scene.traverse(object=>{if(object.isMesh){object.geometry.dispose();object.material.dispose();}});
    this.scene.clear();this.records.clear();this.particleBodies.length=0;this.structural.length=0;
    this.physics.bodies.slice().forEach(body=>this.physics.removeBody(body));
  }
}

export class Timeline {
  constructor(limit=180) { this.limit=limit;this.frames=[];this.recording=false; }
  record(world) {
    if(!this.recording)return;
    this.frames.push(world.snapshot());
    if(this.frames.length>this.limit)this.frames.shift();
  }
  restore(world,index) {if(this.frames[index])world.restore(this.frames[index]);}
  clear() {this.frames.length=0;}
}

export function exportPoints(points,frame="world",camera=null,reference=null,simulationTime=null) {
  const timestamp=new Date().toISOString();
  return points.map(point=>{
    let position=point.world.clone();
    if(frame==="local")position.copy(point.local);
    if(frame==="camera"&&camera)position.applyMatrix4(camera.matrixWorldInverse);
    if(frame==="relative"&&reference)position.applyMatrix4(reference.matrixWorld.clone().invert());
    const color=point.color.clone().convertLinearToSRGB();
    return {objectId:point.objectId,pointId:point.id,x:position.x,y:position.y,z:position.z,r:Math.round(color.r*255),g:Math.round(color.g*255),b:Math.round(color.b*255),frame,units:"m",timestamp,simulationTime};
  });
}

export function pointsCSV(rows) {
  const fields=["objectId","pointId","x","y","z","r","g","b","frame","units","timestamp","simulationTime"];
    return fields.join(",")+"\n"+rows.map(row=>fields.map(field=>String(row[field])).join(",")).join("\n");
}

export function pointsPLY(rows) {
  return ["ply","format ascii 1.0","comment TensorCat simulated coordinates; units meters; frame "+(rows[0]?.frame||"world"),"comment exported "+(rows[0]?.timestamp||"unknown")+" simulation_seconds "+(rows[0]?.simulationTime??"not_applicable"),"element vertex "+rows.length,"property float x","property float y","property float z","property uchar red","property uchar green","property uchar blue","end_header",...rows.map(r=>[r.x,r.y,r.z,r.r,r.g,r.b].join(" "))].join("\n");
}
