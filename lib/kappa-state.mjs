export function validKappa(data) {
 const point=data?.maintainer?.current;
 return data?.schemaVersion===1&&/^[a-f0-9]{64}$/.test(data?.revision??'')&&Number.isFinite(Date.parse(data?.fetchedAt))&&Array.isArray(data?.maintainer?.history)&&
  (point===null||point?.kind==='reviewed'&&Number.isFinite(point.bound?.value)&&point.bound.value>0&&/^[a-f0-9]{40}$/.test(point.commit??''));
}

export function mergeKappa(research,kappa) {
 if(!research||!kappa||Date.parse(kappa.fetchedAt)<Date.parse(research.maintainer?.checkedAt??research.fetchedAt))return research;
 const history=new Map((research.maintainer?.history??[]).map(point=>[point.commit,point]));
 for(const point of kappa.maintainer.history)if(!history.has(point.commit))history.set(point.commit,point);
 return {...research,maintainer:{current:kappa.maintainer.current,history:[...history.values()].sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt))}};
}
