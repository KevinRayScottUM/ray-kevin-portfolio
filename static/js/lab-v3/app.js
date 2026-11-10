import {THREE, SoftwareRenderer, CameraRig, GeometrySampler, QUALITY, clamp, coordinateInFrame} from "./graphics.js";
import {ResearchConsole} from "./console.js";
import {WorldSimulator, Timeline, STEP, DEFAULTS, exportPoints, pointsCSV, pointsPLY} from "./simulation.js";
import {ExperimentSession} from "./session.js";
import {ExperimentInteraction} from "./experiment-view.js";
import {EmbeddedDisplay} from "./embedded-display.js";
import {screenIntersection,pickGeometry} from "./mechanics.js";
import {FaceController} from "./motion.js";
import {CartridgeGallery,TransferOverlay,transferPoseFromAnchor} from "./gallery.js";

const root=document.querySelector("[data-tc-app]");
if(root) start(root).catch(error=>{console.error(error);const status=root.querySelector("[data-loading]");status.hidden=false;status.textContent="Workspace unavailable: "+error.message;});

async function start(host) {
  const $=selector=>host.querySelector(selector), $$=selector=>[...host.querySelectorAll(selector)];
  const assets=host.dataset.assets.replace(/\/?$/, "/"),icons=host.dataset.icons.replace(/\/?$/, "/");
  const response=await fetch(assets+"experiments.json");if(!response.ok)throw new Error("Experiment registry unavailable");
  const registry=await response.json();
  const icon=name=>`<img src="${icons+name}.svg" width="17" height="17" alt="" aria-hidden="true">`;
  const button=(label,command,image="")=>`<button type="button" data-command="${command}" aria-label="${label||(command==="step"?"Advance one physics step":"Play or pause physics")}" title="${label||command}">${image?icon(image):""}${label}</button>`;
  const range=(label,key,value,min,max,step)=>`<label class="tc-row">${label}<input type="range" data-parameter="${key}" value="${value}" min="${min}" max="${max}" step="${step}"></label>`;
  const options=registry.map(task=>`<option value="${task.id}">${task.number} / ${task.name}</option>`).join("");
  $("[data-sidebar]").innerHTML=`
    <section data-console-panel><div class="tc-panel-heading"><h2>Cartridge bay</h2><output data-machine>EMPTY</output></div><div class="tc-cartridges">${registry.map((task,index)=>`<button type="button" style="--cart-color:${task.color}" data-cartridge="${index}" aria-label="Select ${task.name}" aria-pressed="${index===0}"><img src="${assets}logo-badge.png" alt=""><small>${task.number}</small><strong>${task.label}</strong></button>`).join("")}</div><div class="tc-command-row">${button("Insert","insert")}${button("Eject","eject")}${button("Launch · A","launch")}${button("Focus screen","focus","maximize-2")}</div><p class="tc-notice" data-console-status>Insert a cartridge</p>
    <fieldset class="tc-physical"><legend>Console controls</legend><div class="tc-dpad">${[["up","↑"],["left","←"],["down","↓"],["right","→"]].map(([action,label])=>`<button type="button" data-physical="${action}" aria-label="D-pad ${action}">${label}</button>`).join("")}</div><div class="tc-ab"><button type="button" data-physical="a">A</button><button type="button" data-physical="b">B</button></div><div class="tc-small-controls"><button type="button" data-physical="select">Select</button><button type="button" data-physical="start">Start</button></div></fieldset>
    <label class="tc-row">Power<button type="button" role="switch" aria-label="Console power" aria-checked="true" class="tc-power" data-command="power"><span>OFF</span><i aria-hidden="true"></i><span>ON</span></button></label><label class="tc-row">Sound<input type="checkbox" data-sound></label><label class="tc-row">Rotation sensitivity<input type="range" min="0.3" max="2" step="0.1" value="1" data-sensitivity></label></section>
    <section data-lab-panel hidden><div class="tc-panel-heading"><h2>Experiment</h2><output data-sim-time>0.00 s</output></div><select aria-label="Experiment" data-task>${options}</select><p class="tc-objective" data-objective></p><div class="tc-command-row">${button("","play","play")}${button("","step","step-forward")}${button("Auto","auto")}${button("Release","release")}</div><div class="tc-command-row" data-cloth-actions>${button("Lift","lift")}${button("Stretch","stretch")}${button("Fold","fold")}</div>
    <fieldset><legend>End effector / meters</legend><label class="tc-row">Arm<select data-arm><option value="0">Left</option><option value="1">Right</option></select></label>${["x","y","z"].map(axis=>`<label class="tc-row">${axis.toUpperCase()}<input type="number" min="${axis==="y"?.105:-.75}" max="${axis==="z"?.43:.85}" step="0.01" data-target="${axis}"></label>`).join("")}<label class="tc-row">Gripper<input type="range" min="0" max="1" step="0.01" value="0.1" data-opening></label><label class="tc-row">Tool tilt<input type="range" min="-1.57" max="1.57" step="0.01" value="0" data-tilt></label></fieldset>
    <details><summary>Joint control / radians</summary><label class="tc-row">Joint<select data-joint><option value="yaw">Base yaw</option><option value="shoulder">Shoulder</option><option value="elbow">Elbow</option></select></label><input type="range" aria-label="Joint angle" min="-2.5" max="2.5" step="0.01" value="0" data-joint-value></details>
    <details><summary>Physics parameters</summary>${range("Gravity","gravity",9.81,0,20,.1)}${range("Friction","friction",.45,0,1,.01)}${range("Damping","damping",.2,0,.95,.01)}${range("Constraint force / N","stiffness",40,1,100,1)}${range("EE speed / m/s","speed",.35,.05,1,.05)}<label class="tc-row">Cloth columns<select data-resolution><option>10</option><option selected>16</option><option>22</option></select></label></details><label class="tc-row">Grid<input type="checkbox" checked data-grid></label><label class="tc-row">Axes<input type="checkbox" data-axes></label></section>
    <details><summary>Rendering &amp; sampling</summary><label class="tc-row">Quality<select data-quality><option value="low">Low</option><option value="balanced" selected>Balanced</option><option value="high">High</option><option value="adaptive">Adaptive</option></select></label><label class="tc-row">Pixel-ratio limit<input type="range" min="1" max="2" step="0.25" value="2" data-pixel-ratio></label><label class="tc-row">Point budget<input type="number" min="300" max="6000" step="100" value="2400" data-point-budget></label><label class="tc-row">Point radius<input type="range" min="1" max="4" step="0.25" value="1.5" data-point-size></label><label class="tc-row">Opacity<input type="range" min="0.2" max="1" step="0.05" value="1" data-point-opacity></label><label class="tc-row">Color<select data-point-color><option value="material">Material</option><option value="height">Height</option><option value="depth">Depth</option></select></label><label class="tc-row">Seed<input type="number" min="0" max="99999" value="7" data-seed></label></details>`;
  const tabs=["coordinates","world","timeline","prediction"];
  $("[data-inspector]").innerHTML=`<div class="tc-tabs" role="tablist" aria-label="Inspection view">${tabs.map((tab,i)=>`<button type="button" role="tab" id="tc-tab-${tab}" aria-controls="tc-${tab}" aria-selected="${i===0}" tabindex="${i===0?0:-1}" data-tab="${tab}">${["Coordinates","World state","Timeline","Prediction"][i]}</button>`).join("")}</div>
    <div id="tc-coordinates" role="tabpanel" aria-labelledby="tc-tab-coordinates" class="tc-inspect-panel" data-panel="coordinates"><div class="tc-inspect-controls"><label>Object<select data-object><option value="all">Whole scene</option></select></label><label>Reference<select data-reference><option value="">World origin</option></select></label><label>Frame<select data-frame><option value="world">World</option><option value="local">Object local</option><option value="relative">Relative</option><option value="camera">Camera</option></select></label><label>Point<select data-point><option value="">No selection</option></select></label></div><div class="tc-coordinate-detail"><div><h3 data-point-id>No point selected</h3><table class="tc-coordinate-table"><thead><tr><th>Frame / m</th><th>X</th><th>Y</th><th>Z</th></tr></thead><tbody data-coordinates></tbody></table></div><div class="tc-point-summary"><p data-sample-stats></p><div class="tc-command-row">${button("Copy XYZ","copy","copy")}${button("CSV","csv")}${button("PLY","ply")}</div></div></div></div>
    <div id="tc-world" role="tabpanel" aria-labelledby="tc-tab-world" class="tc-inspect-panel" data-panel="world" hidden>${button("Export state","state","download")}<pre data-world-state></pre></div>
    <div id="tc-timeline" role="tabpanel" aria-labelledby="tc-tab-timeline" class="tc-inspect-panel" data-panel="timeline" hidden><div class="tc-command-row"><label>Record<input type="checkbox" data-record></label>${button("Replay","replay","play")}${button("Clear","clear-timeline")}${button("Export trajectory","trajectory")}<output data-timeline-count>0 / 180 snapshots</output></div><input aria-label="Timeline position" type="range" min="0" max="0" step="1" value="0" data-scrub><p class="tc-notice">Bounded state snapshots · 10 Hz · simulated time</p></div>
    <div id="tc-prediction" role="tabpanel" aria-labelledby="tc-tab-prediction" class="tc-inspect-panel" data-panel="prediction" hidden><div class="tc-inspect-controls"><label>Horizon / s<input type="number" min="0.25" max="3" step="0.25" value="1.5" data-horizon></label><label>A / ΔX / m<input type="number" min="-0.3" max="0.3" step="0.01" value="0.12" data-branch-a></label><label>B / ΔX / m<input type="number" min="-0.3" max="0.3" step="0.01" value="-0.12" data-branch-b></label>${button("Compare futures","predict")}</div><div class="tc-predictions" data-predictions></div><div class="tc-command-row">${button("Apply action A","commit-a")}${button("Apply action B","commit-b")}${button("Discard","discard")}</div><p class="tc-notice">Independent physical rollouts · no neural inference or real robot safety guarantee</p></div>`;
  $("[data-parameter=gravity]").closest("details").insertAdjacentHTML("beforeend",`${range("Solver iterations","solverIterations",10,4,24,1)}${range("Simulation rate","timeScale",1,.25,2,.25)}<label class="tc-row">Contact stiffness<input type="number" min="100000" max="100000000" step="1000000" value="10000000" data-parameter="contactStiffness"></label>`);
  $("[data-quality]").closest("details").insertAdjacentHTML("beforeend",'<label class="tc-row">Background<select data-background><option value="#f7f9f9">Porcelain</option><option value="#e3eceb">Mist</option><option value="#243238">Graphite</option></select></label>');
  $("[data-lab-panel]").insertAdjacentHTML("beforeend",'<label class="tc-row">Pause at goal<input type="checkbox" checked data-goal-pause></label>');
  $("[data-command=predict]").insertAdjacentHTML("beforebegin",'<label>A / Δtilt / rad<input type="number" min="-1.57" max="1.57" step="0.05" value="0" data-tilt-a></label><label>B / Δtilt / rad<input type="number" min="-1.57" max="1.57" step="0.05" value="0.35" data-tilt-b></label>');
  $("[data-panel=coordinates] .tc-inspect-controls").insertAdjacentHTML("afterbegin",'<label>Inspect<select data-inspect-source><option value="hardware">Console hardware</option><option value="experiment">Active experiment</option></select></label>');
  host.insertAdjacentHTML("beforeend",`<dialog class="tc-focus" data-focus-dialog aria-label="Focused console screen"><header><h2>TC-06 / Focus screen</h2>${button("Close","close-focus","minimize-2")}</header><canvas data-focus-canvas tabindex="0" aria-label="Interactive enlarged console touchscreen"></canvas><div class="tc-command-row">${["a","b","select","start"].map(action=>`<button type="button" data-physical="${action}">${action.toUpperCase()}</button>`).join("")}</div></dialog>`);
  const canvas=$("[data-canvas]"),renderer=new SoftwareRenderer(canvas),sampler=new GeometrySampler();
  const rigs={console:new CameraRig("console"),lab:new CameraRig("lab")};
  const reduced=matchMedia("(prefers-reduced-motion: reduce)");
  const abort=new AbortController(),on=(element,event,callback,options={})=>element.addEventListener(event,callback,{...options,signal:abort.signal});
  const worlds=new Map(),timeline=new Timeline(180);
  let mode="console",world=null,renderMode="surface",visible=true,dirty=true,disposed=false,inspectSource="hardware";
  let last=0,accumulator=0,frame=0,lastRender=0,lastInspect=0,lastSample=0,lastRecord=0,replayTime=0,replay=-1,rollouts=[],predicting=false,predictionToken=0,goalStreak=0;
  let points=[],selectedPoint="",filter="all",tab="coordinates",objectMap=new Map(),cameraTween=null,orbitVelocity={x:0,y:0};
  let toastTimer=0,pulseTimers=new Set();
  const params={...DEFAULTS};
  const session=new ExperimentSession((id,reset=false)=>{
    if(reset&&worlds.has(id)){worlds.get(id).dispose();worlds.delete(id);}
    if(!worlds.has(id))worlds.set(id,new WorldSimulator(id,params));
    world=worlds.get(id);return world;
  },{view:rigs.lab,startPaused:reduced.matches,onReset:()=>{interaction.end(true);timeline.clear();goalStreak=0;syncWorldUI(world.task);if(inspectWorld())rebuildObjects();dirty=true;}});
  const toast=message=>{const el=$("[data-toast]");el.textContent=message;el.classList.add("is-visible");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("is-visible"),2500);};
  const rig=()=>rigs[mode],scene=()=>mode==="console"?device.scene:world.scene;
  const inspectWorld=()=>Boolean(world&&(mode==="lab"||inspectSource==="experiment"));
  const inspectionScene=()=>inspectWorld()?world.scene:device.scene,inspectionRig=()=>inspectWorld()?rigs.lab:rigs.console;
  const device=await ResearchConsole.create(renderer,registry,assets,id=>{if(session.launch(id)){timeline.clear();lastRecord=world.time;goalStreak=0;syncWorldUI(id);updateMode();dirty=true;}},settings=>setQuality(settings.quality));
  device.session=session;session.power=device.power;
  const pose=new FaceController(device.scene);
  canvas.insertAdjacentHTML("afterend",`<div class="tc-gallery" data-gallery role="group" aria-label="Experiment cartridges"><div class="tc-gallery-strip"><canvas aria-hidden="true" data-gallery-canvas></canvas><div class="tc-gallery-targets">${registry.map((task,index)=>`<button type="button" class="tc-gallery-button" data-gallery-cartridge="${index}" data-cartridge="${index}" aria-label="Insert ${task.name}" aria-pressed="false" title="${task.number} / ${task.name}"></button>`).join("")}</div></div></div>`);
  const galleryElement=$("[data-gallery]"),gallery=new CartridgeGallery(galleryElement,device.model,registry,renderer.textures);
  canvas.insertAdjacentHTML("afterend",'<canvas class="tc-transfer" data-transfer-canvas aria-hidden="true" hidden></canvas>');
  const transferOverlay=new TransferOverlay($("[data-transfer-canvas]"));
  device.onInsertionRequest=()=>{releaseInput();if(focusDialog.open)focusDialog.close();if(!pose.transferReady)pose.toFace("front");gallery.clear();dirty=true;};
  device.getTransferPose=index=>transferPoseFromAnchor(gallery.anchor(index),rigs.console,device.scene,canvas.getBoundingClientRect());
  device.onTransferStart=index=>gallery.suspend(index);device.onTransferEnd=index=>gallery.release(index);
  const embedded=new EmbeddedDisplay(session,rigs.lab,device);
  const interaction=new ExperimentInteraction(session,rigs.lab,hit=>{if(inspectSource!=="experiment"){inspectSource="experiment";$("[data-inspect-source]").value=inspectSource;rebuildObjects();}selectHit({object:hit.object,point:null});});
  const focusDialog=$("[data-focus-dialog]"),focusCanvas=$("[data-focus-canvas]");
  device.onPowerChange=()=>{releaseInput();session.returnMenu();predictionToken++;predicting=false;rollouts=[];replay=-1;accumulator=0;if(focusDialog.open)focusDialog.close();embedded.force=true;dirty=true;};
  let frameMetrics={outerMs:0,embeddedMs:0,physicsMs:0,totalMs:0,fps:0},adaptiveLimit=2,measuredFrames=0,measuredSince=performance.now();
  function resize(){const b=canvas.getBoundingClientRect();if(!b.width||!b.height)return;renderer.resizeToViewport(b.width,b.height,window.devicePixelRatio||1,Math.min(Number($("[data-pixel-ratio]").value),adaptiveLimit));rigs.console.resize(b.width,b.height);rigs.console.theta=0;rigs.console.phi=Math.PI/2;rigs.console.update();gallery.resize(window.devicePixelRatio||1,renderer.quality);if(mode==="lab")rigs.lab.resize(b.width,b.height);else embedded.resize(renderer.quality==="high"?1280:1024);dirty=true;}
  function pulse(action) {device.press(action);dirty=true;const timer=setTimeout(()=>{device.release(action);pulseTimers.delete(timer);dirty=true;},140);pulseTimers.add(timer);}
  function setQuality(quality) {renderer.setQuality(quality);params.quality=quality;params.solverIterations=QUALITY[quality].iterations;$("[data-quality]").value=quality;$("[data-point-budget]").value=QUALITY[quality].points;$("[data-parameter=solverIterations]").value=QUALITY[quality].iterations;worlds.forEach(w=>{w.parameters.quality=quality;w.parameters.solverIterations=QUALITY[quality].iterations;w.physics.solver.iterations=QUALITY[quality].iterations;});resize();}
  function rebuildObjects() {
    objectMap=new Map();inspectionScene().traverseVisible(o=>{if(o.userData.id&&!o.userData.overlay)objectMap.set(o.userData.id,o);});
    for(const [selector,initial] of [["[data-object]","Whole scene"],["[data-reference]","World origin"]]) {
      const el=$(selector);el.replaceChildren(new Option(initial,selector.includes("reference")?"":"all"));
      for(const [id] of objectMap)el.add(new Option(id,id));
    }
    filter="all";selectedPoint="";refreshSamples(true);
  }
  function refreshSamples(force=false) {
    points=sampler.sampleScene(inspectionScene(),clamp(Number($("[data-point-budget]").value)||2400,300,6000),Number($("[data-seed]").value)||0,filter);
    if(inspectWorld())world.particleBodies.forEach(body=>{
      if(filter!=="all"&&filter!==body.tcId)return;
      const object=world.records.get(body.tcId).group;
      points.push({id:body.tcId+".particle",objectId:body.tcId,object,local:new THREE.Vector3(),world:new THREE.Vector3(body.position.x,body.position.y,body.position.z),color:new THREE.Color("#398d90"),triangle:null});
    });
    if(force) {
      const el=$("[data-point]");el.replaceChildren(new Option("No selection",""));
      points.slice(0,300).forEach(p=>el.add(new Option(p.id,p.id)));
    }
    if(selectedPoint&&!points.some(p=>p.id===selectedPoint))selectedPoint="";
  }
  function syncArm() {
    if(!world)return;const arm=world.arms[Number($("[data-arm]").value)];
    $$("[data-target]").forEach(input=>{if(document.activeElement!==input)input.value=arm.target[input.dataset.target].toFixed(3);});
    if(document.activeElement!==$("[data-opening]"))$("[data-opening]").value=arm.opening;
    if(document.activeElement!==$("[data-tilt]"))$("[data-tilt]").value=arm.tilt;
    if(document.activeElement!==$("[data-joint-value]"))$("[data-joint-value]").value=arm.angles[$("[data-joint]").value];
  }
  function updateMode() {
    orbitVelocity={x:0,y:0};
    $("[data-predictions]").replaceChildren();
    $$("[data-workspace]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.workspace===mode)));
    $("[data-console-panel]").hidden=mode!=="console";$("[data-lab-panel]").hidden=mode!=="lab";
    galleryElement.hidden=mode!=="console";
    const currentView=$("[data-view]").value;
    $("[data-view]").replaceChildren(...(mode==="console"?[["front","Front"],["back","Back"]]:[["perspective","Perspective"],["front","Front"],["back","Back"],["left","Left"],["right","Right"],["top","Top"],["bottom","Bottom"]]).map(([value,label])=>new Option(label,value)));
    $("[data-view]").value=mode==="console"?pose.face:currentView;
    if(mode==="lab")$$("[data-parameter]").forEach(input=>{const value=world.parameters[input.dataset.parameter];input.value=value??world.physics.solver.iterations;});
    ["record","scrub"].forEach(name=>$("[data-"+name+"]").disabled=!world);
    ["predict","replay","step","commit-a","commit-b"].forEach(name=>$("[data-command="+name+"]").disabled=!world);
    $("[data-inspect-source]").disabled=mode==="lab";
    $("[data-stage-title]").textContent=mode==="console"?"TC-06 / Console":registry.find(t=>t.id===world.task).name;
    canvas.setAttribute("aria-label",mode==="console"?"TC-06 3D console. Drag deliberately to flip front or back. Power, buttons and touchscreen are interactive.":"Physical experiment. Drag a gripper to manipulate, drag empty space to orbit.");
    rebuildObjects();syncArm();resize();embedded.force=true;dirty=true;last=0;accumulator=0;
  }
  function syncWorldUI(id) {
    $("[data-task]").value=id;
    const task=registry.find(t=>t.id===id);$("[data-objective]").textContent=task.objective;$("[data-method]").textContent=task.method;$("[data-limits]").textContent=task.limits;
    $("[data-cloth-actions]").hidden=id!=="cloth";$("[data-arm] option[value='1']").disabled=!["cloth","rope"].includes(id);$("[data-arm]").value="0";
    world.grid.visible=$("[data-grid]").checked;world.axes.visible=$("[data-axes]").checked;
  }
  function openLab(id) {
    const changed=world?.task!==id;
    predictionToken++;rollouts=[];replay=-1;goalStreak=0;
    session.activateLab(id);mode="lab";syncWorldUI(id);
    if(changed){timeline.clear();lastRecord=world.time;}
    releaseInput();updateMode();
  }
  function inspect() {
    const machine=device.machine;$("[data-machine]").textContent=device.lifecycle;
    $$("[data-cartridge]").forEach(b=>{const index=Number(b.dataset.cartridge);b.setAttribute("aria-pressed",String(index===(machine.queued??machine.selected)));b.disabled=b.dataset.galleryCartridge!==undefined&&b.dataset.vacant==="true";});
    $("[data-command=insert]").hidden=true;
    $("[data-command=launch]").disabled=!device.power.on||!device.ready||device.embedded;$("[data-command=eject]").disabled=machine.busy||machine.inserted===null;
    $("[data-command=power]").setAttribute("aria-checked",String(device.power.on));
    if(document.activeElement!==$("[data-sound]"))$("[data-sound]").checked=device.sound;
    $$("[data-physical]").forEach(b=>b.disabled=!device.power.on);
    $("[data-command=focus]").disabled=!device.embedded;
    const cameraControls=device.embedded&&!["PAUSE_MENU","CONTROLS","BOOTING"].includes(session.state);
    for(const direction of ["up","down","left","right"]){const b=$("[data-physical="+direction+"]");b.disabled=!device.power.on||cameraControls&&["left","right"].includes(direction);b.title=cameraControls?(direction==="up"?"Zoom in":direction==="down"?"Zoom out":"Inactive during experiment"):"D-pad "+direction;}
    $("[data-console-status]").textContent=!device.power.on?"Power off":device.embedded?registry.find(t=>t.id===world.task).name+" / "+session.state.replaceAll("_"," "):device.ready?"Ready / Press A to launch":machine.busy?machine.state:"Choose a cartridge";
    $("[data-stage-state]").textContent=mode==="console"?device.lifecycle:session.running?"Running / 60 Hz":"Paused";
    if(mode==="lab") {
      $("[data-sim-time]").textContent=world.time.toFixed(2)+" s";syncArm();
      $("[data-command=play]").innerHTML=icon(session.running?"pause":"play");$("[data-command=play]").ariaLabel=session.running?"Pause physics":"Play physics";
      $("[data-status]").textContent=world.metrics().success?"Goal conditions met":"Local CPU · "+world.action;
    } else $("[data-status]").textContent="Local CPU · No learned model";
    $("[data-performance]").textContent=`${renderer.width} × ${renderer.height} / ${(renderer.effectiveRatio||1).toFixed(2)}× · outer ${frameMetrics.outerMs.toFixed(1)} ms · screen ${frameMetrics.embeddedMs.toFixed(1)} ms · physics ${frameMetrics.physicsMs.toFixed(1)} ms · ${frameMetrics.fps.toFixed(0)} fps`;
    const point=points.find(p=>p.id===selectedPoint),reference=objectMap.get($("[data-reference]").value);
    $("[data-point-id]").textContent=point?.id||"No point selected";
    $("[data-coordinates]").replaceChildren();
    for(const frame of ["world","local","relative","camera"]) {
      const tr=document.createElement("tr");const position=point?coordinateInFrame(point.world,point.object,frame,inspectionRig().camera,reference):null;
      [frame,...(position?position.toArray().map(v=>v.toFixed(5)):["—","—","—"])].forEach(value=>{const td=document.createElement("td");td.textContent=value;tr.append(td);});$("[data-coordinates]").append(tr);
    }
    const box=new THREE.Box3();points.forEach(p=>box.expandByPoint(p.world));
    const center=points.reduce((v,p)=>v.add(p.world),new THREE.Vector3()).multiplyScalar(1/Math.max(1,points.length));
    $("[data-sample-stats]").textContent=`${points.length} surface samples / ${new Set(points.map(p=>p.objectId)).size} objects\nCentroid: ${center.toArray().map(v=>v.toFixed(3)).join(", ")} m\nExtent: ${box.getSize(new THREE.Vector3()).toArray().map(v=>v.toFixed(3)).join(" × ")} m`;
    $("[data-sample-stats]").style.whiteSpace="pre-line";
    if(tab==="world")$("[data-world-state]").textContent=JSON.stringify({presentation:mode,lifecycle:device.lifecycle,session:session.state,metrics:world?.metrics(),state:world?.snapshot(),machine:{state:machine.state,selected:machine.selected,inserted:machine.inserted},controls:{joystick:device.joy,pressed:[...device.pressed]}},null,2);
    $("[data-timeline-count]").textContent=`${timeline.frames.length} / 180 snapshots`;
    $("[data-scrub]").max=Math.max(0,timeline.frames.length-1);
    $("[data-command=commit-a]").disabled=!rollouts[0];$("[data-command=commit-b]").disabled=!rollouts[1];
  }
  function showTab(name) {
    tab=name;$$("[data-tab]").forEach(b=>{const active=b.dataset.tab===name;b.setAttribute("aria-selected",String(active));b.tabIndex=active?0:-1;});$$("[data-panel]").forEach(p=>p.hidden=p.dataset.panel!==name);inspect();
  }
  function save(content,name,type="application/json") {const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement("a");a.href=url;a.download="tensorcat-"+name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  const coordinateRows=()=>{refreshSamples();return exportPoints(points,$("[data-frame]").value,inspectionRig().camera,objectMap.get($("[data-reference]").value),inspectWorld()?world.time:null);};
  async function predict() {
    if(!world||predicting)return;session.running=false;predicting=true;rollouts=[];const token=++predictionToken;
    $("[data-command=predict]").disabled=true;$("[data-predictions]").textContent="Computing independent rollouts…";
    const snapshot=world.snapshot(),arm=Number($("[data-arm]").value),horizon=clamp(Number($("[data-horizon]").value)||1.5,.25,3),results=[];
    try {
      for(const key of ["a","b"]) {
        const target=[...snapshot.arms[arm].target];target[0]=clamp(target[0]+Number($("[data-branch-"+key+"]").value),-.75,.75);
        const action={arm,target,opening:snapshot.arms[arm].opening,tilt:clamp(snapshot.arms[arm].tilt+Number($("[data-tilt-"+key+"]").value),-1.57,1.57)},branch=new WorldSimulator(snapshot.task,snapshot.parameters,snapshot),path=[];
        branch.applyAction(action);
        try {for(let i=0;i<Math.round(horizon/STEP);i++){branch.step();if(i%4===0)path.push(branch.arms[arm].hand.clone());if(i%24===23){await new Promise(resolve=>requestAnimationFrame(resolve));if(disposed||token!==predictionToken)return;}}
          const ghosts=sampler.sampleScene(branch.scene,1800,7).filter(p=>!/robot|floor|worktable|socket|container|ring/.test(p.objectId)).map(p=>p.world.clone());
          results.push({action,path,ghosts,metrics:branch.metrics(),terminal:branch.snapshot()});}finally{branch.dispose();}
      }
      if(token!==predictionToken)return;rollouts=results;
      $("[data-predictions]").replaceChildren();results.forEach((r,i)=>{const article=document.createElement("article"),heading=document.createElement("h3"),p=document.createElement("p");heading.textContent="Branch "+(i?"B":"A");p.textContent=JSON.stringify(r.metrics,null,2);article.append(heading,p);$("[data-predictions]").append(article);});toast("Two futures computed; live state unchanged");
    } catch(error) {toast(error.message);$("[data-predictions]").textContent="Rollout failed: "+error.message;} finally {predicting=false;$("[data-command=predict]").disabled=!world;dirty=true;embedded.force=true;inspect();}
  }
  async function command(action) {
    if(action==="power"){device.beep();device.power.set(!device.power.on);dirty=true;inspect();return;}
    if(!device.power.on&&["launch","play","step","auto","release","lift","stretch","fold","predict","replay","commit-a","commit-b"].includes(action)){toast("Switch power ON first");return;}
    if(action==="insert")device.insert();else if(action==="eject"){interaction.end(true);device.eject();if(focusDialog.open)focusDialog.close();}else if(action==="launch")pulse("a");
    else if(action==="focus"){if(device.embedded&&!focusDialog.open){focusDialog.showModal();visible=true;resizeFocus();embedded.force=true;last=0;schedule();focusCanvas.focus({preventScroll:true});}}
    else if(action==="close-focus")focusDialog.close();
    else if(action==="fullscreen") {if(document.fullscreenElement)await document.exitFullscreen();else if(host.requestFullscreen)await host.requestFullscreen();else toast("Fullscreen is unavailable in this browser");}
    else if(action==="image")canvas.toBlob(blob=>{if(blob)save(blob,mode+".png","image/png");});
    else if(action==="reset") {predictionToken++;rollouts=[];orbitVelocity={x:0,y:0};releaseInput();if(mode==="console"){device.cancelInput();rig().reset();rig().theta=0;rig().phi=Math.PI/2;rig().update();pose.reset();$("[data-view]").value="front";}else session.reset();timeline.clear();}
    else if(action==="play") {session.running=!session.running;replay=-1;accumulator=0;}
    else if(action==="step"&&world) {session.running=false;world.step();dirty=true;refreshSamples();}
    else if(["auto","release","lift","stretch","fold"].includes(action)&&world){world.command(action);session.running=true;rollouts=[];}
    else if(action==="state")save(JSON.stringify(world?world.snapshot():{model:device.model.metadata,machine:device.machine},null,2),"state.json");
    else if(action==="csv")save(pointsCSV(coordinateRows()),"points.csv","text/csv");
    else if(action==="ply")save(pointsPLY(coordinateRows()),"points.ply","text/plain");
    else if(action==="copy") {const p=coordinateRows().find(p=>p.pointId===selectedPoint);if(p){await navigator.clipboard.writeText([p.x,p.y,p.z].join(", "));toast("XYZ copied / "+p.frame);}else toast("Select a point first");}
    else if(action==="trajectory")save(JSON.stringify({version:3,units:"m,s,rad",frames:timeline.frames},null,2),"trajectory.json");
    else if(action==="clear-timeline"){timeline.clear();replay=-1;}
    else if(action==="replay"&&world){if(timeline.frames.length){session.running=false;timeline.recording=false;$("[data-record]").checked=false;replay=0;}else toast("Record a trajectory first");}
    else if(action==="predict")await predict();
    else if(action==="discard"){predictionToken++;rollouts=[];$("[data-predictions]").replaceChildren();}
    else if(action.startsWith("commit-")&&world){const r=rollouts[action.endsWith("a")?0:1];if(r){world.applyAction(r.action);rollouts=[];session.running=true;toast("Action applied to current state");}}
    dirty=true;embedded.force=true;inspect();
  }
  on(host,"click",event=>{
    const b=event.target.closest("button");if(!b||b.disabled)return;
    if(b.dataset.command)command(b.dataset.command).catch(e=>toast(e.message));
    if(b.dataset.physical)pulse(b.dataset.physical);
    if(b.dataset.cartridge!==undefined)device.requestCartridgeInsertion(Number(b.dataset.cartridge));
    if(b.dataset.workspace){if(b.dataset.workspace==="lab")openLab(world?.task||registry[device.machine.selected].id);else{mode="console";if(!device.embedded)session.running=false;device.cancelInput();interaction.end(true);predictionToken++;rollouts=[];updateMode();}}
    if(b.dataset.render){renderMode=b.dataset.render;$$("[data-render]").forEach(e=>e.setAttribute("aria-pressed",String(e===b)));embedded.force=true;dirty=true;}
    if(b.dataset.tab)showTab(b.dataset.tab);
    dirty=true;
  });
  on(host,"keydown",event=>{const b=event.target.closest("[data-tab]");if(b&&["ArrowLeft","ArrowRight"].includes(event.key)){event.preventDefault();const next=tabs[(tabs.indexOf(b.dataset.tab)+(event.key==="ArrowLeft"?3:1))%4];showTab(next);$("[data-tab="+next+"]").focus();}});
  on(host,"change",event=>{
    const el=event.target;
    if(el.matches("[data-task]"))openLab(el.value);
    if(el.matches("[data-arm]"))syncArm();
    if(el.matches("[data-joint]"))syncArm();
    if(el.matches("[data-view]")){if(mode==="console"){if(!device.machine.busy)pose.toFace(el.value);}else{orbitVelocity={x:0,y:0};const r=rig(),start={theta:r.theta,phi:r.phi,distance:r.distance,target:r.target.clone()};r.preset(el.value);cameraTween={start,end:{theta:r.theta,phi:r.phi,distance:r.distance,target:r.target.clone()},time:performance.now()};r.theta=start.theta;r.phi=start.phi;r.distance=start.distance;r.target.copy(start.target);}}
    if(el.matches("[data-quality]")){adaptiveLimit=2;setQuality(el.value);embedded.force=true;}
    if(el.matches("[data-background]"))renderer.setBackground(el.value);
    if(el.matches("[data-sound]")){device.sound=el.checked;device.screenDirty=true;}
    if(el.matches("[data-resolution]")){params.resolution=Number(el.value);if(mode==="lab"&&world.task==="cloth")command("reset");}
    if(el.matches("[data-object]")){filter=el.value;selectedPoint="";refreshSamples(true);}
    if(el.matches("[data-point]")){selectedPoint=el.value;}
    if(el.matches("[data-point-budget],[data-seed]"))refreshSamples(true);
    if(el.matches("[data-record]")){timeline.recording=el.checked;if(el.checked&&world&&device.power.on){session.running=true;replay=-1;}}
    if(el.matches("[data-inspect-source]")){inspectSource=el.value;rebuildObjects();}
    if(el.matches("[data-grid]")&&world)world.grid.visible=el.checked;
    if(el.matches("[data-axes]")&&world)world.axes.visible=el.checked;
    dirty=true;embedded.force=true;inspect();
  });
  on(host,"input",event=>{
    const el=event.target;
    if(mode==="lab") {
      const arm=world.arms[Number($("[data-arm]").value)];
      if(el.dataset.target){arm.target[el.dataset.target]=clamp(Number(el.value)||0,Number(el.min),Number(el.max));world.auto=false;}
      if(el.matches("[data-opening]")){arm.opening=Number(el.value);world.auto=false;}
      if(el.matches("[data-tilt]")){arm.tilt=Number(el.value);world.auto=false;}
      if(el.dataset.parameter){params[el.dataset.parameter]=Number(el.value);world.parameters[el.dataset.parameter]=Number(el.value);}
      if(el.matches("[data-joint-value]")){arm.setJoint($("[data-joint]").value,Number(el.value));world.auto=false;}
      if(el.matches("[data-scrub]")){session.running=false;replay=-1;timeline.restore(world,Number(el.value));refreshSamples();syncArm();}
    }
    if(el.matches("[data-pixel-ratio]"))resize();
    dirty=true;embedded.force=true;
  });
  const pointers=new Map();let drag=null,touchDistance=0,touchCenter=null,wheelGestureUntil=0;
  let lastHover=null;
  const location=(event,hostCanvas=event.currentTarget)=>{const b=hostCanvas.getBoundingClientRect();return {x:event.clientX-b.left,y:event.clientY-b.top,w:b.width,h:b.height};};
  const screenUV=(p,hostCanvas=canvas,allowOutside=false)=>hostCanvas===focusCanvas?{u:p.x/p.w,v:1-p.y/p.h}:screenIntersection(rigs.console.ray(p.x,p.y,p.w,p.h),device.model.nodes.get("Screen_Surface"),allowOutside);
  const innerPosition=(p,hostCanvas,allowOutside=true)=>{const uv=screenUV(p,hostCanvas,allowOutside);return uv?{x:uv.u*embedded.width,y:(1-uv.v)*embedded.width*9/16,uv}:null;};
  function findAction(object) {for(let o=object;o;o=o.parent){if(o.userData.action)return o.userData.action;if(o.userData.cartridge)return "cartridge:"+o.userData.cartridge;if(o.name==="Joystick_Pivot")return "joystick";}return null;}
  function selectHit(hit) {
    if(!hit?.object)return;
    const id=hit.object.userData.id;if(!objectMap.has(id))return;
    if(filter!==id){filter=id;$("[data-object]").value=id;refreshSamples(true);}
    const point=hit.point||points[0];if(point){selectedPoint=point.id;const el=$("[data-point]");if(![...el.options].some(o=>o.value===selectedPoint))el.add(new Option(selectedPoint,selectedPoint));el.value=selectedPoint;}
    inspect();
  }
  function releaseInput(){
    interaction.end(true);device.cancelInput();if(device.power.dragging)device.power.release(true);
    for(const id of pointers.keys())for(const surface of [canvas,focusCanvas])if(surface.hasPointerCapture(id))surface.releasePointerCapture(id);
    pointers.clear();drag=null;touchDistance=0;touchCenter=null;orbitVelocity={x:0,y:0};wheelGestureUntil=0;
    if(pose.drag)pose.end(true);pose.unlock();gallery.clear();
  }
  function powerPosition(p){
    const local=rigs.console.ray(p.x,p.y,p.w,p.h).applyMatrix4(device.scene.matrixWorld.clone().invert()),point=local.intersectPlane(new THREE.Plane(new THREE.Vector3(0,0,1),-.032),new THREE.Vector3());
    return point?clamp((point.x+.098)/.016,0,1):device.power.slider.value;
  }
  function hoverBody(p,reducedMotion=false){
    if(mode!=="console"||device.machine.busy||pose.drag||pose.snap)return;
    const hit=pickGeometry(device.scene,rigs.console,p.x,p.y,p.w,p.h);
    if(!hit||hit.object.name==="Screen_Surface"||findAction(hit.object)){pose.clearHover();return;}
    const bounds=new THREE.Box3().setFromObject(device.model.nodes.get("Chassis")),min={x:Infinity,y:Infinity},max={x:-Infinity,y:-Infinity};
    for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){const v=rigs.console.project(new THREE.Vector3(x,y,z),p.w,p.h);min.x=Math.min(min.x,v.x);min.y=Math.min(min.y,v.y);max.x=Math.max(max.x,v.x);max.y=Math.max(max.y,v.y);}
    pose.point((p.x-(min.x+max.x)/2)/((max.x-min.x)/2),(p.y-(min.y+max.y)/2)/((max.y-min.y)/2),reducedMotion);
  }
  on(host,"pointermove",event=>{const b=event.target.closest("[data-cartridge]");if(!b||event.pointerType==="touch")return;const rect=b.getBoundingClientRect();gallery.point(Number(b.dataset.cartridge),(event.clientX-rect.left)/rect.width*2-1,(event.clientY-rect.top)/rect.height*2-1,reduced.matches);});
  on(host,"pointerout",event=>{const b=event.target.closest("[data-cartridge]");if(b&&!b.contains(event.relatedTarget))gallery.clear();});
  on(galleryElement,"scroll",()=>{gallery.clear();},{passive:true});
  function pointerDown(event){
    if(event.button>2)return;
    if(pointers.size&&["power","button","joystick"].includes(drag?.kind)&&!pointers.has(event.pointerId)){event.preventDefault();return;}
    const hostCanvas=event.currentTarget,p=location(event);hostCanvas.focus({preventScroll:true});event.preventDefault();hostCanvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId,p);cameraTween=null;orbitVelocity={x:0,y:0};
    if(pointers.size===2){const inner=hostCanvas===focusCanvas||mode==="lab"||drag?.kind.startsWith("screen");interaction.end(true);drag={kind:inner?"inner-touch":"outer-touch",host:hostCanvas};if(!inner&&!device.machine.busy)pose.begin(event.timeStamp);const pair=touchPair();if(pair){touchDistance=pair.distance;touchCenter=pair.center;}device.cancelInput();return;}
    const hit=hostCanvas===focusCanvas?null:pickGeometry(scene(),rig(),p.x,p.y,p.w,p.h);
    drag={kind:event.button===0?"orbit":"pan",host:hostCanvas,x:p.x,y:p.y,startX:p.x,startY:p.y,hit,moved:false};
    if(mode==="lab"&&hostCanvas!==focusCanvas){interaction.begin(p.x,p.y,p.w,p.h,event.button);drag.kind="lab";}
    else if(hostCanvas===focusCanvas||hit?.object.name==="Screen_Surface"){
      pose.lock();
      const uv=screenUV(p,hostCanvas);if(uv){const ui=device.screenActionAt(uv.u,uv.v);drag.kind="screen-ui";drag.ui=ui?.id;
        if(device.embedded&&session.state!=="BOOTING"&&!ui&&session.running){const inner=innerPosition(p,hostCanvas);interaction.begin(inner.x,inner.y,embedded.width,embedded.width*9/16,event.button);drag.kind="screen-scene";}
      }
    }else if(mode==="console"&&event.button===0&&hit){const action=findAction(hit.object);
      if(action?.startsWith("power")){drag.kind="power";pose.lock();if(action==="power-off"||action==="power-on"){device.beep();device.power.set(action==="power-on");drag=null;}else{device.power.begin();device.power.move(powerPosition(p));}}
      else if(action==="joystick"){drag.kind="joystick";pose.lock();}
      else if(action){drag.kind="button";drag.action=action;pose.lock();device.press(action);}
    }
    if(mode==="console"&&drag?.kind==="orbit"){if(device.machine.busy)drag.kind="idle";else pose.begin(event.timeStamp);}
    dirty=true;embedded.force=true;
  }
  function touchPair(){
    let pair=[...pointers.values()];if(pair.length!==2)return null;
    if(drag.kind==="inner-touch"&&mode==="console"){pair=pair.map(p=>innerPosition(p,drag.host));if(pair.some(p=>!p))return null;}
    const[a,b]=pair;return{distance:Math.hypot(a.x-b.x,a.y-b.y),center:{x:(a.x+b.x)/2,y:(a.y+b.y)/2}};
  }
  function pointerMove(event){
    lastHover={clientX:event.clientX,clientY:event.clientY,host:event.currentTarget};
    if(!pointers.has(event.pointerId)){if(event.currentTarget===canvas&&event.pointerType!=="touch")hoverBody(location(event),reduced.matches);return;}const p=location(event);pointers.set(event.pointerId,p);if(!drag)return;
    const sensitivity=Number($("[data-sensitivity]").value);
    if(pointers.size===2){const pair=touchPair();if(pair){const inner=drag.kind==="inner-touch",camera=inner?rigs.lab:rigs.console;if(touchDistance>0)camera.zoom(Math.log(touchDistance/Math.max(1,pair.distance))*500);if(touchCenter){const dx=(pair.center.x-touchCenter.x)*sensitivity,dy=(pair.center.y-touchCenter.y)*sensitivity;if(inner)camera.orbit(dx*.5,dy*.5);else pose.move(dx,dy,p.w,event.timeStamp);}touchDistance=pair.distance;touchCenter=pair.center;}dirty=true;embedded.force=true;return;}
    const dx=p.x-drag.x,dy=p.y-drag.y;drag.moved ||= Math.hypot(p.x-drag.startX,p.y-drag.startY)>4;
    if(drag.kind==="orbit")pose.move(dx*sensitivity,dy*sensitivity,p.w,event.timeStamp);
    if(drag.kind==="pan")rigs.console.pan(dx,dy);
    if(drag.kind==="joystick")device.setJoystick((p.x-drag.startX)/Math.max(24,p.w*.045),-(p.y-drag.startY)/Math.max(24,p.w*.045));
    if(drag.kind==="power")device.power.move(powerPosition(p));
    if(drag.kind==="screen-scene"){const inner=innerPosition(p,drag.host);if(inner)interaction.move(inner.x,inner.y);}
    if(drag.kind==="lab")interaction.move(p.x,p.y);
    drag.x=p.x;drag.y=p.y;dirty=true;embedded.force=true;
  }
  function endPointer(event) {
    const ended=drag;
    if(ended?.kind==="power")device.power.release(event.type!=="pointerup");
    if(ended?.kind==="orbit"||ended?.kind==="outer-touch"){pose.end(event.type!=="pointerup");$("[data-view]").value=pose.face;}
    if(ended?.action)device.release(ended.action);
    if(ended?.kind==="joystick")device.setJoystick(0,0);
    if(ended?.kind==="screen-scene"||ended?.kind==="lab")interaction.end(event.type!=="pointerup");
    if(event.type==="pointerup"&&ended&&!ended.moved&&pointers.size===1) {
      if(ended.kind==="screen-ui"){const uv=screenUV(location(event),ended.host);if(uv){const ui=device.screenActionAt(uv.u,uv.v);if(ui?.id===ended.ui)ui?.action();}}
      if(["orbit","pan"].includes(ended.kind)&&ended.hit){if(inspectSource!=="hardware"){inspectSource="hardware";$("[data-inspect-source]").value=inspectSource;rebuildObjects();}selectHit({object:ended.hit.object,point:null});}
    }
    pointers.delete(event.pointerId);drag=null;touchDistance=0;touchCenter=null;pose.unlock();dirty=true;embedded.force=true;
  }
  function ownsInner(event,hostCanvas){if(mode==="lab"||hostCanvas===focusCanvas)return true;const p=location(event,hostCanvas);return device.embedded&&pickGeometry(device.scene,rigs.console,p.x,p.y,p.w,p.h)?.object.name==="Screen_Surface";}
  function wheel(event){event.preventDefault();cameraTween=null;orbitVelocity={x:0,y:0};if(ownsInner(event,event.currentTarget))interaction.wheel(event.deltaX,event.deltaY,event.ctrlKey||event.metaKey,event.shiftKey);else if(event.ctrlKey||event.metaKey)rigs.console.zoom(event.deltaY);else if(!device.machine.busy){if(!wheelGestureUntil)pose.begin(event.timeStamp);pose.move(event.deltaX*.55,event.deltaY*.35,canvas.getBoundingClientRect().width,event.timeStamp);wheelGestureUntil=performance.now()+130;}dirty=true;embedded.force=true;}
  let gestureScale=1,gestureInner=false;
  const keys={ArrowUp:"up",ArrowDown:"down",ArrowLeft:"left",ArrowRight:"right",w:"up",s:"down",a:"a",d:"right",j:"a",k:"b",Enter:"a",Escape:"b"," ":"start",Backspace:"b"};
  for(const inputCanvas of [canvas,focusCanvas]){
    on(inputCanvas,"pointerdown",pointerDown);on(inputCanvas,"pointermove",pointerMove);["pointerup","pointercancel","lostpointercapture"].forEach(name=>on(inputCanvas,name,endPointer));on(inputCanvas,"contextmenu",event=>event.preventDefault());on(inputCanvas,"wheel",wheel,{passive:false});
    on(inputCanvas,"pointerleave",()=>{pose.clearHover();});
    on(inputCanvas,"gesturestart",event=>{event.preventDefault();gestureScale=event.scale;gestureInner=ownsInner(lastHover||event,inputCanvas);},{passive:false});
    on(inputCanvas,"gesturechange",event=>{event.preventDefault();(gestureInner?rigs.lab:rigs.console).zoom(Math.log(gestureScale/event.scale)*500);gestureScale=event.scale;dirty=true;embedded.force=true;},{passive:false});
    on(inputCanvas,"keydown",event=>{const action=keys[event.key];if(!action||event.repeat)return;event.preventDefault();if(mode==="console")device.press(action);else session.dispatch(action);dirty=true;embedded.force=true;});
    on(inputCanvas,"keyup",event=>{if(keys[event.key])device.release(keys[event.key]);});on(inputCanvas,"blur",()=>{releaseInput();dirty=true;});
  }
  function resizeFocus(){
    if(!focusDialog.open)return;const width=focusCanvas.getBoundingClientRect().width;
    embedded.resize(Math.max(renderer.quality==="high"?1280:1024,width*(window.devicePixelRatio||1)));
    if(focusCanvas.width!==embedded.width||focusCanvas.height!==Math.round(embedded.width*9/16)){focusCanvas.width=embedded.width;focusCanvas.height=Math.round(embedded.width*9/16);}
    focusCanvas.getContext("2d").drawImage(device.screen,0,0,focusCanvas.width,focusCanvas.height);embedded.force=true;
  }
  on(focusDialog,"close",()=>{interaction.end(true);device.cancelInput();const b=canvas.getBoundingClientRect();visible=b.bottom>0&&b.top<innerHeight;resize();last=0;dirty=true;schedule();});
  on(window,"blur",()=>{releaseInput();dirty=true;});
  on(reduced,"change",()=>{if(reduced.matches){session.running=false;orbitVelocity={x:0,y:0};}dirty=true;});
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(canvas.parentElement);
  const focusObserver=new ResizeObserver(()=>{if(focusDialog.open)resizeFocus();});focusObserver.observe(focusCanvas);
  const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting||focusDialog.open;if(visible){last=0;schedule();}else{cancelAnimationFrame(frame);frame=0;}});observer.observe(canvas);
  on(document,"visibilitychange",()=>{releaseInput();if(document.hidden){cancelAnimationFrame(frame);frame=0;}else{last=0;schedule();}});
  function tick(now) {
    frame=0;if(disposed||document.hidden||!visible)return;
    const frameStart=performance.now();
    const dt=last?Math.min((now-last)/1000,.08):0;last=now;
    session.advance(dt,reduced.matches);
    if(mode==="console"){
      if(wheelGestureUntil&&now>wheelGestureUntil){pose.end();wheelGestureUntil=0;$("[data-view]").value=pose.face;}
      const poseChanged=pose.update(dt,reduced.matches);device.canTransfer=pose.transferReady;
      const hardwareChanged=device.update(dt,reduced.matches);dirty ||= poseChanged||hardwareChanged||device.screenState==="boot"||device.pressed.size>0;
      gallery.sync(device.machine);
      gallery.update(dt,reduced.matches);
    }
    if(cameraTween) {const t=clamp((now-cameraTween.time)/(reduced.matches?1:650),0,1),s=t*t*(3-2*t),r=rig(),{start,end}=cameraTween;r.theta=start.theta+(end.theta-start.theta)*s;r.phi=start.phi+(end.phi-start.phi)*s;r.distance=start.distance+(end.distance-start.distance)*s;r.target.copy(start.target).lerp(end.target,s);r.update();if(t===1)cameraTween=null;dirty=true;}
    const physicsStart=performance.now();
    if(world&&session.running&&(mode==="lab"||device.embedded)&&!predicting) {
      accumulator+=dt*world.parameters.timeScale;let steps=0;
      try {while(accumulator>=STEP&&steps<4){world.step();accumulator-=STEP;steps++;if(timeline.recording&&world.time-lastRecord>=.099){timeline.record(world);lastRecord=world.time;$("[data-scrub]").value=timeline.frames.length-1;}
        goalStreak=world.metrics().success?goalStreak+1:0;
        if(goalStreak>=8&&$("[data-goal-pause]").checked){session.running=false;accumulator=0;toast("Goal conditions met / physics paused");break;}
      }}catch(error){session.running=false;toast("Physics paused: "+error.message);console.error(error);}
      if(steps)dirty=true;if(steps===4)accumulator=0;
    }
    frameMetrics.physicsMs=performance.now()-physicsStart;
    if(world&&replay>=0&&now-replayTime>100){replayTime=now;timeline.restore(world,replay);$("[data-scrub]").value=replay++;if(replay>=timeline.frames.length)replay=-1;dirty=true;embedded.force=true;}
    if(mode==="console"&&device.embedded){
      const updated=embedded.render(now,renderMode,{pointBudget:Number($("[data-point-budget]").value),seed:Number($("[data-seed]").value),pointColor:$("[data-point-color]").value,pointSize:Number($("[data-point-size]").value),pointOpacity:Number($("[data-point-opacity]").value),paths:rollouts.map((r,i)=>({points:r.path,color:i?"#c38c69":"#4c9b92"})),ghosts:rollouts.map((r,i)=>({points:r.ghosts,color:i?"#c38c69":"#4c9b92"}))});
      if(updated){dirty=true;frameMetrics.embeddedMs=embedded.renderer.stats.ms;if(focusDialog.open)focusCanvas.getContext("2d").drawImage(device.screen,0,0,focusCanvas.width,focusCanvas.height);}
    }
    if(dirty&&now-lastRender>=1000/30) {
      lastRender=now;
      if(renderMode==="cloud"||selectedPoint||now-lastSample>=200){refreshSamples();lastSample=now;}
      const hardwarePoints=mode==="console"&&inspectWorld()&&renderMode==="cloud"?sampler.sampleScene(device.scene,Number($("[data-point-budget]").value),Number($("[data-seed]").value)):points;
      const staticKey=mode==="console"&&!device.isAnimating&&pose.settled&&!cameraTween&&renderMode==="surface"?JSON.stringify([renderer.width,renderer.height,renderer.background,rig().distance,rig().target.toArray(),device.hardwareRevision,pose.revision,selectedPoint]):null;
      renderer.render(scene(),rig(),{mode:renderMode,staticKey,screenOverlay:mode==="console",points:hardwarePoints,particles:mode==="lab"?world.particleBodies.map(b=>new THREE.Vector3(b.position.x,b.position.y,b.position.z)):[],pointColor:$("[data-point-color]").value,pointSize:Number($("[data-point-size]").value),pointOpacity:Number($("[data-point-opacity]").value),selected:(mode==="lab"||!inspectWorld())?points.find(p=>p.id===selectedPoint)?.world:null,paths:mode==="lab"?rollouts.map((r,i)=>({points:r.path,color:new THREE.Color(i?"#c38c69":"#4c9b92")})):[],ghosts:mode==="lab"?rollouts.map((r,i)=>({points:r.ghosts,color:i?"#c38c69":"#4c9b92"})):[]});
      transferOverlay.present(renderer,mode==="console"&&["ALIGNING","INSERTING","EJECTING"].includes(device.machine.state));
      frameMetrics.outerMs=renderer.stats.ms;frameMetrics.totalMs=performance.now()-frameStart;measuredFrames++;
      if(now-measuredSince>=1000){frameMetrics.fps=measuredFrames*1000/(now-measuredSince);measuredFrames=0;measuredSince=now;}
      $("[data-loading]").hidden=true;
      dirty=false;
      if(renderer.quality==="adaptive"&&frameMetrics.totalMs>55&&adaptiveLimit>1){adaptiveLimit=Math.max(1,adaptiveLimit-.125);resize();}
    }
    if(now-lastInspect>200){lastInspect=now;inspect();}schedule();
  }
  function schedule(){if(!frame&&!disposed&&visible&&!document.hidden)frame=requestAnimationFrame(tick);}
  function dispose(){if(disposed)return;disposed=true;predictionToken++;cancelAnimationFrame(frame);abort.abort();resizeObserver.disconnect();focusObserver.disconnect();observer.disconnect();clearTimeout(toastTimer);pulseTimers.forEach(clearTimeout);interaction.end(true);transferOverlay.dispose();gallery.dispose();embedded.dispose();device.dispose();renderer.staticCache=null;worlds.forEach(w=>w.dispose());}
  on(window,"pagehide",event=>{device.cancelInput();cancelAnimationFrame(frame);frame=0;if(!event.persisted)dispose();});
  on(window,"pageshow",()=>{last=0;dirty=true;resize();schedule();});
  // Read-only diagnostics expose the actual live state for reproducible local QA.
  host.tcInteractionDiagnostics=()=>({power:{state:device.power.state,value:device.power.slider.value,dragging:device.power.dragging},face:{committed:pose.face,yaw:pose.yaw,pitch:pose.pitch,quaternion:device.scene.quaternion.toArray(),hover:[pose.hover.pitch.value,pose.hover.yaw.value],dragging:Boolean(pose.drag),snapping:Boolean(pose.snap),transferReady:pose.transferReady},gallery:gallery.diagnostics(),pointerOwner:drag?.kind||null,queue:device.machine.queued,visiblePhysicalCartridges:registry.filter(t=>device.model.nodes.get("Cartridge_"+t.id).visible).map(t=>t.id),screenSize:[device.screen.width,device.screen.height],galleryRenderMs:gallery.renderer.stats.ms});
  host.tcDiagnostics=()=>({mode,task:world?.task,renderMode,running:session.running,lifecycle:device.lifecycle,session:{state:session.state,cartridgeId:session.cartridgeId,arm:session.arm,axes:session.axes},focus:focusDialog.open,camera:{theta:rig().theta,phi:rig().phi,distance:rig().distance,target:rig().target.toArray()},innerCamera:{theta:rigs.lab.theta,phi:rigs.lab.phi,distance:rigs.lab.distance,target:rigs.lab.target.toArray()},renderer:{...renderer.stats,width:renderer.width,height:renderer.height,effectiveRatio:renderer.effectiveRatio},embeddedRenderer:{...embedded.renderer.stats,width:embedded.renderer.width,height:embedded.renderer.height,frames:embedded.frames},performance:{...frameMetrics},samples:points.length,machine:{state:device.machine.state,selected:device.machine.selected,inserted:device.machine.inserted,screen:device.screenState,joystick:{...device.joy},pressed:[...device.pressed],cartridges:registry.map((task,i)=>{const node=device.model.nodes.get("Cartridge_"+task.id);return{id:task.id,visible:node.visible,position:node.position.toArray(),bounds:{min:device.mechanisms[i].bounds.min.toArray(),max:device.mechanisms[i].bounds.max.toArray()},seat:device.mechanisms[i].seat.toArray(),contained:device.mechanisms[i].contained()};})},metrics:world?.metrics(),snapshot:world?.snapshot(),timeline:timeline.frames.length,rollouts:rollouts.map(r=>r.metrics)});
  updateMode();resize();schedule();
}
