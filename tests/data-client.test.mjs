import test from 'node:test';
import assert from 'node:assert/strict';
import {createResearchClient,createDescriptionClient} from '../lib/data-client.mjs';
import {compactResearch} from '../lib/payload.mjs';
const record=(fetchedAt='2026-10-09T00:00:00Z')=>compactResearch({schemaVersion:1,fetchedAt,repository:{},prs:[],forks:[],maintainer:{current:null,history:[]},coverage:{}});
const memory=()=>{let saved=null;return {getItem:()=>saved,setItem:(k,value)=>saved=value};};
const unchanged=data=>new Response(null,{status:304,headers:{'X-Research-Fetched-At':data.fetchedAt,'X-Research-Live':'true'}});
test('cold startup renders one compact snapshot then conditionally checks it; overlapping checks are deduplicated',async()=>{
 const data=record(),calls=[];let last;
 const client=createResearchClient({storage:memory,fetcher:async(url,options)=>{calls.push({url,options});return url==='/research.json'?Response.json(data):unchanged(data);}});
 client.subscribe(next=>last=next);await Promise.all([client.start(),client.start()]);
 assert.equal(calls.length,2);assert.equal(calls[0].url,'/research.json');assert.equal(calls[1].options.headers['If-None-Match'],`W/"${data.revision}"`);assert.equal(last.status.live,true);assert.equal(last.data.revision,data.revision);
});
test('returning visits skip the snapshot and unchanged refreshes update freshness without another dataset',async()=>{
 const store=memory(),data=record(),later=record('2026-10-09T01:00:00Z'),calls=[];
 const first=createResearchClient({storage:()=>store,fetcher:async url=>url==='/research.json'?Response.json(data):unchanged(data)});await first.start();
 let last;const returning=createResearchClient({storage:()=>store,fetcher:async url=>{calls.push(url);return unchanged(later);}});returning.subscribe(next=>last=next);await returning.start();await returning.refresh();
 assert.deepEqual(calls,['/api/research?v=compact-2','/api/research?v=compact-2']);assert.equal(last.data.fetchedAt,later.fetchedAt);assert.equal(last.data.revision,data.revision);
});
test('changed records replace the cache and a stale response cannot overwrite newer data',async()=>{
 const store=memory(),data=record(),later={...record('2026-10-09T01:00:00Z'),revision:'a'.repeat(64)},responses=[Response.json({...later,live:true}),Response.json({...data,live:true})];let last;
 const client=createResearchClient({storage:()=>store,fetcher:async url=>url==='/research.json'?Response.json(data):responses.shift()});client.subscribe(next=>last=next);await client.start();await client.refresh();
 assert.equal(last.data.revision,later.revision);assert.equal(JSON.parse(store.getItem()).revision,later.revision);
});
test('offline and unavailable storage retain charts; invalid saved data falls back to the bundled snapshot',async()=>{
 let last;const client=createResearchClient({storage:()=>{throw Error('blocked');},fetcher:async url=>{if(url==='/research.json')return Response.json(record());throw Error('Offline');}});client.subscribe(next=>last=next);await client.start();assert.ok(last.data);assert.equal(last.status.live,false);assert.equal(last.status.error,'Offline');
 let snapshots=0;const invalid=createResearchClient({storage:()=>({getItem:()=>'{invalid',setItem:()=>{}}),fetcher:async url=>{if(url==='/research.json'){snapshots++;return Response.json(record());}return unchanged(record());}});await invalid.start();assert.equal(snapshots,1);
});
test('an unchanged response still exposes an upstream outage instead of claiming live data',async()=>{
 let last;const data=record();const client=createResearchClient({storage:()=>undefined,fetcher:async url=>url==='/research.json'?Response.json(data):new Response(null,{status:304,headers:{'X-Research-Live':'false','X-Research-Refresh-Error':'The GitHub refresh timed out.'}})});client.subscribe(next=>last=next);await client.start();assert.equal(last.status.live,false);assert.match(last.status.error,/timed out/);assert.ok(last.data);
});
test('descriptions are lazy, deduplicated, cached per revision, and retryable after failure',async()=>{
 let calls=0;const pr={id:'owner/repo#1',repo:'owner/repo',number:1,descriptionVersion:'a'.repeat(64)};
 const load=createDescriptionClient({fetcher:async url=>{calls++;return Response.json({id:pr.id,version:new URL(url,'https://example.test').searchParams.get('version'),body:'Full description'});}});assert.equal(calls,0);assert.deepEqual(await Promise.all([load(pr),load(pr)]),['Full description','Full description']);await load(pr);assert.equal(calls,1);await load({...pr,descriptionVersion:'b'.repeat(64)});assert.equal(calls,2);
 let failed=true;const retry=createDescriptionClient({fetcher:async()=>failed?new Response(null,{status:503}):Response.json({id:pr.id,version:pr.descriptionVersion,body:'Recovered'})});await assert.rejects(retry(pr),/could not/);failed=false;assert.equal(await retry(pr),'Recovered');
});
