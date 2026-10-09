import test from 'node:test';
import assert from 'node:assert/strict';
import {collectMaintainer,normalizeSelectedResult,upstreamTimeline,reviewedPRResult,SELECTED_RESULT_PATH} from '../lib/maintainer.mjs';
import {collectResearch} from '../lib/github.mjs';
import {firstParentCommits,publicationCommits} from '../lib/commit-history.mjs';

const ROOT='CrocSwap/integer-mult-bounds';
const head='c8b22bc5c10dba497ac25804e27d9647d818e2ff';
const commit=(letter,date)=>({sha:letter.repeat(40),commit:{committer:{date}}});
const first=commit('a','2026-10-09T04:53:33Z'),later=commit('b','2026-10-09T08:00:00Z');
const record={status:'Selected maintainer-reviewed conditional witness',kappa:'4609169/10000000000',decimal:'0.0004609169',source_pr:144,reviewed_head:head,scope:'Conditional on retained analytic and fixed-tape interfaces; not a formal proof of multiplication',review:'docs/research/community-round6-review.md',validation:'docs/research/community-round6-validation.json',previous_kappa:'25508460085039/500000000000000000'};
const pr={repo:ROOT,number:144,author:'icekylinx',headSha:head,bound:{kind:'exact',value:0.0004609169},methods:[],fields:[]};
const encoded=value=>({data:{content:Buffer.from(JSON.stringify(value)).toString('base64')}});

function harness(commits,records) {
 const calls=[];
 return {get:async path=>{calls.push(path);const sha=new URL('https://api.github.com'+path).searchParams.get('ref');const value=records[sha];if(value instanceof Error)throw value;return value==null?null:encoded(value);},
  pages:async path=>{calls.push(path);return commits;},mapLimit:async(items,fn)=>Promise.all(items.map(fn)),
  defaultBranch:'main',prs:[pr],history:[],warnings:[],calls};
}

test('the maintainer selection is pinned to upstream history and carries its reviewed head and scope',async()=>{
 const args=harness([first],{[first.sha]:record});
 const data=await collectMaintainer(args);
 assert.equal(data.current.bound.value,0.0004609169);
 assert.equal(data.current.review.sourcePR,144);
 assert.equal(data.current.review.head,head);
 assert.equal(data.current.review.scope,record.scope);
 assert.equal(data.current.author,'icekylinx');
 assert.match(data.current.url,new RegExp(`${ROOT}/blob/${first.sha}/${SELECTED_RESULT_PATH}`));
 assert.ok(args.calls[0].endsWith('&sha=main'));
 assert.ok(args.calls.every(p=>p.startsWith(`/repos/${ROOT}/`)));
 args.calls.length=0;
 await collectMaintainer({...args,priorData:{maintainer:data}});
 assert.equal(args.calls.length,1,'immutable ledger snapshots are reused');
});

test('a corrected lower selection replaces a larger one; selection is not a historical maximum',async()=>{
 const args=harness([later,first],{[first.sha]:record,[later.sha]:{...record,kappa:'1/10000',decimal:'0.0001',source_pr:160}});
 const data=await collectMaintainer(args);
 assert.equal(data.current.bound.value,0.0001);
 assert.equal(data.current.review.sourcePR,160);
 assert.deepEqual(data.history.map(p=>p.bound.value),[0.0004609169,0.0001]);
});

test('withdrawal, deletion or absence clears the current selection while preserving historical receipts',async()=>{
 const prior=await collectMaintainer(harness([first],{[first.sha]:record}));
 for(const replacement of [null,{...record,status:'Withdrawn'}]){
  const data=await collectMaintainer({...harness([later,first],{[later.sha]:replacement}),priorData:{maintainer:prior}});
  assert.equal(data.current,null);
  assert.deepEqual(data.history,prior.history);
 }
 const missing=await collectMaintainer({...harness([],{}),priorData:{maintainer:prior}});
 assert.deepEqual(missing,{current:null,history:[]});
});

test('a ledger request failure reaches the last-good service instead of silently declaring a fresh selection',async()=>{
 await assert.rejects(collectMaintainer(harness([first],{[first.sha]:Error('GitHub returned 503')})),/503/);
});

test('only the exact reviewed PR head and matching bound receive a reviewed tag',()=>{
 const result=normalizeSelectedResult(record,first,{prs:[pr]});
 const maintainer={current:result,history:[result]};
 assert.equal(reviewedPRResult(pr,maintainer),result);
 assert.equal(reviewedPRResult(pr,{current:null,history:[result]}),null,'withdrawn selections do not retain an active reviewed tag');
 for(const change of [{headSha:'d'.repeat(40)},{number:159},{repo:'icekylinx/integer-mult-bounds'},{bound:{kind:'exact',value:0.127865}},{bound:{kind:'lower',value:pr.bound.value}}]){
  assert.equal(reviewedPRResult({...pr,...change},maintainer),null);
 }
 for(const change of [{status:'Pending review'},{decimal:'0.127865'},{reviewed_head:'main'},{review:'https://example.test/review'},{kappa:'0.0004609169 unsupported'}])assert.equal(normalizeSelectedResult({...record,...change},first),null);
});

test('upstream selections preserve the original history, switch to the ledger, and never include PR claims',()=>{
 const original={id:'openai',kind:'openai',createdAt:'2026-10-06T21:58:50Z',bound:{value:2**-182}};
 const early={id:'early',kind:'checkpoint',createdAt:'2026-10-07T02:22:26Z',bound:{value:5.8e-33}};
 const sameCommit={id:'duplicate',kind:'checkpoint',createdAt:first.commit.committer.date,bound:{value:0.0004609169}};
 const result=normalizeSelectedResult(record,first,{prs:[pr]});
 assert.deepEqual(upstreamTimeline([original,early,sameCommit],{current:result,history:[result]}),[original,early,result]);
 assert.deepEqual(upstreamTimeline([original,early],null),[original,early]);
});

test('main checkpoints exclude merged branch history, and receipts use the actual main publication date',async()=>{
 const root=commit('0','2026-10-07T02:22:26Z');
 const branch={...first,parents:[{sha:root.sha}]};
 const branchUpdate={...later,parents:[{sha:branch.sha}]};
 const merge={...commit('c','2026-10-09T09:00:00Z'),parents:[{sha:root.sha},{sha:branchUpdate.sha}]};
 const graph=[merge,branchUpdate,branch,root];
 assert.deepEqual(firstParentCommits(graph).map(c=>c.sha),[merge.sha,root.sha]);
 assert.deepEqual(publicationCommits([branchUpdate,branch],graph),[merge]);
 const args={...harness([branchUpdate,branch],{[merge.sha]:{...record,kappa:'1/10000',decimal:'0.0001'}}),commits:graph};
 const data=await collectMaintainer(args);
 assert.equal(data.history.length,1,'multiple branch receipts become one actual published selection');
 assert.equal(data.current.commit,merge.sha);
 assert.equal(data.current.createdAt,merge.commit.committer.date);
 assert.equal(data.current.bound.value,0.0001);
 assert.ok(args.calls.at(-1).endsWith(`ref=${merge.sha}`),'read the actual file after integration');
});

test('selection order follows main ancestry even when commit clocks are out of order',()=>{
 const root={...first,parents:[]};
 const correction={...later,commit:{committer:{date:'2026-10-08T00:00:00Z'}},parents:[{sha:root.sha}]};
 assert.deepEqual(publicationCommits([correction,root],[correction,root]),[correction,root]);
 assert.throws(()=>publicationCommits([first],[later]),/publication could not be resolved/);
});

test('collector keeps the huge decoy claim browsable without making it the maintainer selection',async()=>{
 const apiPR=number=>({number,title:`kappa = ${number===159?'0.127865':'0.0004609169'}`,body:'',html_url:`https://github.com/${ROOT}/pull/${number}`,user:{login:number===159?'CarrotCultivator':'icekylinx',avatar_url:''},created_at:'2026-10-09T00:00:00Z',updated_at:'2026-10-09T00:00:00Z',closed_at:null,merged_at:null,state:number===159?'closed':'open',draft:false,base:{repo:{full_name:ROOT},sha:'base'},head:{repo:{full_name:`contributor/integer-mult-bounds`},ref:'research',sha:number===159?'d'.repeat(40):head},labels:[]});
 const fetcher=async input=>{
  const url=new URL(input);let value=[];
  if(url.pathname===`/repos/${ROOT}`)value={default_branch:'main',html_url:`https://github.com/${ROOT}`,forks_count:0};
  else if(url.pathname.endsWith('/pulls'))value=[apiPR(144),apiPR(159)];
  else if(url.pathname.endsWith('/readme'))value={content:Buffer.from('κ = 0.0004609169').toString('base64')};
  else if(url.pathname.endsWith('/commits'))value=url.searchParams.get('path')==='README.md'?[]:[first];
  else if(url.pathname.endsWith(SELECTED_RESULT_PATH))value=encoded(record).data;
  return Response.json(value);
 };
 const data=await collectResearch({fetcher,token:null});
 assert.equal(data.prs.find(p=>p.number===159).bound.value,0.127865);
 assert.equal(data.maintainer.current.review.sourcePR,144);
 assert.equal(data.maintainer.current.bound.value,0.0004609169);
 assert.equal(upstreamTimeline(data.history,data.maintainer).at(-1).review.sourcePR,144);
});
