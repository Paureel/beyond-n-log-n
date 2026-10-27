import {getStore} from '@netlify/blobs';
import snapshot from '../../data/kappa.json' with {type:'json'};
import {createKappaService} from '../../lib/kappa.mjs';
function store(){try{return getStore({name:'kappa-selection-cache',consistency:'strong'});}catch{return null;}}
const service=createKappaService({snapshot,
 read:async()=>{const s=store();return s?await s.get('last-good-v1',{type:'json'}):null;},
 write:async data=>{const s=store();if(s)await s.setJSON('last-good-v1',data);}
});
export default service;
export const config={path:'/api/kappa'};
