import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PhotonImage} from '@cf-wasm/photon/node';
import {decodeBounded,validatorHandler,CLOUD_BYTE_LIMIT} from '../src/decode.js';

const logo=readFileSync(new URL('../../../static/lab/tc06/logo-original.png',import.meta.url));
test('real WASM decoder fully decodes bounded PNG, JPEG and WebP',()=>{
  const source=PhotonImage.new_from_byteslice(logo);
  try{
    for(const [type,bytes]of [['image/png',logo],['image/jpeg',source.get_bytes_jpeg(85)],['image/webp',source.get_bytes_webp()]]){
      assert.deepEqual(decodeBounded(bytes,type,PhotonImage),{decoded:true,type,width:400,height:400});
    }
  }finally{source.free();}
});
test('valid-looking truncated pixels fail and do not poison the next decode',()=>{
  assert.throws(()=>decodeBounded(logo.slice(0,40),'image/png',PhotonImage));
  assert.equal(decodeBounded(logo,'image/png',PhotonImage).decoded,true);
});
test('oversized dimensions and bodies are rejected before native decoding',()=>{
  const bomb=new Uint8Array(logo);new DataView(bomb.buffer).setUint32(16,100000);
  const never={new_from_byteslice(){assert.fail('decoder must not run');}};
  assert.throws(()=>decodeBounded(bomb,'image/png',never),/pixels/);
  assert.throws(()=>decodeBounded(new Uint8Array(CLOUD_BYTE_LIMIT+1),'image/png',never),/format/);
  assert.throws(()=>decodeBounded(logo,'image/jpeg',never),/format/);
});
test('decode allocations are released even when post-decode dimensions disagree',()=>{
  let released=0;
  const mismatch={new_from_byteslice(){return {get_width:()=>401,get_height:()=>400,free(){released++;}};}};
  assert.throws(()=>decodeBounded(logo,'image/png',mismatch),/pixels/);assert.equal(released,1);
});
test('private worker only accepts bounded raw image decode requests',async()=>{
  const handler=validatorHandler(PhotonImage);
  assert.equal((await handler(new Request('https://validator.internal/'))).status,404);
  const response=await handler(new Request('https://validator.internal/decode',{method:'POST',headers:{'Content-Type':'image/png'},body:logo}));
  assert.equal(response.status,200);assert.equal((await response.json()).decoded,true);
  const invalid=await handler(new Request('https://validator.internal/decode',{method:'POST',headers:{'Content-Type':'image/png'},body:logo.slice(0,40)}));
  assert.equal(invalid.status,422);
  const tooLarge=await handler(new Request('https://validator.internal/decode',{method:'POST',body:new Uint8Array(CLOUD_BYTE_LIMIT+1)}));
  assert.equal(tooLarge.status,413);
});
