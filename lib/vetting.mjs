import {REPOSITORY} from './research.mjs';
// Repository checkpoints and PRs merged into the repository are vetted. Open PRs, and PRs merged only within a fork, are unreviewed claims. Closed, unmerged PRs never count.
export function vetting(entry) {
 if(entry.kind==='openai'||entry.kind==='checkpoint')return 'vetted';
 if(entry.state==='closed')return 'closed';
 return entry.state==='merged'&&entry.repo===REPOSITORY?'vetted':'unreviewed';
}
export function counted(entry,unreviewed=false) {const status=vetting(entry);return status==='vetted'||unreviewed&&status==='unreviewed';}
// Points arrive in chronological order; each counted point that raises the best κ so far joins the frontier.
export function frontierOf(points,unreviewed=false) {
 let best=0;
 return points.filter(p=>{if(!counted(p.source,unreviewed)||p.bound.value<=best)return false;best=p.bound.value;return true;});
}
