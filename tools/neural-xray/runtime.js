import '@tensorflow/tfjs-backend-cpu';
import '@tensorflow/tfjs-core/dist/register_all_gradients.js';
import '@tensorflow/tfjs-core/dist/public/chained_ops/register_all_chained_ops.js';
import {env} from '@tensorflow/tfjs-core';
env().setPlatform('tensorcat-cpu',{now:()=>performance.now(),fetch:(...args)=>globalThis.fetch(...args),encode:text=>new TextEncoder().encode(text),decode:(bytes,encoding)=>new TextDecoder(encoding).decode(bytes),isTypedArray:ArrayBuffer.isView});
export * from '@tensorflow/tfjs-core';
