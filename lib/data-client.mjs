import {validKappa} from './kappa-state.mjs';
const CACHE_KEY='beyond-n-log-n:compact:1';
export function validResearch(data){return data?.schemaVersion===1&&data?.payloadVersion===1&&/^[a-f0-9]{64}$/.test(data.revision??'')&&Number.isFinite(Date.parse(data.fetchedAt))&&Array.isArray(data.prs)&&Array.isArray(data.forks)&&Array.isArray(data.maintainer?.history);}

export function createResearchClient({fetcher=fetch,storage=()=>globalThis.localStorage,endpoint='/api/research?v=compact-2',snapshotURL='/research.json',cacheKey=CACHE_KEY,validate=validResearch,headerPrefix='X-Research'}={}){
 let data=null,status={refreshing:false,live:false,error:''},bootstrapPromise,inflight;
 const listeners=new Set();
 const notify=()=>{for(const listener of listeners)listener({data,status});};
 const persist=()=>{try{storage()?.setItem(cacheKey,JSON.stringify(data));}catch{/* Storage blocked or full: the snapshot and HTTP cache still work. */}};
 const apply=next=>{if(!data||Date.parse(next.fetchedAt)>=Date.parse(data.fetchedAt)){data=next;persist();}notify();};
 const bootstrap=()=>bootstrapPromise??=(async()=>{
  try{const saved=JSON.parse(storage()?.getItem(cacheKey)??'null');if(validate(saved)){data=saved;notify();return;}}catch{/* Invalid or unavailable local cache. */}
  try{const response=await fetcher(snapshotURL);if(!response.ok)throw Error('The research snapshot could not be loaded.');const saved=await response.json();if(!validate(saved))throw Error('Unexpected snapshot format.');apply(saved);}catch(error){status={...status,error:error.message};notify();}
 })();
 const refresh=()=>inflight??=(async()=>{
  await bootstrap();status={...status,refreshing:true};notify();
  try{
   const response=await fetcher(endpoint,{cache:'no-cache',headers:data?{'If-None-Match':`W/"${data.revision}"`}:{},signal:AbortSignal.timeout(headerPrefix==='X-Kappa'?20000:55000)});
   if(response.status===304){
    if(!data)throw Error('The saved research record is unavailable.');
    const fetchedAt=response.headers.get(`${headerPrefix}-Fetched-At`),live=response.headers.get(`${headerPrefix}-Live`);
    status={refreshing:false,live:live===null?status.live:live==='true',error:response.headers.get(`${headerPrefix}-Refresh-Error`)||''};
    apply({...data,...(fetchedAt&&Number.isFinite(Date.parse(fetchedAt))?{fetchedAt}:{}),live:status.live,refreshError:status.error});
   }else{
    if(!response.ok)throw Error('GitHub refresh is unavailable.');
    const next=await response.json();if(!validate(next))throw Error('Unexpected research data format.');
    status={refreshing:false,live:!!next.live,error:next.refreshError||''};apply(next);
   }
  }catch(error){status={refreshing:false,live:false,error:error.message};notify();}
  finally{inflight=null;}
 })();
 return {start:refresh,refresh,subscribe(listener){listeners.add(listener);listener({data,status});return ()=>listeners.delete(listener);}};
}

export function createKappaClient(options={}){
 return createResearchClient({...options,endpoint:'/api/kappa?v=1',snapshotURL:'/kappa.json',cacheKey:'beyond-n-log-n:kappa:1',validate:validKappa,headerPrefix:'X-Kappa'});
}

export function createDescriptionClient({fetcher=fetch}={}){
 const cache=new Map();
 return pr=>{
  const key=`${pr.id}:${pr.descriptionVersion}`;
  if(!cache.has(key)){
   const params=new URLSearchParams({repo:pr.repo,number:String(pr.number),version:pr.descriptionVersion});
   const pending=(async()=>{
    const response=await fetcher('/api/pr-description?'+params,{signal:AbortSignal.timeout(55000)});
    if(!response.ok)throw Error(response.status===409?'This description changed. Refresh the dashboard and reopen the PR.':'The description could not be loaded.');
    const result=await response.json();
    if(result.id!==pr.id||result.version!==pr.descriptionVersion||typeof result.body!=='string')throw Error('Unexpected description format.');
    return result.body;
   })().catch(error=>{cache.delete(key);throw error;});
   cache.set(key,pending);
  }
  return cache.get(key);
 };
}
