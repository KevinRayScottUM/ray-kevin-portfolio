import {Spring} from "./motion.js";
import {clamp} from "./graphics.js";

export class PowerSwitch {
  constructor(on=true,onChange=()=>{}){this.state=on?"ON":"OFF";this.slider=new Spring(on?1:0,32);this.dragging=false;this.onChange=onChange;}
  get on(){return this.state==="ON";}
  set(on){const next=on?"ON":"OFF",changed=next!==this.state;this.state=next;this.dragging=false;this.slider.target=on?1:0;if(changed)this.onChange(on);return changed;}
  begin(){this.dragging=true;this.slider.velocity=0;}
  move(value){if(this.dragging)this.slider.value=clamp(value,0,1);}
  release(cancel=false){this.set(cancel?this.on:this.slider.value>=.5);}
  update(dt,reduced=false){return !this.dragging&&this.slider.step(dt,reduced);}
}
