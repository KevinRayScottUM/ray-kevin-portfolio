import {THREE,SoftwareRenderer} from "./graphics.js";
import {HoverTilt} from "./motion.js";

export const GALLERY_SPACING=.045;
export const galleryCenter=index=>(index-2.5)*GALLERY_SPACING;
export const galleryVacant=(machine,index)=>index===machine.inserted||index===machine.selected&&["ALIGNING","INSERTING"].includes(machine.state);

export function transferPoseFromAnchor(anchor,rig,root,viewport){
  rig.update();root.updateMatrixWorld(true);
  const height=.0515,depth=height*viewport.height/(2*Math.tan(THREE.MathUtils.degToRad(rig.camera.fov/2))*anchor.pixelHeight);
  const direction=rig.camera.getWorldDirection(new THREE.Vector3()),planePoint=rig.camera.position.clone().addScaledVector(direction,depth),plane=new THREE.Plane().setFromNormalAndCoplanarPoint(direction,planePoint);
  const ray=rig.ray(anchor.x-viewport.left,anchor.y-viewport.top,viewport.width,viewport.height),point=ray.intersectPlane(plane,new THREE.Vector3());
  const inverse=root.getWorldQuaternion(new THREE.Quaternion()).invert();
  return {position:root.worldToLocal(point),quaternion:inverse.multiply(rig.camera.quaternion).multiply(anchor.quaternion)};
}

export class CartridgeGallery {
  constructor(element,model,registry,textures){
    this.element=element;this.canvas=element.querySelector("canvas");this.renderer=new SoftwareRenderer(this.canvas,{alpha:true});this.renderer.textures=textures;
    this.scene=new THREE.Group();this.hovered=-1;this.suspended=new Set();this.dirty=true;this.width=.27;
    this.cards=registry.map((task,index)=>{const card=model.nodes.get("Cartridge_"+task.id).clone(true);card.position.set(galleryCenter(index),0,0);card.quaternion.identity();card.visible=true;this.scene.add(card);return card;});
    this.tilts=registry.map(()=>new HoverTilt());
    const camera=new THREE.OrthographicCamera(-.135,.135,.04,-.04,.01,2);camera.position.set(0,0,1);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
    this.rig={camera,update:()=>{camera.updateMatrixWorld(true);camera.matrixWorldInverse.copy(camera.matrixWorld).invert();},project:(p,w,h)=>{const n=p.clone().project(camera);return{x:(n.x+1)*w/2,y:(1-n.y)*h/2,z:n.z};}};
    this.buttons=[...element.querySelectorAll("[data-gallery-cartridge]")];
  }
  resize(dpr,quality){const rect=this.canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;const camera=this.rig.camera;camera.top=this.width*rect.height/rect.width/2;camera.bottom=-camera.top;camera.updateProjectionMatrix();this.renderer.quality=quality;this.renderer.resizeToViewport(rect.width,rect.height,dpr);this.dirty=true;}
  point(index,x,y,reduced=false){this.hovered=index;this.tilts.forEach((tilt,i)=>i===index&&this.cards[i].visible&&!this.suspended.has(i)?tilt.point(x,y,reduced):tilt.clear());}
  clear(){this.hovered=-1;this.tilts.forEach(tilt=>tilt.clear());}
  suspend(index){this.suspended.add(index);this.tilts[index].clear();}
  release(index){this.suspended.delete(index);}
  sync(machine){
    this.cards.forEach((card,index)=>{
      const vacant=galleryVacant(machine,index);
      if(card.visible===vacant){card.visible=!vacant;this.dirty=true;}
      this.buttons[index].dataset.vacant=String(vacant);this.buttons[index].disabled=vacant;
      if(vacant)this.tilts[index].clear();
    });
  }
  anchor(index){
    const rect=this.canvas.getBoundingClientRect(),button=this.buttons[index].getBoundingClientRect();
    return{x:button.left+button.width/2,y:rect.top+rect.height/2,pixelHeight:.0515*rect.width/this.width,quaternion:this.cards[index].quaternion.clone()};
  }
  update(dt,reduced=false){
    this.tilts.forEach((tilt,index)=>{if(tilt.step(dt,reduced)){this.cards[index].rotation.set(tilt.pitch.value,tilt.yaw.value,0,"YXZ");this.dirty=true;}});
    if(!this.dirty)return false;
    this.renderer.render(this.scene,this.rig,{mode:"surface",transparent:true});this.dirty=false;return true;
  }
  diagnostics(){return{hovered:this.hovered,visible:this.cards.map(c=>c.visible),centers:this.cards.map(c=>c.position.toArray()),rotations:this.cards.map(c=>c.rotation.toArray().slice(0,3)),pixels:[this.renderer.width,this.renderer.height],bounds:this.buttons.map(b=>b.getBoundingClientRect().toJSON())};}
  dispose(){this.scene.clear();this.renderer.staticCache=null;this.canvas.width=1;this.canvas.height=1;}
}

// Reuse the main depth-tested pixels, rather than rerendering a second physical card.
// This lifts the moving card above the gallery without exposing pixels hidden by the shell.
export class TransferOverlay {
  constructor(canvas){this.canvas=canvas;this.context=canvas.getContext("2d");this.image=null;this.visibleIds=new Set();}
  present(renderer,active){
    this.canvas.hidden=!active;if(!active)return;
    const {width,height}=renderer;
    if(!this.image||this.image.width!==width||this.image.height!==height){this.canvas.width=width;this.canvas.height=height;this.image=this.context.createImageData(width,height);this.words=new Uint32Array(this.image.data.buffer);}
    this.words.fill(0);this.visibleIds.clear();
    renderer.objects.forEach((object,index)=>{for(let node=object;node;node=node.parent)if(node.userData.cartridge){this.visibleIds.add(index);break;}});
    const source=new Uint32Array(renderer.image.data.buffer);
    for(let index=0;index<renderer.ids.length;index++)if(this.visibleIds.has(renderer.ids[index]))this.words[index]=source[index];
    this.context.putImageData(this.image,0,0);
  }
  dispose(){this.image=null;this.words=null;this.canvas.width=1;this.canvas.height=1;}
}
