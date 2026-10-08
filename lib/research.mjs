export const REPOSITORY = 'CrocSwap/integer-mult-bounds';
export const FIELDS = [
 {id:'linear',name:'Linear algebra',color:'#aa9ef3',description:'Frames, ranks, controlled bases, and projector geometry.'},
 {id:'combinatorics',name:'Combinatorics',color:'#e8bd76',description:'Subset networks, matchings, incidence trees, and shared sums.'},
 {id:'circuits',name:'Circuit complexity',color:'#87cbea',description:'Reversible circuits, gate accounting, and physical role allocation.'},
 {id:'analysis',name:'Asymptotic analysis',color:'#b9f582',description:'Recurrences, parameter constraints, and final exponent assembly.'},
 {id:'numerical',name:'Numerical analysis',color:'#f0a18c',description:'Gaussian resampling, precision, error bounds, and analytic interfaces.'},
 {id:'number',name:'Number theory',color:'#74d5b0',description:'Finite fields, modular witnesses, prime bounds, and rational arithmetic.'},
 {id:'formal',name:'Formal verification',color:'#dca2d5',description:'Explicit Lean and Mathlib checks, within their stated scope.'}
];
const RULES = [
 ['geometric-frames','Geometric frames',['linear','circuits'],/geometric envelope|geometric complex|physical frame residual|rational source[- ]span/i],
 ['controlled-bases','Controlled bases',['linear'],/controlled bas(?:is|es)|common (?:rational |boundary )?bas(?:is|es)|fixed (?:local |rational )?bas(?:is|es)/i],
 ['partial-swaps','Partial swaps',['linear','circuits'],/partial[- ]swap/i],
 ['shared-circuits','Shared circuits',['combinatorics','circuits'],/shared (?:sums|exclusions|exclusion|intermediate)|paired (?:recursion|circuit|degree)|retained (?:exclusion )?totals|star resynthesis/i],
 ['gaussian','Gaussian resampling',['numerical','analysis'],/Gaussian resampling|fast resampling|bulk resampling|chirped correlation/i],
 ['parameters','Parameter tuning',['analysis','number'],/parameter[- ]only|parameter refinement|refine[^.\n]{0,35}parameters|exact rational parameters|balanced (?:semantic\/bulk )?assembly/i],
 ['batching','Projector batching',['linear','circuits'],/projector block|projector batching|controlled batching|contiguous[^.\n]{0,30}blocks|batch[^.\n]{0,25}residual/i],
 ['source-frames','Source frames',['linear','circuits'],/source frames|source[- ]framed|auxiliary source|endpoint gauges|translated[^.\n]{0,30}frames/i],
 ['two-stage','Two-stage topology',['combinatorics','circuits'],/two[- ]stage (?:construction|topology|assembly|controlled|dimensions|basis|rank|bit)/i],
 ['data-corners','Data corners',['linear','combinatorics'],/data[- ]corner|rank[- ]partition|zero[- ]minor|reversed (?:boundary|corners)/i],
 ['copied-centers','Copied centers',['linear','circuits'],/copied (?:retained[- ]|retained |center|centers)|cheaper centers|retained[- ]center schedule/i],
 ['finite-fields','Finite-field networks',['number','combinatorics'],/ternary|F3 payload|prime[- ]power scalar|finite[- ]field|five[- ]subset/i],
 ['semantic','Semantic precision',['numerical','analysis'],/semantic (?:precision|envelope|guard|bulk)|completed[- ]child|phase[- ]cell/i],
 ['bank-sharing','Bank matching',['combinatorics','circuits'],/bank[- ]sharing|bank[- ]matching|bank matching|bipartite[- ]graph|stage[- ]1\/3 bank/i],
 ['formal-checks','Lean checks',['formal','number'],/Lean 4|Mathlib|formal\/lean/i]
];
export function plain(text='') {
 const supers={'⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9','⁻':'-'};
 return text.replace(/([0-9])([⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+)/g,(_,a,b)=>a+'^'+[...b].map(x=>supers[x]).join(''))
 .replace(/\\(?:kappa)/g,'κ').replace(/\\(?:times|cdot)|[×·]/g,'*').replace(/[−–]/g,'-')
 .replace(/\\(?:frac|dfrac)\{([^{}]+)\}\{(\d+)\s*\*\s*10\^\{([^{}]+)\}\}/g,'$1/($2*10^$3)')
 .replace(/\\(?:frac|dfrac)\{([^{}]+)\}\{10\^\{([^{}]+)\}\}/g,'$1/10^$2')
 .replace(/\\(?:frac|dfrac)\{([^{}]+)\}\{([^{}]+)\}/g,'$1/$2')
 .replace(/10\^\{(-?\d+)\}/g,'10^$1').replace(/2\^\{(-?\d+)\}/g,'2^$1')
 .replace(/[\n\r]+/g,' ').replace(/[`$]/g,'').replace(/\*\*/g,'').replace(/\\(?:approx|qquad|quad)/g,' ').replace(/\\,/g,' ');
}
export function parseExpression(raw) {
 const s=plain(raw).trim().replace(/,/g,'');
 const product=s.match(/^(\d+(?:\.\d+)?)\s*\/\s*\(?\s*(\d+(?:\.\d+)?)\s*\*\s*(2|10)\s*\^\s*(-?\d+)\s*\)?/);
 if(product){const value=Number(product[1])/(Number(product[2])*(Number(product[3])**Number(product[4])));if(value>0&&value<1)return {value,expression:product[0]};}
 const patterns=[
  /^(\d+(?:\.\d+)?)\s*\/\s*\(?\s*(\d+(?:\.\d+)?)(?:\s*\^\s*(-?\d+))?\s*\)?/,
  /^(\d+(?:\.\d+)?)\s*\*\s*(2|10)\s*\^\s*(-?\d+)/,
  /^(2|10)\s*\^\s*(-?\d+)/,
  /^(\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/
 ];
 for(let i=0;i<patterns.length;i++) {const m=s.match(patterns[i]);if(!m)continue;let value;
 if(i===0)value=Number(m[1])/(Number(m[2])**Number(m[3]??1));
 if(i===1)value=Number(m[1])*(Number(m[2])**Number(m[3]));
 if(i===2)value=Number(m[1])**Number(m[2]);
 if(i===3)value=Number(m[1]);
 if(value>0&&value<1)return {value,expression:m[0].trim()};
 } return null;
}
export function extractBound(title='',body='') {
 if(/no (?:new multiplication exponent|kappa change)|formal and independent checks only|no bound, certificate/i.test(title+' '+body)) return null;
 const t=plain(title), b=plain(body);
 // Prefer a headline equality, then an explicit equality in the description. Never take a component saving or ceiling.
 const titleValue=t.match(/(?:κ|kappa)\s*=\s*(.+)|conditional\s+([\d][^a-z]*?)(?:\s+>|\s+bound|$)/i);
 if(titleValue){const result=parseExpression(titleValue[1]||titleValue[2]);if(result)return {...result,kind:'exact',evidence:title,source:'title'};}
 const eq=/(?:κ|kappa)\s*=\s*/gi; let m;
 while((m=eq.exec(b))) {const context=b.slice(Math.max(0,m.index-90),m.index);if(/(?:ceiling|supremum|component exponent|inherited conditional witness remains)[^.]{0,75}$/i.test(context))continue;
 const result=parseExpression(b.slice(eq.lastIndex));if(result)return {...result,kind:'exact',evidence:b.slice(Math.max(0,m.index-80),eq.lastIndex+result.expression.length+100),source:'body'};
 }
 const lower=t.match(/(?:κ|kappa)\s*>\s*(.+)/i);const result=lower&&parseExpression(lower[1]);
 return result?{...result,kind:'lower',evidence:title,source:'title'}:null;
}
export function classify(title,body) {
 const text=title+'\n'+body, methods=[];
 for(const [id,name,fields,rule] of RULES) {const match=text.match(rule);if(match)methods.push({id,name,fields,evidence:plain(text.slice(Math.max(0,match.index-55),match.index+match[0].length+110))});}
 methods.sort((a,b)=>Number(RULES.find(r=>r[0]===b.id)[3].test(title))-Number(RULES.find(r=>r[0]===a.id)[3].test(title)));
 return {methods,fields:[...new Set(methods.flatMap(m=>m.fields))]};
}
export function references(body,repo,number) {
 const refs=new Set();
 // Bare numbers are deliberately excluded; only #N / PRN / explicit pull URLs are references.
 for(const match of body.matchAll(/#(\d+)\b|\bPR\s*(\d+)\b|github\.com\/CrocSwap\/integer-mult-bounds\/pull\/(\d+)/gi)) {const n=Number(match[1]||match[2]||match[3]);if(n!==number&&n>0)refs.add(n);}
 return [...refs].sort((a,b)=>a-b);
}
export function normalizePR(p) {
 const body=p.body||'';return {id:`${p.base.repo.full_name}#${p.number}`,repo:p.base.repo.full_name,number:p.number,title:p.title,body,url:p.html_url,author:p.user.login,avatar:p.user.avatar_url,createdAt:p.created_at,updatedAt:p.updated_at,closedAt:p.closed_at,mergedAt:p.merged_at,state:p.merged_at?'merged':p.state,draft:p.draft,headRepo:p.head.repo?.full_name??null,headBranch:p.head.ref,headSha:p.head.sha,baseSha:p.base.sha,labels:p.labels.map(l=>l.name),bound:extractBound(p.title,body),...classify(p.title,body),references:references(body,p.base.repo.full_name,p.number)};
}
