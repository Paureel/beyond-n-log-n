import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {extractBound,parseExpression,classify} from '../lib/research.mjs';
import {vetting,counted,frontierOf} from '../lib/vetting.mjs';
const snapshot=JSON.parse(fs.readFileSync(new URL('../public/research.json',import.meta.url)));
test('the real PR corpus preserves final exponents rather than component savings or comparison values',()=>{
 const values={1:1.7523184e-18,2:17*2**-63,3:59/10**11,4:591/10**12,5:1479/10**12,7:373/10**11,9:19/5000000000,10:6149999/50000000000000,15:1076678/10**12,20:5834475279233921242758637328164947/(5*10**39),23:1099/10**8,31:7939287/500000000000,35:16631776/10**12,36:384569/10000000000,37:3850771033/10**14,38:242889/6250000000};
 for(const [number,value] of Object.entries(values)){const p=snapshot.prs.find(p=>p.number===+number);const bound=extractBound(p.title,p.body);assert.ok(bound,`PR ${number}`);assert.ok(Math.abs(bound.value/value-1)<1e-14,`PR ${number}: ${bound.value} vs ${value}`);}
 assert.equal(extractBound(snapshot.prs.find(p=>p.number===11).title,snapshot.prs.find(p=>p.number===11).body),null);
 assert.equal(extractBound(snapshot.prs.find(p=>p.number===26).title,snapshot.prs.find(p=>p.number===26).body),null);
});
test('Unicode and TeX rational claims are parsed without eval',()=>{
 assert.equal(parseExpression('17·2⁻⁶³').value,17*2**-63);
 assert.equal(parseExpression('373/10¹¹').value,3.73e-9);
 assert.ok(Math.abs(parseExpression('1.099 × 10⁻⁵').value/1.099e-5-1)<1e-14);
 assert.equal(parseExpression('\\frac{5834475279233921242758637328164947}{5\\cdot10^{39}}').value,5834475279233921242758637328164947/(5*10**39));
 assert.equal(parseExpression('process.env.GITHUB_TOKEN'),null);
 assert.equal(parseExpression('NaN'),null);
});
test('exact witnesses override threshold headlines; a lower-only claim stays explicitly lower',()=>{
 assert.equal(extractBound('Conditional κ > 2^-20','κ = 1.2e-6').kind,'exact');
 assert.equal(extractBound('Conditional κ > 2^-20','No equality given.').kind,'lower');
 assert.equal(extractBound('Refinement','The scoped ceiling kappa = 0.0001. The witness κ = 0.00001.').value,.00001);
});
test('checkpoints and merged PRs set the default frontier; open claims count on request and closed, unmerged PRs never count',()=>{
 const pr=(number,state,title,repo='CrocSwap/integer-mult-bounds')=>({repo,number,state,bound:extractBound(title,'')});
 const original={kind:'openai',bound:{value:2**-182}},checkpoint={kind:'checkpoint',bound:{value:4.6e-4}};
 const merged=pr(2,'merged','Conditional κ = 4.7e-4'),open=pr(3,'open','Conditional κ = 5.9e-4'),closed=pr(4,'closed','A construction, kappa = 0.127865'),forkMerged=pr(1,'merged','Conditional κ = 9e-4','alice/integer-mult-bounds');
 const entries=[original,checkpoint,merged,open,closed,forkMerged],points=entries.map(source=>({source,bound:source.bound}));
 assert.deepEqual(entries.map(vetting),['vetted','vetted','vetted','unreviewed','closed','unreviewed']);
 assert.deepEqual(frontierOf(points).map(p=>p.source),[original,checkpoint,merged]);
 assert.deepEqual(frontierOf(points,true).map(p=>p.source),[original,checkpoint,merged,open,forkMerged]);
 assert.equal(counted(open),false);assert.equal(counted(open,true),true);assert.equal(counted(closed,true),false);
});
test('a formal verification tag needs explicit formal tooling; a disclaimer is insufficient',()=>{
 assert.equal(classify('A circuit','No formal verification or independent review is claimed.').fields.includes('formal'),false);
 assert.equal(classify('Lean certificate check','Lean 4 and Mathlib prove exact certificate arithmetic.').fields.includes('formal'),true);
 const p=snapshot.prs.find(p=>p.number===38);const tags=classify(p.title,p.body);assert.ok(tags.methods[0].name==='Controlled bases'||tags.methods[0].name==='Copied centers');assert.ok(tags.methods.every(m=>m.evidence.length));
});
