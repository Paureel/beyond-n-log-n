import {createHash} from 'node:crypto';
import {REPOSITORY} from './research.mjs';
import {normalizeSelectedResult,selectionStatus,SELECTED_RESULT_PATH} from './maintainer.mjs';
import {matchesETag} from './payload.mjs';

const RAW=`https://raw.githubusercontent.com/${REPOSITORY}`;
const FEED=`https://github.com/${REPOSITORY}/commits/main/${SELECTED_RESULT_PATH}.atom`;
const hash=value=>createHash('sha256').update(value).digest('hex');
const digest=record=>hash(JSON.stringify(record));
const formatError=()=>Object.assign(new Error('Unsupported upstream maintainer selection.'),{code:'MAINTAINER_FORMAT_UNSUPPORTED'});

export function parseSelectionFeed(xml) {
 if(typeof xml!=='string'||/<!DOCTYPE|<!ENTITY/i.test(xml)||!xml.includes(`<id>tag:github.com,2008:/${REPOSITORY}/commits/main/${SELECTED_RESULT_PATH}</id>`))throw Error('Invalid selection feed.');
 const commits=[...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([,entry])=>{
  const sha=entry.match(/<id>tag:github\.com,2008:Grit::Commit\/([a-f0-9]{40})<\/id>/)?.[1];
  const date=entry.match(/<updated>([^<]+)<\/updated>/)?.[1];
  if(!sha||!Number.isFinite(Date.parse(date))||!entry.includes(`href="https://github.com/${REPOSITORY}/commit/${sha}"`))throw Error('Invalid selection feed entry.');
  return {sha,commit:{committer:{date}}};
 });
 if(!commits.length||new Set(commits.map(c=>c.sha)).size!==commits.length)throw Error('Empty or duplicate selection feed.');
 return commits;
}

export async function collectKappa({fetcher=fetch,priorData=null,now=Date.now,backfill=false}={}) {
 const get=async url=>{
  const response=await fetcher(url,{headers:{'User-Agent':'beyond-n-log-n-kappa'},signal:AbortSignal.timeout(7000)});
  if(response.status===404)return null;
  if(!response.ok)throw Error(`Kappa source returned ${response.status}.`);
  return response.text();
 };
 const [feed,headText]=await Promise.all([get(FEED),get(`${RAW}/main/${SELECTED_RESULT_PATH}`)]);
 const commits=parseSelectionFeed(feed),latest=commits[0];
 let head;
 try{head=headText===null?null:JSON.parse(headText);if(headText!==null&&(!head||typeof head!=='object'||Array.isArray(head)))throw formatError();}catch{throw formatError();}
 const recordDigest=digest(head),priorHistory=priorData?.maintainer?.history??[];
 let current=null;
 const warnings=[];
 // A cache hit still checks both live sources. A feed/main disagreement may
 // be a concurrent update or CDN lag, so retain last-good data and retry later.
 const cached=priorData?.sourceCommit===latest.sha&&priorData?.recordDigest===recordDigest;
 if(cached)current=priorData.maintainer.current;
 else {
  const text=await get(`${RAW}/${latest.sha}/${SELECTED_RESULT_PATH}`);
  let pinned;
  try{pinned=text===null?null:JSON.parse(text);}catch{throw formatError();}
  if(digest(pinned)!==recordDigest)throw Error('Selection sources are temporarily inconsistent.');
  if(head!==null&&selectionStatus(head)!=='withdrawn') {
   current=normalizeSelectedResult(head,latest);
   if(!current)throw formatError();
   current.review.dateSource='record-commit';
  }
 }
 const history=new Map(priorHistory.map(point=>[point.commit,point]));
 // Backfill runs explicitly when preparing the bundled snapshot. Live requests
 // append only the current selection: optional history cannot delay the headline.
 let index=1;
 await Promise.all(Array.from({length:backfill?Math.min(3,commits.length-1):0},async()=>{
  while(index<commits.length){const commit=commits[index++];if(history.has(commit.sha))continue;
   try{
    const text=await get(`${RAW}/${commit.sha}/${SELECTED_RESULT_PATH}`);
    if(!text)continue;
    const point=normalizeSelectedResult(JSON.parse(text),commit);
    if(point){point.review.dateSource='record-commit';history.set(commit.sha,point);}
   }catch{warnings.push(`Recent selection ${commit.sha.slice(0,7)} could not be loaded.`);}
  }
 }));
 if(current)history.set(current.commit,current);
 return {schemaVersion:1,fetchedAt:new Date(now()).toISOString(),sourceCommit:latest.sha,recordDigest,
  maintainer:{current,history:[...history.values()].sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt))},warnings};
}

export function kappaPayload(data) {
 const {sourceCommit,recordDigest,fetchedAt,live,refreshError,revision,...content}=data;
 return {...content,fetchedAt,revision:hash(JSON.stringify(content))};
}

export function createKappaService({collect=collectKappa,snapshot,read=async()=>null,write=async()=>{},now=Date.now,ttl=15*60*1000}={}) {
 let cached=snapshot??null,pending=null,retryAt=0,lastError='';
 const run=async()=>{
  try{const shared=await read();if(shared&&(!cached||Date.parse(shared.fetchedAt)>Date.parse(cached.fetchedAt)))cached=shared;}catch{/* Keep the local last-good selection. */}
  if(cached&&now()-Date.parse(cached.fetchedAt)<ttl)return {data:cached,live:true};
  if(cached&&now()<retryAt)return {data:cached,live:false,refreshError:lastError};
  try{
   const data=await collect({priorData:cached});cached=data;retryAt=0;lastError='';
   try{await write(data);}catch{/* Storage does not gate successful refreshes. */}
   return {data,live:true};
  }catch(error){
   lastError=error?.code==='MAINTAINER_FORMAT_UNSUPPORTED'?'The maintainer selection format changed. Showing the last successful kappa.':'The kappa refresh is temporarily unavailable. Showing the last successful kappa.';
   retryAt=now()+60*1000;
   if(cached)return {data:cached,live:false,refreshError:lastError};
   throw Error('The κ source is temporarily unavailable.');
  }
 };
 return async request=>{
  const security={'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'"};
  if(request.method!=='GET')return Response.json({error:'Method not allowed'},{status:405,headers:{...security,Allow:'GET','Cache-Control':'no-store'}});
  try{
   pending??=run().finally(()=>{pending=null;});
   const {data,live,refreshError}=await pending,payload=kappaPayload(data),etag=`W/"${payload.revision}"`;
   const remaining=Math.max(0,Math.min(900,Math.ceil((ttl-(now()-Date.parse(data.fetchedAt)))/1000)));
   const headers={...security,ETag:etag,'X-Kappa-Fetched-At':data.fetchedAt,'X-Kappa-Live':String(live),...(refreshError?{'X-Kappa-Refresh-Error':refreshError}:{}),
    ...(live?{'Cache-Control':`public, max-age=${Math.min(60,remaining)}`,'Netlify-CDN-Cache-Control':`public, durable, s-maxage=${remaining}, stale-while-revalidate=60`}:{'Cache-Control':'no-store'})};
   if(matchesETag(request.headers.get('If-None-Match'),etag))return new Response(null,{status:304,headers:{...headers,'Netlify-CDN-Cache-Control':'no-store'}});
   return Response.json({...payload,live,...(refreshError?{refreshError}:{})},{headers});
  }catch{return Response.json({error:'The κ source is temporarily unavailable.'},{status:503,headers:{...security,'Cache-Control':'no-store'}});}
 };
}
