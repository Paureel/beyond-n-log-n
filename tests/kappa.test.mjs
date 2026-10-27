import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {collectKappa,createKappaService,kappaPayload,parseSelectionFeed} from '../lib/kappa.mjs';
import {mergeKappa,validKappa} from '../lib/kappa-state.mjs';
import {createKappaClient,createResearchClient} from '../lib/data-client.mjs';
const record=JSON.parse(readFileSync(new URL('./fixtures/selected-result-frontier5599.json',import.meta.url)));
const ROOT='CrocSwap/integer-mult-bounds';
const sha='df0137efd35e11b4445734bf612bdd4c7ebc330c',oldSha='a'.repeat(40);
const date='2026-10-26T01:38:04Z',time=Date.parse('2026-10-27T08:00:00Z');
const feed=(heads=[sha])=>`<feed><id>tag:github.com,2008:/${ROOT}/commits/main/certificates/selected-result.json</id>${heads.map(head=>`<entry><id>tag:github.com,2008:Grit::Commit/${head}</id><link href="https://github.com/${ROOT}/commit/${head}"/><updated>${date}</updated></entry>`).join('')}</feed>`;
function harness({head=record,pinned=head,xml=feed(),fail}={}) {
 const calls=[];
 return {calls,now:()=>time,fetcher:async url=>{
  calls.push(url);
  assert.ok(!url.includes('api.github.com'),'the independent collector must not use the exhausted REST API');
  if(fail)throw Error(fail);
  if(url.endsWith('.atom'))return new Response(xml);
  const value=url.includes('/main/')?head:pinned;
  return value===undefined?new Response(null,{status:404}):Response.json(value);
 }};
}
const snapshot=async()=>collectKappa(harness());

test('current kappa refresh requires only a public feed and two small raw records, even when REST is rate limited',async()=>{
 const options=harness({xml:feed([sha,oldSha])}),data=await collectKappa(options);
 assert.equal(data.maintainer.current.bound.value,0.00310045);
 assert.equal(data.maintainer.current.commit,sha);
 assert.equal(data.maintainer.current.createdAt,date);
 assert.equal(data.maintainer.current.review.dateSource,'record-commit');
 assert.equal(options.calls.length,3,'optional history does not delay a live response');
 assert.ok(!data.maintainer.current.review.sources.some(source=>source.head));
 assert.ok(validKappa(kappaPayload(data)));
 options.calls.length=0;
 await collectKappa({...options,priorData:data});
 assert.equal(options.calls.length,2,'an unchanged selection reuses its pinned normalization');
});

test('a changed lower selection replaces the current value and explicit withdrawals clear it without erasing history',async()=>{
 const prior=await snapshot(),latest='b'.repeat(40);
 const lower={...record,kappa:'1/1000',decimal:'0.001'};
 const data=await collectKappa({...harness({head:lower,xml:feed([latest,sha])}),priorData:prior});
 assert.equal(data.maintainer.current.bound.value,0.001);
 assert.equal(data.maintainer.history.length,2);
 const withdrawn=await collectKappa({...harness({head:{status:'Withdrawn: replay failed'},xml:feed([latest,sha])}),priorData:prior});
 assert.equal(withdrawn.maintainer.current,null);
 assert.equal(withdrawn.maintainer.history.length,1);
});

test('deletion is accepted only when both the branch and pinned record are absent',async()=>{
 const prior=await snapshot();
 const missing=harness();missing.fetcher=async url=>url.endsWith('.atom')?new Response(feed()):new Response(null,{status:404});
 const data=await collectKappa({...missing,priorData:prior});assert.equal(data.maintainer.current,null);assert.equal(data.maintainer.history.length,1);
 const mismatch=harness();mismatch.fetcher=async url=>url.endsWith('.atom')?new Response(feed()):url.includes('/main/')?new Response(null,{status:404}):Response.json(record);
 await assert.rejects(collectKappa(mismatch),/inconsistent/);
});

test('malformed, unsupported or mismatched records never promote a PR claim or replace the last successful selection',async()=>{
 for(const head of [null,[],{...record,status:'Pending review'},{...record,decimal:'0.127865'},{...record,review:'https://evil.test/review'}])await assert.rejects(collectKappa(harness({head})),{code:'MAINTAINER_FORMAT_UNSUPPORTED'});
 await assert.rejects(collectKappa(harness({pinned:{...record,kappa:'1/1000'}})),/inconsistent/);
 for(const xml of ['<feed/>',feed().replace(ROOT,'someone/else'),feed().replace(date,'not-a-date'),'<!DOCTYPE feed>'+feed(),feed([sha,sha])])assert.throws(()=>parseSelectionFeed(xml));
});

test('independent cache deduplicates requests, returns small conditional responses and preserves stale data on outage',async()=>{
 const data=await snapshot();let calls=0,clock=time,fail=false;
 const service=createKappaService({now:()=>clock,collect:async()=>{calls++;if(fail)throw Error('credential=DO_NOT_DISCLOSE');return {...data,fetchedAt:new Date(clock).toISOString()};}});
 const [first,concurrent]=await Promise.all([service(new Request('https://test/api/kappa')),service(new Request('https://test/api/kappa'))]);
 assert.equal(calls,1);assert.equal(concurrent.status,200);
 const body=await first.json();assert.equal(body.maintainer.current.bound.value,0.00310045);assert.ok(!('recordDigest' in body));assert.ok(!('prs' in body));
 clock+=16*60*1000;
 const request=new Request('https://test/api/kappa',{headers:{'If-None-Match':first.headers.get('ETag')}});
 const same=await service(request);assert.equal(same.status,304);assert.equal(await same.text(),'');assert.equal(same.headers.get('X-Kappa-Fetched-At'),new Date(clock).toISOString());
 fail=true;clock+=16*60*1000;
 const stale=await service(new Request('https://test/api/kappa')),staleBody=await stale.json();
 assert.equal(staleBody.live,false);assert.equal(staleBody.maintainer.current.bound.value,0.00310045);assert.match(staleBody.refreshError,/last successful/);assert.ok(!JSON.stringify(staleBody).includes('DO_NOT_DISCLOSE'));assert.equal(stale.headers.get('Cache-Control'),'no-store');
 await service(new Request('https://test/api/kappa'));assert.equal(calls,3,'outages back off independently');
 assert.equal((await service(new Request('https://test/api/kappa',{method:'POST'}))).status,405);
});

test('a cold start reuses the shared kappa cache without invoking a research scan',async()=>{
 const data=await snapshot();
 const service=createKappaService({now:()=>time,read:async()=>data,collect:async()=>{throw Error('must not collect');}});
 const response=await service(new Request('https://test/api/kappa'));
 assert.equal((await response.json()).live,true);
});

test('CDN caching uses the source cache remaining lifetime rather than restarting another 15 minutes',async()=>{
 const data=await snapshot();
 const service=createKappaService({now:()=>time+14*60*1000,read:async()=>data,collect:async()=>{throw Error('must not collect');}});
 const response=await service(new Request('https://test/api/kappa'));
 assert.match(response.headers.get('Netlify-CDN-Cache-Control'),/s-maxage=60,/);
});

test('the kappa client completes while a full research refresh is still pending and uses separate persistent storage',async()=>{
 const kappa=kappaPayload(await snapshot()),research={schemaVersion:1,payloadVersion:1,revision:'a'.repeat(64),fetchedAt:'2026-10-13T00:00:00Z',prs:[],forks:[],maintainer:{current:null,history:[]}};
 const saved=new Map(),storage=()=>({getItem:key=>saved.get(key),setItem:(key,value)=>saved.set(key,value)});
 let release,latest;
 const full=createResearchClient({storage,fetcher:async url=>url==='/research.json'?Response.json(research):new Promise(resolve=>{release=resolve;})});
 const independent=createKappaClient({storage,fetcher:async(url,options)=>{assert.ok(['/kappa.json','/api/kappa?v=1'].includes(url));if(url.startsWith('/api/'))assert.equal(options.cache,'no-store','the browser must not generate its own conditional request');assert.ok(!options?.headers?.['If-None-Match'],'small kappa responses carry freshness in JSON rather than relying on CDN 304 headers');return Response.json({...kappa,live:true});}});
 independent.subscribe(state=>latest=state);
 const waiting=full.start();await independent.start();
 assert.equal(latest.data.maintainer.current.bound.value,0.00310045);assert.equal(latest.status.live,true);
 assert.ok(saved.has('beyond-n-log-n:kappa:1'));assert.ok(saved.has('beyond-n-log-n:compact:1'));
 assert.equal(mergeKappa(research,latest.data).maintainer.current.bound.value,0.00310045);
 release(new Response(null,{status:403}));await waiting;
 assert.equal(latest.status.live,true,'a research outage cannot change kappa freshness');
});

test('an older full scan cannot overwrite fresh kappa, and an independent withdrawal cannot restore a historical maximum',async()=>{
 const kappa=kappaPayload(await snapshot());
 const research={fetchedAt:'2026-10-15T00:00:00Z',maintainer:{current:null,history:[]}};
 const merged=mergeKappa(research,kappa);assert.equal(merged.maintainer.current.bound.value,0.00310045);assert.equal(merged.fetchedAt,research.fetchedAt,'PR freshness stays separate');
 const withdrawn=mergeKappa(merged,{...kappa,maintainer:{...kappa.maintainer,current:null}});assert.equal(withdrawn.maintainer.current,null);assert.equal(withdrawn.maintainer.history.length,1);
 const newer={...research,fetchedAt:'2026-10-28T00:00:00Z'};assert.equal(mergeKappa(newer,kappa),newer);
 const slowScan={...research,fetchedAt:'2026-10-28T00:00:00Z',maintainer:{...research.maintainer,checkedAt:'2026-10-15T00:00:00Z'}};
 assert.equal(mergeKappa(slowScan,kappa).maintainer.current.bound.value,0.00310045,'a slow scan completing later must not roll back a newer independent source check');
});
