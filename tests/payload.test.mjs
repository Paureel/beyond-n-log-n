import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compactResearch} from '../lib/payload.mjs';
import {buildIdeaGraph} from '../lib/lineage.mjs';
import {upstreamTimeline,reviewedPRResult} from '../lib/maintainer.mjs';
const full=JSON.parse(readFileSync(new URL('../data/research.json',import.meta.url)));
test('compact real-corpus data preserves every lineage edge, source excerpt, field and maintainer selection',()=>{
 const compact=compactResearch(full),all=d=>[...d.prs,...d.forks.flatMap(f=>f.prs)];
 const before=buildIdeaGraph(all(full)),after=buildIdeaGraph(all(compact));
 assert.deepEqual(after.edges,before.edges);assert.deepEqual(after.missing,before.missing);
 assert.deepEqual(upstreamTimeline(compact.history,compact.maintainer),upstreamTimeline(full.history,full.maintainer));
 assert.deepEqual(compact.fields,full.fields);
 for(const [i,pr] of all(compact).entries()){
  assert.ok(!('body' in pr));assert.deepEqual(pr.bound,all(full)[i].bound);assert.deepEqual(pr.methods,all(full)[i].methods);assert.deepEqual(pr.fields,all(full)[i].fields);
  assert.deepEqual(reviewedPRResult(pr,compact.maintainer),reviewedPRResult(all(full)[i],full.maintainer));
 }
 assert.ok(!('readme' in compact.repository));assert.ok(compact.forks.every(f=>!('readme' in f)&&!('detailsFetchedAt' in f)));
 assert.equal(compactResearch(full).revision,JSON.parse(readFileSync(new URL('../public/research.json',import.meta.url))).revision);
 assert.ok(full.prs.every(pr=>'body' in pr),'projection must retain the internal full record');
});
test('a fresh collection without research changes retains its revision; edits and withdrawals change it',()=>{
 const original=compactResearch(full).revision;
 const metadata=structuredClone(full);metadata.fetchedAt='2026-10-10T00:00:00Z';metadata.coverage.apiRemaining='4000';metadata.forks.forEach(f=>f.detailsFetchedAt=metadata.fetchedAt);
 assert.equal(compactResearch(metadata).revision,original);
 for(const edit of [d=>d.prs[0].body+='\nA correction.',d=>d.prs[0].headSha='changed',d=>d.prs[0].state='closed',d=>d.maintainer.current=null,d=>d.maintainer.current.bound.value/=2]){
  const next=structuredClone(full);edit(next);assert.notEqual(compactResearch(next).revision,original);
 }
});
