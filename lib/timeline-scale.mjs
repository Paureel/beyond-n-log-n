export const superscript=value=>String(value).replace(/[0-9-]/g,c=>c==='-'?'⁻':'⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(c)]);
export const logValue=(value,base)=>base===2?Math.log2(value):Math.log10(value);

export function logDomain(low,high,base,recent=false){
 const low10=Math.log10(low),high10=Math.log10(high),padding=Math.max(.08,(high10-low10)*.12),unit=logValue(10,base);
 // Changing logarithm base changes units, not the displayed kappa range.
 return {min:(recent?low10-padding:Math.floor(low10))*unit,max:(recent?high10+padding:Math.ceil(high10))*unit};
}

export function formatKappa(value,base,digits=3){
 if(value===0)return '0';
 let power=Math.floor(logValue(value,base)),mantissa=Number((value/base**power).toPrecision(digits));
 if(mantissa>=base){power++;mantissa=Number((mantissa/base).toPrecision(digits));}
 return `${mantissa===1?'':`${mantissa} × `}${base}${superscript(power)}`;
}
