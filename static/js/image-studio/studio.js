import {acquireImage,uploadImage,REFERENCE_SIDE} from './files.js';
import {ImageSelection,ImageTransfer,DragDepth} from './session.js';
import {ImageReveal,MOTION} from './motion.js';
import {tr,localize} from './messages.js';
import {CodeRain,readingMasks} from '../lab-rain.js';

const TOOLS=['edit','inpaint','remove-background','upscale','face-swap'];
const ACTION_LABELS={edit:'processEdit',inpaint:'processInpaint','remove-background':'processBackground',upscale:'processUpscale','face-swap':'processFace'};
const download=(blob,name)=>{const link=document.createElement('a'),url=URL.createObjectURL(blob);link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
export class ImageStudio {
  constructor(root){
    this.root=root;this.abort=new AbortController();this.editor=null;this.file=null;this.tool='edit';this.busy=false;this.disposed=false;this.selection=new ImageSelection(acquireImage);this.transfer=new ImageTransfer(uploadImage);this.depth=new DragDepth();this.reveal=new ImageReveal(root);this.cloud={upload:false,providers:{}};this.quota=null;this.receiptHash=null;this.message=null;this.rainTimer=null;this.toolEpoch=0;this.turnstileWidget=null;this.turnstilePending=null;this.compact=matchMedia('(max-width:800px)');
    this.drop=root.querySelector('[data-drop-zone]');this.drawer=root.querySelector('[data-tool-drawer]');this.media=matchMedia('(prefers-reduced-motion: reduce)');this.drawer.open=!this.compact.matches;
    const on=(target,event,fn,options={})=>target.addEventListener(event,fn,{...options,signal:this.abort.signal});this.on=on;
    on(root.querySelector('[data-file]'),'change',e=>{const file=e.target.files[0];e.target.value='';if(file)this.select(file);});
    on(root,'click',e=>{const action=e.target.closest('[data-action]');if(action&&!action.disabled)this.action(action.dataset.action);const button=e.target.closest('[data-tool]');if(button&&!button.disabled)this.selectTool(button.dataset.tool);});
    const hasFiles=e=>[...(e.dataTransfer?.types||[])].includes('Files');
    on(this.drop,'dragenter',e=>{if(!hasFiles(e)||this.busy)return;e.preventDefault();this.depth.enter();this.dragActive(true);});
    on(this.drop,'dragover',e=>{if(!hasFiles(e))return;e.preventDefault();e.dataTransfer.dropEffect=this.busy?'none':'copy';if(!this.busy){this.dragActive(true);this.highlight(e);}});
    on(this.drop,'dragleave',e=>{if(!this.depth.leave())this.dragActive(false);});
    on(this.drop,'drop',e=>{if(!hasFiles(e))return;e.preventDefault();this.clearDrag();if(!this.busy)this.select(e.dataTransfer.files[0],{x:e.clientX,y:e.clientY});});
    on(window,'dragover',e=>{if(hasFiles(e))e.preventDefault();});on(window,'drop',e=>{if(hasFiles(e)){e.preventDefault();this.clearDrag();}});on(window,'dragend',()=>this.clearDrag());on(window,'blur',()=>this.clearDrag());
    on(this.drop,'pointermove',e=>this.highlight(e));on(this.drop,'pointerleave',()=>{this.drop.style.removeProperty('--drop-x');this.drop.style.removeProperty('--drop-y');});
    on(document,'paste',e=>{if(e.target.closest('input,textarea,[contenteditable=true]'))return;const image=[...(e.clipboardData?.files||[])].find(f=>f.type.startsWith('image/'));if(image){e.preventDefault();this.select(image);}});
    on(root.querySelector('[data-cloud-consent]'),'change',()=>this.syncProvider());on(root.querySelector('[data-consent]'),'change',()=>this.syncProvider());on(root.querySelector('[data-resize-scale]'),'change',()=>this.syncEditor());
    on(root.querySelector('[data-face-file]'),'change',e=>{const file=e.target.files[0];e.target.value='';if(file)this.selectFace(file);});
    on(window,'tensorcat:preferences',()=>{this.reveal.cancel();localize(root);this.syncProvider();this.syncEditor();this.editor?.renderHistory();this.editor?.draw();if(this.message)this.notice(this.message,this.messageError);this.updateLocalStatus();});
    on(this.compact,'change',()=>{this.drawer.open=!this.compact.matches;});
    for(const details of root.querySelectorAll('details'))this.disclosure(details);
    on(document,'visibilitychange',()=>document.hidden?this.stopRain():this.scheduleRain());on(this.media,'change',()=>{this.reveal.cancel();this.stopRain();this.scheduleRain();});
    on(window,'pagehide',e=>{this.stopRain();if(!e.persisted)this.dispose();});on(window,'pageshow',()=>this.scheduleRain());
    localize(root);this.rain=new CodeRain(document.body);this.scheduleRain();this.fetchCapabilities();
    root.studioDiagnostics=()=>({state:root.dataset.state,hasImage:!!this.file,tool:this.tool,transfer:this.transfer.state,editorStates:this.editor?.history.length||0,maskStates:this.editor?.maskHistory.length||0,maskIndex:this.editor?.maskIndex,editorIndex:this.editor?.index,rainScheduled:!!this.rainTimer,selectionVersion:this.selection.version,activeReveal:this.reveal.animations.length,language:document.documentElement.lang});
  }
  setState(state){this.root.dataset.state=state;}
  notice(key,error=false){this.message=key;this.messageError=error;const el=this.root.querySelector('[data-notice]');el.textContent=tr(key);el.classList.toggle('is-error',error);}
  clearDrag(){this.depth.clear();this.dragActive(false);}
  dragActive(active){this.drop.classList.toggle('is-dragging',active);const copy=this.root.querySelector('[data-drop-copy]');copy.dataset.studioText=active?'release':'drop';copy.textContent=tr(copy.dataset.studioText);if(!this.busy&&this.root.dataset.state!=='VALIDATING')this.setState(active?'DRAGGING':this.file?'EDITING':'EMPTY');}
  highlight(event){const r=this.drop.getBoundingClientRect();this.drop.style.setProperty('--drop-x',(event.clientX-r.left)+'px');this.drop.style.setProperty('--drop-y',(event.clientY-r.top)+'px');}
  async editorInstance(){if(!this.editor){this.editorModule??=import('./editor.js');const {ImageEditor}=await this.editorModule;if(this.disposed)return null;if(!this.editor){this.editor=new ImageEditor(this.root,this.abort.signal,key=>this.notice(key));this.editor.onChange=()=>{this.syncEditor();this.syncProvider();};}}return this.editor;}
  async select(file,point){
    if(!file||this.busy||this.disposed)return;this.clearDrag();this.reveal.cancel();this.setState('VALIDATING');this.drop.classList.add('is-validating');this.notice('loading');let prepared;
    try{
      prepared=await this.selection.prepare(file);if(!prepared)return;const {image,version}=prepared,editor=await this.editorInstance();if(!editor||!this.selection.current(version)){image.bitmap.close();return;}
      const wasEmpty=!this.file;if(!await editor.open(image,()=>this.selection.current(version))){image.bitmap.close();return;}
      this.file?.bitmap.close();this.file=image;this.receiptHash=null;this.transfer.select(null);this.root.querySelector('[data-cloud-consent]').checked=false;this.root.querySelector('[data-consent]').checked=false;this.root.dataset.hasImage='true';this.root.querySelector('[data-empty-surface]').inert=true;this.root.querySelector('[data-empty-surface]').setAttribute('aria-hidden','true');
      for(const selector of ['[data-editor]','[data-inspector]','[data-image-meta]','[data-image-history]'])this.root.querySelector(selector).hidden=false;
      this.root.querySelector('[data-file-name]').textContent=image.file.name;this.root.querySelector('[data-file-summary]').textContent=image.width+' × '+image.height+' · '+(image.file.size/1024).toFixed(0)+' KB';
      this.root.querySelector('[data-progress]').hidden=true;this.setState('LOCAL_IMAGE_READY');this.drop.classList.remove('is-validating');this.syncEditor();this.syncProvider();editor.fit();this.notice('ready');this.updateLocalStatus();
      await this.reveal.run(image.file,image.bitmap,point,wasEmpty);if(this.selection.current(version))this.setState('EDITING');
    }catch(error){if(prepared?.image&&prepared.image!==this.file)prepared.image.bitmap.close();if(!this.disposed){this.notice(error.message in {size:1,format:1,pixels:1}?error.message:'format',true);this.setState(this.file?'EDITING':'EMPTY');}}
    finally{if(!this.disposed&&this.root.dataset.state!=='VALIDATING')this.drop.classList.remove('is-validating');}
  }
  async selectFace(file){if(this.busy)return;try{const face=await acquireImage(file);if(this.disposed){face.bitmap.close();return;}this.face?.bitmap.close();if(this.faceURL)URL.revokeObjectURL(this.faceURL);this.face=face;this.faceURL=URL.createObjectURL(face.file);const img=this.root.querySelector('[data-face-preview]');img.src=this.faceURL;img.hidden=false;this.root.querySelector('[data-consent]').checked=false;this.syncProvider();}catch(error){this.notice(error.message,true);}}
  async selectTool(tool){
    if(!TOOLS.includes(tool)||!this.file||this.busy)return;const epoch=++this.toolEpoch,settings=this.root.querySelector('[data-tool-settings]');this.toolAnimation?.cancel();
    if(!this.media.matches&&this.tool!==tool){this.toolAnimation=settings.animate([{opacity:1},{opacity:0}],{duration:110,fill:'both'});await Promise.allSettled([this.toolAnimation.finished]);if(epoch!==this.toolEpoch||this.disposed)return;this.toolAnimation.cancel();}
    this.tool=tool;this.editor.tool=tool;
    for(const [selector,id]of [['mask-controls','inpaint'],['background-controls','remove-background'],['resize-controls','upscale'],['face-controls','face-swap']])this.root.querySelector('[data-'+selector+']').hidden=tool!==id;
    this.root.querySelector('[data-prompt-control]').hidden=!['edit','inpaint'].includes(tool);this.root.querySelector('[data-seed-control]').hidden=tool!=='edit';this.syncProvider();this.editor.draw();
    if(!this.media.matches)this.toolAnimation=settings.animate([{opacity:0,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:280,easing:MOTION.easing});
  }
  syncEditor(){
    const image=this.editor?.current?.bitmap;if(!image)return;for(const button of this.root.querySelectorAll('[data-tool]'))button.disabled=this.busy;
    this.root.querySelector('[data-comparison]').hidden=this.editor.history.length<2;this.root.querySelector('[data-target-resolution]').textContent=Math.round(image.width*+this.root.querySelector('[data-resize-scale]').value)+' × '+Math.round(image.height*+this.root.querySelector('[data-resize-scale]').value);
  }
  updateLocalStatus(){const accepted=!!this.transfer.receipt;this.root.querySelector('[data-local-badge]').textContent=tr(accepted?'serverAccepted':'imageReady');this.root.querySelector('[data-session-state]').textContent=tr(this.busy?'processing':'localSession');}
  syncProvider(){
    const provider=this.cloud.providers[this.tool],status=provider?.status||'NOT_CONFIGURED';this.root.querySelector('[data-provider-status]').textContent=tr('status'+status);this.root.querySelector('[data-provider-name]').textContent=provider?.model||provider?.provider||'Cloudflare';this.root.querySelector('[data-provider-reason]').textContent=tr(provider?.reason||'configuration');
    for(const el of this.root.querySelectorAll('[data-active-tool],[data-selected-tool]'))el.textContent=tr(this.tool);for(const button of this.root.querySelectorAll('[data-tool]'))button.setAttribute('aria-pressed',String(button.dataset.tool===this.tool));
    const process=this.root.querySelector('[data-action=process]');process.textContent=tr(this.busy?'processing':ACTION_LABELS[this.tool]);process.disabled=this.busy||!this.file||!['READY','EXPERIMENTAL'].includes(status)||!this.cloud.upload||!this.root.querySelector('[data-cloud-consent]').checked||(this.tool==='face-swap'&&(!this.face||!this.root.querySelector('[data-consent]').checked));
    this.root.querySelector('[data-quota]').textContent=this.quota?.remaining===null||this.quota?.remaining===undefined?'AI / '+tr('notAvailable'):tr('remaining')+this.quota.remaining;
    this.root.querySelector('[data-provider-list]').replaceChildren(...TOOLS.map(id=>{const el=document.createElement('div');el.className='is-provider-item';const title=document.createElement('strong'),text=document.createElement('span'),p=this.cloud.providers[id];title.textContent=tr(id);text.textContent=tr('status'+(p?.status||'NOT_CONFIGURED'))+' · '+tr(p?.reason||'configuration');el.append(title,text);return el;}));
  }
  async fetchCapabilities(){try{const response=await fetch('/api/image-studio/capabilities',{cache:'no-store',signal:this.abort.signal});if(!response.ok)throw Error();this.cloud=await response.json();const quota=await fetch('/api/image-studio/quota',{cache:'no-store',signal:this.abort.signal});if(quota.ok)this.quota=await quota.json();if(this.cloud.siteKey)this.loadTurnstile();}catch{this.cloud={upload:false,providers:{}};}if(!this.disposed)this.syncProvider();}
  loadTurnstile(){
    const render=()=>{if(this.disposed||this.turnstileWidget!==null||!window.turnstile)return;this.turnstileWidget=window.turnstile.render(this.root.querySelector('[data-turnstile]'),{sitekey:this.cloud.siteKey,action:'image-studio',execution:'execute',appearance:'interaction-only',callback:token=>{this.turnstilePending?.resolve(token);this.turnstilePending=null;},'error-callback':()=>{this.turnstilePending?.reject(Error('challenge'));this.turnstilePending=null;}});};
    if(window.turnstile){render();return;}let script=document.querySelector('script[data-studio-challenge]');if(!script){script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;script.dataset.studioChallenge='';document.head.append(script);}this.on(script,'load',render);
  }
  token(){if(this.turnstileWidget===null||!window.turnstile)return Promise.reject(Error('challenge'));return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.turnstilePending=null;reject(Error('challenge'));},120000);this.turnstilePending={resolve:t=>{clearTimeout(timer);resolve(t);},reject:e=>{clearTimeout(timer);reject(e);}};window.turnstile.reset(this.turnstileWidget);window.turnstile.execute(this.turnstileWidget);});}
  async process(){
    if(this.busy||!this.editor?.current)return;const provider=this.cloud.providers[this.tool];if(!this.cloud.upload||!['READY','EXPERIMENTAL'].includes(provider?.status)){this.notice('notConfigured',true);return;}if(!this.root.querySelector('[data-cloud-consent]').checked){this.notice('consentRequired',true);return;}
    const prompt=this.root.querySelector('[data-prompt]').value.trim(),seed=+this.root.querySelector('[data-seed]').value;
    if(this.tool==='edit'&&(!prompt||prompt.length>2000||!Number.isInteger(seed)||seed<0||seed>2147483647)){this.notice('input',true);return;}
    if(this.tool==='face-swap'&&(!this.face||!this.root.querySelector('[data-consent]').checked)){this.notice('consentRequired',true);return;}
    this.setBusy(true);
    try{
      // Prepare only the current image on explicit invocation; file selection never transfers.
      const image=this.editor.current.bitmap,reference=await this.editor.exportBlob('image/png',Math.min(1,REFERENCE_SIDE/Math.max(image.width,image.height))),bytes=new Uint8Array(await reference.arrayBuffer()),hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
      if(hash!==this.receiptHash||!this.transfer.receipt){
        this.transfer.select(new File([reference],'studio-reference.png',{type:'image/png'}));this.setState('TRANSFERRING');this.notice('uploading');const progress=this.root.querySelector('[data-progress]');progress.hidden=false;progress.value=0;
        await this.transfer.send({consent:true,token:await this.token(),signal:this.abort.signal,onProgress:({loaded,total})=>{progress.value=Math.min(99,loaded/total*100);}});this.receiptHash=hash;progress.value=100;this.setState('SERVER_ACCEPTED');
      }
      this.notice('processing');this.root.querySelector('[data-progress]').hidden=true;let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);
      const response=await fetch('/api/image-studio/'+this.tool,{method:'POST',headers:{'Content-Type':'application/json','X-Studio-Receipt':this.transfer.receipt,'X-Turnstile-Token':await this.token(),'Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({image:btoa(binary),prompt,seed}),signal:this.abort.signal});
      if(!response.ok){const error=await response.json();if(error.error==='receipt'){this.transfer.receipt=null;this.receiptHash=null;}throw Error(error.error||'provider');}
      const blob=await response.blob();await this.editor.add(blob,'result');const output=await blob.arrayBuffer();this.receiptHash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',output))].map(v=>v.toString(16).padStart(2,'0')).join('');this.transfer.receipt=response.headers.get('X-Studio-Receipt');this.root.querySelector('[data-compare]').value=50;this.editor.draw();
      if(!this.media.matches)this.root.querySelector('[data-editor-canvas]').animate([{opacity:.35,transform:'scale(.992)'},{opacity:1,transform:'scale(1)'}],{duration:360,easing:MOTION.easing});this.notice('resultReady');await this.fetchCapabilities();
    }catch(error){if(!this.disposed){this.notice(error.message,true);if(error.message==='quota'){this.cloud.providers[this.tool].status='QUOTA_EXHAUSTED';this.quota={remaining:0};}if(this.transfer.state==='TRANSFER_FAILED')this.setState('TRANSFER_FAILED');}}finally{if(!this.disposed){this.setBusy(false);if(this.root.dataset.state!=='TRANSFER_FAILED')this.setState('EDITING');}}
  }
  setBusy(busy){this.busy=busy;this.root.querySelector('[data-processing]').hidden=!busy;for(const b of this.root.querySelectorAll('[data-action],[data-tool]'))b.disabled=busy;this.root.querySelector('[data-editor-canvas]').inert=busy;this.syncEditor();this.syncProvider();this.updateLocalStatus();if(!busy)this.editor?.renderHistory();}
  async action(action){if(this.busy)return;try{
    if(action==='browse'){this.root.querySelector('[data-file]').click();return;}if(!this.editor?.current){this.notice('needImage',true);return;}
    if(action==='undo')this.editor.moveHistory(-1);if(action==='redo')this.editor.moveHistory(1);if(action==='fit')this.editor.fit();if(action==='actual'){const view=this.editor.view();this.editor.zoom/=view.scale;this.editor.pan={x:0,y:0};this.editor.draw();}
    if(action==='resetImage'){this.editor.index=0;this.editor.fit();this.editor.resetMask();this.editor.renderHistory();}if(action==='maskUndo')this.editor.maskMove(-1);if(action==='maskRedo')this.editor.maskMove(1);if(action==='clearMask'){this.editor.maskContext.clearRect(0,0,this.editor.mask.width,this.editor.mask.height);this.editor.saveMask();this.editor.draw();}
    if(action==='flatten'||action==='resize'){this.setBusy(true);try{await this.editor.add(await this.editor.exportBlob('image/png',action==='resize'?+this.root.querySelector('[data-resize-scale]').value:1,action==='flatten'),action==='resize'?'standardResize':'matte');}finally{this.setBusy(false);}}
    if(action==='download'){const type=this.root.querySelector('[data-export-format]').value;download(await this.editor.exportBlob(type),'tensorcat-edit.'+type.split('/')[1]);}if(action==='process')await this.process();
  }catch(error){this.notice(error.message,true);}}
  disclosure(details){
    const summary=details.querySelector('summary');this.on(summary,'click',event=>{event.preventDefault();const start=details.getBoundingClientRect().height,open=!(details.studioTarget??details.open),body=details.querySelector(':scope>div');details.studioAnimation?.cancel();details.studioTarget=open;
      if(this.media.matches){details.open=open;if(body)body.inert=false;delete details.studioTarget;details.style.overflow='';return;}details.open=true;const end=open?details.scrollHeight:summary.getBoundingClientRect().height;
      details.style.overflow='hidden';if(body)body.inert=true;const animation=details.animate([{height:start+'px'},{height:end+'px'}],{duration:280,easing:MOTION.easing});details.studioAnimation=animation;animation.onfinish=()=>{details.open=open;details.style.overflow='';if(body)body.inert=false;delete details.studioAnimation;delete details.studioTarget;};});
  }
  scheduleRain(){if(this.disposed||document.hidden||this.rainTimer)return;const masks=[...readingMasks(),...[...this.root.querySelectorAll('.is-heading,.is-tools,.is-inspector,.is-status-line')].map(el=>{const r=el.getBoundingClientRect();return {x:r.x-3,y:r.y-3,width:r.width+6,height:r.height+6};})];this.rain.paint(performance.now(),masks,this.media.matches);if(!this.media.matches)this.rainTimer=setTimeout(()=>{this.rainTimer=null;this.scheduleRain();},100);}
  stopRain(){clearTimeout(this.rainTimer);this.rainTimer=null;}
  dispose(){this.disposed=true;this.abort.abort();this.selection.dispose();this.reveal.dispose();this.toolAnimation?.cancel();for(const d of this.root.querySelectorAll('details'))d.studioAnimation?.cancel();this.stopRain();this.rain.dispose();this.editor?.dispose();this.file?.bitmap.close();this.face?.bitmap.close();if(this.faceURL)URL.revokeObjectURL(this.faceURL);if(this.turnstileWidget!==null)window.turnstile?.remove(this.turnstileWidget);this.turnstilePending?.reject(Error('cancelled'));delete this.root.studioDiagnostics;}
}
const root=typeof document!=='undefined'?document.querySelector('[data-image-studio]'):null;if(root)new ImageStudio(root);
