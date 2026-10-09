import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {collectResearch} from '../lib/github.mjs';
import {compactResearch} from '../lib/payload.mjs';
try {
 const path=new URL('../data/research.json',import.meta.url);
 let priorData=null;
 try {priorData=JSON.parse(await readFile(path,'utf8'));} catch {/* A first sync has no snapshot. */}
 const data=await collectResearch({priorData});
 await mkdir(new URL('../data/',import.meta.url),{recursive:true});
 await writeFile(path,JSON.stringify(data,null,2)+'\n');
 await writeFile(new URL('../public/research.json',import.meta.url),JSON.stringify(compactResearch(data))+'\n');
 console.log(`Synced ${data.prs.length} upstream PRs, ${data.forks.length} public forks, ${data.coverage.forkPRs} fork PRs at ${data.fetchedAt}`);
 for(const warning of data.warnings)console.warn(warning);
} catch(error) {console.error(error.message);process.exitCode=1;}
