import {t,bindTranslations} from '../i18n.js';
// Explicit bindings target stable controls, never English text searches.
export function localizeSimulator(host,registry=[]){
  const slot=(selector,key)=>host.querySelectorAll(selector).forEach(element=>{
    if(element.tagName==='OPTION'){element.dataset.i18n=key;element.textContent=t(key);return;}
    let span=[...element.children].find(child=>child.hasAttribute('data-label-slot'));
    if(!span){span=document.createElement('span');span.dataset.labelSlot='';for(const node of [...element.childNodes])if(node.nodeType===3)node.remove();element.prepend(span);}
    span.dataset.i18n=key;span.textContent=t(key);
  });
  const text=(selector,key)=>host.querySelectorAll(selector).forEach(element=>{element.dataset.i18n=key;element.textContent=t(key);});
  const attr=(selector,key,attribute='aria-label')=>host.querySelectorAll(selector).forEach(element=>{element.setAttribute('data-i18n-'+attribute,key);element.setAttribute(attribute,t(key));});
  if(!host.querySelector('[data-objective]')?.textContent.trim()){
    for(const field of ['method','limits']){const element=host.querySelector('[data-'+field+']');if(element)element.textContent=t('sim.'+field);}
  }
  const labels={
    '[data-opening]':'gripper','[data-tilt]':'tilt','[data-arm]':'arm','[data-joint]':'joint',
    '[data-parameter=gravity]':'gravity','[data-parameter=friction]':'friction','[data-parameter=damping]':'damping','[data-parameter=stiffness]':'stiffness','[data-parameter=speed]':'speed','[data-resolution]':'columns','[data-grid]':'grid','[data-axes]':'axes',
    '[data-quality]':'quality','[data-pixel-ratio]':'ratio','[data-point-budget]':'budget','[data-point-size]':'radius','[data-point-opacity]':'opacity','[data-point-color]':'color','[data-seed]':'seed',
    '[data-object]':'object','[data-reference]':'reference','[data-frame]':'frame','[data-point]':'point','[data-record]':'record','[data-horizon]':'horizon','[data-background]':'background','[data-sensitivity]':'sensitivity','[data-goal-pause]':'pauseGoal','[data-inspect-source]':'inspect','[data-parameter=solverIterations]':'iterations','[data-parameter=timeScale]':'rate','[data-parameter=contactStiffness]':'contactStiffness'
  };
  // Inputs/selects are never replaced; labels own a separate text slot.
  for(const [selector,key] of Object.entries(labels))host.querySelectorAll(selector).forEach(input=>{
    const label=input.closest('label');if(label){let span=label.querySelector(':scope>[data-label-slot]');if(!span){span=document.createElement('span');span.dataset.labelSlot='';for(const node of [...label.childNodes])if(node.nodeType===3)node.remove();label.prepend(span);}span.dataset.i18n='sim.'+key;span.textContent=t('sim.'+key);}
  });
  for(const [command,key] of Object.entries({auto:'auto',release:'release',lift:'lift',stretch:'stretch',fold:'fold',copy:'copy',state:'exportState',replay:'replay','clear-timeline':'clear',trajectory:'trajectory',predict:'compare','commit-a':'applyA','commit-b':'applyB',discard:'discard','close-focus':'close'})){
    const selector=`[data-command="${command}"]`;slot(selector,'sim.'+key);attr(selector,'sim.'+key);attr(selector,'sim.'+key,'title');
  }
  attr('[data-task]','sim.experiment');
  for(const [selector,key] of Object.entries({'.lab-back':'back','.tc-identity p':'subtitle','[data-workspace=console]':'console','[data-workspace=lab]':'lab','[data-render=surface]':'surface','[data-render=wire]':'wire','[data-render=particles]':'particles','[data-render=cloud]':'cloud','label[for=tc-view]':'view','.tc-research>summary>span:first-child':'inspector','.tc-research-caption':'inspectorCaption','.tc-method>summary':'assumptions','.tc-foot>a':'inspiration','[data-lab-panel] h2':'experiment','[data-lab-panel] legend':'effector','[data-joint] option[value=yaw]':'yaw','[data-joint] option[value=shoulder]':'shoulder','[data-joint] option[value=elbow]':'elbow','[data-point-color] option[value=material]':'material','[data-point-color] option[value=height]':'height','[data-point-color] option[value=depth]':'depth','[data-object] option[value=all]':'whole','[data-reference] option[value=""]':'origin','[data-point] option[value=""]':'noSelection','[data-frame] option[value=world]':'frameWorld','[data-frame] option[value=local]':'frameLocal','[data-frame] option[value=relative]':'frameRelative','[data-frame] option[value=camera]':'frameCamera','[data-inspect-source] option[value=hardware]':'hardware','[data-inspect-source] option[value=experiment]':'active','[data-focus-dialog] h2':'focus','.tc-coordinate-table th:first-child':'frameMeters','[data-panel=timeline] .tc-notice':'bounded','[data-panel=prediction] .tc-notice':'rolloutNotice','noscript':'javascript'}))slot(selector,'sim.'+key);
  for(const [selector,key] of Object.entries({'[data-joint]':'joints','[data-parameter=gravity]':'physics','[data-quality]':'rendering'}))host.querySelectorAll(selector).forEach(input=>{const summary=input.closest('details')?.querySelector('summary');if(summary){summary.dataset.i18n='sim.'+key;summary.textContent=t('sim.'+key);}});
  for(const [value,key] of Object.entries({low:'low',balanced:'balanced',high:'high',adaptive:'adaptive'}))text(`[data-quality] option[value=${value}]`,'sim.'+key);
  for(const [value,key] of Object.entries({'#101418':'darkStudio','#f7f9f9':'porcelain','#e3eceb':'mist','#243238':'graphite'}))text(`[data-background] option[value="${value}"]`,'sim.'+key);
  for(const [value,key] of Object.entries({perspective:'perspective',front:'front',back:'backView',left:'left',right:'right',top:'top',bottom:'bottom'}))text(`[data-view] option[value=${value}]`,'sim.'+key);
  for(const [value,key] of Object.entries({coordinates:'coordinates',world:'world',timeline:'timeline',prediction:'prediction'}))text(`[data-tab=${value}]`,'sim.'+key);
  for(const value of ['0','1'])text(`[data-arm] option[value="${value}"]`,'sim.'+(value==='0'?'left':'right'));
  for(const [selector,key] of Object.entries({'.tc-heading .tc-segment':'workspace','.tc-render':'representation','[data-view]':'view','.tc-viewport':'stage','[data-sidebar]':'controls','[data-inspector]':'stateInspector','.tc-tabs':'inspection','[data-focus-dialog]':'focusLabel','[data-focus-canvas]':'focusCanvas','[data-gallery]':'cartridges','[data-joint-value]':'angle','[data-scrub]':'position','[data-command=step]':'step','[data-command=reset]':'reset','[data-command=image]':'image','[data-command=fullscreen]':'fullscreen'})){attr(selector,'sim.'+key);if(selector.includes('data-command'))attr(selector,'sim.'+key,'title');}
  for(const task of registry){const name=t('task.'+task.id+'.name');host.querySelectorAll(`[data-task] option[value="${task.id}"]`).forEach(option=>{option.dataset.i18n='task.'+task.id+'.name';option.textContent=task.number+' / '+name;option.removeAttribute('data-i18n');});host.querySelectorAll(`[data-gallery-cartridge="${registry.indexOf(task)}"]`).forEach(button=>{button.ariaLabel=t('sim.insert',{name});button.title=task.number+' / '+name;});}
  bindTranslations(host);
}
