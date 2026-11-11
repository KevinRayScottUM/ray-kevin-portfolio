import {THREE,CameraRig} from './lab-v3/graphics.js';
import {tourPose} from './lab-showcase-motion.js';

// Weld identical vertex attributes without changing surfaces, UV seams or hard normals.
export function indexRigidGeometry(geometry){
  if(geometry.index)return geometry;
  const p=geometry.attributes.position,n=geometry.attributes.normal,uv=geometry.attributes.uv,unique=new Map(),positions=[],normals=[],uvs=[],indices=[];
  for(let i=0;i<p.count;i++){
    const values=[p.getX(i),p.getY(i),p.getZ(i),n.getX(i),n.getY(i),n.getZ(i),uv.getX(i),uv.getY(i)],key=values.join(',');
    let index=unique.get(key);if(index===undefined){index=unique.size;unique.set(key,index);positions.push(...values.slice(0,3));normals.push(...values.slice(3,6));uvs.push(...values.slice(6));}indices.push(index);
  }
  const result=new THREE.BufferGeometry();result.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));result.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));result.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));result.setIndex(indices);return result;
}
export function compileHardware(model){
  model.root.traverse(node=>{if(node.isMesh)node.geometry=indexRigidGeometry(node.geometry);});return model;
}
export function createHardwareScene(source){
  const root=source.root.clone(true),nodes=new Map();root.traverse(node=>nodes.set(node.name,node));
  nodes.get('Cartridges').visible=false;
  const center=new THREE.Box3().setFromObject(nodes.get('Chassis')).getCenter(new THREE.Vector3());
  const scene=new THREE.Group(),pivot=new THREE.Group();pivot.position.copy(center);root.position.sub(center);pivot.add(root);scene.add(pivot);scene.updateMatrixWorld(true);
  return {scene,pivot,root,nodes,center,metadata:source.metadata};
}
export class ShowcaseRig extends CameraRig {
  constructor(){
    super('console');this.camera.aspect=1376/650;this.camera.setViewOffset(1376,650,208,30,960,540);
    this.theta=0;this.phi=Math.PI/2;this.distance=.5;this.target.set(0,.045,0);this.update();
  }
  pose(progress,pivot){
    const pose=tourPose(progress);
    const yaw=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),pose.yaw),pitch=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),pose.pitch);
    pivot.quaternion.copy(yaw.multiply(pitch));this.distance=pose.distance;this.target.set(0,pose.targetY,0);this.update();return pose;
  }
}
