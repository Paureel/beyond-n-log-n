import {readFile,writeFile} from 'node:fs/promises';
import {collectKappa,kappaPayload} from '../lib/kappa.mjs';
try {
 let priorData;
 try{priorData=JSON.parse(await readFile(new URL('../data/kappa.json',import.meta.url),'utf8'));}
 catch{priorData=JSON.parse(await readFile(new URL('../data/research.json',import.meta.url),'utf8'));}
 const data=await collectKappa({priorData,backfill:true});
 await writeFile(new URL('../data/kappa.json',import.meta.url),JSON.stringify(data,null,2)+'\n');
 await writeFile(new URL('../public/kappa.json',import.meta.url),JSON.stringify(kappaPayload(data))+'\n');
 console.log(`κ ${data.maintainer.current?.bound.expression??'withdrawn'} checked ${data.fetchedAt}; ${data.maintainer.history.length} selection records`);
}catch(error){console.error(error.message);process.exitCode=1;}
