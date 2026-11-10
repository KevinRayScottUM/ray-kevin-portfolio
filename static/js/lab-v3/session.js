import {clamp} from "./graphics.js";

// One world and lifecycle, independent of whether it is shown on the handheld or in Lab.
export class ExperimentSession {
  constructor(acquireWorld, {startPaused=false, onReset=()=>{}, view=null}={}) {
    this.acquireWorld=acquireWorld;this.startPaused=startPaused;this.onReset=onReset;
    this.world=null;this.cartridgeId=null;this.state="EMPTY";this.bootTime=0;
    this.arm=0;this.axes="xy";this.menuIndex=0;this.revision=0;
    this.view=view;
  }
  get powered(){return this.power?.on!==false;}
  get running(){return this.powered&&this.state==="EXPERIMENT_RUNNING";}
  set running(value){if(this.world){this.state=value&&this.powered?"EXPERIMENT_RUNNING":"EXPERIMENT_PAUSED";this.revision++;}}
  get embedded(){return this.cartridgeId!==null&&["BOOTING","EXPERIMENT_RUNNING","EXPERIMENT_PAUSED","PAUSE_MENU","CONTROLS"].includes(this.state);}
  activateLab(id) {
    const same=this.world?.task===id,wasRunning=this.running;
    this.world=this.acquireWorld(id);this.arm=this.world.arms[this.arm]?.root.visible?this.arm:0;
    if(this.cartridgeId!==id)this.cartridgeId=null;
    if(!same)this.running=!this.startPaused;
    else if(this.state==="CARTRIDGE_MENU"||this.state==="EMPTY")this.running=false;
    else if(this.state==="PAUSE_MENU"||this.state==="CONTROLS")this.running=false;
    else this.running=wasRunning;
    this.revision++;return this.world;
  }
  launch(id) {
    if(!this.powered||this.state==="BOOTING")return false;
    this.world=this.acquireWorld(id);this.cartridgeId=id;this.arm=0;
    this.state="BOOTING";this.bootTime=0;this.menuIndex=0;this.revision++;return true;
  }
  advance(dt,reduced=false) {
    if(!this.powered||this.state!=="BOOTING")return;
    this.bootTime+=dt;
    if(reduced||this.bootTime>=.24){this.state="EXPERIMENT_RUNNING";this.revision++;}
  }
  returnMenu(){this.state=this.world?"CARTRIDGE_MENU":"EMPTY";this.revision++;}
  eject(){this.returnMenu();this.cartridgeId=null;}
  reset() {
    if(!this.world)return;
    this.world=this.acquireWorld(this.world.task,true);this.running=true;this.onReset(this.world);
  }
  menuItems() {
    if(this.state==="CONTROLS")return [
      {label:"Arm: "+(this.arm?"Right":"Left"),action:()=>{if(this.world.arms[1].root.visible)this.arm=1-this.arm;}},
      {label:"Axes: "+this.axes.toUpperCase(),action:()=>{this.axes=this.axes==="xy"?"xz":"xy";}},
      {label:"Auto sequence",action:()=>{this.world.command("auto");this.running=true;}},
      {label:"Tilt −",action:()=>{this.world.arms[this.arm].tilt=clamp(this.world.arms[this.arm].tilt-.12,-1.57,1.57);}},
      {label:"Tilt +",action:()=>{this.world.arms[this.arm].tilt=clamp(this.world.arms[this.arm].tilt+.12,-1.57,1.57);}},
      {label:"Resume",action:()=>{this.running=true;}}
    ];
    return [{label:"Resume",action:()=>{this.running=true;}},{label:"Restart experiment",action:()=>this.reset()},{label:"Controls",action:()=>{this.state="CONTROLS";this.menuIndex=0;}},{label:"Cartridge menu",action:()=>this.returnMenu()}];
  }
  choose(index=this.menuIndex) {const item=this.menuItems()[index];if(item){item.action();this.revision++;}}
  move(x,y,amount=.025) {
    if(!this.world)return;const arm=this.world.arms[this.arm],target=arm.target.toArray();
    target[0]=clamp(target[0]+x*amount,-.75,.75);
    const axis=this.axes==="xy"?1:2;target[axis]=clamp(target[axis]+y*amount,axis===1?.105:-.43,axis===1?.85:.43);
    this.world.applyAction({arm:this.arm,target});this.revision++;
  }
  zoom(direction,dt=null) {if(this.view){this.view.zoom(direction*(dt===null?40:dt*220));this.revision++;}}
  analog(x,y,dt) {
    if(this.running&&this.view&&Math.hypot(x,y)>.001){this.view.orbit(x*dt*150,-y*dt*150);this.revision++;}
  }
  dispatch(action) {
    if(!this.powered||!this.world||this.state==="BOOTING")return false;
    if(action==="start") {
      if(this.state==="PAUSE_MENU"||this.state==="CONTROLS"||this.state==="EXPERIMENT_PAUSED")this.running=true;
      else {this.state="PAUSE_MENU";this.menuIndex=0;this.revision++;}
      return true;
    }
    if(action==="b") {
      if(this.state==="PAUSE_MENU")this.returnMenu();
      else {this.state="PAUSE_MENU";this.menuIndex=0;this.revision++;}
      return true;
    }
    if(action==="select"){this.state="CONTROLS";this.menuIndex=0;this.revision++;return true;}
    if(["PAUSE_MENU","CONTROLS"].includes(this.state)) {
      if(action==="a")this.choose();
      else if(["left","up","right","down"].includes(action)){this.menuIndex=(this.menuIndex+(["left","up"].includes(action)?-1:1)+this.menuItems().length)%this.menuItems().length;this.revision++;}
      return true;
    }
    if(action==="a") {
      if(this.state==="EXPERIMENT_PAUSED"){this.running=true;return true;}
      if(this.world.task==="pusht"){this.world.command("auto");this.running=true;return true;}
      const arm=this.world.arms[this.arm];arm.opening=arm.opening>.5?.1:1;
      if(arm.opening>.5)this.world.release(this.arm);this.world.auto=false;this.world.action=arm.opening>.5?"Release":"Close gripper";this.revision++;return true;
    }
    if(action==="up"||action==="down"){this.zoom(action==="up"?-1:1);return true;}
    return action==="left"||action==="right";
  }
}
