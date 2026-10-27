import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import research from './netlify/functions/research.mjs';
import kappa from './netlify/functions/kappa.mjs';
export default defineConfig({plugins:[react(),{name:'local-research-api',configureServer(server){server.middlewares.use(async(req,res,next)=>{
 const path=(req.url??'').split('?')[0];if(!['/api/research','/api/pr-description','/api/kappa'].includes(path))return next();
 try{const headers=new Headers();for(const [key,value] of Object.entries(req.headers))if(value!==undefined)headers.set(key,Array.isArray(value)?value.join(','):value);const response=await (path==='/api/kappa'?kappa:research)(new Request('http://localhost'+req.url,{method:req.method,headers}));res.statusCode=response.status;response.headers.forEach((value,key)=>res.setHeader(key,value));res.end(Buffer.from(await response.arrayBuffer()));}catch{res.statusCode=503;res.end(JSON.stringify({error:'Live refresh unavailable'}));}
 });}}]});
