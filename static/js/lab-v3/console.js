import {THREE,loadConsole,clamp} from "./graphics.js";
import {localBounds,CartridgeMechanism} from "./mechanics.js";
import {PowerSwitch} from "./power.js";
import {drawConsoleHome} from "./home-screen.js";
import {t} from '../i18n.js';

export const CARTRIDGE_TIMES={ALIGNING:.70,INSERTING:.85,EJECTING:1.25};
export class CartridgeMachine {
  constructor(){this.state="EMPTY";this.selected=0;this.inserted=null;this.elapsed=0;this.pending=null;this.queued=null;this.ejectOnly=false;}
  get busy(){return this.state==="ORIENTING"||Object.hasOwn(CARTRIDGE_TIMES,this.state);}
  request(index){
    index=((index%6)+6)%6;
    if(!this.busy&&this.inserted===index)return false;
    if(this.busy){this.queued=index;this.ejectOnly=false;return true;}
    this.queued=index;this.ejectOnly=false;this.state="ORIENTING";this.elapsed=0;return true;
  }
  requestEject(){if(this.busy||this.inserted===null)return false;this.ejectOnly=true;this.queued=null;this.pending=null;this.state="ORIENTING";this.elapsed=0;return true;}
  select(index){if(this.busy)return false;this.selected=((index%6)+6)%6;if(this.inserted===null)this.state="SELECTING";return true;}
  insert(){
    if(this.busy)return false;
    if(this.inserted!==null){if(this.inserted===this.selected)return false;this.pending=this.selected;this.state="EJECTING";}
    else this.state="ALIGNING";
    this.elapsed=0;return true;
  }
  eject(){if(this.busy||this.inserted===null)return false;this.pending=null;this.state="EJECTING";this.elapsed=0;return true;}
  advance(dt,canTransfer=true){
    if(this.state==="ORIENTING"){
      if(!canTransfer)return;
      if(this.ejectOnly){this.state="EJECTING";this.ejectOnly=false;}
      else {const index=this.queued;this.queued=null;if(index===this.inserted){this.state="READY";return;}this.selected=index;this.pending=this.inserted===null?null:index;this.state=this.inserted===null?"ALIGNING":"EJECTING";}
      this.elapsed=0;
    }
    if(!this.busy)return;this.elapsed+=Math.max(0,dt);
    while(this.busy&&this.elapsed+1e-9>=CARTRIDGE_TIMES[this.state]){
      this.elapsed=Math.max(0,this.elapsed-CARTRIDGE_TIMES[this.state]);
      if(this.state==="ALIGNING")this.state="INSERTING";
      else if(this.state==="INSERTING"){this.inserted=this.selected;this.state="READY";if(this.queued!==null&&this.queued!==this.inserted){this.state="ORIENTING";}else this.queued=null;}
      else {this.inserted=null;this.state="EMPTY";const next=this.queued??this.pending;this.queued=null;this.pending=null;if(next!==null){this.selected=next;this.state="ALIGNING";}}
      if(this.state==="ORIENTING")break;
    }
    if(!this.busy)this.elapsed=0;
  }
}

export function normalizeJoystick(x,y,deadZone=.12){const length=Math.hypot(x,y);if(length<=deadZone)return{x:0,y:0};const magnitude=clamp((length-deadZone)/(1-deadZone),0,1);return{x:x/length*magnitude,y:y/length*magnitude};}

export class ResearchConsole {
  static async create(renderer,registry,base,onLaunch,onSettings){
    const model=await loadConsole(base+"console-mesh.json");
    for(const texture of model.textures)await renderer.loadTexture(texture,base+texture);
    const logo=new Image();logo.src=base+"logo-badge.png";await logo.decode();
    return new ResearchConsole(renderer,registry,model,logo,onLaunch,onSettings);
  }
  constructor(renderer,registry,model,logo,onLaunch,onSettings){
    Object.assign(this,{renderer,registry,model,logo,onLaunch,onSettings,scene:model.root});
    this.machine=new CartridgeMachine();this.screenState="boot";this.cursor=0;this.bootTime=0;this.sound=false;
    this.joy={x:0,y:0};this.joyElapsed=0;this.pressed=new Set();this.depths=new Map();this.holds=new Map();
    this.rest=new Map([...model.nodes].map(([name,node])=>[name,node.position.clone()]));
    this.mechanisms=registry.map(task=>new CartridgeMechanism(localBounds(model.nodes.get("Cartridge_"+task.id)),model.metadata.cartridgeBay));
    this.screen=document.createElement("canvas");this.screen.width=1024;this.screen.height=576;
    this.buttons=[];this.settings={quality:"balanced",sensitivity:1};this.screenDirty=true;
    this.hardwareRevision=0;this.isAnimating=false;this.notice="";this.drawScreen();
    this.transferRest=new Map();this.transferRotation=new Map();this.canTransfer=true;
    this.power=new PowerSwitch(true,on=>{this.cancelInput();this.session?.returnMenu();this.screenState="cartridges";this.screenDirty=true;this.onPowerChange?.(on);});
  }
  get ready(){return this.machine.state==="READY"&&this.machine.inserted!==null;}
  get embedded(){return this.power?.on!==false&&this.ready&&this.session?.embedded&&this.session.cartridgeId===this.registry[this.machine.inserted].id;}
  get lifecycle(){return this.machine.busy?this.machine.state:this.power?.on===false?"POWER_OFF":this.embedded?this.session.state:this.ready?"INSERTED_READY":this.machine.state;}
  requestCartridgeInsertion(index){if(!Number.isInteger(index)||index<0||index>=this.registry.length)return false;if(!this.machine.request(index))return false;this.notice="";this.session?.eject();this.cancelInput();this.screenState="cartridges";this.screenDirty=true;this.onInsertionRequest?.();return true;}
  select(index){if(this.machine.select(index)){this.notice="";this.session?.returnMenu();this.screenState="cartridges";this.screenDirty=true;}}
  insert(){return this.requestCartridgeInsertion(this.machine.selected);}
  eject(){if(!this.machine.requestEject())return false;this.session?.eject();this.cancelInput();this.screenState="cartridges";this.screenDirty=true;this.onEjectionRequest?.();this.onInsertionRequest?.();return true;}
  launch(){if(this.power?.on!==false&&this.ready&&!this.embedded){this.notice="";this.onLaunch(this.registry[this.machine.inserted].id);this.screenDirty=true;return true;}return false;}
  press(action){
    this.pressed.add(action);this.holds.set(action,0);this.beep();
    if(action.startsWith("cartridge:")){this.requestCartridgeInsertion(this.registry.findIndex(task=>task.id===action.split(":")[1]));return;}
    if(this.power?.on===false)return;
    if(this.machine.busy)return;
    if(this.embedded){this.session.dispatch(action);this.screenDirty=true;return;}
    if(this.screenState==="boot")this.screenState="menu";
    if(action==="a"&&this.ready&&this.screenState!=="settings"){this.launch();return;}
    if(action==="start"){this.screenState="menu";this.screenDirty=true;return;}
    if(action==="select"){this.screenState=this.screenState==="settings"?"cartridges":"settings";this.screenDirty=true;return;}
    if(action==="b"){this.screenState="menu";this.screenDirty=true;return;}
    if(["up","down","left","right"].includes(action)){
      const direction=["left","up"].includes(action)?-1:1;
      if(["labs","cartridges"].includes(this.screenState))this.select(this.machine.selected+direction);
      else if(this.screenState==="menu")this.cursor=(this.cursor+direction+4)%4;
      else if(this.screenState==="settings"){const levels=["low","balanced","high","adaptive"];this.settings.quality=levels[(levels.indexOf(this.settings.quality)+direction+4)%4];this.onSettings(this.settings);}
      this.screenDirty=true;return;
    }
    if(action==="a"){
      if(this.screenState==="menu")this.screenState=["cartridges","cartridges","info","settings"][this.cursor];
      else if(this.screenState==="settings")this.sound=!this.sound;
      else this.notice='console.insertNotice';
      this.screenDirty=true;
    }
  }
  release(action){this.pressed.delete(action);this.holds.delete(action);}
  cancelInput(){this.pressed.clear();this.holds.clear();this.joy={x:0,y:0};}
  setJoystick(x,y){this.joy=normalizeJoystick(x,y);}
  beep(){
    if(!this.sound)return;
    try{if(!this.audio)this.audio=new(window.AudioContext||window.webkitAudioContext)();this.audio.resume();const oscillator=this.audio.createOscillator(),gain=this.audio.createGain();oscillator.type="sine";oscillator.frequency.value=460;gain.gain.value=.025;oscillator.connect(gain);gain.connect(this.audio.destination);oscillator.start();oscillator.stop(this.audio.currentTime+.035);}catch(_){this.sound=false;}
  }
  update(dt,reduced=false){
    const before=this.machine.state;this.machine.advance(reduced&&this.machine.busy?2:dt,this.canTransfer);
    if(before!==this.machine.state){this.screenDirty=true;if(this.machine.state==="EMPTY")this.screenState="menu";}
    if(this.screenState==="boot"){this.bootTime+=dt;if(this.bootTime>(reduced?0:.4)){this.screenState="menu";this.screenDirty=true;}}
    let moving=this.machine.busy||before!==this.machine.state;
    if(this.power){moving=this.power.update(dt,reduced)||moving;const slider=this.model.nodes.get("Power_Slider");if(slider)slider.position.x=this.rest.get("Power_Slider").x+(this.power.slider.value-1)*.016;const led=this.model.nodes.get("Status_LED");if(led)led.material.color.set(this.power.on?"#a2cd84":"#424c47");}
    for(const action of ["a","b","start","select","up","down","left","right"]){
      const amount=this.depths.get(action)||0,target=this.pressed.has(action)?1:0,next=amount+(target-amount)*(1-Math.exp(-dt*22));
      if(Math.abs(next-amount)>.0001)moving=true;this.depths.set(action,next);
      const name=["a","b","start","select"].includes(action)?"Button_"+(action.length===1?action.toUpperCase():action[0].toUpperCase()+action.slice(1)):"DPad_"+action;
      const node=this.model.nodes.get(name);if(node)node.position.z=this.rest.get(name).z-next*.0017;
      if(this.pressed.has(action)){
        const hold=(this.holds.get(action)||0)+dt;this.holds.set(action,hold);
        if(this.embedded&&this.session.running&&hold>.28&&["up","down"].includes(action))this.session.zoom(action==="up"?-1:1,dt);
      }
    }
    const joy=this.model.nodes.get("Joystick_Pivot"),oldX=joy.rotation.x,oldZ=joy.rotation.z;
    joy.rotation.x+=(this.joy.y*.21-joy.rotation.x)*(1-Math.exp(-dt*18));joy.rotation.z+=(-this.joy.x*.21-joy.rotation.z)*(1-Math.exp(-dt*18));
    moving ||= Math.abs(oldX-joy.rotation.x)+Math.abs(oldZ-joy.rotation.z)>.00001;
    if(this.embedded)this.session.analog(this.joy.x,this.joy.y,dt);
    else if(Math.hypot(this.joy.x,this.joy.y)>.5){this.joyElapsed+=dt;if(this.joyElapsed>.2){this.joyElapsed=0;const action=Math.abs(this.joy.x)>Math.abs(this.joy.y)?(this.joy.x>0?"right":"left"):(this.joy.y>0?"up":"down");this.press(action);this.release(action);}}else this.joyElapsed=0;
    const state=this.machine.state,time=this.machine.elapsed;
    this.registry.forEach((task,index)=>{
      const node=this.model.nodes.get("Cartridge_"+task.id),inserted=index===this.machine.inserted;
      const transferring=index===this.machine.selected&&["ALIGNING","INSERTING"].includes(state);
      if((state==="ALIGNING"&&before!==state&&index===this.machine.selected)||(state==="EJECTING"&&before!==state&&inserted)){
        const pose=this.getTransferPose?.(index);this.transferRest.set(index,pose?.position||this.rest.get(node.name));this.transferRotation.set(index,pose?.quaternion||new THREE.Quaternion());this.onTransferStart?.(index);
      }
      const rest=this.transferRest.get(index)||this.rest.get(node.name),rotation=this.transferRotation.get(index)||new THREE.Quaternion();
      node.position.copy(this.mechanisms[index].position(rest,state,time,index===this.machine.selected,inserted));
      const blend=state==="ALIGNING"?clamp(time/.70,0,1):state==="EJECTING"?1-clamp((time/1.25-.42)/.58,0,1):1;
      node.quaternion.copy(rotation).slerp(new THREE.Quaternion(),blend*blend*(3-2*blend));
      node.visible=inserted||transferring;
      if(!this.machine.busy)this.onTransferEnd?.(index);
    });
    this.isAnimating=moving;if(moving)this.hardwareRevision++;
    this.scene.updateMatrixWorld(true);
    if(this.screenDirty||this.machine.busy||this.embedded&&this.session.state==="BOOTING")this.drawScreen();
    return moving;
  }
  context(){const c=this.screen.getContext("2d");c.setTransform(this.screen.width/512,0,0,this.screen.height/288,0,0);return c;}
  text(c,value,x,y,size=18,color="#eaf0ec"){c.fillStyle=color;c.font=`${size}px system-ui, sans-serif`;c.fillText(value,x,y);}
  screenButton(c,id,label,x,y,w,h,action,selected=false){c.fillStyle=selected?"#4b7774":"#e7eeeb";c.fillRect(x,y,w,h);this.text(c,label,x+10,y+h*.65,13,selected?"#fff":"#294644");this.buttons.push({id,x,y,w,h,action});}
  systemButtons(c){
    if(this.power?.on===false||!this.ready||this.session?.state==="BOOTING"||this.screenState==="boot")return;
    if(this.embedded){
      this.screenButton(c,"system-focus","",374,6,58,42,()=>this.onFocusRequest?.());
      c.strokeStyle="#294644";c.lineWidth=2;c.beginPath();
      for(const [x,y,dx,dy] of [[390,18,8,8],[416,18,-8,8],[390,36,8,-8],[416,36,-8,-8]]){c.moveTo(x+dx,y);c.lineTo(x,y);c.lineTo(x,y+dy);}c.stroke();
    }
    this.screenButton(c,"system-eject","",442,6,58,42,()=>this.eject());
    c.fillStyle="#294644";c.beginPath();c.moveTo(471,14);c.lineTo(482,29);c.lineTo(460,29);c.closePath();c.fill();c.fillRect(460,33,22,4);
  }
  drawScreen(){
    this.screenDirty=false;const c=this.context();c.fillStyle="#17242a";c.fillRect(0,0,512,288);this.buttons=[];
    if(this.power?.on===false){c.fillStyle="#10191d";c.fillRect(0,0,512,288);this.renderer.updateTexture("screen",this.screen);return;}
    c.strokeStyle="#40565e";c.strokeRect(12,12,488,264);
    if(this.embedded&&this.session.state==="BOOTING"||this.screenState==="boot"){
      c.drawImage(this.logo,171,19,170,170);this.text(c,this.embedded?t('console.loading',{label:this.registry[this.machine.inserted].label}):t('console.boot'),106,233,16,"#b4cdc6");
    }else if(this.ready&&this.screenState!=="settings"||["labs","cartridges"].includes(this.screenState)){
      const task=this.registry[this.machine.inserted??this.machine.selected];
      c.drawImage(this.logo,370,65,100,100);this.text(c,t('console.experiment',{number:task.number}),32,52,13,"#b2cdc3");this.text(c,task.label,32,99,30);this.text(c,t('task.'+task.id+'.name'),32,137,16);
      this.text(c,t('state.'+(this.ready?'READY':this.machine.state)),32,185,15,"#b5ccc7");
      if(this.machine.inserted!==null&&this.machine.selected!==this.machine.inserted)this.text(c,t('console.next',{label:this.registry[this.machine.selected].label}),32,208,12,"#b5ccc7");
      const caption=t(this.machine.busy?'console.inserting':this.ready?'console.launch':'console.insert');
      this.screenButton(c,"launch",caption,32,225,300,35,()=>this.ready?this.pressAndRelease("a"):this.insert());
      if(this.notice)this.text(c,t(this.notice),32,214,12,"#e1c490");
    }else if(this.screenState==="menu"){
      drawConsoleHome(c,this.logo,(name,index,x,y,w,h)=>this.screenButton(c,"home-"+index,name,x,y,w,h,()=>{this.cursor=index;this.pressAndRelease("a");},this.cursor===index));
    }else if(this.screenState==="info"){
      ['system','raster','shared','units'].forEach((key,index)=>this.text(c,t('console.'+key),30,55+index*49,index?17:22));
    }else{
      this.text(c,t('console.settings'),32,52,22);this.text(c,t('console.quality',{value:t('sim.'+this.settings.quality)}),32,105,20);this.text(c,t('console.sound',{value:t(this.sound?'console.on':'console.muted')}),32,153,20);
      this.buttons.push({id:"quality",x:25,y:75,w:450,h:48,action:()=>this.pressAndRelease("right")},{id:"sound",x:25,y:130,w:450,h:45,action:()=>{this.sound=!this.sound;this.screenDirty=true;}});
    }
    this.systemButtons(c);this.renderer.updateTexture("screen",this.screen);
  }
  presentExperiment(viewport){
    if(!this.embedded||this.session.state==="BOOTING")return;
    const c=this.context();c.drawImage(viewport,0,0,512,288);this.buttons=[];
    c.fillStyle="#f4f8f5f2";c.fillRect(0,0,512,52);c.fillRect(0,242,512,46);
    const task=this.registry[this.machine.inserted],metrics=this.session.world.metrics();
    this.text(c,task.number+" / "+task.label,12,24,20,"#263f46");
    const status=this.session.running?"RUNNING":this.session.state==="EXPERIMENT_PAUSED"?"PAUSED":"MENU";this.text(c,t('console.'+status),12,44,12,"#3f7768");
    const metric=this.session.world.task==="box"?t('console.packed',{count:metrics.packed}):this.session.world.task==="cloth"?t('console.fold',{count:Math.round(metrics.foldProgress*100)}):metrics.radialError!==undefined?t('console.radial',{value:(metrics.radialError*1000).toFixed(1)}):this.session.world.task==="rope"?t(metrics.crossed?'console.crossed':'console.threading'):t('console.error',{value:(metrics.translationError*100).toFixed(1)});
    this.text(c,metric+" / "+metrics.time.toFixed(1)+" s",12,239,15,metrics.success?"#237052":"#3f585c");
    [["a",t(this.session.world.task==="pusht"?'console.push':'console.grip')],["select",t('console.tools')],["start",t(this.session.running?'console.pause':'console.resume')],["auto",t('sim.auto')]].forEach(([action,label],i)=>this.screenButton(c,"control-"+action,label,8+i*126,250,118,30,()=>{if(action==="auto"){this.session.world.command("auto");this.session.running=true;}else this.pressAndRelease(action);}));
    if(["PAUSE_MENU","CONTROLS"].includes(this.session.state)){
      c.fillStyle="#172b32e8";c.fillRect(0,52,512,236);this.buttons=[];
      this.text(c,t(this.session.state==="CONTROLS"?'console.controlTitle':'console.PAUSED'),28,78,20,"#fff");
      const items=this.session.state==="EXPERIMENT_PAUSED"?[{label:t('console.resume'),action:()=>{this.session.running=true;}}]:this.session.menuItems();
      items.forEach((item,i)=>this.screenButton(c,"menu-"+i,item.label,28+(i%2)*242,94+Math.floor(i/2)*44,214,36,()=>{item.action();this.session.revision++;},i===this.session.menuIndex));
    }
    this.systemButtons(c);this.renderer.updateTexture("screen",this.screen);
  }
  pressAndRelease(action){this.press(action);this.release(action);}
  screenActionAt(u,v){const x=u*512,y=(1-v)*288;return this.buttons.find(b=>x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h)||null;}
  screenClick(u,v){this.screenActionAt(u,v)?.action();this.screenDirty=true;}
  dispose(){this.cancelInput();this.audio?.close();this.scene.traverse(object=>{if(object.isMesh){object.geometry.dispose();object.material.dispose();}});this.scene.clear();}
}
