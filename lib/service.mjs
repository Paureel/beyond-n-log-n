import {compactResearch,descriptionVersion,matchesETag} from './payload.mjs';
// A shared last-good record makes cold starts and GitHub outages non-destructive.
function publicRefreshError(error) {
 const status = /^GitHub returned (\d{3})\b/.exec(error?.message || '')?.[1];
 if(status==='403'||status==='429')return `GitHub returned ${status} (API limit; a server-side GITHUB_TOKEN increases capacity).`;
 if(status)return `GitHub returned ${status}.`;
 if(error?.name==='TimeoutError'||error?.name==='AbortError')return 'The GitHub refresh timed out.';
 if(error?.message==='The research repository is not public.')return error.message;
 return 'The GitHub refresh is temporarily unavailable.';
}
const securityHeaders={'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'"};
function descriptionResponse(pr,version,request){
 if(!pr)return Response.json({error:'PR description is unavailable.'},{status:404,headers:{...securityHeaders,'Cache-Control':'no-store'}});
 if(descriptionVersion(pr)!==version)return Response.json({error:'This description changed. Refresh the dashboard and reopen the PR.'},{status:409,headers:{...securityHeaders,'Cache-Control':'no-store'}});
 const etag=`"${version}"`,headers={...securityHeaders,ETag:etag,'Cache-Control':'public, max-age=86400, immutable','Netlify-CDN-Cache-Control':'public, durable, s-maxage=86400'};
 if(matchesETag(request.headers.get('If-None-Match'),etag))return new Response(null,{status:304,headers:{...headers,'Netlify-CDN-Cache-Control':'no-store'}});
 return Response.json({id:pr.id,version,body:pr.body??'',headSha:pr.headSha,updatedAt:pr.updatedAt},{headers});
}
export function createResearchService({collect,snapshot,read=async()=>null,write=async()=>{},now=Date.now,ttl=15*60*1000}={}) {
 let cached=snapshot?{data:snapshot,time:0}:null,pending=null,retryAt=0,lastError='',compactSource,compactCache;
 async function run() {
  try {const shared=await read();if(shared&&(!cached||+new Date(shared.fetchedAt)>+new Date(cached.data.fetchedAt)))cached={data:shared,time:+new Date(shared.fetchedAt)};}catch{/* Shared storage unavailable: retain local last-good record. */}
  if(cached&&now()-cached.time<ttl)return {data:cached.data,live:true};
  if(cached&&now()<retryAt)return {data:cached.data,live:false,refreshError:lastError};
  try {
   const data=await collect({priorData:cached?.data});cached={data,time:now()};retryAt=0;lastError='';
   try{await write(data);}catch{/* A storage outage must not discard a successful GitHub refresh. */}
   return {data,live:true};
  }catch(error){lastError=publicRefreshError(error);retryAt=now()+5*60*1000;if(cached)return {data:cached.data,live:false,refreshError:lastError};throw error;}
 }
 return async(request)=>{
  if(request.method!=='GET')return Response.json({error:'Method not allowed'},{status:405,headers:{...securityHeaders,Allow:'GET','Cache-Control':'no-store'}});
  const url=new URL(request.url),detail=url.pathname==='/api/pr-description';
  const repo=url.searchParams.get('repo'),number=Number(url.searchParams.get('number')),version=url.searchParams.get('version');
  if(detail&&(!/^[\w.-]+\/[\w.-]+$/.test(repo??'')||!Number.isSafeInteger(number)||number<1||!/^[a-f0-9]{64}$/.test(version??'')))return Response.json({error:'Invalid description request.'},{status:400,headers:{...securityHeaders,'Cache-Control':'no-store'}});
  if(detail){
   // A description must match its requested version, but does not need a new GitHub collection.
   const find=data=>[...(data?.prs??[]),...(data?.forks??[]).flatMap(f=>f.prs)].find(pr=>pr.repo===repo&&pr.number===number);
   let pr=find(cached?.data);
   if(pr&&descriptionVersion(pr)===version)return descriptionResponse(pr,version,request);
   try{const shared=await read();if(shared){pr=find(shared);if(!cached||Date.parse(shared.fetchedAt)>Date.parse(cached.data.fetchedAt))cached={data:shared,time:Date.parse(shared.fetchedAt)};}}catch{/* An existing matching snapshot remains usable without shared storage. */}
   return descriptionResponse(pr,version,request);
  }
  try {pending??=run().finally(()=>{pending=null;});const {data,live,refreshError}=await pending;
   // Existing open tabs still use the old API version; explicit JSON exports request the full record.
   if(url.searchParams.get('v')==='maintainer-1'||url.searchParams.get('format')==='full')return Response.json({...data,live,...(refreshError?{refreshError}:{})},{headers:{...securityHeaders,...(live?{'Cache-Control':'public, max-age=60','Netlify-CDN-Cache-Control':'public, durable, s-maxage=900, stale-while-revalidate=300'}:{'Cache-Control':'no-store'})}});
   if(compactSource!==data){compactCache=compactResearch(data);compactSource=data;}
   const compact=compactCache,etag=`W/"${compact.revision}"`;
   const headers={...securityHeaders,ETag:etag,'X-Research-Fetched-At':data.fetchedAt,'X-Research-Live':String(live),...(refreshError?{'X-Research-Refresh-Error':refreshError}:{}),...(live?{'Cache-Control':'public, max-age=60','Netlify-CDN-Cache-Control':'public, durable, s-maxage=900, stale-while-revalidate=300'}:{'Cache-Control':'no-store'})};
   if(matchesETag(request.headers.get('If-None-Match'),etag))return new Response(null,{status:304,headers:{...headers,'Netlify-CDN-Cache-Control':'no-store'}});
   return Response.json({...compact,live,...(refreshError?{refreshError}:{})},{headers});
  }catch(error){return Response.json({error:publicRefreshError(error)},{status:503,headers:{...securityHeaders,'Cache-Control':'no-store'}});}
 };
}
