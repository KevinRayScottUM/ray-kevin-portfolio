import {StudioError} from './security.js';
export const PROVIDERS=Object.freeze({
  edit:{provider:'Cloudflare Workers AI',model:'@cf/black-forest-labs/flux-2-klein-4b',status:'NOT_CONFIGURED',reason:'configuration',freeEligibility:'Workers Free only; shared allowance',licensing:'Review BFL terms before activation'},
  inpaint:{provider:'Mask-aware inpainting',status:'UNAVAILABLE',reason:'retirement',freeEligibility:'Not verified',licensing:'Not verified'},
  'remove-background':{provider:'remove.bg / BRIA',status:'UNAVAILABLE',reason:'license',freeEligibility:'Not verified for recurring public use',licensing:'Review required'},
  upscale:{provider:'Cloudflare Images ESRGAN',status:'NOT_FREE',reason:'billing',freeEligibility:'Not verified',licensing:'Account review required'},
  'face-swap':{provider:'Magic Hour',status:'NOT_FREE',reason:'trial',freeEligibility:'Trial credits are not a recurring allocation',licensing:'Consent and provider terms required'},
});
export function ready(env){return env.STUDIO_AI_ENABLED==='true'&&env.STUDIO_FREE_PLAN_CONFIRMED==='true'&&env.STUDIO_MODEL_VERIFIED==='true'&&!!env.AI&&!!env.STUDIO_DB&&!!env.IMAGE_VALIDATOR&&typeof env.STUDIO_SECRET==='string'&&env.STUDIO_SECRET.length>=32&&!!env.TURNSTILE_SECRET&&!!env.TURNSTILE_SITE_KEY;}
export function capabilities(env){const enabled=ready(env);return Object.fromEntries(Object.entries(PROVIDERS).map(([id,p])=>[id,{...p,status:id==='edit'&&enabled?'EXPERIMENTAL':p.status,reason:id==='edit'&&enabled?'cloudAvailable':p.reason}]));}
export async function generativeEdit(env,{image,type,prompt,seed}){
  if(!ready(env))throw new StudioError('notConfigured',503);
  const form=new FormData();form.set('prompt',prompt);form.set('width','512');form.set('height','512');form.set('input_image_0',new Blob([image],{type}),'reference');if(seed!==undefined)form.set('seed',String(seed));
  const request=new Request('https://multipart.internal',{method:'POST',body:form});
  // Only the pinned model is callable. Schema/live verification is an explicit enablement gate.
  let timer,output;try{output=await Promise.race([env.AI.run(PROVIDERS.edit.model,{multipart:{body:request.body,contentType:request.headers.get('Content-Type')}}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new StudioError('timeout',504)),45000);})]);}finally{clearTimeout(timer);}
  if(typeof output?.image!=='string'||output.image.length>16000000)throw new StudioError('provider',502);
  let result;try{result=Uint8Array.from(atob(output.image),v=>v.charCodeAt(0));}catch{throw new StudioError('provider',502);}return result;
}
