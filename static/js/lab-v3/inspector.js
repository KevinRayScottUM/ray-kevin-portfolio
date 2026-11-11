// Disclosure preferences are presentation state, never experiment lifecycle state.
export class InspectorVisibility {
  constructor(){this.mode="console";this.preferences={console:false,lab:true};}
  get open(){return this.preferences[this.mode];}
  set(open){this.preferences[this.mode]=Boolean(open);}
  select(mode){this.mode=mode;return this.open;}
}
