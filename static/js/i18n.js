import {translate,catalog} from './preferences-core.js';
export const locale=()=>globalThis.document?.documentElement.dataset.language||'en';
export const t=(key,args={},fallback)=>translate(key,args,locale(),fallback);
export function bindTranslations(root=document){
  for(const element of root.querySelectorAll('[data-i18n],[data-i18n-aria-label],[data-i18n-title],[data-i18n-content],[data-i18n-alt]')){
    let args={};try{args=JSON.parse(element.dataset.i18nArgs||'{}');}catch(_){}
    if(element.dataset.i18n){const key=element.dataset.i18n;if(catalog[key])element.textContent=t(key,args);else console.warn('Missing translation:',key);}
    for(const attribute of ['aria-label','title','content','alt']){const key=element.getAttribute('data-i18n-'+attribute);if(key&&catalog[key])element.setAttribute(attribute,t(key,args));else if(key)console.warn('Missing translation:',key);}
  }
  for(const time of root.querySelectorAll('time[data-date]')){
    const value=new Date(time.dataset.date.slice(0,10)+'T12:00:00Z');if(!isNaN(value))time.textContent=new Intl.DateTimeFormat(locale(),{year:'numeric',month:'short',day:'numeric',timeZone:'UTC'}).format(value);
  }
}
export function label(element,key){if(!element)return;element.dataset.i18n=key;element.textContent=t(key);}
