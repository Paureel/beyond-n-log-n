export function firstParentCommits(commits) {
 const bySha=new Map(commits.map(c=>[c.sha,c])),result=[];
 let current=commits[0];
 while(current){
  result.push(current);
  const parent=current.parents?.[0]?.sha;
  if(!parent)break;
  current=bySha.get(parent);
  if(!current)throw new Error('Main branch commit history is incomplete.');
 }
 return result;
}

// A research-branch commit can precede its publication on main. Use the first
// main-branch commit that actually contains it, and read the file at that commit.
export function publicationCommits(changes,commits) {
 const bySha=new Map(commits.map(c=>[c.sha,c]));
 const mainline=firstParentCommits(commits).reverse(),published=new Map();
 for(const change of changes){
  const contains=sha=>{
   const pending=[sha],seen=new Set();
   while(pending.length){const next=pending.pop();if(next===change.sha)return true;if(seen.has(next))continue;seen.add(next);pending.push(...(bySha.get(next)?.parents || []).map(p=>p.sha));}
   return false;
  };
  const first=mainline.find(c=>contains(c.sha));
  if(!first)throw new Error('Maintainer record publication could not be resolved.');
  published.set(first.sha,first);
 }
 return mainline.filter(c=>published.has(c.sha)).reverse();
}
