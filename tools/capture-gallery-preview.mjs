// Run in the local exhibit page through browser developer tooling after choosing High quality.
// This exports the real CPU framebuffers, not a redesigned illustration or AI-generated image.
export function captureGalleryPreview(){
  const source=document.querySelector('[data-canvas]'),gallery=document.querySelector('[data-gallery-canvas]');
  const r=source.getBoundingClientRect(),g=gallery.getBoundingClientRect();
  if(Math.abs(r.width-1376)>1||Math.abs(r.height-650)>1)throw Error('Use a 1440px desktop viewport in Console mode.');
  const ratio=source.width/r.width,crop={x:208,y:30,width:960,height:540},output=document.createElement('canvas');
  output.width=Math.round(crop.width*ratio);output.height=Math.round(crop.height*ratio);
  const c=output.getContext('2d');
  c.drawImage(source,crop.x*ratio,crop.y*ratio,crop.width*ratio,crop.height*ratio,0,0,output.width,output.height);
  c.drawImage(gallery,(g.x-r.x-crop.x)*ratio,(g.y-r.y-crop.y)*ratio,g.width*ratio,g.height*ratio);
  return {width:output.width,height:output.height,url:output.toDataURL('image/png')};
}
