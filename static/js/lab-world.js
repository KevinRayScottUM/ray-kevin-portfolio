import * as THREE from "../vendor/three/three.module.min.js";
import { SVGRenderer } from "../vendor/three/renderers/SVGRenderer.js";
import { OrbitControls } from "../vendor/three/controls/OrbitControls.js";
import * as CANNON from "../vendor/cannon-es/cannon-es.js";

// A local cloth proxy, not a learned world model. SVGRenderer never requests WebGL.
export function createWorld(host, requestFrame, reportPointer, reportCamera = () => {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#f8fafb");
  const camera = new THREE.OrthographicCamera(-4.5, 4.5, 3, -3, 0.1, 60);
  camera.position.set(4.6, 3.5, 7.5);
  const renderer = new SVGRenderer();
  renderer.setQuality("high");
  renderer.setPrecision(2);
  renderer.overdraw = 0.4;
  renderer.domElement.setAttribute("aria-hidden", "true");
  host.appendChild(renderer.domElement);
  function releaseDocumentScroll() { document.documentElement.classList.remove("lab-scene-engaged"); }
  host.addEventListener("pointerenter", event => {
    if (event.pointerType === "mouse") document.documentElement.classList.add("lab-scene-engaged");
  });
  host.addEventListener("pointerleave", releaseDocumentScroll);
  window.addEventListener("blur", releaseDocumentScroll);
  window.addEventListener("pagehide", releaseDocumentScroll);
  const controls = new OrbitControls(camera, host);
  controls.target.set(0, 1.35, 0);
  controls.enablePan = false;
  controls.rotateSpeed = -1;
  controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
  controls.enableDamping = true;
  controls.dampingFactor = 0.14;
  controls.minZoom = 0.8;
  controls.maxZoom = 2.1;
  controls.minPolarAngle = 0.35;
  controls.maxPolarAngle = Math.PI / 2 - 0.06;
  controls.update();
  controls.saveState();
  controls.addEventListener("change", requestFrame);
  let wheelActive = false;
  let thetaGoal = 0, phiGoal = 0, zoomGoal = 1;
  let safariGesture = false, gestureZoom = 1;
  let gestureUntil = 0;
  const cameraSpherical = new THREE.Spherical();
  function beginCameraGesture() {
    if (wheelActive) return;
    // Flush the native drag's residual damping before starting another input source.
    controls.enableDamping = false;
    controls.update();
    controls.enableDamping = true;
    cameraSpherical.setFromVector3(camera.position.clone().sub(controls.target));
    thetaGoal = cameraSpherical.theta;
    phiGoal = cameraSpherical.phi;
    zoomGoal = camera.zoom;
    wheelActive = true;
  }
  controls.addEventListener("start", () => { wheelActive = false; });
  function advanceCamera(dt, noMotion) {
    if (!wheelActive) return false;
    cameraSpherical.setFromVector3(camera.position.clone().sub(controls.target));
    const angleDelta = Math.atan2(Math.sin(thetaGoal - cameraSpherical.theta), Math.cos(thetaGoal - cameraSpherical.theta));
    const blend = noMotion ? 1 : 1 - Math.exp(-dt * 8);
    cameraSpherical.theta += angleDelta * blend;
    cameraSpherical.phi += (phiGoal - cameraSpherical.phi) * blend;
    camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(cameraSpherical));
    camera.zoom += (zoomGoal - camera.zoom) * blend;
    camera.updateProjectionMatrix();
    const unsettled = Math.abs(angleDelta) + Math.abs(phiGoal - cameraSpherical.phi) + Math.abs(zoomGoal - camera.zoom);
    if (unsettled < 0.0003) wheelActive = false;
    return wheelActive;
  }
  host.addEventListener("wheel", event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (dragging >= 0) return;
    if (event.ctrlKey && (safariGesture || performance.now() < gestureUntil)) return;
    beginCameraGesture();
    const units = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? host.clientHeight : 1;
    const dx = THREE.MathUtils.clamp(event.deltaX * units, -160, 160);
    const dy = THREE.MathUtils.clamp(event.deltaY * units, -160, 160);
    if (event.ctrlKey || event.deltaMode !== 0) {
      zoomGoal = THREE.MathUtils.clamp(zoomGoal * Math.exp(-dy * 0.004), controls.minZoom, controls.maxZoom);
    } else {
      thetaGoal += dx * 0.0035;
      phiGoal = THREE.MathUtils.clamp(phiGoal + dy * 0.0035, controls.minPolarAngle, controls.maxPolarAngle);
    }
    requestFrame();
  }, { capture: true, passive: false });
  // Safari can report trackpad pinches as GestureEvents rather than ctrl+wheel.
  host.addEventListener("gesturestart", event => {
    event.preventDefault(); event.stopImmediatePropagation();
    if (dragging >= 0) return;
    beginCameraGesture();
    safariGesture = true; gestureZoom = zoomGoal;
  }, { capture: true, passive: false });
  host.addEventListener("gesturechange", event => {
    event.preventDefault(); event.stopImmediatePropagation();
    if (!safariGesture || !Number.isFinite(event.scale)) return;
    zoomGoal = THREE.MathUtils.clamp(gestureZoom * event.scale, controls.minZoom, controls.maxZoom);
    wheelActive = true;
    requestFrame();
  }, { capture: true, passive: false });
  host.addEventListener("gestureend", event => {
    event.preventDefault();
    safariGesture = false; gestureUntil = performance.now() + 100;
  }, { capture: true, passive: false });

  scene.add(new THREE.AmbientLight("#ffffff", 0.85));
  const light = new THREE.DirectionalLight("#ffffff", 0.8);
  light.position.set(-3, 7, 5);
  scene.add(light);
  const fill = new THREE.DirectionalLight("#dbe9ff", 0.3);
  fill.position.set(5, 2, -4);
  scene.add(fill);

  const white = new THREE.MeshLambertMaterial({ color: "#d8e0e9" });
  const dark = new THREE.MeshLambertMaterial({ color: "#303c4a" });
  const metal = new THREE.MeshLambertMaterial({ color: "#8694a6" });
  const accent = new THREE.MeshLambertMaterial({ color: "#2563eb" });
  const floorMaterial = new THREE.MeshLambertMaterial({ color: "#eff2f5", side: THREE.DoubleSide });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 4.3), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.045;
  scene.add(floor);
  const grid = new THREE.GridHelper(7.2, 18, "#d8dfe8", "#e1e6ed");
  grid.position.y = -0.035;
  grid.material.transparent = true;
  grid.material.opacity = 0.5;
  scene.add(grid);

  function box(size, material, parent) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    parent.add(mesh);
    return mesh;
  }
  function cylinder(radius, depth, material, parent) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, depth, 8), material);
    parent.add(mesh);
    return mesh;
  }
  const up = new THREE.Vector3(0, 1, 0);
  function connect(mesh, start, end) {
    const delta = new THREE.Vector3().subVectors(end, start);
    mesh.position.copy(start).addScaledVector(delta, 0.5);
    mesh.scale.y = delta.length();
    mesh.quaternion.setFromUnitVectors(up, delta.normalize());
  }
  function arm(side) {
    const group = new THREE.Group();
    scene.add(group);
    const base = cylinder(0.38, 0.13, dark, group);
    base.position.set(side * 2.5, 0.065, -0.12);
    const pedestal = cylinder(0.24, 0.37, white, group);
    pedestal.position.set(side * 2.5, 0.28, -0.12);
    const collar = cylinder(0.255, 0.07, accent, group);
    collar.position.set(side * 2.5, 0.4, -0.12);
    const linkA = box([0.23, 1, 0.24], white, group);
    const linkB = box([0.18, 1, 0.19], white, group);
    const joints = [];
    for (let i = 0; i < 3; i++) {
      const joint = cylinder(i === 1 ? 0.17 : 0.145, 0.3, dark, group);
      joint.rotation.x = Math.PI / 2;
      joints.push(joint);
    }
    const grip = new THREE.Group();
    group.add(grip);
    const palm = box([0.22, 0.11, 0.18], dark, grip);
    palm.position.y = 0.15;
    [-1, 1].forEach(sign => {
      const finger = box([0.035, 0.15, 0.11], metal, grip);
      finger.position.set(sign * 0.065, 0.045, 0);
      const pad = box([0.04, 0.04, 0.12], accent, grip);
      pad.position.set(sign * 0.045, -0.025, 0);
    });
    const markerMaterial = new THREE.MeshBasicMaterial({ color: side < 0 ? "#e87957" : "#2563eb" });
    const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.075), markerMaterial);
    group.add(marker);
    return { side, group, linkA, linkB, joints, grip, marker, shoulder: new THREE.Vector3(side * 2.5, 0.55, -0.12) };
  }
  const arms = [arm(-1), arm(1)];
  const handles = arms.map(() => new THREE.Vector3());
  const offsets = [{ x: 0, y: 0 }, { x: 0, y: 0 }];
  function poseArm(robot, hand) {
    const wrist = hand.clone().add(new THREE.Vector3(0, 0.2, 0));
    const direction = wrist.clone().sub(robot.shoulder);
    const distance = THREE.MathUtils.clamp(direction.length(), 0.2, 2.94);
    direction.normalize();
    const along = (1.45 * 1.45 - 1.5 * 1.5 + distance * distance) / (2 * distance);
    const normal = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 0, 1), direction).normalize();
    const elbow = robot.shoulder.clone().addScaledVector(direction, along)
      .addScaledVector(normal, Math.sqrt(Math.max(0, 1.45 * 1.45 - along * along)) * -robot.side);
    connect(robot.linkA, robot.shoulder, elbow);
    connect(robot.linkB, elbow, wrist);
    [robot.shoulder, elbow, wrist].forEach((p, i) => robot.joints[i].position.copy(p));
    robot.grip.position.copy(hand);
    robot.marker.position.copy(hand);
    robot.marker.position.z += 0.13;
  }

  let world, bodies = [], geometry, cloth, wire, particles, options = {};
  let columns = 16, rows = 11;
  let activityFrames = 0;
  let dragging = -1;
  let dragPointer = null;
  let reduced = false;
  let latestPhase = 0;
  const clothMaterial = new THREE.MeshLambertMaterial({ color: "#2563eb", side: THREE.DoubleSide });
  const wireMaterial = new THREE.MeshBasicMaterial({ color: "#234275", wireframe: true, transparent: true, opacity: 0.65 });
  const pointMaterial = new THREE.PointsMaterial({ color: "#2563eb", size: 0.025, sizeAttenuation: true });

  function targetHands(phase) {
    const spread = 1.03 + (options.response || 0) * 0.43;
    const lift = 2.0 + (options.lift || 0) * 0.65;
    handles.forEach((hand, i) => {
      const side = i === 0 ? -1 : 1;
      const sway = reduced ? 0 : Math.sin(phase + i * Math.PI) * 0.09;
      hand.set(
        THREE.MathUtils.clamp(side * spread + offsets[i].x, side < 0 ? -1.48 : 0.8, side < 0 ? -0.8 : 1.48),
        THREE.MathUtils.clamp(lift + sway + offsets[i].y, 1.8, 2.7),
        reduced ? 0 : Math.sin(phase * 0.7 + i) * 0.08
      );
      poseArm(arms[i], hand);
    });
  }
  function disposeCloth() {
    [cloth, wire, particles].forEach(object => { if (object) scene.remove(object); });
    if (geometry) geometry.dispose();
  }
  function rebuild() {
    disposeCloth();
    columns = options.density || 16;
    rows = Math.round(columns * 0.65);
    world = new CANNON.World({ gravity: new CANNON.Vec3(0, -5.5, 0) });
    world.solver.iterations = 7;
    world.solver.tolerance = 0.001;
    world.broadphase = new CANNON.SAPBroadphase(world);
    const ground = new CANNON.Body({ mass: 0, shape: new CANNON.Plane(), collisionFilterGroup: 1, collisionFilterMask: 2 });
    ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    world.addBody(ground);
    targetHands(latestPhase);
    bodies = [];
    const positions = new Float32Array(columns * rows * 3);
    const indices = [];
    const pinIds = [0, columns - 1];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < columns; c++) {
        const index = r * columns + c;
        const x = handles[0].x + (handles[1].x - handles[0].x) * c / (columns - 1);
        const y = handles[0].y + (handles[1].y - handles[0].y) * c / (columns - 1) - r / (rows - 1) * 1.65;
        const body = new CANNON.Body({
          mass: pinIds.includes(index) ? 0 : 0.035,
          type: pinIds.includes(index) ? CANNON.Body.KINEMATIC : CANNON.Body.DYNAMIC,
          shape: new CANNON.Particle(),
          position: new CANNON.Vec3(x, y, 0),
          linearDamping: 0.65,
          collisionFilterGroup: 2, collisionFilterMask: 1
        });
        bodies.push(body);
        world.addBody(body);
        if (r < rows - 1 && c < columns - 1) {
          indices.push(index, index + columns, index + 1, index + 1, index + columns, index + columns + 1);
        }
      }
    }
    function constraint(a, b, rest) {
      world.addConstraint(new CANNON.DistanceConstraint(bodies[a], bodies[b], rest, 55));
    }
    const dx = 3.0 / (columns - 1);
    const dy = 1.65 / (rows - 1);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < columns; c++) {
        const i = r * columns + c;
        if (c + 1 < columns) constraint(i, i + 1, dx);
        if (r + 1 < rows) constraint(i, i + columns, dy);
        if (r + 1 < rows && c + 1 < columns) constraint(i, i + columns + 1, Math.hypot(dx, dy));
      }
    }
    geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    cloth = new THREE.Mesh(geometry, clothMaterial);
    wire = new THREE.Mesh(geometry, wireMaterial);
    particles = new THREE.Points(geometry, pointMaterial);
    scene.add(cloth, wire, particles);
    activityFrames = 60;
    updateGeometry();
    applyVisibility();
  }
  function applyVisibility() {
    cloth.visible = options.mode === "surface";
    wire.visible = options.mode === "lines";
    particles.visible = options.mode === "points";
    grid.visible = !!options.grid;
    clothMaterial.color.set(options.color);
    pointMaterial.color.set(options.color);
    wireMaterial.color.set(options.color);
  }
  function updateGeometry() {
    const values = geometry.attributes.position.array;
    bodies.forEach((body, i) => {
      values[i * 3] = body.position.x;
      values[i * 3 + 1] = body.position.y;
      values[i * 3 + 2] = body.position.z;
    });
    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
  }
  function pinHands() {
    [0, columns - 1].forEach((index, i) => {
      bodies[index].position.set(handles[i].x, handles[i].y, handles[i].z);
      bodies[index].velocity.setZero();
      bodies[index].angularVelocity.setZero();
    });
  }
  function setOptions(next) {
    const rebuildNeeded = next.density !== options.density || !world;
    const pulled = next.response !== options.response || next.lift !== options.lift;
    options = { ...next };
    if (rebuildNeeded) rebuild();
    else {
      applyVisibility();
      if (pulled) activityFrames = 60;
    }
    requestFrame();
  }
  function step(dt, phase, running, isReduced) {
    reduced = isReduced;
    latestPhase = phase;
    controls.enableDamping = !reduced;
    const cameraGliding = advanceCamera(dt, reduced);
    const cameraMoved = controls.update();
    targetHands(phase);
    const simulate = running || dragging >= 0 || activityFrames > 0;
    if (simulate) {
      const steps = reduced ? 18 : 1;
      for (let i = 0; i < steps; i++) {
        pinHands();
        if (reduced) world.step(1 / 60);
        else world.step(1 / 60, Math.min(dt, 0.05), 3);
      }
      pinHands();
      updateGeometry();
      if (reduced) activityFrames = 0;
      else if (activityFrames > 0) activityFrames--;
    }
    return cameraMoved || cameraGliding || activityFrames > 0 || dragging >= 0;
  }
  function resize() {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    const aspect = width / height;
    const halfWidth = aspect < 1.25 ? 4.0 : 4.5;
    camera.left = -halfWidth; camera.right = halfWidth;
    camera.top = halfWidth / aspect; camera.bottom = -halfWidth / aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    requestFrame();
  }

  const ray = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const intersection = new THREE.Vector3();
  function position(event) {
    const rect = host.getBoundingClientRect();
    mouse.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    ray.setFromCamera(mouse, camera);
    reportPointer((mouse.x + 1) / 2, (1 - mouse.y) / 2);
    return rect;
  }
  function release() {
    if (dragPointer !== null && host.hasPointerCapture(dragPointer)) host.releasePointerCapture(dragPointer);
    dragging = -1; dragPointer = null;
    delete host.dataset.draggingGripper;
    controls.enabled = true;
    activityFrames = 45;
    requestFrame();
  }
  host.addEventListener("pointerdown", event => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const rect = position(event);
    camera.updateMatrixWorld();
    const hits = handles.map(hand => {
      const projected = hand.clone().project(camera);
      return Math.hypot((projected.x - mouse.x) * rect.width / 2, (projected.y - mouse.y) * rect.height / 2);
    });
    const index = hits[0] < hits[1] ? 0 : 1;
    if (hits[index] > 32 || !options.pointer) {
      const objects = [...arms.map(robot => robot.group), cloth].filter(Boolean);
      if (event.pointerType === "mouse" && ray.intersectObjects(objects, true).length) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      return;
    }
    event.preventDefault(); event.stopImmediatePropagation();
    dragging = index; dragPointer = event.pointerId;
    host.dataset.draggingGripper = index === 0 ? "left" : "right";
    controls.enabled = false;
    host.setPointerCapture(event.pointerId);
    arms[index].marker.scale.setScalar(1.65);
    requestFrame();
  }, { capture: true });
  host.addEventListener("pointermove", event => {
    position(event);
    if (dragging < 0) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (ray.ray.intersectPlane(plane, intersection)) {
      const side = dragging === 0 ? -1 : 1;
      const span = 1.03 + options.response * 0.43;
      // Limit manipulation to the small workspace in which the arms can reach.
      const x = THREE.MathUtils.clamp(intersection.x, side < 0 ? -1.48 : 0.85, side < 0 ? -0.85 : 1.48);
      const y = THREE.MathUtils.clamp(intersection.y, 1.8, 2.65);
      offsets[dragging].x = x - side * span;
      offsets[dragging].y = y - (2.0 + options.lift * 0.65);
      activityFrames = 60;
      requestFrame();
    }
  }, { capture: true });
  ["pointerup", "pointercancel", "lostpointercapture"].forEach(type => {
    host.addEventListener(type, () => {
      if (dragging < 0) return;
      arms[dragging].marker.scale.setScalar(1);
      release();
    }, { capture: true });
  });
  host.addEventListener("keydown", event => {
    const moves = { ArrowLeft: [-0.06, 0], ArrowRight: [0.06, 0], ArrowUp: [0, 0.06], ArrowDown: [0, -0.06] };
    if (!options.pointer || !moves[event.key]) return;
    event.preventDefault();
    const index = event.shiftKey ? 1 : 0;
    offsets[index].x = THREE.MathUtils.clamp(offsets[index].x + moves[event.key][0], -0.18, 0.18);
    offsets[index].y = THREE.MathUtils.clamp(offsets[index].y + moves[event.key][1], -0.15, 0.15);
    activityFrames = 45;
    requestFrame();
  });
  async function exportPNG() {
    renderer.render(scene, camera);
    const source = new XMLSerializer().serializeToString(renderer.domElement);
    const url = URL.createObjectURL(new Blob([source], { type: "image/svg+xml" }));
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const output = document.createElement("canvas");
      output.width = renderer.domElement.width.baseVal.value * 2;
      output.height = renderer.domElement.height.baseVal.value * 2;
      const ctx = output.getContext("2d");
      ctx.fillStyle = "#f8fafb"; ctx.fillRect(0, 0, output.width, output.height);
      ctx.drawImage(image, 0, 0, output.width, output.height);
      return await new Promise(resolve => output.toBlob(resolve, "image/png"));
    } finally { URL.revokeObjectURL(url); }
  }
  return {
    setOptions, step, resize, exportPNG,
    render() {
      renderer.render(scene, camera);
      renderer.domElement.dataset.cameraZoom = camera.zoom.toFixed(4);
      renderer.domElement.dataset.cameraAzimuth = controls.getAzimuthalAngle().toFixed(4);
      renderer.domElement.dataset.cameraPolar = controls.getPolarAngle().toFixed(4);
      reportCamera(camera.zoom);
    },
    get count() { return columns * rows; },
    get dimensions() { return columns + " × " + rows; },
    reset() {
      offsets.forEach(offset => { offset.x = offset.y = 0; });
      latestPhase = 0;
      controls.reset();
      wheelActive = false;
      rebuild();
      requestFrame();
    },
    resetCamera() {
      wheelActive = false;
      controls.reset();
      requestFrame();
    },
    dispose() {
      controls.dispose();
      disposeCloth();
      scene.traverse(object => {
        if (object.geometry) object.geometry.dispose();
      });
      [white, dark, metal, accent, floorMaterial, clothMaterial, wireMaterial, pointMaterial].forEach(m => m.dispose());
      renderer.domElement.remove();
    }
  };
}
