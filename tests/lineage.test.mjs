import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {extractIdeaLinks,buildIdeaGraph,ancestors} from '../lib/lineage.mjs';
const root='CrocSwap/integer-mult-bounds';
const snapshot=JSON.parse(fs.readFileSync(new URL('../public/research.json',import.meta.url)));
test('reuse is supported by source language, rather than numerical comparisons or credit lists',()=>{
 const body='This composes the network from #3 with the method from PR #5.\n\nThe result is 5% above #7.\n\nCredit alice #9 and bob #11.\n\nWe do not use the construction in #12.';
 const links=extractIdeaLinks(body,root,20),get=n=>links.find(e=>e.number===n);
 assert.equal(get(3).kind,'reuse');assert.equal(get(5).kind,'reuse');assert.equal(get(7).kind,'comparison');assert.equal(get(9).kind,'citation');assert.equal(get(11).kind,'citation');assert.equal(get(12).kind,'comparison');
});
test('explicit reuse survives an additional comparison; fork references retain their actual repository identity',()=>{
 const links=extractIdeaLinks('The saving is above #2.\n\nThis builds on #2 and [PR #3](https://github.com/CrocSwap/integer-mult-bounds/pull/3).','alice/integer-mult-bounds',4);
 assert.equal(links.find(e=>e.repo==='alice/integer-mult-bounds'&&e.number===2).kind,'reuse');
 assert.ok(links.some(e=>e.repo===root&&e.number===3));
 assert.equal(extractIdeaLinks('This extends PR4.','alice/integer-mult-bounds',4).length,0);
});
test('the real multi-parent compositions link the correct GitHub authors and retain quoted evidence',()=>{
 const g=buildIdeaGraph(snapshot.prs),nodes=new Map(g.nodes.map(p=>[p.id,p]));
 const incoming=g.edges.filter(e=>e.target===root+'#43'&&e.kind==='reuse');
 assert.deepEqual(incoming.map(e=>nodes.get(e.source).number).sort((a,b)=>a-b),[32,34,35,36,37,41]);
 assert.equal(nodes.get(incoming.find(e=>e.source===root+'#41').source).author,'hipotures');
 assert.ok(incoming.every(e=>e.evidence.includes('Compose RaD')));
 assert.ok(g.edges.filter(e=>e.target===root+'#7'&&[root+'#1',root+'#6'].includes(e.source)).every(e=>e.kind!=='reuse'),'PR7 compares existing records while targeting main independently');
 assert.ok(g.edges.some(e=>e.target===root+'#7'&&e.source===root+'#5'&&e.kind==='reuse'),'PR7 explicitly retains PR5 resampling');
 assert.equal(g.edges.find(e=>e.source===root+'#42'&&e.target===root+'#43').kind,'citation');
 assert.deepEqual(g.edges.filter(e=>e.target===root+'#38'&&e.kind==='reuse').map(e=>nodes.get(e.source).number).sort((a,b)=>a-b),[35,36]);
});
test('ancestry is chronological and terminates even when current descriptions refer back to each other',()=>{
 const mk=(n,body,date)=>({id:root+'#'+n,repo:root,number:n,author:'user'+n,body,createdAt:date});
 const g=buildIdeaGraph([mk(1,'This builds on #3.','2026-10-07T00:00:00Z'),mk(2,'This builds on #1.','2026-10-07T01:00:00Z'),mk(3,'This builds on #2 and #99.','2026-10-07T02:00:00Z')]);
 assert.equal(g.missing.length,1);assert.equal(g.edges.find(e=>e.source===root+'#3').chronological,false);
 assert.deepEqual([...ancestors(root+'#3',g.edges)].sort(),[root+'#1',root+'#2',root+'#3']);
});
