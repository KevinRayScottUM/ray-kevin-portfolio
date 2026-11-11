const unit=([x,y,z])=>{const l=Math.hypot(x,y,z);return[x/l,y/l,z/l];};
export const STUDIO_LIGHTS=Object.freeze({ambient:.32,key:{direction:unit([-.55,.78,1]),intensity:.64},fill:{direction:unit([.8,.12,.7]),intensity:.22},rim:{direction:unit([.25,.8,-.65]),intensity:.38},softbox:unit([-.22,.32,1])});
export const MATERIALS=Object.freeze({
  housing:{roughness:.65,specular:.14,f0:.035,occlusion:1},
  button:{roughness:.34,specular:.28,f0:.045,occlusion:1},
  rubber:{roughness:.9,specular:.045,f0:.025,occlusion:.93},
  cartridge:{roughness:.52,specular:.19,f0:.04,occlusion:1},
  metal:{roughness:.26,specular:.48,f0:.35,occlusion:1},
  recess:{roughness:.85,specular:.06,f0:.025,occlusion:.72},
  label:{roughness:.7,specular:.06,f0:.03,occlusion:1},
  glass:{roughness:.18,specular:.22,f0:.045,occlusion:1}
});
export function materialKind(object){
  const name=object.name||"";
  if(object.userData.texture==="screen")return"glass";
  if(object.userData.texture)return"label";
  if(/connector|Contact_|Screw(?!_Slot)|Joystick_Shaft|Power_Grip/.test(name))return"metal";
  if(/socket|Well|Slot|Screen_Inner|Screen_Bezel|Speaker|USB_Port/.test(name))return"recess";
  if(/Joystick_Cap|DPad|Shoulder|Shell_Trim|Rear_Grip/.test(name))return"rubber";
  if(/_cap|Power_Knob/.test(name))return"button";
  for(let node=object;node;node=node.parent)if(node.userData.cartridge)return"cartridge";
  return"housing";
}
// A bounded local illumination approximation, not a path tracer or measured BRDF.
export function studioLighting(normal,position,eye,kind="housing",quality="balanced",out={},lights=STUDIO_LIGHTS){
  const p=MATERIALS[kind],nx=normal.x,ny=normal.y,nz=normal.z;
  let vx=eye.x-position.x,vy=eye.y-position.y,vz=eye.z-position.z;
  const length=Math.hypot(vx,vy,vz)||1;vx/=length;vy/=length;vz/=length;
  const ndv=Math.max(0,Math.min(1,nx*vx+ny*vy+nz*vz));
  let diffuse=lights.ambient,specular=0;
  for(let lightIndex=0;lightIndex<3;lightIndex++){
    const light=lightIndex===0?lights.key:lightIndex===1?lights.fill:lights.rim;
    const [lx,ly,lz]=light.direction,ndl=Math.max(0,nx*lx+ny*ly+nz*lz);
    diffuse+=ndl*light.intensity;
    if(quality!=="low"&&ndl>0){
      const hx=lx+vx,hy=ly+vy,hz=lz+vz,hl=Math.hypot(hx,hy,hz)||1;
      const ndh=Math.max(0,(nx*hx+ny*hy+nz*hz)/hl),power=8+(1-p.roughness)**2*120;
      specular+=Math.pow(ndh,power)*p.specular*light.intensity;
    }
  }
  const fresnel=p.f0+(1-p.f0)*(1-ndv)**5;
  if(quality!=="low"){
    const rx=2*ndv*nx-vx,ry=2*ndv*ny-vy,rz=2*ndv*nz-vz;
    const [sx,sy,sz]=lights.softbox;
    const softbox=Math.exp(-(((rx-sx)/.38)**4+((ry-sy)/.56)**4+((rz-sz)/.65)**2));
    specular+=softbox*p.specular*(.3+fresnel)*.45;
    specular+=fresnel*(kind==="glass"?.08:.035);
  }
  out.diffuse=kind==="glass"?1-fresnel*.18:Math.sqrt(Math.min(1.15,diffuse*p.occlusion));
  out.specular=Math.min(kind==="glass"?.065:.32,specular*(quality==="high"?1:.86));
  return out;
}
