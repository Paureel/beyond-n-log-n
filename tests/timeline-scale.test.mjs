import test from 'node:test';
import assert from 'node:assert/strict';
import {formatKappa,logDomain,logValue} from '../lib/timeline-scale.mjs';

test('switching bases preserves kappa positions and the same physical range, including recent and zoomed windows',()=>{
 for(const [low,high,recent] of [[2**-182,0.000661885549259598,false],[0.0004609169,0.000661885549259598,true],[0.000661885549259598,0.000661886549259598,true]]){
  const domains=[10,2].map(base=>logDomain(low,high,base,recent));
  for(const [i,base] of [10,2].entries()){
   const {min,max}=domains[i];assert.ok(base**min<=low);assert.ok(base**max>=high);
   for(const value of [low,high,Math.sqrt(low*high)]){
    const normalized=(logValue(value,base)-min)/(max-min);
    const reference=(Math.log10(value)-domains[0].min)/(domains[0].max-domains[0].min);
    assert.ok(Math.abs(normalized-reference)<1e-12);
    assert.ok(Math.abs(((normalized-.25)/.5)-((reference-.25)/.5))<1e-12);
   }
  }
 }
});
test('dyadic results retain exact powers and binary labels keep real nearby improvements distinct',()=>{
 assert.equal(formatKappa(2**-182,2),'2⁻¹⁸²');assert.equal(formatKappa(2**-182,10),'1.63 × 10⁻⁵⁵');
 assert.equal(formatKappa(0.000661885549259598,10),'6.62 × 10⁻⁴');assert.equal(formatKappa(0.000661885549259598,2),'1.36 × 2⁻¹¹');
 assert.notEqual(formatKappa(0.000661885549259598,2,9),formatKappa(0.000661886549259598,2,9));
 for(const base of [10,2])assert.equal(formatKappa(0,base),'0');
 assert.equal(formatKappa(.9999,2),'2⁰');assert.equal(formatKappa(.0009999,10),'10⁻³');
});
