import {createPreferenceStore} from './preferences-core.js';
import {bindTranslations,t} from './i18n.js';
let storage=null;try{storage=window.localStorage;}catch(_){}
const store=createPreferenceStore({storage,initial:document.documentElement.dataset});
window.TensorCatPreferences={...store,t};
function revealLocalizedAnchor(){
  if(!location.hash)return;
  let id;try{id=decodeURIComponent(location.hash.slice(1));}catch(_){return;}
  const source=document.getElementById(id),english=source?.closest('.locale-content[data-locale="en"]');
  if(!english||document.documentElement.lang!=='zh-CN')return;
  const chinese=english.nextElementSibling;
  if(chinese?.dataset.locale!=='zh-CN')return;
  const headings='h2,h3,h4,h5,h6',index=[...english.querySelectorAll(headings)].indexOf(source);
  if(index>=0)chinese.querySelectorAll(headings)[index]?.scrollIntoView({block:'start',behavior:'instant'});
}
function apply(state,before){
  const root=document.documentElement;root.dataset.language=state.language;root.lang=state.language;root.dataset.theme=state.theme;root.style.colorScheme=state.theme;
  bindTranslations();
  document.querySelectorAll('[data-preference]').forEach(control=>{
    const key=control.dataset.preference;control.dataset.selection=state[key]===control.querySelector('button').dataset.value?'0':'1';
    control.querySelectorAll('button').forEach(button=>{const active=button.dataset.value===state[key];button.setAttribute('aria-checked',String(active));button.tabIndex=active?0:-1;});
  });
  const title=document.querySelector('title[data-title-key]');if(title)document.title=t(title.dataset.titleKey,{},title.dataset.titleEn)+' | Kevin Ray Scott | TensorCat';
  if(before){
    window.dispatchEvent(new CustomEvent('tensorcat:preferences',{detail:{...state,changed:Object.keys(state).filter(key=>state[key]!==before[key])}}));
    if(state.language!==before.language&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
      document.querySelectorAll('main,.portfolio-page-wrap,.blog-index-wrap,.blog-post-wrap').forEach(surface=>{if(!surface.closest('main main'))surface.animate?.([{opacity:.78,transform:'translateY(3px)'},{opacity:1,transform:'translateY(0)'}],{duration:180,easing:'cubic-bezier(.22,1,.36,1)'});});
    }
    if(state.language!==before.language)requestAnimationFrame(revealLocalizedAnchor);
  }
}
store.subscribe(apply);
document.querySelectorAll('[data-preference]').forEach(control=>{
  control.addEventListener('click',event=>{const button=event.target.closest('button[data-value]');if(button)store.set(control.dataset.preference,button.dataset.value);});
  control.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const buttons=[...control.querySelectorAll('button')],current=buttons.indexOf(document.activeElement),index=event.key==='Home'?0:event.key==='End'?1:current===0?1:0;store.set(control.dataset.preference,buttons[index].dataset.value);buttons[index].focus();});
});
window.addEventListener('storage',event=>store.storageEvent(event));
window.addEventListener('hashchange',revealLocalizedAnchor);
window.addEventListener('pageshow',()=>{for(const key of ['language','theme'])try{store.set(key,storage?.getItem('tensorcat.'+key)||({language:'en',theme:'light'})[key],{persist:false});}catch(_){}apply(store.get());requestAnimationFrame(revealLocalizedAnchor);});
apply(store.get());document.documentElement.dataset.preferencesReady='true';
