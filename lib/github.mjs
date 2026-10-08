import { REPOSITORY, FIELDS, normalizePR, extractBound, classify } from './research.mjs';
import { collectHistory } from './history.mjs';
const API='https://api.github.com';
export async function collectResearch({token=process.env.GITHUB_TOKEN,fetcher=fetch,priorData=null}={}) {
 const warnings=[];let remaining=null;
 async function get(path,optional=false) {
  const response=await fetcher(API+path,{headers:{Accept:'application/vnd.github+json','User-Agent':'beyond-n-log-n','X-GitHub-Api-Version':'2022-11-28',...(token?{Authorization:`Bearer ${token}`}:{})},signal:AbortSignal.timeout(12000)});
  remaining=response.headers.get('x-ratelimit-remaining');
  if(!response.ok){if(optional&&(response.status===404||response.status===409))return null;throw new Error(`GitHub returned ${response.status}${response.status===403||response.status===429?' (API limit; a server-side GITHUB_TOKEN increases capacity)':''} for ${path.split('?')[0]}`);}
  return {data:await response.json(),next:response.headers.get('link')?.match(/<https:\/\/api.github.com([^>]+)>; rel="next"/)?.[1]};
 }
 async function pages(path,optional=false) {let result=[];let next=path+(path.includes('?')?'&':'?')+'per_page=100';while(next){const res=await get(next,optional);if(!res)return result;result.push(...res.data);next=res.next;}return result;}
 async function mapLimit(items,fn,limit=4) {const output=new Array(items.length);let index=0;await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{while(index<items.length){const i=index++;output[i]=await fn(items[i]);}}));return output;}
 const [repo,rootPRs,initialForks,readme]=await Promise.all([get(`/repos/${REPOSITORY}`),pages(`/repos/${REPOSITORY}/pulls?state=all&sort=created&direction=asc`),pages(`/repos/${REPOSITORY}/forks?sort=newest`),get(`/repos/${REPOSITORY}/readme`)]);
 if(repo.data.private===true||repo.data.visibility==='private'||repo.data.visibility==='internal')throw new Error('The research repository is not public.');
 const isPublic=f=>f.private!==true&&f.visibility!=='private'&&f.visibility!=='internal';
 const readmeText=Buffer.from(readme.data.content,'base64').toString('utf8');
 const history=await collectHistory({get,pages,mapLimit,readmeText,priorData,warnings});
 const publicForks=initialForks.filter(isPublic);
 const forkMap=new Map(publicForks.map(f=>[f.full_name,f]));let queue=publicForks.filter(f=>f.forks_count>0);
 while(queue.length){const batch=await mapLimit(queue,async f=>{try{return await pages(`/repos/${f.full_name}/forks`);}catch(e){warnings.push(`Descendants of ${f.full_name}: ${e.message}`);return [];}});queue=[];for(const f of batch.flat())if(isPublic(f)&&!forkMap.has(f.full_name)){forkMap.set(f.full_name,f);if(f.forks_count>0)queue.push(f);}}
 const forkDetailTTL=(token?15:60)*60*1000;
 const forks=await mapLimit([...forkMap.values()],async f=>{
  const prior=priorData?.forks?.find(p=>p.name===f.full_name);
  if(prior&&Date.now()-new Date(prior.detailsFetchedAt||priorData.fetchedAt).getTime()<forkDetailTTL)return {...prior,pushedAt:f.pushed_at,stars:f.stargazers_count,forkCount:f.forks_count};
  const result={detailsFetchedAt:new Date().toISOString(),name:f.full_name,owner:f.owner.login,avatar:f.owner.avatar_url,url:f.html_url,createdAt:f.created_at,pushedAt:f.pushed_at,defaultBranch:f.default_branch,description:f.description,stars:f.stargazers_count,forkCount:f.forks_count,prs:[],readme:null,readmeUrl:null,fields:[],methods:[],bound:null};
  const tasks=await Promise.allSettled([pages(`/repos/${f.full_name}/pulls?state=all&sort=created&direction=asc`,true),get(`/repos/${f.full_name}/readme`,true)]);
  if(tasks[0].status==='fulfilled')result.prs=tasks[0].value.map(normalizePR);else warnings.push(`PRs in ${f.full_name}: ${tasks[0].reason.message}`);
  if(tasks[1].status==='fulfilled'&&tasks[1].value){const r=tasks[1].value.data;const text=Buffer.from(r.content,'base64').toString('utf8');result.readmeUrl=r.html_url;result.readme=text;result.readmeMatchesMain=text===readmeText;Object.assign(result,classify('',text));result.bound=extractBound('',text);}
  else if(tasks[1].status==='rejected')warnings.push(`README in ${f.full_name}: ${tasks[1].reason.message}`);
  return result;
 });
 return {schemaVersion:1,fetchedAt:new Date().toISOString(),repository:{name:REPOSITORY,url:repo.data.html_url,description:repo.data.description,defaultBranch:repo.data.default_branch,createdAt:repo.data.created_at,stars:repo.data.stargazers_count,forkCount:repo.data.forks_count,pushedAt:repo.data.pushed_at,readmeUrl:readme.data.html_url,readme:readmeText,bound:extractBound('',readmeText),...classify('',readmeText)},history,fields:FIELDS,prs:rootPRs.map(normalizePR),forks,warnings,coverage:{publicForks:forks.length,reportedForks:repo.data.forks_count,rootPRs:rootPRs.length,forkPRs:forks.reduce((n,f)=>n+f.prs.length,0),apiRemaining:remaining,forkDetailCadenceMinutes:token?15:60},methodology:'Original OpenAI and repository checkpoints use immutable source text at commit publication timestamps; the manuscript date is shown separately. PR bounds use current titles and descriptions at PR opening times. Drafts and lower-bound-only claims are marked. Method tags are phrase-based, include inherited methods, and are not expert classification. Field edges show co-mentions, not proof dependencies. PR references can denote comparisons as well as dependencies. No full-theorem verification is inferred from tests or certificates.'};
}
