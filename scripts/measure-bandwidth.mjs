// Local, deterministic measurements. No GitHub calls, Netlify writes or load testing.
import {readFile,readdir,writeFile,mkdir} from 'node:fs/promises';
import {gzipSync,brotliCompressSync,constants} from 'node:zlib';
import {compactResearch,descriptionVersion} from '../lib/payload.mjs';
import {createResearchService} from '../lib/service.mjs';
const root=new URL('../',import.meta.url);
const snapshotText=await readFile(new URL('data/research.json',root),'utf8'),snapshot=JSON.parse(snapshotText);
const input=process.argv[2];
const live=input?JSON.parse(await readFile(input,'utf8')):{...snapshot,fetchedAt:new Date(Date.parse(snapshot.fetchedAt)+16*60*1000).toISOString()};
const snapshotCompact=compactResearch(snapshot),liveCompact=compactResearch(live),now=Date.parse(live.fetchedAt);
const service=createResearchService({now:()=>now,collect:async()=>live});
const response=await service(new Request('https://local.test/api/research'));
const liveText=await response.text();
const conditional=await service(new Request('https://local.test/api/research',{headers:{'If-None-Match':response.headers.get('ETag')}}));
if(conditional.status!==304||(await conditional.text()).length)throw Error('Unchanged request did not return an empty 304.');
const assets=await readdir(new URL('dist/assets/',root));
const initialAssets=await Promise.all(assets.filter(name=>/^index-.*\.(js|css)$/.test(name)).map(name=>readFile(new URL('dist/assets/'+name,root))));
const descriptions=await Promise.all(live.prs.map(async pr=>{
 const params=new URLSearchParams({repo:pr.repo,number:String(pr.number),version:descriptionVersion(pr)});
 const response=await service(new Request('https://local.test/api/pr-description?'+params));
 if(!response.ok)throw Error('Description fixture failed');return Buffer.from(await response.text());
}));
const codecs={gzip:bytes=>gzipSync(bytes).length,brotli:bytes=>brotliCompressSync(bytes,{params:{[constants.BROTLI_PARAM_QUALITY]:4}}).length};
const report={date:new Date().toISOString(),snapshotPRs:snapshot.prs.length,livePRs:live.prs.length,conditionalStatus:conditional.status,conditionalBodyBytes:0,codecs:{}};
for(const [codec,size] of Object.entries(codecs)){
 const oldSnapshot=size(Buffer.from(snapshotText)),oldLive=size(Buffer.from(JSON.stringify({...live,live:true}))),newSnapshot=size(Buffer.from(JSON.stringify(snapshotCompact)+'\n')),newLive=size(Buffer.from(liveText));
 const frontend=initialAssets.reduce((n,b)=>n+size(b),0);
 const matchingOldLive=size(Buffer.from(JSON.stringify({...snapshot,live:true})));
 const descriptionSizes=descriptions.map(size).sort((a,b)=>a-b),medianDescription=descriptionSizes[Math.floor(descriptionSizes.length/2)];
 // Use the same current frontend on each side to isolate data savings. Its JS grew about 1 KB gzip.
 const scenarios=[
  ['First visit, bootstrap already current',oldSnapshot+matchingOldLive+frontend,newSnapshot+frontend],
  ['First visit, newer research available',oldSnapshot+oldLive+frontend,newSnapshot+newLive+frontend],
  ['First visit, newer research + 3 typical descriptions',oldSnapshot+oldLive+frontend,newSnapshot+newLive+frontend+3*medianDescription],
  ['Returning visit, unchanged data',oldLive,0],
  ['Refresh with changed data',oldLive,newLive]
 ].map(([name,before,after])=>({name,beforeBytes:before,afterBytes:after,savedPercent:100*(1-after/before),beforeBandwidthCreditsPer10000:before*10000/1e9*20,afterBandwidthCreditsPer10000:after*10000/1e9*20}));
 report.codecs[codec]={oldSnapshot,oldLive,newSnapshot,newLive,frontend,medianDescription,scenarios};
}
const markdown=['# Local bandwidth measurement','',`Measured ${report.date}. Bootstrap: ${report.snapshotPRs} PRs; refresh corpus: ${report.livePRs} PRs. ${input?'The refresh corpus is a saved public API response from the earlier live-site measurement.':'The same research corpus is reused with a later collection timestamp.'}`,'','The actual new server handler returned HTTP 304 and a zero-byte body for unchanged data. No network load test or deployment was performed. Compression is applied locally with the same settings before and after.',''];
for(const [codec,data] of Object.entries(report.codecs)){
 markdown.push(`## ${codec==='gzip'?'Gzip':'Brotli (quality 4)'}`,'','| Scenario | Before | After | Saved | Bandwidth credits per 10,000, before → after |','| --- | ---: | ---: | ---: | ---: |');
 for(const row of data.scenarios)markdown.push(`| ${row.name} | ${(row.beforeBytes/1000).toFixed(1)} KB | ${(row.afterBytes/1000).toFixed(1)} KB | ${row.savedPercent.toFixed(1)}% | ${row.beforeBandwidthCreditsPer10000.toFixed(1)} → ${row.afterBandwidthCreditsPer10000.toFixed(1)} |`);
 markdown.push('',`Compact snapshot: ${(data.newSnapshot/1000).toFixed(1)} KB; compact refresh: ${(data.newLive/1000).toFixed(1)} KB; median full PR description: ${(data.medianDescription/1000).toFixed(1)} KB.`,'');
}
markdown.push('## Scope of the estimate','','Uses [Netlify’s rate of 20 credits per GB](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/), with decimal GB. These are bandwidth estimates, not total billing credits. Request and compute charges are separate. An unchanged check still makes one request and sends response headers.','', 'Initial JS/CSS are included using the current production build on both sides; this isolates the data-loading change. HTML, external fonts, Netlify-injected content, source images, lazy Markdown/KaTeX assets and HTTP headers are excluded. The description scenario adds three median description responses, not the one-time Markdown renderer/font download. Content-hashed assets now have an immutable browser cache.','', 'Netlify compression settings, browser caches, how many descriptions users open, refresh frequency and changes in upstream data affect the actual result. The earlier 1.39 GB bill cannot be retroactively attributed from these measurements. Re-run after the build with `npm run measure:bandwidth`; optionally pass a saved full response path after `--`.', '');
await mkdir(new URL('docs/',root),{recursive:true});
await writeFile(new URL('docs/bandwidth-measurement.json',root),JSON.stringify(report,null,2)+'\n');
await writeFile(new URL('docs/bandwidth-measurement.md',root),markdown.join('\n'));
console.log(JSON.stringify(report,null,2));
