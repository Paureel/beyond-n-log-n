import {getStore} from '@netlify/blobs';
import snapshot from '../../public/research.json' with {type:'json'};
import {collectResearch} from '../../lib/github.mjs';
import {createResearchService} from '../../lib/service.mjs';
function store(){try{return getStore({name:'kappa-research-cache',consistency:'strong'});}catch{return null;}}
const cacheKey='last-good-maintainer-v1';
const service=createResearchService({
 collect:collectResearch,snapshot,
 read:async()=>{const s=store();return s?await s.get(cacheKey,{type:'json'}):null;},
 write:async data=>{const s=store();if(s)await s.setJSON(cacheKey,data);}
});
export default service;
export const config={path:'/api/research'};
