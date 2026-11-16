import {signature,headerDimensions} from '../../../static/js/image-studio/files.js';

export const CLOUD_SIDE_LIMIT=512,CLOUD_BYTE_LIMIT=1024*1024+4096;
const allowedSize=({width,height})=>Number.isInteger(width)&&Number.isInteger(height)&&width>0&&height>0&&width<=CLOUD_SIDE_LIMIT&&height<=CLOUD_SIDE_LIMIT;

export function decodeBounded(bytes,type,PhotonImage){
  if(!bytes.length||bytes.length>CLOUD_BYTE_LIMIT||signature(bytes)!==type)throw Error('format');
  const header=headerDimensions(bytes);
  if(!header||!allowedSize(header))throw Error('pixels');
  let image;
  try{
    image=PhotonImage.new_from_byteslice(bytes);
    const width=image.get_width(),height=image.get_height();
    if(!allowedSize({width,height})||width!==header.width||height!==header.height)throw Error('pixels');
    return {decoded:true,type,width,height};
  }finally{image?.free();}
}

export function validatorHandler(PhotonImage){
  return async request=>{
    const reply=(body,status)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
    if(request.method!=='POST'||new URL(request.url).pathname!=='/decode')return reply({error:'notFound'},404);
    const reader=request.body?.getReader();if(!reader)return reply({error:'format'},400);
    let size=0;const parts=[];
    try{
      while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>CLOUD_BYTE_LIMIT){await reader.cancel();return reply({error:'size'},413);}parts.push(value);}
      const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
      return reply(decodeBounded(bytes,request.headers.get('Content-Type'),PhotonImage),200);
    }catch{return reply({error:'decode'},422);}finally{reader.releaseLock();}
  };
}
