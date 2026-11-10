import {THREE,clamp} from "./graphics.js";
import {pickGeometry} from "./mechanics.js";

// Identical manipulation semantics for a full Lab canvas and a projected touchscreen.
export class ExperimentInteraction {
  constructor(session,rig,onSelect=()=>{}) {this.session=session;this.rig=rig;this.onSelect=onSelect;this.drag=null;this.selected=null;}
  begin(x,y,width,height,button=0) {
    const world=this.session.world;if(!world)return;
    const hit=pickGeometry(world.scene,this.rig,x,y,width,height);
    this.selected=hit?.object||null;
    this.drag={x,y,width,height,moved:false,kind:button?"pan":"orbit",hit};
    const arm=hit?.object.userData.arm;
    if(arm!==undefined&&/finger|palm|gripper/.test(hit.object.name)&&button===0) {
      this.session.arm=arm;world.auto=false;this.session.running=true;
      this.drag.kind="gripper";this.drag.arm=arm;
      this.drag.plane=new THREE.Plane().setFromNormalAndCoplanarPoint(this.rig.camera.getWorldDirection(new THREE.Vector3()),world.arms[arm].hand);
    }
  }
  move(x,y) {
    const d=this.drag;if(!d)return;
    const dx=x-d.x,dy=y-d.y;d.moved ||= Math.hypot(dx,dy)>2;
    if(d.kind==="orbit")this.rig.orbit(dx*.7,dy*.7);
    if(d.kind==="pan")this.rig.pan(dx,dy);
    if(d.kind==="gripper") {
      const point=this.rig.ray(x,y,d.width,d.height).intersectPlane(d.plane,new THREE.Vector3());
      if(point){point.x=clamp(point.x,-.75,.75);point.y=clamp(point.y,.105,.85);point.z=clamp(point.z,-.43,.43);this.session.world.applyAction({arm:d.arm,target:point.toArray()});}
    }
    d.x=x;d.y=y;
  }
  end(cancel=false) {if(!cancel&&this.drag?.hit)this.onSelect(this.drag.hit);this.drag=null;}
  wheel(dx,dy,zoom=false,pan=false){if(zoom)this.rig.zoom(dy);else if(pan)this.rig.pan(dx,dy);else this.rig.orbit(dx*.55,dy*.55);}
}
