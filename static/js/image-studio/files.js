export const FILE_LIMIT=10*1024*1024,PIXEL_LIMIT=16000000;
export const REFERENCE_SIDE=504;
export function signature(bytes){
  const b=new Uint8Array(bytes),ascii=(start,end)=>String.fromCharCode(...b.slice(start,end));
  if(b.length>=24&&b[0]===137&&ascii(1,4)==='PNG'&&b[4]===13&&b[5]===10&&b[6]===26&&b[7]===10)return 'image/png';
  if(b.length>=12&&b[0]===255&&b[1]===216&&b[2]===255)return 'image/jpeg';
  if(b.length>=30&&ascii(0,4)==='RIFF'&&ascii(8,12)==='WEBP')return 'image/webp';
  return null;
}
export function dimensionsOK(width,height){return Number.isInteger(width)&&Number.isInteger(height)&&width>0&&height>0&&width<=8192&&height<=8192&&width*height<=PIXEL_LIMIT;}
export function headerDimensions(bytes){
  const b=new Uint8Array(bytes),v=new DataView(b.buffer,b.byteOffset,b.byteLength),type=signature(b),ascii=(a,n)=>String.fromCharCode(...b.slice(a,a+n));
  if(type==='image/png'&&ascii(12,4)==='IHDR')return {width:v.getUint32(16),height:v.getUint32(20)};
  if(type==='image/jpeg'){
    let i=2;while(i+4<=b.length){if(b[i++]!==255)return null;while(b[i]===255)i++;const marker=b[i++];if(marker===0xd9||marker===0xda)return null;const length=v.getUint16(i);if(length<2||i+length>b.length)return null;if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)&&length>=8)return {height:v.getUint16(i+3),width:v.getUint16(i+5)};i+=length;}
  }
  if(type==='image/webp'){
    const kind=ascii(12,4);if(kind==='VP8X')return {width:1+b[24]+(b[25]<<8)+(b[26]<<16),height:1+b[27]+(b[28]<<8)+(b[29]<<16)};
    if(kind==='VP8 '&&b.length>=30&&b[23]===157&&b[24]===1&&b[25]===42)return {width:v.getUint16(26,true)&16383,height:v.getUint16(28,true)&16383};
    if(kind==='VP8L'&&b[20]===47)return {width:1+b[21]+((b[22]&63)<<8),height:1+(b[22]>>6)+(b[23]<<2)+((b[24]&15)<<10)};
  }
  return null;
}
export async function acquireImage(file){
  if(!file||file.size===0||file.size>FILE_LIMIT)throw Error('size');
  const bytes=await file.arrayBuffer(),type=signature(bytes);if(!type||(file.type&&type!==file.type))throw Error('format');
  const header=headerDimensions(bytes);if(!header)throw Error('format');if(!dimensionsOK(header.width,header.height))throw Error('pixels');
  let bitmap;try{bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});}catch{throw Error('format');}if(!dimensionsOK(bitmap.width,bitmap.height)){bitmap.close();throw Error('pixels');}
  return {file,bitmap,type,width:bitmap.width,height:bitmap.height};
}
export function uploadImage(file,{token='',onProgress=()=>{},signal}={}){
  return new Promise((resolve,reject)=>{
    const xhr=new XMLHttpRequest();xhr.open('POST','/api/image-studio/upload');xhr.timeout=30000;xhr.setRequestHeader('Content-Type',file.type);xhr.setRequestHeader('X-Turnstile-Token',token);
    if(signal?.aborted){reject(Error('cancelled'));return;}
    const stop=()=>xhr.abort();signal?.addEventListener('abort',stop,{once:true});
    const clean=()=>signal?.removeEventListener('abort',stop);
    xhr.upload.onprogress=e=>{if(e.lengthComputable)onProgress({loaded:e.loaded,total:e.total});};
    xhr.onload=()=>{clean();let data;try{data=JSON.parse(xhr.responseText);}catch{reject(Error('unavailable'));return;}if(xhr.status>=200&&xhr.status<300&&data.accepted===true)resolve(data);else reject(Error(data.error||'uploadFailed'));};
    xhr.onerror=xhr.ontimeout=()=>{clean();reject(Error('uploadFailed'));};xhr.onabort=()=>{clean();reject(Error('cancelled'));};xhr.send(file);
  });
}
