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
export function createResearchService({collect,snapshot,read=async()=>null,write=async()=>{},now=Date.now,ttl=15*60*1000}={}) {
 let cached=snapshot?{data:snapshot,time:0}:null,pending=null,retryAt=0,lastError='';
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
  try {pending??=run().finally(()=>{pending=null;});const {data,live,refreshError}=await pending;
   return Response.json({...data,live,...(refreshError?{refreshError}:{})},{headers:{...securityHeaders,...(live?{'Cache-Control':'public, max-age=60','Netlify-CDN-Cache-Control':'public, durable, s-maxage=900, stale-while-revalidate=300'}:{'Cache-Control':'no-store'})}});
  }catch(error){return Response.json({error:publicRefreshError(error)},{status:503,headers:{...securityHeaders,'Cache-Control':'no-store'}});}
 };
}
