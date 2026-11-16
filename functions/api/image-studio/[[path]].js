import {json,StudioError,boundedBody,originCheck,visitor,challenge,validateImage,digest,sign,verify} from '../../_studio/security.js';
import {capabilities,ready,generativeEdit} from '../../_studio/providers.js';
import {reserve,settle,remaining,reserveUpload} from '../../_studio/quota.js';
import {signature,REFERENCE_SIDE} from '../../../static/js/image-studio/files.js';
export async function onRequest({request,env,params}){
  try{
    const path=Array.isArray(params.path)?params.path.join('/'):params.path;
    if(request.method==='GET'&&path==='capabilities')return json({providers:capabilities(env),upload:!!env.STUDIO_DB&&!!env.IMAGE_VALIDATOR&&!!env.STUDIO_SECRET&&!!env.TURNSTILE_SECRET&&!!env.TURNSTILE_SITE_KEY,siteKey:env.TURNSTILE_SITE_KEY||null});
    if(request.method==='GET'&&path==='quota')return json({remaining:ready(env)?await remaining(env.STUDIO_DB,await visitor(request,env)):null,reset:new Date(new Date().setUTCHours(24,0,0,0)).toISOString(),status:ready(env)?'EXPERIMENTAL':'NOT_CONFIGURED'});
    if(request.method!=='POST')return json({error:'method'},405);
    originCheck(request);
    if(path==='upload'){
      if(!env.IMAGE_VALIDATOR||!env.STUDIO_SECRET||!env.STUDIO_DB)throw new StudioError('notConfigured',503);
      await challenge(request,env);const identity=await visitor(request,env);await reserveUpload(env.STUDIO_DB,identity,crypto.randomUUID());const bytes=await boundedBody(request),type=request.headers.get('Content-Type'),info=await validateImage(bytes,type,env);
      const receipt=await sign({hash:await digest(bytes),visitor:identity,width:info.width,height:info.height,type,exp:Date.now()+900000},env.STUDIO_SECRET);
      return json({accepted:true,receipt,width:info.width,height:info.height,bytes:bytes.length});
    }
    if(!['edit','inpaint','remove-background','upscale','face-swap'].includes(path))return json({error:'notFound'},404);
    if(path!=='edit'||!ready(env))throw new StudioError('notConfigured',503);
    await challenge(request,env);const identity=await visitor(request,env),receipt=await verify(request.headers.get('X-Studio-Receipt')||'',env.STUDIO_SECRET);
    const bytes=await boundedBody(request,2*1024*1024),input=JSON.parse(new TextDecoder().decode(bytes));
    if(receipt.visitor!==identity||typeof input.prompt!=='string'||input.prompt.length<1||input.prompt.length>2000||!Number.isInteger(input.seed)||input.seed<0||input.seed>2147483647)throw new StudioError('input');
    if(typeof input.image!=='string'||input.image.length>1500000)throw new StudioError('size',413);
    const image=Uint8Array.from(atob(input.image),v=>v.charCodeAt(0)),type=signature(image),info=await validateImage(image,type,env);
    if(info.width>REFERENCE_SIDE||info.height>REFERENCE_SIDE)throw new StudioError('pixels');
    // Inference input must be exactly the image accepted by the validation endpoint.
    if(await digest(image)!==receipt.hash)throw new StudioError('receipt',403);
    const id=request.headers.get('Idempotency-Key');if(!/^[a-f0-9-]{36}$/.test(id||''))throw new StudioError('idempotency');
    await reserve(env.STUDIO_DB,{id,visitor:identity,hash:await digest(bytes)});
    try{const result=await generativeEdit(env,{image,type,prompt:input.prompt,seed:input.seed});const resultType=signature(result);if(!resultType)throw new StudioError('provider',502);const resultInfo=await validateImage(result,resultType,env);const nextReceipt=await sign({hash:await digest(result),visitor:identity,width:resultInfo.width,height:resultInfo.height,type:resultType,exp:Date.now()+900000},env.STUDIO_SECRET);await settle(env.STUDIO_DB,id,'committed');return new Response(result,{headers:{'Content-Type':resultType,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Studio-Receipt':nextReceipt}});}catch(error){await settle(env.STUDIO_DB,id,'consumed-failure');throw error;}
  }catch(error){return json({error:error instanceof StudioError?error.message:'unavailable'},error instanceof StudioError?error.status:503);}
}
