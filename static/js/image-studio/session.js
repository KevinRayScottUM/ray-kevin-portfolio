export const IMAGE_STATES=Object.freeze(['EMPTY','DRAGGING','VALIDATING','LOCAL_IMAGE_READY','TRANSFERRING','SERVER_ACCEPTED','TRANSFER_FAILED','EDITING']);
export class ImageSelection {
  constructor(decode){this.decode=decode;this.version=0;this.disposed=false;}
  async prepare(file){const version=++this.version;let image;try{image=await this.decode(file);}catch(error){if(!this.current(version))return null;throw error;}if(!this.current(version)){image.bitmap.close();return null;}return {image,version};}
  current(version){return !this.disposed&&version===this.version;}
  dispose(){this.disposed=true;this.version++;}
}
export class ImageTransfer {
  constructor(transfer){this.transfer=transfer;this.state='EMPTY';this.pending=null;this.receipt=null;this.file=null;}
  select(file){if(this.pending)throw Error('busy');this.file=file;this.receipt=null;this.state='LOCAL_IMAGE_READY';}
  send(options={}){
    if(this.pending)return this.pending;if(!options.consent)return Promise.reject(Error('consentRequired'));if(!this.file)return Promise.reject(Error('needImage'));
    this.state='TRANSFERRING';
    this.pending=Promise.resolve().then(()=>this.transfer(this.file,options)).then(data=>{if(!data?.accepted||!data.receipt)throw Error('uploadFailed');this.receipt=data.receipt;this.state='SERVER_ACCEPTED';return data;}).catch(error=>{this.state='TRANSFER_FAILED';throw error;}).finally(()=>{this.pending=null;});return this.pending;
  }
}
export class DragDepth {
  constructor(){this.depth=0;}
  enter(){return ++this.depth>0;}
  leave(){this.depth=Math.max(0,this.depth-1);return this.depth>0;}
  clear(){this.depth=0;}
}
