import http from 'node:http';
import {onRequest} from '../functions/api/image-studio/[[path]].js';
const port=Number(process.env.PORT||1112);
// Real Pages handlers, empty bindings: no provider mocks, credentials or remote inference.
http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,`http://127.0.0.1:${port}`);
    if(url.pathname.startsWith('/api/image-studio/')){
      const controller=new AbortController();req.on('aborted',()=>controller.abort());
      const request=new Request(url,{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:req,duplex:'half',signal:controller.signal});
      const response=await onRequest({request,env:{},params:{path:url.pathname.slice('/api/image-studio/'.length).split('/')}});
      res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
    }
    const upstream=await fetch('http://127.0.0.1:1111'+url.pathname+url.search),type=upstream.headers.get('content-type')||'application/octet-stream';
    res.writeHead(upstream.status,{'Content-Type':type,'Cache-Control':'no-store'});
    if(type.includes('text/html'))res.end((await upstream.text()).replaceAll('127.0.0.1:1111',url.host).replace('<script src="/livereload.js?port=1111&amp;mindelay=10"></script>',''));else res.end(Buffer.from(await upstream.arrayBuffer()));
  }catch{res.writeHead(503,{'Content-Type':'text/plain'});res.end('Start zola serve on 127.0.0.1:1111 first.');}
}).listen(port,'127.0.0.1',()=>console.log(`Image Studio preview: http://127.0.0.1:${port}/lab/ai-image-studio/ (cloud services disabled)`));
