import test from 'node:test';
import assert from 'node:assert/strict';
import {createResearchService} from '../lib/service.mjs';
import {collectResearch} from '../lib/github.mjs';
const request=()=>new Request('https://example.test/api/research');
test('overlapping refreshes share one collection; successful data uses durable caching',async()=>{
 let calls=0;const time=Date.parse('2026-10-08T12:00:00Z');const service=createResearchService({now:()=>time,collect:async()=>{calls++;await new Promise(r=>setTimeout(r,10));return {fetchedAt:new Date(time).toISOString(),prs:[]};}});
 const responses=await Promise.all([service(request()),service(request())]);assert.equal(calls,1);assert.equal((await responses[0].json()).live,true);assert.match(responses[1].headers.get('Netlify-CDN-Cache-Control'),/durable/);await service(request());assert.equal(calls,1);
});
test('GitHub failure preserves the last-good data, identifies staleness and backs off',async()=>{
 let calls=0;const service=createResearchService({now:()=>2000000,snapshot:{fetchedAt:'2026-10-07T00:00:00Z',prs:[{number:1}]},collect:async()=>{calls++;throw Error('GitHub returned 403 (API limit)');}});
 const response=await service(request());const data=await response.json();assert.equal(response.status,200);assert.equal(data.live,false);assert.equal(data.prs[0].number,1);assert.match(data.refreshError,/API limit/);assert.equal(response.headers.get('Cache-Control'),'no-store');await service(request());assert.equal(calls,1);
 assert.equal((await service(new Request('https://example.test/api/research',{method:'POST'}))).status,405);
});
test('a shared fresh record survives a cold start without a new GitHub fetch',async()=>{
 let calls=0;const time=Date.parse('2026-10-08T12:00:00Z');const service=createResearchService({now:()=>time,read:async()=>({fetchedAt:new Date(time-10000).toISOString(),prs:[{number:99}]}),collect:async()=>{calls++;throw Error('must not run');}});
 const data=await(await service(request())).json();assert.equal(data.prs[0].number,99);assert.equal(data.live,true);assert.equal(calls,0);
});
test('public refresh failures do not echo credentials or internal exception details',async()=>{
 const internal='Internal failure: credential=DO_NOT_DISCLOSE /private/server/config';
 for(const snapshot of [undefined,{fetchedAt:'2026-10-07T00:00:00Z',prs:[]}]){
  const service=createResearchService({snapshot,collect:async()=>{throw Error(internal);}});
  const response=await service(request());const body=await response.text();
  assert.equal(response.status,snapshot?200:503);assert.ok(!body.includes('DO_NOT_DISCLOSE'));assert.ok(!body.includes('/private/server'));
  assert.match(body,/temporarily unavailable/);assert.equal(response.headers.get('X-Content-Type-Options'),'nosniff');assert.equal(response.headers.get('Cache-Control'),'no-store');
 }
});
test('a private root repository cannot be published through an authenticated collection',async()=>{
 const fetcher=async input=>{const u=new URL(input);return Response.json(u.pathname==='/repos/CrocSwap/integer-mult-bounds'?{private:true}:[]);};
 await assert.rejects(collectResearch({fetcher,token:'test-credential'}),/not public/);
});
function pr(number,repo='CrocSwap/integer-mult-bounds') {return {number,title:`Conditional kappa = ${number}e-8`,body:'',html_url:`https://github.com/${repo}/pull/${number}`,user:{login:'tester',avatar_url:''},created_at:'2026-10-08T00:00:00Z',updated_at:'2026-10-08T00:00:00Z',closed_at:null,merged_at:null,state:'open',draft:false,base:{repo:{full_name:repo},sha:'base'},head:{repo:{full_name:'alice/integer-mult-bounds'},ref:'research',sha:'head'},labels:[]};}
const fork=(owner,n=0)=>({full_name:`${owner}/integer-mult-bounds`,owner:{login:owner,avatar_url:''},html_url:`https://github.com/${owner}/integer-mult-bounds`,created_at:'2026-10-08T00:00:00Z',pushed_at:'2026-10-08T01:00:00Z',default_branch:'main',forks_count:n,stargazers_count:0});
test('collection follows every page, every state, descendant forks and fork-local PRs',async()=>{
 const calls=[];const fetcher=async input=>{const u=new URL(input);calls.push(u.pathname+u.search);let data=[];let headers={};
 if(u.pathname==='/repos/CrocSwap/integer-mult-bounds')data={html_url:'https://github.com/CrocSwap/integer-mult-bounds',default_branch:'main',forks_count:2,pushed_at:'2026-10-08T00:00:00Z'};
 else if(u.pathname.endsWith('/readme'))data={content:Buffer.from('κ = 83/10^12').toString('base64'),html_url:'https://github.com/example/README.md'};
 else if(u.pathname==='/repos/CrocSwap/integer-mult-bounds/pulls'){if(u.searchParams.get('page')==='2')data=[pr(2)];else{data=[pr(1)];headers.link='<https://api.github.com/repos/CrocSwap/integer-mult-bounds/pulls?state=all&per_page=100&page=2>; rel="next"';}}
 else if(u.pathname==='/repos/CrocSwap/integer-mult-bounds/forks')data=[fork('alice',1),{...fork('private-root-fork',1),private:true}];
 else if(u.pathname==='/repos/alice/integer-mult-bounds/forks')data=[fork('bob'),{...fork('internal-descendant',1),visibility:'internal'}];
 else if(u.pathname==='/repos/bob/integer-mult-bounds/pulls')data=[pr(3,'bob/integer-mult-bounds')];
 return new Response(JSON.stringify(data),{status:200,headers});};
 const data=await collectResearch({fetcher,token:null});assert.equal(data.prs.length,2);assert.equal(data.forks.length,2);assert.equal(data.coverage.forkPRs,1);assert.ok(calls.some(p=>p.includes('state=all')));assert.equal(data.repository.bound.value,83e-12);
 assert.ok(calls.every(p=>!p.includes('private-root-fork')&&!p.includes('internal-descendant')));
 const second=await collectResearch({fetcher,token:null,priorData:data});assert.equal(second.coverage.forkPRs,1);assert.equal(second.forks[1].detailsFetchedAt,data.forks[1].detailsFetchedAt);
});
