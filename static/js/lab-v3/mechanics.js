import {THREE,clamp} from "./graphics.js";

export function localBounds(object) {
  object.updateWorldMatrix(true,true);
  const inverse=object.matrixWorld.clone().invert(),bounds=new THREE.Box3();
  object.traverse(child=>{if(child.isMesh){child.geometry.computeBoundingBox();bounds.union(child.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,child.matrixWorld)));}});
  return bounds;
}

export class CartridgeMechanism {
  constructor(bounds,bay) {
    this.bounds=bounds.clone();this.bay=new THREE.Box3(new THREE.Vector3(...bay.min),new THREE.Vector3(...bay.max));
    this.mouthY=bay.mouthY;const center=this.bay.getCenter(new THREE.Vector3());
    this.seat=new THREE.Vector3(center.x,this.mouthY-bounds.max.y-.0005,center.z);
    this.hover=new THREE.Vector3(center.x,this.mouthY-bounds.min.y+.014,center.z);
    if(!this.contained())throw new Error("TensorCat internal bay cannot contain this cartridge");
  }
  contained(){return this.bay.containsBox(this.bounds.clone().translate(this.seat));}
  position(rest,state,time,active,inserted) {
    const smooth=value=>{const t=clamp(value,0,1);return t*t*(3-2*t);};
    if(inserted&&state==="EJECTING") {
      const t=clamp(time/1.25,0,1);
      if(t<.42)return this.seat.clone().lerp(this.hover,smooth(t/.42));
      const curve=this.approach(rest);return curve.getPoint(1-smooth((t-.42)/.58));
    }
    if(active&&state==="ALIGNING")return this.approach(rest).getPoint(smooth(time/.70));
    if(active&&state==="INSERTING")return this.hover.clone().lerp(this.seat,smooth(time/.85));
    return inserted?this.seat.clone():rest.clone();
  }
  approach(rest){
    if(this.path&&this.pathRest.equals(rest))return this.path;
    // The fixed gallery is a separate layer; only the transfer card enters this scene.
    const lift=Math.max(rest.y,this.hover.y)+.018;
    const path=new THREE.CubicBezierCurve3(rest.clone(),new THREE.Vector3(rest.x,lift,rest.z+.025),new THREE.Vector3(this.hover.x,lift,this.hover.z+.025),this.hover.clone());
    this.pathRest=rest.clone();this.path=path;return path;
  }
}

export function screenIntersection(ray,screen,allowOutside=false) {
  screen.updateWorldMatrix(true,false);screen.geometry.computeBoundingBox();
  const local=ray.clone().applyMatrix4(screen.matrixWorld.clone().invert()),box=screen.geometry.boundingBox;
  if(local.direction.z>=-1e-8)return null;
  const point=local.intersectPlane(new THREE.Plane(new THREE.Vector3(0,0,1),-box.max.z),new THREE.Vector3());
  if(!point)return null;
  const u=(point.x-box.min.x)/(box.max.x-box.min.x),v=(point.y-box.min.y)/(box.max.y-box.min.y);
  if(!allowOutside&&(u<0||u>1||v<0||v>1))return null;
  return {u,v,x:u,y:1-v};
}

export function pickGeometry(scene,rig,x,y,width,height) {
  scene.updateMatrixWorld(true);rig.update();
  const candidates=[];scene.traverseVisible(object=>{if(object.isMesh&&!object.userData.overlay)candidates.push(object);});
  const caster=new THREE.Raycaster();caster.ray.copy(rig.ray(x,y,width,height));caster.near=0;caster.far=rig.camera.far;
  return caster.intersectObjects(candidates,false)[0]||null;
}
