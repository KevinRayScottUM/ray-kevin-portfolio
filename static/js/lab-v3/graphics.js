import * as THREE from "../../vendor/three/three.module.min.js";

export { THREE };
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const QUALITY = {
  low: { width: 480, height: 270, points: 1200, iterations: 7 },
  balanced: { width: 960, height: 540, points: 2400, iterations: 10 },
  high: { width: 1280, height: 720, points: 4800, iterations: 14 },
  adaptive: { width: 960, height: 540, points: 2400, iterations: 10 },
};

export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = Math.imul(state ^ state >>> 15, 1 | state);
    value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

export function mesh(geometry, color, id, parent, extra = {}) {
  const object = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
  object.name = id;
  object.userData = { id, ...extra };
  parent.add(object);
  return object;
}

export function coordinateInFrame(point, object, frame, camera, reference) {
  const result = point.clone();
  if (frame === "local" && object) result.applyMatrix4(object.matrixWorld.clone().invert());
  if (frame === "relative" && reference) result.applyMatrix4(reference.matrixWorld.clone().invert());
  if (frame === "camera") result.applyMatrix4(camera.matrixWorldInverse);
  return result;
}

export class CameraRig {
  constructor(kind = "console") {
    this.camera = new THREE.PerspectiveCamera(40, 16 / 9, .008, 30);
    this.kind = kind;
    this.reset();
  }
  reset() {
    this.target = new THREE.Vector3(0, this.kind === "console" ? .045 : .25, 0);
    this.theta = this.kind === "console" ? .22 : .48;
    this.phi = this.kind === "console" ? 1.35 : 1.05;
    this.distance = this.fitDistance(this.camera.aspect);
    this.update();
  }
  resize(width, height) {
    const oldAspect=this.camera.aspect;
    this.camera.aspect = width / height;
    this.distance=clamp(this.distance*this.fitDistance(this.camera.aspect)/this.fitDistance(oldAspect),this.kind==="console"?.24:.8,this.kind==="console"?1.2:4);
    this.camera.updateProjectionMatrix(); this.update();
  }
  fitDistance(aspect) {return Math.max(this.kind==="console"?.50:2.2,(this.kind==="console"?.36:1.7)/(2*Math.tan(Math.PI/9)*aspect));}
  update() {
    const offset = new THREE.Vector3().setFromSphericalCoords(this.distance, this.phi, this.theta);
    this.camera.position.copy(this.target).add(offset);
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld(true);
    this.camera.matrixWorldInverse.copy(this.camera.matrixWorld).invert();
  }
  orbit(dx, dy) {
    this.theta += dx * .006;
    this.phi = clamp(this.phi + dy * .006, .06, this.kind === "console" ? Math.PI - .06 : Math.PI / 2 - .025);
    this.update();
  }
  zoom(delta) {
    this.distance = clamp(this.distance * Math.exp(delta * .002), this.kind === "console" ? .24 : .8, this.kind === "console" ? .9 : 4);
    this.update();
  }
  pan(dx, dy) {
    const scale = this.distance * .001;
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);
    this.target.addScaledVector(right, -dx * scale).addScaledVector(up, dy * scale);
    this.update();
  }
  preset(name) {
    const views = { front: [0, Math.PI / 2], back: [Math.PI, Math.PI / 2], left: [-Math.PI / 2, Math.PI / 2], right: [Math.PI / 2, Math.PI / 2], top: [0, .06], bottom: [0, Math.PI - .06] };
    if (name === "perspective") { this.reset(); return; }
    if (views[name]) [this.theta, this.phi] = views[name];
    this.update();
  }
  ray(x, y, width, height) {
    const near = new THREE.Vector3(x / width * 2 - 1, 1 - y / height * 2, -1).unproject(this.camera);
    const far = new THREE.Vector3(x / width * 2 - 1, 1 - y / height * 2, 1).unproject(this.camera);
    return new THREE.Ray(near, far.sub(near).normalize());
  }
  project(point, width, height) {
    const value = point.clone().project(this.camera);
    return { x: (value.x + 1) * width / 2, y: (1 - value.y) * height / 2, z: value.z };
  }
}

function objectSeed(name, seed) {
  let value = seed >>> 0;
  for (let index = 0; index < name.length; index++) value = Math.imul(value ^ name.charCodeAt(index), 16777619);
  return value;
}

// Stable triangle IDs and barycentric weights are reused as a deformable mesh moves.
export class GeometrySampler {
  constructor() { this.cache = new WeakMap(); }
  samples(object, count, seed) {
    const geometry = object.geometry;
    const key = count + ":" + seed;
    let cache = this.cache.get(geometry);
    if (!cache) { cache = new Map(); this.cache.set(geometry, cache); }
    if (cache.has(key)) return cache.get(key);
    const position = geometry.attributes.position.array;
    const indices = geometry.index?.array;
    const triangles = (indices?.length || position.length / 3) / 3;
    const cumulative = new Float64Array(triangles);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    let area = 0;
    for (let triangle = 0; triangle < triangles; triangle++) {
      const offset = triangle * 3;
      a.fromArray(position, (indices ? indices[offset] : offset) * 3);
      b.fromArray(position, (indices ? indices[offset + 1] : offset + 1) * 3);
      c.fromArray(position, (indices ? indices[offset + 2] : offset + 2) * 3);
      area += b.sub(a).cross(c.sub(a)).length() * .5;
      cumulative[triangle] = area;
    }
    const random = seededRandom(seed);
    const result = [];
    for (let sample = 0; sample < count && area > 0; sample++) {
      const target = random() * area;
      let low = 0, high = triangles - 1;
      while (low < high) { const mid = (low + high) >> 1; if (cumulative[mid] < target) low = mid + 1; else high = mid; }
      const offset = low * 3;
      const u = Math.sqrt(random()), v = random();
      result.push({ triangle: low, indices: [0, 1, 2].map(i => indices ? indices[offset + i] : offset + i), weights: [1 - u, u * (1 - v), u * v] });
    }
    cache.set(key, result);
    return result;
  }
  sampleScene(scene, budget, seed = 7, filter = "all") {
    scene.updateMatrixWorld(true);
    const objects = [];
    scene.traverseVisible(object => {
      let matches=filter==="all";
      for(let node=object;node&&!matches;node=node.parent)matches=node.userData.id===filter;
      if (object.isMesh && !object.userData.overlay && matches) objects.push(object);
    });
    const points = [];
    const minimum = Math.min(10, Math.floor(budget / Math.max(1, objects.length)));
    const weight = object => object.userData.floor ? .35 : object.userData.deformable ? 4 : 1;
    const totalWeight = objects.reduce((sum, object) => sum + weight(object), 0);
    let remaining = Math.max(0, budget - minimum * objects.length);
    for (let objectIndex = 0; objectIndex < objects.length; objectIndex++) {
      const object = objects[objectIndex];
      const count = minimum + Math.floor(remaining * weight(object) / totalWeight);
      const specs = this.samples(object, count, objectSeed(object.userData.id, seed));
      const array = object.geometry.attributes.position.array;
      const color = object.material.color.clone();
      specs.forEach((spec, index) => {
        const local = new THREE.Vector3();
        for (let corner = 0; corner < 3; corner++) {
          const offset = spec.indices[corner] * 3;
          local.x += array[offset] * spec.weights[corner];
          local.y += array[offset + 1] * spec.weights[corner];
          local.z += array[offset + 2] * spec.weights[corner];
        }
        points.push({ id: object.userData.id + ".sample-" + index, objectId: object.userData.id, object, local, world: local.clone().applyMatrix4(object.matrixWorld), color, triangle: spec.triangle });
      });
    }
    return points;
  }
}

function clipPolygon(vertices) {
  let result = vertices;
  for (const plane of [v => v[3] + v[0], v => v[3] - v[0], v => v[3] + v[1], v => v[3] - v[1], v => v[3] + v[2], v => v[3] - v[2]]) {
    const input = result;
    result = [];
    for (let i = 0; i < input.length; i++) {
      const a = input[i], b = input[(i + 1) % input.length];
      const da = plane(a), db = plane(b);
      if (da >= 0) result.push(a);
      if ((da >= 0) !== (db >= 0)) {
        const t = da / (da - db);
        result.push(a.map((value, index) => value + (b[index] - value) * t));
      }
    }
    if (!result.length) break;
  }
  return result;
}

export class SoftwareRenderer {
  constructor(canvas,{alpha=false}={}) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d", { alpha });
    if (!this.context) throw new Error("Canvas 2D is unavailable");
    this.textures = new Map();
    this.objects = [];
    this.pointData = [];
    this.stats = { ms: 0, triangles: 0, points: 0 };
    this.setBackground("#f7f9f9");
    this.setQuality("balanced");
  }
  setBackground(hex) {
    const color=new THREE.Color(hex).convertLinearToSRGB();
    this.background=new Uint32Array(new Uint8Array([Math.round(color.r*255),Math.round(color.g*255),Math.round(color.b*255),255]).buffer)[0];
  }
  setQuality(quality) {
    this.quality = quality;
    this.resizeAspect(this.aspect || 16 / 9);
  }
  resizeToViewport(cssWidth,cssHeight,dpr=1,ratioLimit=2) {
    const profile={low:[1,1,900000],balanced:[1.25,1.5,1800000],high:[1.5,2,3200000],adaptive:[1.15,1.5,1600000]}[this.quality]||[1.25,1.5,1800000];
    const ratio=Math.min(ratioLimit,Math.max(profile[0],Math.min(dpr,profile[1])));
    const limit=Math.min(1,Math.sqrt(profile[2]/(cssWidth*cssHeight*ratio*ratio)));
    this.effectiveRatio=ratio*limit;this.cssWidth=cssWidth;this.cssHeight=cssHeight;
    this.setSize(Math.round(cssWidth*this.effectiveRatio),Math.round(cssHeight*this.effectiveRatio));
  }
  setSize(width,height) {
    width=Math.max(1,width);height=Math.max(1,height);
    if(this.width===width&&this.height===height)return;
    this.width=width;this.height=height;this.aspect=width/height;
    this.canvas.width=width;this.canvas.height=height;
    this.image=this.context.createImageData(width,height);
    this.depth=new Float32Array(width*height);this.ids=new Int32Array(width*height);this.pointIds=new Int32Array(width*height);this.staticCache=null;
  }
  resizeAspect(aspect) {
    this.aspect = clamp(aspect, .2, 8);
    const quality = this.quality;
    const preset = QUALITY[quality] || QUALITY.balanced;
    const width=Math.round(Math.sqrt(preset.width*preset.height*this.aspect));
    this.setSize(width,Math.round(width/this.aspect));
  }
  async loadTexture(name, url) {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    this.updateTexture(name,canvas);
  }
  updateTexture(name, canvas) {
    const texture=this.textures.get(name)||{canvases:[]};
    texture.width=canvas.width;texture.height=canvas.height;texture.data=canvas.getContext("2d").getImageData(0,0,canvas.width,canvas.height).data;
    texture.levels=[texture];let source=canvas;
    for(let level=0;Math.min(source.width,source.height)>16;level++) {
      const target=texture.canvases[level]||(texture.canvases[level]=document.createElement("canvas"));
      const width=Math.max(1,source.width>>1),height=Math.max(1,source.height>>1);
      if(target.width!==width||target.height!==height){target.width=width;target.height=height;}
      const context=target.getContext("2d");context.imageSmoothingEnabled=true;context.imageSmoothingQuality="high";context.clearRect(0,0,width,height);context.drawImage(source,0,0,width,height);
      texture.levels.push({width,height,data:context.getImageData(0,0,width,height).data});source=target;
    }
    this.textures.set(name,texture);
  }
  render(scene, rig, options = {}) {
    const start = performance.now();
    const cached=Boolean(options.staticKey&&options.mode!=="cloud"&&options.mode!=="wire"&&options.mode!=="particles"&&this.staticCache?.key===options.staticKey);
    const pixels = this.image.data;
    if(cached) {
      pixels.set(this.staticCache.pixels);this.depth.set(this.staticCache.depth);this.ids.set(this.staticCache.ids);this.pointIds.set(this.staticCache.pointIds);this.objects=[...this.staticCache.objects];
      for(let index=0;index<this.ids.length;index++)if(this.staticCache.dynamicIds.has(this.ids[index]))this.depth[index]=Infinity;
    } else {this.depth.fill(Infinity);this.ids.fill(-1);this.pointIds.fill(-1);new Uint32Array(pixels.buffer).fill(options.transparent?0:this.background);this.objects=[];}
    this.pointData = options.points || [];
    this.stats.triangles = 0; this.stats.points = 0;
    this.stats.cached=cached;this.stats.reusedTriangles=cached?this.staticCache.triangles:0;
    scene.updateMatrixWorld(true);
    rig.update();
    const vp = new THREE.Matrix4().multiplyMatrices(rig.camera.projectionMatrix, rig.camera.matrixWorldInverse);
    if (options.mode === "cloud") {
      this.pointData.forEach((point, index) => {
        const p = point.world.clone().project(rig.camera);
        if (p.z < -1 || p.z > 1) return;
        const color = point.color.clone();
        if (options.pointColor === "height") color.setHSL(.57 - clamp(point.world.y, 0, 1) * .4, .50, .45);
        if (options.pointColor === "depth") color.setHSL(.56, .4, clamp(1 - point.world.distanceTo(rig.camera.position) / 4, .25, .75));
        this.dot((p.x + 1) * this.width / 2, (1 - p.y) * this.height / 2, p.z, color, options.pointSize || 1.5, -1, index, options.pointOpacity ?? 1);
        this.stats.points++;
      });
    }
    if(options.mode!=="cloud"||options.screenOverlay) {
      scene.traverseVisible(object => {
        if (!object.isMesh) return;
        if(options.mode==="cloud"&&object.userData.texture!=="screen")return;
        if(cached&&object.userData.texture!=="screen")return;
        if(object.userData.overlay&&object.userData.id?.startsWith("grid.")) {
          const size=object.geometry.parameters;
          const a=new THREE.Vector3(size.width>size.depth?-size.width/2:0,0,size.depth>size.width?-size.depth/2:0).applyMatrix4(object.matrixWorld);
          const b=new THREE.Vector3(size.width>size.depth?size.width/2:0,0,size.depth>size.width?size.depth/2:0).applyMatrix4(object.matrixWorld);
          const pa=rig.project(a,this.width,this.height),pb=rig.project(b,this.width,this.height),color=object.material.color.clone().convertLinearToSRGB();
          this.line([pa.x,pa.y,pa.z],[pb.x,pb.y,pb.z],[color.r*255,color.g*255,color.b*255],-1);return;
        }
        const id = cached?this.objects.indexOf(object):this.objects.push(object)-1;
        const matrix = new THREE.Matrix4().multiplyMatrices(vp, object.matrixWorld);
        const normalMatrix = new THREE.Matrix3().getNormalMatrix(object.matrixWorld);
        if(object.userData.singleSided) {
          const n=new THREE.Vector3().fromArray(object.geometry.attributes.normal.array,0).applyMatrix3(normalMatrix);
          if(n.dot(rig.camera.position.clone().sub(object.getWorldPosition(new THREE.Vector3())))<=0)return;
        }
        const positions = object.geometry.attributes.position.array;
        const normals = object.geometry.attributes.normal?.array;
        const uv = object.geometry.attributes.uv?.array;
        const indices = object.geometry.index?.array;
        const count = indices?.length || positions.length / 3;
        const m = matrix.elements;
        const normal = new THREE.Vector3();
        const base = object.material.color;
        const texture = this.textures.get(object.userData.texture);
        for (let offset = 0; offset < count; offset += 3) {
          const vertices = [];
          normal.set(0, 0, 0);
          for (let corner = 0; corner < 3; corner++) {
            const index = indices ? indices[offset + corner] : offset + corner;
            const x = positions[index * 3], y = positions[index * 3 + 1], z = positions[index * 3 + 2];
            vertices.push([m[0]*x+m[4]*y+m[8]*z+m[12], m[1]*x+m[5]*y+m[9]*z+m[13], m[2]*x+m[6]*y+m[10]*z+m[14], m[3]*x+m[7]*y+m[11]*z+m[15], uv ? uv[index*2] : 0, uv ? uv[index*2+1] : 0]);
            if (normals) normal.add(new THREE.Vector3().fromArray(normals, index * 3));
          }
          normal.applyMatrix3(normalMatrix).normalize();
          const shade = object.userData.texture ? 1 : .68 + .32 * Math.max(0, normal.dot(new THREE.Vector3(-.4,.8,.6).normalize()));
          const polygon = clipPolygon(vertices);
          if (polygon.length < 3) continue;
          const screen = polygon.map(v => [(v[0]/v[3]+1)*this.width/2, (1-v[1]/v[3])*this.height/2, v[2]/v[3], 1/v[3], v[4]/v[3], v[5]/v[3]]);
          const display=base.clone().multiplyScalar(shade).convertLinearToSRGB();
          const color = [display.r * 255, display.g * 255, display.b * 255];
          for (let index = 1; index < screen.length - 1; index++) {
            const tri = [screen[0], screen[index], screen[index + 1]];
            if ((options.mode === "wire" || options.mode === "particles")&&object.userData.texture!=="screen") {
              this.line(tri[0], tri[1], color, id); this.line(tri[1], tri[2], color, id); this.line(tri[2], tri[0], color, id);
            } else this.triangle(tri[0], tri[1], tri[2], color, texture, id);
            this.stats.triangles++;
          }
        }
      });
      if (options.mode === "particles") {
        (options.particles || []).forEach(point => {
          const p = point.clone().project(rig.camera);
          if (p.z >= -1 && p.z <= 1) this.dot((p.x+1)*this.width/2, (1-p.y)*this.height/2, p.z-.0001, new THREE.Color("#087f8c"), 2.2, -1, -1, 1);
        });
      }
    }
    for (const path of options.paths || []) {
      const color = new THREE.Color(path.color || "#d65b72");
      const rgb = [color.r*255, color.g*255, color.b*255];
      for (let i = 1; i < path.points.length; i++) {
        const a = rig.project(path.points[i-1], this.width, this.height);
        const b = rig.project(path.points[i], this.width, this.height);
        this.line([a.x,a.y,a.z-.0001], [b.x,b.y,b.z-.0001], rgb, -1);
      }
    }
    for(const ghost of options.ghosts||[]) {
      const color=new THREE.Color(ghost.color);
      for(const point of ghost.points) {
        const p=rig.project(point,this.width,this.height);
        if(p.z>=-1&&p.z<=1)this.dot(p.x,p.y,p.z-.0001,color,1.8,-1,-1,.38);
      }
    }
    if (options.selected) {
      const point = rig.project(options.selected, this.width, this.height);
      this.dot(point.x, point.y, point.z-.0005, new THREE.Color("#df7b31"), 4, -1, -1, 1);
    }
    this.context.putImageData(this.image, 0, 0);
    if(options.staticKey&&!cached&&(!options.mode||options.mode==="surface")) {
      const cache=this.staticCache&&this.staticCache.pixels.length===pixels.length?this.staticCache:{pixels:new Uint8ClampedArray(pixels.length),depth:new Float32Array(this.depth.length),ids:new Int32Array(this.ids.length),pointIds:new Int32Array(this.pointIds.length)};
      cache.key=options.staticKey;cache.pixels.set(pixels);cache.depth.set(this.depth);cache.ids.set(this.ids);cache.pointIds.set(this.pointIds);cache.objects=[...this.objects];cache.dynamicIds=new Set(this.objects.map((object,index)=>object.userData.texture==="screen"?index:-2));cache.triangles=this.stats.triangles;this.staticCache=cache;
    }
    this.stats.ms = performance.now() - start;
    return this.stats;
  }
  triangle(a, b, c, color, texture, objectId) {
    const edge = (p, q, x, y) => (x - p[0]) * (q[1] - p[1]) - (y - p[1]) * (q[0] - p[0]);
    const area = edge(a, b, c[0], c[1]);
    if (Math.abs(area) < .001) return;
    if(texture?.levels) {
      const u0=a[4]/a[3],u1=b[4]/b[3],u2=c[4]/c[3],v0=a[5]/a[3],v1=b[5]/b[3],v2=c[5]/c[3];
      const denominator=(b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]);
      const dux=((u1-u0)*(c[1]-a[1])-(u2-u0)*(b[1]-a[1]))/denominator,duy=((u2-u0)*(b[0]-a[0])-(u1-u0)*(c[0]-a[0]))/denominator;
      const dvx=((v1-v0)*(c[1]-a[1])-(v2-v0)*(b[1]-a[1]))/denominator,dvy=((v2-v0)*(b[0]-a[0])-(v1-v0)*(c[0]-a[0]))/denominator;
      const footprint=Math.max(Math.hypot(dux*texture.width,dvx*texture.height),Math.hypot(duy*texture.width,dvy*texture.height));
      texture=texture.levels[clamp(Math.floor(Math.log2(Math.max(1,footprint))),0,texture.levels.length-1)];
    }
    const minX = clamp(Math.floor(Math.min(a[0],b[0],c[0])), 0, this.width-1), maxX = clamp(Math.ceil(Math.max(a[0],b[0],c[0])), 0, this.width-1);
    const minY = clamp(Math.floor(Math.min(a[1],b[1],c[1])), 0, this.height-1), maxY = clamp(Math.ceil(Math.max(a[1],b[1],c[1])), 0, this.height-1);
    const data = this.image.data;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const w0 = edge(b,c,x+.5,y+.5)/area, w1 = edge(c,a,x+.5,y+.5)/area, w2 = 1-w0-w1;
        if (w0 < -.00001 || w1 < -.00001 || w2 < -.00001) continue;
        const z = w0*a[2]+w1*b[2]+w2*c[2];
        const index = y*this.width+x;
        if (z >= this.depth[index]) continue;
        let r = color[0], g = color[1], blue = color[2],pixelAlpha=1;
        if (texture) {
          const invW = w0*a[3]+w1*b[3]+w2*c[3];
          const u = (w0*a[4]+w1*b[4]+w2*c[4])/invW, v = (w0*a[5]+w1*b[5]+w2*c[5])/invW;
          const tx=clamp(u*(texture.width-1),0,texture.width-1),ty=clamp((1-v)*(texture.height-1),0,texture.height-1),x0=tx|0,y0=ty|0,fx=tx-x0,fy=ty-y0;
          const x1=Math.min(x0+1,texture.width-1),y1=Math.min(y0+1,texture.height-1);
          const source=texture.data,i00=(y0*texture.width+x0)*4,i10=(y0*texture.width+x1)*4,i01=(y1*texture.width+x0)*4,i11=(y1*texture.width+x1)*4;
          const w00=(1-fx)*(1-fy)*source[i00+3]/255,w10=fx*(1-fy)*source[i10+3]/255,w01=(1-fx)*fy*source[i01+3]/255,w11=fx*fy*source[i11+3]/255;
          const alpha=w00+w10+w01+w11;
          if(alpha<.01)continue;
          const backgroundAlpha=data[index*4+3]/255,remaining=backgroundAlpha*(1-alpha);pixelAlpha=alpha+remaining;
          r=(source[i00]*w00+source[i10]*w10+source[i01]*w01+source[i11]*w11+data[index*4]*remaining)/pixelAlpha;
          g=(source[i00+1]*w00+source[i10+1]*w10+source[i01+1]*w01+source[i11+1]*w11+data[index*4+1]*remaining)/pixelAlpha;
          blue=(source[i00+2]*w00+source[i10+2]*w10+source[i01+2]*w01+source[i11+2]*w11+data[index*4+2]*remaining)/pixelAlpha;
        }
        const offset = index*4;
        data[offset]=r; data[offset+1]=g; data[offset+2]=blue;data[offset+3]=pixelAlpha*255;
        this.depth[index]=z; this.ids[index]=objectId;this.pointIds[index]=-1;
      }
    }
  }
  line(a, b, color, objectId) {
    const steps = Math.ceil(Math.max(Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1])));
    if (steps > this.width * 4) return;
    for (let step = 0; step <= steps; step++) {
      const t = steps ? step/steps : 0;
      const x = Math.round(a[0]+(b[0]-a[0])*t), y = Math.round(a[1]+(b[1]-a[1])*t), z = a[2]+(b[2]-a[2])*t;
      if (x<0 || x>=this.width || y<0 || y>=this.height || z < -1 || z > 1) continue;
      const index = y*this.width+x;
      if (z > this.depth[index]+.0001) continue;
      const offset=index*4;
      this.image.data[offset]=color[0]; this.image.data[offset+1]=color[1]; this.image.data[offset+2]=color[2];this.image.data[offset+3]=255;
      this.depth[index]=z; this.ids[index]=objectId;
    }
  }
  dot(x, y, z, color, radius, objectId, pointId, opacity) {
    if(opacity<=0)return;
    const display=color.clone().convertLinearToSRGB();
    const rgb = [display.r*255,display.g*255,display.b*255];
    for (let py=Math.floor(y-radius);py<=Math.ceil(y+radius);py++) for(let px=Math.floor(x-radius);px<=Math.ceil(x+radius);px++) {
      if(px<0||py<0||px>=this.width||py>=this.height||(px-x)**2+(py-y)**2>radius*radius) continue;
      const index=py*this.width+px;
      if(z>=this.depth[index]) continue;
      const offset=index*4;
      const remaining=this.image.data[offset+3]/255*(1-opacity),alpha=opacity+remaining;
      for(let c=0;c<3;c++) this.image.data[offset+c]=(rgb[c]*opacity+this.image.data[offset+c]*remaining)/alpha;
      this.image.data[offset+3]=alpha*255;
      this.depth[index]=z; this.ids[index]=objectId; this.pointIds[index]=pointId;
    }
  }
  pick(x, y) {
    const rect=this.canvas.getBoundingClientRect();
    const px=clamp(Math.floor((x-rect.left)/rect.width*this.width),0,this.width-1), py=clamp(Math.floor((y-rect.top)/rect.height*this.height),0,this.height-1);
    let best=-1;
    for(let dy=-4;dy<=4;dy++) for(let dx=-4;dx<=4;dx++) {
      const sx=px+dx, sy=py+dy;
      if(sx<0||sy<0||sx>=this.width||sy>=this.height) continue;
      const i=sy*this.width+sx;
      if(this.ids[i]<0&&this.pointIds[i]<0) continue;
      if(best<0||this.depth[i]<this.depth[best]) best=i;
    }
    if(best<0) return null;
    const point=this.pointData[this.pointIds[best]];
    return point ? { object:point.object, point } : { object:this.objects[this.ids[best]], point:null };
  }
}

export async function loadConsole(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Console geometry: HTTP " + response.status);
  const data = await response.json();
  if (data.up !== "Y" || data.handedness !== "right") throw new Error("Unsupported console coordinate convention");
  const root = new THREE.Group(); root.name = "TC06_Root";
  const nodes = new Map([[root.name, root]]);
  const textures = new Set();
  for (const node of data.nodes) {
    let object;
    if (node.positions) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(node.positions,3));
      geometry.setAttribute("normal", new THREE.Float32BufferAttribute(node.normals,3));
      geometry.setAttribute("uv", new THREE.Float32BufferAttribute(node.uvs,2));
      object = new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:new THREE.Color(...node.color),side:node.singleSided?THREE.FrontSide:THREE.DoubleSide}));
    } else object = new THREE.Group();
    object.name=node.name;
    object.userData={id:node.name,action:node.action,control:node.control,cartridge:node.cartridge,texture:node.texture,singleSided:node.singleSided};
    if(node.texture && node.texture!=="screen") textures.add(node.texture);
    new THREE.Matrix4().fromArray(node.matrix).decompose(object.position,object.quaternion,object.scale);
    nodes.set(node.name,object);
  }
  for(const node of data.nodes) (nodes.get(node.parent)||root).add(nodes.get(node.name));
  root.updateMatrixWorld(true);
  return {root,nodes,textures,metadata:data};
}
