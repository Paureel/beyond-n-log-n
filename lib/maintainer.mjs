import {REPOSITORY, parseExpression} from './research.mjs';
import {publicationCommits} from './commit-history.mjs';

export const SELECTED_RESULT_PATH = 'certificates/selected-result.json';
const blob = (commit, path) => `https://github.com/${REPOSITORY}/blob/${commit}/${path}`;
const safePath = path => typeof path === 'string' && /^[\w./-]+$/.test(path) && !path.startsWith('/') && !path.split('/').includes('..');

export function normalizeSelectedResult(record, commit, {prs=[], history=[]}={}) {
 // Only the upstream selected-result schema declares a reviewed selection.
 if (record?.status !== 'Selected maintainer-reviewed conditional witness') return null;
 const parsed = typeof record.kappa === 'string' && parseExpression(record.kappa);
 if (!parsed || parsed.expression.replace(/\s/g,'') !== record.kappa.replace(/\s/g,'')) return null;
 if (!Number.isInteger(record.source_pr) || record.source_pr < 1 || !/^[a-f0-9]{40}$/.test(record.reviewed_head || '')) return null;
 if (!/^[a-f0-9]{40}$/.test(commit.sha || '') || !Number.isFinite(Date.parse(commit.commit?.committer?.date))) return null;
 if (!safePath(record.review) || !safePath(record.validation) || typeof record.scope !== 'string' || !record.scope.trim()) return null;
 if (record.decimal != null && (!Number.isFinite(Number(record.decimal)) || Math.abs(Number(record.decimal)-parsed.value) > parsed.value*1e-8)) return null;
 const pr = prs.find(p => p.repo === REPOSITORY && p.number === record.source_pr);
 const checkpoint = history.find(p => p.commit === commit.sha);
 const previous = typeof record.previous_kappa === 'string' && parseExpression(record.previous_kappa);
 return {
  id:`${REPOSITORY}:selected@${commit.sha}`, kind:'reviewed', repo:REPOSITORY, commit:commit.sha,
  title:`Maintainer selection · PR #${record.source_pr}`, author:pr?.author || `PR #${record.source_pr}`,
  createdAt:commit.commit.committer.date, url:blob(commit.sha,SELECTED_RESULT_PATH),
  commitUrl:`https://github.com/${REPOSITORY}/commit/${commit.sha}`,
  bound:{...parsed, kind:'exact', evidence:`κ = ${record.kappa}`, source:'maintainer selected-result.json'},
  methods:checkpoint?.methods || pr?.methods || [], fields:checkpoint?.fields || pr?.fields || [],
  review:{sourcePR:record.source_pr, head:record.reviewed_head, scope:record.scope,
   reviewUrl:blob(commit.sha,record.review), validationUrl:blob(commit.sha,record.validation),
   proofUrl:safePath(record.proof)?blob(commit.sha,record.proof):null,
   certificateUrl:safePath(record.certificate)?blob(commit.sha,record.certificate):null,
   reproduce:typeof record.reproduce==='string'?record.reproduce:null,
   previousBound:previous?{...previous,kind:'exact',evidence:`Previous κ = ${record.previous_kappa}`,source:'maintainer selected-result.json'}:null}
 };
}

export async function collectMaintainer({get,pages,mapLimit,defaultBranch,prs,history,priorData,warnings,commits:mainCommits}) {
 // File history is restricted to the upstream default branch. Each receipt is
 // read at its immutable commit, never from a PR head or a contributor's fork.
 const changes = await pages(`/repos/${REPOSITORY}/commits?path=${SELECTED_RESULT_PATH}&sha=${encodeURIComponent(defaultBranch)}`,true);
 const commits = mainCommits ? publicationCommits(changes,mainCommits) : changes;
 const prior = priorData?.maintainer?.history || [];
 const results = await mapLimit(commits,async commit => {
  const cached = prior.find(p => p.commit === commit.sha);
  if (cached) return cached;
  const response = await get(`/repos/${REPOSITORY}/contents/${SELECTED_RESULT_PATH}?ref=${commit.sha}`,true);
  if (!response) return null; // A deletion clears the current selection.
  let record;
  try { record = JSON.parse(Buffer.from(response.data.content,'base64').toString('utf8')); }
  catch { warnings.push(`Maintainer record ${commit.sha.slice(0,7)} could not be read.`); return null; }
  const result = normalizeSelectedResult(record,commit,{prs,history});
  if (!result && record?.status === 'Selected maintainer-reviewed conditional witness') warnings.push(`Maintainer record ${commit.sha.slice(0,7)} has an unsupported format.`);
  return result;
 });
 // The latest selection wins even when its κ decreases or it is withdrawn.
 // A failed request throws so the service keeps a visibly stale last-good record.
 return {current:results[0] || null, history:results.filter(Boolean).sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt))};
}

export function upstreamTimeline(history=[], maintainer=null) {
 const receipts = maintainer?.history || [];
 const ledgerStart = receipts.length ? Math.min(...receipts.map(p=>Date.parse(p.createdAt))) : Infinity;
 return [...history.filter(p=>p.kind==='openai' || Date.parse(p.createdAt)<ledgerStart),...receipts]
  .sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt))
  .filter((p,i,points)=>p.kind!=='checkpoint'||i===0||p.bound.value!==points[i-1].bound.value);
}

export function reviewedPRResult(pr,maintainer) {
 const p=maintainer?.current;
 return p && pr.repo===REPOSITORY && pr.number===p.review.sourcePR && pr.headSha===p.review.head && pr.bound?.kind==='exact' && Math.abs(pr.bound.value-p.bound.value)<=p.bound.value*1e-12 ? p : null;
}
