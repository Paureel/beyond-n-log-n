export const sci=(n:number,digits=3)=>n.toExponential(digits).replace(/\.?(0+)(?=e)/,'').replace('e-',' × 10⁻').replace(/(?<=10⁻)\d+/g,s=>s.split('').map(c=>'⁰¹²³⁴⁵⁶⁷⁸⁹'[+c]).join(''));
export const shortSci=(n:number)=>n.toExponential(2).replace(/\.?(0+)(?=e)/,'');
export const date=(s:string)=>new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(s));
export const time=(s:string)=>new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'UTC'}).format(new Date(s));
export const colorFor=(name:string)=>['#b9f582','#aa9ef3','#87cbea','#e8bd76','#f0a18c','#74d5b0','#dca2d5','#96adee'][Array.from(name).reduce((a,c)=>a+c.charCodeAt(0),0)%8];
export const compact=(n:number)=>new Intl.NumberFormat('en-GB',{notation:'compact',maximumFractionDigits:1}).format(n);
