import {SoftwareRenderer,GeometrySampler,THREE} from "./graphics.js";

export function sceneSignature(scene,rig){
  scene.updateMatrixWorld(true);rig.update();const values=[...rig.camera.matrixWorld.elements,...rig.camera.projectionMatrix.elements];
  scene.traverseVisible(object=>{
    if(!object.isMesh)return;
    values.push(object.id,object.material.color.getHex(),...object.matrixWorld.elements);
    if(object.userData.deformable)for(const value of object.geometry.attributes.position.array)values.push(value);
  });
  return JSON.stringify(values);
}

export class EmbeddedDisplay {
  constructor(session,rig,device){
    this.session=session;this.rig=rig;this.device=device;this.canvas=document.createElement("canvas");
    this.renderer=new SoftwareRenderer(this.canvas);this.sampler=new GeometrySampler();
    this.width=1024;this.force=true;this.lastTime=-1;this.lastRevision=-1;this.lastFrame=0;this.frames=0;this.presentationRevision=0;
  }
  resize(width){
    width=Math.max(768,Math.min(1536,Math.ceil(width/128)*128));
    if(this.width!==width){this.width=width;this.force=true;}
    const height=Math.round(width*9/16);this.renderer.setSize(width,height);
    this.rig.resize(width,height);
    if(this.device.screen.width!==width){this.device.screen.width=width;this.device.screen.height=height;this.device.screenDirty=true;}
  }
  render(now,mode="surface",options={}){
    if(!this.device.embedded||this.session.state==="BOOTING")return false;
    const world=this.session.world,revision=this.session.revision;
    if(!this.force&&this.lastTime===world.time&&this.lastRevision===revision)return false;
    if(!this.force&&now-this.lastFrame<1000/30&&this.lastRevision===revision)return false;
    if(this.force)this.presentationRevision++;
    const points=mode==="cloud"?this.sampler.sampleScene(world.scene,options.pointBudget||2400,options.seed||7):[];
    const staticKey=mode==="surface"?this.presentationRevision+":"+sceneSignature(world.scene,this.rig):null;
    this.renderer.render(world.scene,this.rig,{mode,staticKey,points,particles:world.particleBodies.map(b=>new THREE.Vector3(b.position.x,b.position.y,b.position.z)),...options});
    this.device.presentExperiment(this.canvas);this.force=false;this.lastTime=world.time;this.lastRevision=revision;this.lastFrame=now;this.frames++;
    return true;
  }
  dispose(){this.renderer.textures.clear();this.renderer.staticCache=null;this.canvas.width=1;this.canvas.height=1;}
}
