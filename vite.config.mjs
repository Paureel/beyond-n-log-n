import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import research from './netlify/functions/research.mjs';
export default defineConfig({plugins:[react(),{name:'local-research-api',configureServer(server){server.middlewares.use('/api/research',async(req,res)=>{try{const response=await research(new Request('http://localhost/api/research',{method:req.method}));res.statusCode=response.status;response.headers.forEach((value,key)=>res.setHeader(key,value));res.end(await response.text());}catch{res.statusCode=503;res.end(JSON.stringify({error:'Live refresh unavailable'}));}});}}]});
