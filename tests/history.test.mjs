import test from 'node:test';
import assert from 'node:assert/strict';
import {collectHistory} from '../lib/history.mjs';

test('history retains the original OpenAI bound and first repository commit with immutable publication dates',async()=>{
 const pin='a'.repeat(40), first='b'.repeat(40), next='c'.repeat(40), calls=[];
 let commits=[{sha:first,commit:{committer:{date:'2026-10-07T02:22:26Z'},author:{name:'Repository author'},message:'First published bound'}}];
 const get=async path=>{
  calls.push(path);
  if(path.startsWith('/repos/openai/math/commits/'))return {data:{html_url:'https://github.com/openai/math/commit/'+pin,commit:{committer:{date:'2026-10-06T21:58:50Z'}}}};
  const pathname=new URL('https://api.github.com'+path).pathname;
  const text=pathname.endsWith('/00-introduction.tex')?'\\kappa=2^{-182}':pathname.endsWith('/README.md')?'**Author:** OpenAI\n**Date:** September 23, 2026':path.endsWith(next)?'κ = 2^-78':'κ = 29/(5*10^33)';
  return {data:{content:Buffer.from(text).toString('base64')}};
 };
 const args={get,pages:async()=>commits,mapLimit:async(items,fn)=>Promise.all(items.map(fn)),readmeText:`[Original](https://github.com/openai/math/tree/${pin}/preprints/Integer-multiplication-below-n-log-n-September-23-2026)`,warnings:[]};
 const history=await collectHistory(args);
 assert.equal(history.length,2);
 assert.equal(history[0].author,'OpenAI');
 assert.equal(history[0].bound.value,2**-182);
 assert.equal(history[0].createdAt,'2026-10-06T21:58:50Z');
 assert.equal(history[0].manuscriptDate,'September 23, 2026');
 assert.equal(history[1].createdAt,'2026-10-07T02:22:26Z');
 assert.equal(history[1].bound.value,5.8e-33);
 assert.match(history[1].url,new RegExp(first));
 calls.length=0;
 commits.unshift({sha:next,parents:[{sha:first}],commit:{committer:{date:'2026-10-07T13:48:36Z'},author:{name:'Repository author'},message:'Routing improvement'}});
 const updated=await collectHistory({...args,priorData:{history}});
 assert.equal(updated.length,3);
 assert.equal(updated[2].bound.value,2**-78);
 assert.deepEqual(calls,[`/repos/CrocSwap/integer-mult-bounds/readme?ref=${next}`]);
 assert.equal(args.warnings.length,0);
});

test('a history fetch failure preserves previously collected checkpoints and reports missing coverage',async()=>{
 const history=[{id:'checkpoint',kind:'checkpoint',createdAt:'2026-10-07T02:22:26Z'}],warnings=[];
 const result=await collectHistory({get:async()=>{throw Error('unavailable');},pages:async()=>{throw Error('API limit');},mapLimit:async()=>[],readmeText:'',priorData:{history},warnings});
 assert.deepEqual(result,history);
 assert.match(warnings[0],/Repository history: API limit/);
});
