import catalog from './locales/catalog.js';
export {catalog};
export const DEFAULTS=Object.freeze({language:'en',theme:'light'});
export function translate(key,args={},language='en',fallback){
  const message=catalog[key]?.[language]??catalog[key]?.en??fallback;
  if(message===undefined)return '['+key+']';
  return message.replace(/\{(\w+)\}/g,(_,name)=>Object.hasOwn(args,name)?String(args[name]):'{'+name+'}');
}
export function createPreferenceStore({storage=null,initial={}}={}){
  const state={...DEFAULTS},listeners=new Set();
  for(const key of Object.keys(state)){let value=initial[key];try{value=storage?.getItem('tensorcat.'+key)||value;}catch(_){}if(valid(key,value))state[key]=value;}
  function valid(key,value){return key==='language'?['en','zh-CN'].includes(value):key==='theme'&&['light','dark'].includes(value);}
  return {get:()=>({...state}),set(key,value,{persist=true}={}){if(!valid(key,value)||state[key]===value)return false;const before={...state};state[key]=value;if(persist)try{storage?.setItem('tensorcat.'+key,value);}catch(_){}listeners.forEach(fn=>fn({...state},before));return true;},subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},storageEvent(event){if(event.key===null){this.set('language','en',{persist:false});this.set('theme','light',{persist:false});}else if(event.key?.startsWith('tensorcat.'))this.set(event.key.slice(10),event.newValue??DEFAULTS[event.key.slice(10)],{persist:false});}};
}
