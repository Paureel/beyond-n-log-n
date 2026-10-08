import {getStore} from '@netlify/blobs';
import snapshot from '../../public/research.json' with {type:'json'};
import {collectResearch} from '../../lib/github.mjs';
import {createResearchService} from '../../lib/service.mjs';
function store(){try{return getStore({name:'kappa-research-cache',consistency:'strong'});}catch{return null;}}
const service=createResearchService({
 collect:collectResearch,snapshot,
 read:async()=>{const s=store();return s?await s.get('last-good',{type:'json'}):null;},
 write:async data=>{const s=store();if(s)await s.setJSON('last-good',data);}
});
export default service;
export const config={path:'/api/research'};
