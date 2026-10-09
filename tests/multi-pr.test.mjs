import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeSelectedResult,collectMaintainer,reviewedPRResult,selectionSources,selectionReference,upstreamTimeline,SELECTED_RESULT_PATH} from '../lib/maintainer.mjs';
import {compactResearch} from '../lib/payload.mjs';
import {createResearchService} from '../lib/service.mjs';
const root='CrocSwap/integer-mult-bounds';
const record=JSON.parse(readFileSync(new URL('./fixtures/selected-result-round8.json',import.meta.url)));
const validation=JSON.parse(readFileSync(new URL('./fixtures/validation-round8.json',import.meta.url)));
const publication={sha:'27d82ebe85596ddae65307c272e1c1cc350de904',commit:{committer:{date:'2026-10-09T12:57:35Z'}}};
const value=0.000661885549259598;
const prs=record.source_prs.map((number,i)=>({id:`${root}#${number}`,repo:root,number,author:['Dugongue','chafreaky','eumemic','chafreaky'][i],headSha:i===0?validation.source_pr186_head:'f'.repeat(40),bound:{value,kind:'exact'},methods:[{id:`method-${i}`,name:'Method',fields:[`field-${i}`],evidence:'source'}],fields:[`field-${i}`]}));
const options={prs,validation};
test('the real multi-PR ledger yields one published selection, preserves roles, and uses previous published main',()=>{
 const point=normalizeSelectedResult(record,publication,options);
 assert.equal(point.bound.value,value);assert.equal(point.author,'Combined result');assert.equal(selectionReference(point),'Combined result · 4 PRs');
 assert.deepEqual(point.review.sourcePRs,[186,181,168,175]);assert.deepEqual(point.review.parallelPRs,[182,185]);assert.deepEqual(point.review.verificationPRs,[101,64]);
 assert.deepEqual(selectionSources(point).map(p=>p.author),prs.map(p=>p.author));
 assert.deepEqual(selectionSources(point).map(p=>p.head),[validation.source_pr186_head,null,null,null]);
 assert.equal(point.review.sourcePR,null);assert.equal(point.review.head,null);
 assert.equal(point.review.previousBound.value,0.0004609169,'compare published main, not the unpublished integration candidate');
 assert.equal(point.createdAt,'2026-10-09T12:57:35Z');assert.match(point.review.validationUrl,new RegExp(publication.sha));assert.match(point.review.manifestUrl,new RegExp(publication.sha));
 assert.equal(point.review.proofSupplements.length,1);assert.match(point.review.proofSupplements[0].url,new RegExp(publication.sha));
 assert.deepEqual(point.fields,prs.flatMap(pr=>pr.fields));assert.equal(point.methods.length,4);
 assert.equal(upstreamTimeline([],{current:point,history:[point]}).length,1,'source PRs must not become four frontier steps');
});
test('explicit composition and construction selections are recognized only through the main-branch ledger',()=>{
 for(const status of ['Selected maintainer-reviewed conditional composition; publication is a separate step','Selected maintainer-reviewed conditional construction; main publication is a separate step'])assert.equal(normalizeSelectedResult({...record,status},publication,options).bound.value,value);
 assert.equal(normalizeSelectedResult({...record,status:'Submitted maintainer-reviewed conditional construction'},publication,options),null);
});
test('source and parallel lists cannot grant blanket review badges; a matching exact source head and kappa can',()=>{
 const point=normalizeSelectedResult(record,publication,options),maintainer={current:point,history:[point]};
 assert.equal(reviewedPRResult(prs[0],maintainer),point);
 for(const pr of [...prs.slice(1),{...prs[0],number:182},{...prs[0],number:185},{...prs[0],headSha:'a'.repeat(40)},{...prs[0],repo:'Dugongue/integer-mult-bounds'},{...prs[0],bound:{value:value*2,kind:'exact'}},{...prs[0],bound:{value,kind:'lower'}}])assert.equal(reviewedPRResult(pr,maintainer),null);
 assert.equal(reviewedPRResult(prs[0],{current:null,history:[point]}),null);
 for(const receipt of [null,{...validation,status:'Pending review'},{...validation,kappa:'1/1000'},{...validation,source_pr186_head:'main'},{status:'PASS',kappa:record.kappa,ci:{tested_head:validation.source_pr186_head}}]){
  const point=normalizeSelectedResult(record,publication,{prs,validation:receipt});assert.ok(point,'the explicit published selection remains authoritative');assert.equal(reviewedPRResult(prs[0],{current:point}),null,'test/integration heads cannot masquerade as a reviewed PR head');
 }
});
test('ambiguous, unsupported or incomplete ledger records do not promote claimed kappa',()=>{
 for(const change of [{status:'Pending publication'},{source_prs:[]},{source_prs:[186,186]},{source_prs:[186,'181']},{source_prs:[-1]},{source_pr:186},{source_manifest:'../secret'},{proof:'https://example.test/proof'},{certificate:null},{parallel_reviewed_prs:'185'},{verification_contributions:[0]},{decimal:'0.127865'},{kappa:'0.00066 unsupported'}])assert.equal(normalizeSelectedResult({...record,...change},publication,options),null);
});
const encoded=value=>value===null?null:{data:{content:Buffer.from(JSON.stringify(value)).toString('base64')}};
function harness(commits,records,receipts=validation){const calls=[];return {commits,defaultBranch:'main',prs,history:[],warnings:[],calls,pages:async()=>commits,mapLimit:async(items,fn)=>Promise.all(items.map(fn)),get:async path=>{calls.push(path);if(path.includes(SELECTED_RESULT_PATH)){const sha=new URL('https://test'+path).searchParams.get('ref');return encoded(records[sha]);}if(receipts instanceof Error)throw receipts;return encoded(receipts);}};}
test('collector pins validation to the publication, caches normalized receipts, and migrates the old cached schema',async()=>{
 const args=harness([publication],{[publication.sha]:record});const data=await collectMaintainer(args);
 assert.equal(data.current.bound.value,value);assert.ok(args.calls.every(path=>path.endsWith(`ref=${publication.sha}`)));assert.equal(args.calls.length,2);
 args.calls.length=0;await collectMaintainer({...args,priorData:{maintainer:data}});assert.equal(args.calls.length,0);
 const legacy={...data.current,review:{...data.current.review,formatVersion:undefined}};args.calls.length=0;await collectMaintainer({...args,priorData:{maintainer:{current:legacy,history:[legacy]}}});assert.equal(args.calls.length,2,'old parser projections are re-normalized from immutable sources');
});
test('multi-PR reductions and withdrawals still replace the current selection; validation failures retain last-good data',async()=>{
 const prior=await collectMaintainer(harness([publication],{[publication.sha]:record}));
 const later={sha:'a'.repeat(40),commit:{committer:{date:'2026-10-09T14:00:00Z'}},parents:[{sha:publication.sha}]};
 for(const replacement of [null,{...record,status:'Withdrawn'}]){
  const data=await collectMaintainer({...harness([later,publication],{[later.sha]:replacement}),priorData:{maintainer:prior}});assert.equal(data.current,null);assert.deepEqual(data.history,prior.history);
 }
 const reduction={...record,kappa:'1/10000',decimal:'0.0001'};
 const corrected=await collectMaintainer({...harness([later,publication],{[later.sha]:reduction}),priorData:{maintainer:prior}});assert.equal(corrected.current.bound.value,0.0001);assert.equal(corrected.history.length,2);assert.equal(reviewedPRResult(prs[0],corrected),null);
 const collect=()=>collectMaintainer(harness([publication],{[publication.sha]:record},Error('GitHub returned 503')));
 await assert.rejects(collect(),/503/);
 const snapshot={schemaVersion:1,fetchedAt:'2026-10-09T13:00:00Z',repository:{},prs,forks:[],maintainer:prior};
 const service=createResearchService({snapshot,collect});const response=await service(new Request('https://test/api/research'));const result=await response.json();assert.equal(result.live,false);assert.equal(result.maintainer.current.bound.value,value);
});
test('compact payloads and conditional refreshes carry the combined selection and all contributor roles',async()=>{
 const maintainer=await collectMaintainer(harness([publication],{[publication.sha]:record}));const full={schemaVersion:1,fetchedAt:'2026-10-09T13:00:00Z',repository:{},prs,forks:[],maintainer};const compact=compactResearch(full);
 assert.deepEqual(compact.maintainer,full.maintainer);assert.equal(compact.prs.length,4);
 const service=createResearchService({collect:async()=>full});const response=await service(new Request('https://test/api/research?v=compact-2'));const json=await response.json();assert.equal(json.maintainer.current.bound.value,value);assert.deepEqual(json.maintainer.current.review.sourcePRs,record.source_prs);
 const same=await service(new Request('https://test/api/research?v=compact-2',{headers:{'If-None-Match':response.headers.get('ETag')}}));assert.equal(same.status,304);assert.equal(await same.text(),'');
});
