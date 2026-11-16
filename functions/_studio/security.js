import {FILE_LIMIT,signature,dimensionsOK} from '../../static/js/image-studio/files.js';
export class StudioError extends Error {constructor(code,status=400){super(code);this.status=status;}}
export const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
export async function boundedBody(request,limit=FILE_LIMIT){
  const length=Number(request.headers.get('Content-Length')||0);if(length>limit)throw new StudioError('size',413);
  const reader=request.body?.getReader();if(!reader)throw new StudioError('format');let size=0;const chunks=[];
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw new StudioError('size',413);}chunks.push(value);}}finally{reader.releaseLock();}
  const out=new Uint8Array(size);let offset=0;for(const chunk of chunks){out.set(chunk,offset);offset+=chunk.length;}return out;
}
export function originCheck(request){
  const url=new URL(request.url),origin=request.headers.get('Origin');
  if(origin!==url.origin||request.headers.get('Sec-Fetch-Site')==='cross-site')throw new StudioError('origin',403);
}
const hex=bytes=>[...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,'0')).join('');
export const digest=async bytes=>hex(await crypto.subtle.digest('SHA-256',bytes));
async function key(secret){return crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
export async function sign(data,secret){if(!secret||secret.length<32)throw new StudioError('notConfigured',503);const payload=btoa(JSON.stringify(data));return payload+'.'+hex(await crypto.subtle.sign('HMAC',await key(secret),new TextEncoder().encode(payload)));}
export async function verify(token,secret){
  try{const [payload,mac]=token.split('.');if(!secret||!/^[a-f0-9]{64}$/.test(mac))throw Error();const bytes=new Uint8Array(mac.match(/../g).map(v=>parseInt(v,16)));if(!await crypto.subtle.verify('HMAC',await key(secret),bytes,new TextEncoder().encode(payload)))throw Error();const data=JSON.parse(atob(payload));if(data.exp<Date.now())throw Error();return data;}catch{throw new StudioError('receipt',403);}
}
export async function visitor(request,env){
  if(!env.STUDIO_SECRET)throw new StudioError('notConfigured',503);
  const ip=request.headers.get('CF-Connecting-IP');if(!ip)throw new StudioError('notConfigured',503);
  // Daily keyed hashes avoid storing raw IP addresses or persistent device identifiers.
  return digest(new TextEncoder().encode(env.STUDIO_SECRET+new Date().toISOString().slice(0,10)+ip));
}
export async function challenge(request,env){
  if(!env.TURNSTILE_SECRET||!env.TURNSTILE_SITE_KEY)throw new StudioError('notConfigured',503);
  const token=request.headers.get('X-Turnstile-Token');if(!token||token.length>2048)throw new StudioError('challenge',403);
  const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret:env.TURNSTILE_SECRET,response:token}),signal:AbortSignal.timeout(10000)});
  const result=await response.json();if(!result.success||result.hostname!==new URL(request.url).hostname||result.action!=='image-studio')throw new StudioError('challenge',403);
}
export async function validateImage(bytes,type,env){
  if(bytes.length===0||bytes.length>FILE_LIMIT||signature(bytes)!==type)throw new StudioError('format');
  if(!env.IMAGE_VALIDATOR)throw new StudioError('notConfigured',503);
  const response=await env.IMAGE_VALIDATOR.fetch(new Request('https://validator.internal/decode',{method:'POST',headers:{'Content-Type':type},body:bytes,signal:AbortSignal.timeout(15000)}));
  const info=await response.json();if(!response.ok||info.decoded!==true||info.type!==type||!dimensionsOK(info.width,info.height))throw new StudioError('pixels');return info;
}
