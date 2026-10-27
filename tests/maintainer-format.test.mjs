import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeSelectedResult,collectMaintainer,reviewedPRResult,SELECTED_RESULT_PATH} from '../lib/maintainer.mjs';
import {createResearchService} from '../lib/service.mjs';

const fixture=name=>JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`,import.meta.url)));
const latest=fixture('selected-result-frontier799');
const earlier=fixture('selected-result-pr531');
const currentCommit={sha:'d6dfd8f21b1e0b7e3f93b7e30e64639390e48504',commit:{committer:{date:'2026-10-13T06:44:14Z'}}};
const earlierCommit={sha:'a1e7d84866e73aa6f3355629ea31b24b8076b113',commit:{committer:{date:'2026-10-12T01:55:19Z'}}};
const pr={repo:'CrocSwap/integer-mult-bounds',number:799,author:'jkot',headSha:latest.audited_source_head,bound:{kind:'exact',value:Number(latest.decimal)},methods:[],fields:[]};
const encoded=record=>record===undefined?null:{data:{content:Buffer.from(JSON.stringify(record)).toString('base64')}};
const harness=(records,commits=[currentCommit,earlierCommit])=>({
 defaultBranch:'main',prs:[pr],history:[],warnings:[],
 pages:async()=>commits,mapLimit:async(items,fn)=>Promise.all(items.map(fn)),
 get:async path=>path.includes(SELECTED_RESULT_PATH)?encoded(records[new URL('https://test'+path).searchParams.get('ref')]):null
});

test('real published and receipt-linked finite-construction records recover the missing selections',async()=>{
 const data=await collectMaintainer(harness({[currentCommit.sha]:latest,[earlierCommit.sha]:earlier}));
 assert.equal(data.current.bound.value,0.001661634653669567);
 assert.deepEqual(data.history.map(point=>point.bound.value),[0.001517760977820331,0.001661634653669567]);
 assert.deepEqual(data.current.review.sourcePRs,latest.source_prs);
 assert.equal(data.current.review.scope,latest.scope);
 assert.equal(data.current.review.previousBound.value,0.001661202643272239);
 assert.match(data.current.review.validationUrl,new RegExp(currentCommit.sha));
 assert.match(data.current.review.certificateUrl,/community-frontier799-audit\/ASSEMBLY\.json$/);
 assert.ok(!data.current.review.sources.some(source=>source.head),'a source list or audited_source_head does not grant blanket PR review badges');
 assert.equal(reviewedPRResult(pr,data),null);
});

test('finite-construction status changes retain artifact, attribution and exact-bound checks',()=>{
 for(const record of [earlier,latest]) {
  assert.ok(normalizeSelectedResult(record,currentCommit));
  for(const change of [{certificate:null},{proof:'https://example.test/proof'},{source_manifest:'../secret'},{source_prs:[]},{source_prs:[799,799]},{source_pr:799},{decimal:'0.127865'},{kappa:'0.00166 unsupported'},{scope:''},{review:null},{validation:null}]) {
   assert.equal(normalizeSelectedResult({...record,...change},currentCommit),null);
  }
 }
 for(const status of ['Pending review','Withdrawn','Prepared locally for publication: maintainer-reviewed conditional finite construction; frozen-family integration still in progress']) {
  assert.equal(normalizeSelectedResult({...latest,status},currentCommit),null,'incomplete work is not promoted by similar status wording');
 }
});

test('wording, whitespace, case and publication or CI notes do not require a new status allowlist',()=>{
 for(const status of [
  '  MAINTAINER–REVIEWED   conditional finite construction  ; published on main',
  'Maintainer reviewed conditional construction — exact source-bound replay complete',
  'Selected maintainer-reviewed conditional PR5413 completion, with companion audits and explicit inherited foundation reuse',
  'Selected conditional finite construction, reviewed by the maintainer; integration Linux CI pending',
  'Published on main: conditional composition reviewed by maintainer (publication receipt attached)',
  'Selected maintainer-reviewed conditional witness; publication is pending',
  'Maintainer_reviewed conditional construction; integration CI is in progress'
 ]) {
  const point=normalizeSelectedResult({...latest,status},currentCommit);
  assert.equal(point?.bound.value,Number(latest.decimal),status);
  assert.equal(point.review.formatVersion,3);
  assert.equal(reviewedPRResult(pr,{current:point}),null,'flexible selection wording cannot manufacture a reviewed PR head');
 }
 for(const status of [
  'Submitted maintainer-reviewed conditional construction',
  'Selected maintainer-reviewed conditional construction; review is pending',
  'Selected maintainer-reviewed conditional construction; awaiting maintainer review',
  'Selected conditional construction; not yet maintainer reviewed',
  'Maintainer-reviewed conditional construction; withdrawn after review',
  'Published conditional construction; reviewer unknown',
  'Selected unreviewed conditional construction',
  'Selected maintainer-reviewed conditional construction; rejected',
  'Selected maintainer-reviewed conditional construction; review incomplete',
  'Selected maintainer-reviewed conditional construction; review failed'
 ])assert.equal(normalizeSelectedResult({...latest,status},currentCommit),null,status);
});

test('explicit withdrawal wording clears the selection, while malformed latest records retain last-good data',async()=>{
 const prior=await collectMaintainer(harness({[earlierCommit.sha]:earlier},[earlierCommit]));
 for(const status of ['WITHDRAWN: the conditional construction was invalidated','Retracted after source replay failed','No current selection; review continues','Not selected: the prior witness was revoked']) {
  const data=await collectMaintainer({...harness({[currentCommit.sha]:{...latest,status},[earlierCommit.sha]:earlier}),priorData:{maintainer:prior}});
  assert.equal(data.current,null,status);
  assert.deepEqual(data.history,prior.history);
 }
});

test('cached projections from the sentence-based parser are re-read under the new parser',async()=>{
 const point=normalizeSelectedResult(earlier,earlierCommit);
 const legacy={...point,review:{...point.review,formatVersion:2}};
 const data=await collectMaintainer({...harness({[earlierCommit.sha]:earlier},[earlierCommit]),priorData:{maintainer:{current:legacy,history:[legacy]}}});
 assert.equal(data.current.review.formatVersion,3);
});

test('an unsupported or malformed latest selection fails refresh instead of clearing current kappa',async()=>{
 for(const record of [{...latest,status:'Future maintainer format'},{...latest,certificate:null},null]) {
  const args=harness({[currentCommit.sha]:record});
  await assert.rejects(collectMaintainer(args),{code:'MAINTAINER_FORMAT_UNSUPPORTED'});
 }
 const malformed=harness({});
 malformed.get=async()=>({data:{content:Buffer.from('{broken json').toString('base64')}});
 await assert.rejects(collectMaintainer(malformed),{code:'MAINTAINER_FORMAT_UNSUPPORTED'});
});

test('format drift preserves last-good kappa and returns an explicit stale response',async()=>{
 const selected=normalizeSelectedResult(earlier,earlierCommit);
 const snapshot={schemaVersion:1,fetchedAt:'2026-10-12T02:00:00Z',repository:{},prs:[],forks:[],maintainer:{current:selected,history:[selected]}};
 const service=createResearchService({snapshot,now:()=>Date.parse('2026-10-13T10:00:00Z'),collect:()=>collectMaintainer(harness({[currentCommit.sha]:{...latest,status:'Future format'}}))});
 const response=await service(new Request('https://test/api/research?v=compact-2'));
 const data=await response.json();
 assert.equal(data.maintainer.current.bound.value,0.001517760977820331);
 assert.equal(data.live,false);
 assert.equal(data.fetchedAt,snapshot.fetchedAt);
 assert.match(data.refreshError,/maintainer selection format changed/);
 assert.equal(response.headers.get('Cache-Control'),'no-store');
});
