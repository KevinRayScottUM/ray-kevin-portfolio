import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {runInNewContext} from 'node:vm';
import {createPreferenceStore,effectiveAppearance,translate,catalog} from '../static/js/preferences-core.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('first visit defaults to English and Light without inferring OS preferences',()=>{
  assert.deepEqual(createPreferenceStore().get(),{language:'en',theme:'light'});
});
test('Lab appearance is isolated from all four global language and theme combinations',()=>{
  for(const language of ['en','zh-CN'])for(const theme of ['light','dark']){
    const map=new Map([['tensorcat.language',language],['tensorcat.theme',theme]]),storage={getItem:key=>map.get(key),setItem:(key,value)=>map.set(key,value)},store=createPreferenceStore({storage});
    assert.equal(effectiveAppearance('lab',store.get().theme),'dark');
    assert.equal(effectiveAppearance('portfolio',store.get().theme),theme);
    assert.deepEqual(store.get(),{language,theme});assert.equal(map.get('tensorcat.theme'),theme);
  }
});
test('early bootstrap paints Lab dark without changing a saved Light preference',()=>{
  for(const appearanceScope of ['portfolio','lab'])for(const theme of ['light','dark']){
    const root={dataset:{appearanceScope},style:{}},writes=[];
    runInNewContext(read('static/js/preferences-init.js'),{document:{documentElement:root},localStorage:{getItem:key=>key==='tensorcat.theme'?theme:'zh-CN',setItem:(...args)=>writes.push(args)}});
    assert.equal(root.dataset.theme,theme);assert.equal(root.dataset.effectiveTheme,appearanceScope==='lab'?'dark':theme);assert.equal(root.style.colorScheme,root.dataset.effectiveTheme);assert.equal(root.lang,'zh-CN');assert.deepEqual(writes,[]);
  }
});
test('Lab boundary belongs to exact layout route segments, not arbitrary substrings',()=>{
  const boundary=read('templates/base.html').split('<!DOCTYPE html>')[0];
  assert.match(boundary,/route_path == "\/lab" or route_path is starting_with\("\/lab\/"\)/);
  assert.doesNotMatch(boundary,/containing/);assert.match(read('static/js/preferences.js'),/effectiveAppearance\(root\.dataset\.appearanceScope,state\.theme\)/);
});
test('Home does not override shared header geometry or typography',()=>{
  assert.doesNotMatch(read('static/styles/home-layout.css'),/portfolio-nav-inner|portfolio-brand/);
  const css=read('static/styles/preferences.css');assert.match(css,/width:100%;max-width:none;margin-inline:0;padding:18px 48px/);assert.match(css,/scrollbar-gutter:stable/);assert.match(css,/\.portfolio-nav-link\.is-active\{[^}]*font-weight:600/);
});
test('Lab has its own permanent tokens and no global Light-specific pale surface',()=>{
  const css=read('static/styles/preferences.css');assert.match(css,/:root\[data-appearance-scope=lab\]\{--page-bg:#090b0e/);assert.doesNotMatch(css,/#eaf0eb|html\[data-theme=light\] body/);
  assert.match(css,/html\[data-effective-theme=dark\] \.preference-switch img/);
  assert.match(read('templates/macros/nav.html'),/aria-describedby="lab-appearance-note"/);
});
test('Contact motion uses stable targets, gradual independent transforms and no layout animation',()=>{
  const css=read('static/styles/editorial.css'),contact=css.slice(css.indexOf('.editorial-contact-links {'),css.indexOf('.tensorcat-lab {'));
  assert.match(contact,/--contact-content-duration: 420ms/);assert.match(contact,/--contact-arrow-duration: 460ms/);assert.match(contact,/--contact-exit-duration: 340ms/);assert.match(contact,/--contact-content-delay: 50ms/);assert.match(contact,/--contact-arrow-delay: 80ms/);
  assert.match(contact,/translate3d\(4px,0,0\)/);assert.match(contact,/translate3d\(6px,-6px,0\)/);assert.doesNotMatch(contact,/transition[^;{}]*\b(?:padding|margin|width|height|top|left)\b/);
  assert.doesNotMatch(contact,/padding-left|setTimeout/);assert.match(contact,/:focus-visible/);
  assert.doesNotMatch(read('static/styles/preferences.css'),/\.editorial-contact-links>a/);
  assert.doesNotMatch(css,/\.editorial-contact h1 span\s*\{/);
  const template=read('templates/contact-page.html');assert.match(template,/class="editorial-contact-label"/);assert.match(template,/target="_blank" rel="noopener"/);
});
test('only supported preferences enter state and no-op selections do not notify',()=>{
  const store=createPreferenceStore();let calls=0;store.subscribe(()=>calls++);
  assert.equal(store.set('language','zh-TW'),false);assert.equal(store.set('theme','system'),false);assert.equal(store.set('other','en'),false);assert.equal(store.set('theme','light'),false);assert.equal(calls,0);
  assert.equal(store.set('language','zh-CN'),true);assert.equal(calls,1);
});
test('explicit selections persist and another page restores them',()=>{
  const map=new Map(),storage={getItem:key=>map.get(key),setItem:(key,value)=>map.set(key,value)},first=createPreferenceStore({storage});
  first.set('language','zh-CN');first.set('theme','dark');assert.equal(map.get('tensorcat.language'),'zh-CN');assert.deepEqual(createPreferenceStore({storage}).get(),{language:'zh-CN',theme:'dark'});
});
test('unavailable storage does not prevent changes or subscriptions',()=>{
  const store=createPreferenceStore({storage:{getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}}});let calls=0;const off=store.subscribe(()=>calls++);store.set('theme','dark');off();store.set('language','zh-CN');assert.equal(calls,1);assert.equal(store.get().theme,'dark');
});
test('cross-tab events update state without writing storage again, and removal restores defaults',()=>{
  let writes=0;const store=createPreferenceStore({storage:{getItem:()=>null,setItem:()=>writes++}});store.storageEvent({key:'tensorcat.language',newValue:'zh-CN'});store.storageEvent({key:'tensorcat.theme',newValue:'dark'});assert.deepEqual(store.get(),{language:'zh-CN',theme:'dark'});assert.equal(writes,0);store.storageEvent({key:null});assert.deepEqual(store.get(),{language:'en',theme:'light'});
});
test('messages have complete locales and exactly matching interpolation slots',()=>{
  assert.ok(Object.keys(catalog).length>390);
  for(const [key,pair] of Object.entries(catalog)){
    assert.deepEqual(Object.keys(pair).sort(),['en','zh-CN']);for(const text of Object.values(pair))assert.ok(text.length>0,key);
    const slots=text=>[...text.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort();assert.deepEqual(slots(pair.en),slots(pair['zh-CN']),key);
  }
  assert.equal(translate('sim.snapshots',{count:37},'zh-CN'),'37 / 180 个快照');assert.equal(translate('missing',{},'zh-CN'),'[missing]');assert.equal(translate('missing',{},'zh-CN','Original'),'Original');
});
test('generated browser catalog exactly matches the authored dictionary',()=>{
  assert.deepEqual(catalog,JSON.parse(read('data/locales.json')));execFileSync(process.execPath,[new URL('../tools/build-locales.mjs',import.meta.url).pathname,'--check']);
});
test('the standard JSON parser rejects duplicate keys rather than silently dropping them',()=>{
  const dir=mkdtempSync(join(tmpdir(),'tensorcat-locales-'));try{const path=join(dir,'bad.json');writeFileSync(path,'{"nav.home":1,"nav.home":2}');assert.throws(()=>execFileSync('python3',[new URL('../tools/validate-locale-json.py',import.meta.url).pathname,path],{stdio:'pipe'}),/Command failed/);}finally{rmSync(dir,{recursive:true});}
});
test('all original authored articles have separate Chinese variants and preserve exact math blocks',()=>{
  for(const file of readdirSync(new URL('../content/blog/',import.meta.url)).filter(p=>p!== '_index.md'&&p.endsWith('.md'))){
    const slug=file.slice(0,-3),original=read('content/blog/'+file),translation=read('locales/zh-CN/blog/'+file);assert.ok(translation.length>100,slug);assert.ok(catalog['post.'+slug+'.title']);assert.ok(catalog['post.'+slug+'.description']);
    const math=s=>[...s.matchAll(/<div class="math-block">([\s\S]*?)<\/div>/g)].map(m=>m[1]);assert.deepEqual(math(original),math(translation),slug);
  }
  for(const id of ['home','about','project-experience'])assert.ok(existsSync(new URL('../locales/zh-CN/'+id+'.md',import.meta.url)));
  const projects=read('locales/zh-CN/project-experience.md');for(const value of ['0.2005%','3.59%','82.70%','85.68%','0.97°','10.04°','19.0%','62.6%','35.5%','8.85%','81.12%','9,720','2,707','91.79%','0.9138','0.9172'])assert.ok(projects.includes(value),value);
});
test('preferences are initialized before styles and use no navigation or simulation reset',()=>{
  const base=read('templates/base.html'),source=read('static/js/preferences.js');assert.ok(base.indexOf('preferences-init.js')<base.indexOf('block user_head'));
  assert.doesNotMatch(source,/location\.(?:reload|href)|new ExperimentSession|session\.reset|updateMode\(/);
  assert.match(source,/storage/);assert.match(source,/pageshow/);assert.match(source,/aria-checked/);assert.match(source,/ArrowLeft/);
  const init=read('static/js/preferences-init.js');assert.match(init,/tensorcat\.theme/);assert.match(init,/root\.lang=language/);
});
test('locale DOM updates use explicit keys and safe text, not English text matching',()=>{
  const i18n=read('static/js/i18n.js'),ui=read('static/js/lab-v3/locale-ui.js');assert.match(i18n,/element\.textContent=t\(key,args\)/);assert.doesNotMatch(i18n,/innerHTML|TreeWalker|createTreeWalker/);assert.match(ui,/data-label-slot/);assert.doesNotMatch(ui,/innerHTML\s*=/);
});
test('runtime locale callbacks only relabel and repaint, not reset scientific state',()=>{
  const app=read('static/js/lab-v3/app.js'),callback=app.slice(app.lastIndexOf("on(window,'tensorcat:preferences'"),app.lastIndexOf('updateMode();resize();schedule();'));
  assert.doesNotMatch(callback,/reset\(|activateLab|rebuildObjects|syncWorldUI|timeline\.clear|new WorldSimulator/);assert.match(callback,/screenDirty=true/);
  const showcase=read('static/js/lab-showcase.js');assert.match(showcase,/paintHome\(\)/);assert.match(showcase,/tensorcat:preferences/);
});
test('dark appearance uses semantic colors without inverting artwork and keeps motion opt-out',()=>{
  const css=read('static/styles/preferences.css');assert.match(css,/--page-bg:#0d1010/);assert.match(css,/--quote-bg:#2b4030/);assert.doesNotMatch(css,/(?:html|body)(?:\[[^\]]+\])?\s*\{[^{}]*filter:invert/);assert.match(css,/prefers-reduced-motion/);assert.match(css,/translateX\(100%\)/);assert.match(css,/320ms cubic-bezier/);
});
