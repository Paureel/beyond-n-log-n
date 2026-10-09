import {REPOSITORY, parseExpression} from './research.mjs';
import {publicationCommits} from './commit-history.mjs';

export const SELECTED_RESULT_PATH = 'certificates/selected-result.json';
const blob = (commit, path) => `https://github.com/${REPOSITORY}/blob/${commit}/${path}`;
const safePath = path => typeof path === 'string' && /^[\w./-]+$/.test(path) && !path.startsWith('/') && !path.split('/').includes('..');
const SINGLE_STATUS='Selected maintainer-reviewed conditional witness';
const COMBINED_STATUS='Published on main: maintainer-reviewed conditional construction';
const ACTIVE_STATUSES=new Set([SINGLE_STATUS,COMBINED_STATUS,'Selected maintainer-reviewed conditional composition; publication is a separate step','Selected maintainer-reviewed conditional construction; main publication is a separate step']);
const supportedStatus=record=>ACTIVE_STATUSES.has(record?.status);
const prNumbers=value=>Array.isArray(value)&&value.length>0&&value.every(n=>Number.isSafeInteger(n)&&n>0)&&new Set(value).size===value.length;
const exactBound=value=>{const parsed=typeof value==='string'&&parseExpression(value);return parsed&&parsed.expression.replace(/\s/g,'')===value.replace(/\s/g,'')?parsed:null;};

export function selectionSources(point){
 if(point?.review?.sources)return point.review.sources;
 return point?.review?.sourcePR?[{number:point.review.sourcePR,author:point.author,head:point.review.head??null}]:[];
}
export function selectionReference(point){
 const sources=selectionSources(point);
 return sources.length===1?`PR #${sources[0].number}`:`Combined result · ${sources.length} PRs`;
}

export function normalizeSelectedResult(record, commit, {prs=[], history=[],validation=null}={}) {
 // Only the upstream selected-result schema declares a reviewed selection.
 if (!supportedStatus(record)) return null;
 const parsed=exactBound(record.kappa);
 if (!parsed) return null;
 const multi=record.source_prs!==undefined;
 if(multi?!prNumbers(record.source_prs):!Number.isSafeInteger(record.source_pr)||record.source_pr<1||!/^[a-f0-9]{40}$/.test(record.reviewed_head||''))return null;
 if(multi&&record.source_pr!==undefined)return null; // Ambiguous attribution must not pick an arbitrary primary PR.
 if(record.status===COMBINED_STATUS&&(!multi||!safePath(record.source_manifest)||!safePath(record.certificate)||!safePath(record.proof)))return null;
 const numbers=multi?record.source_prs:[record.source_pr];
 for(const key of ['parallel_reviewed_prs','verification_contributions'])if(record[key]!==undefined&&!(Array.isArray(record[key])&&(!record[key].length||prNumbers(record[key]))))return null;
 if (!/^[a-f0-9]{40}$/.test(commit.sha || '') || !Number.isFinite(Date.parse(commit.commit?.committer?.date))) return null;
 if (!safePath(record.review) || !safePath(record.validation) || typeof record.scope !== 'string' || !record.scope.trim()) return null;
 if (record.decimal != null && (!Number.isFinite(Number(record.decimal)) || Math.abs(Number(record.decimal)-parsed.value) > parsed.value*1e-8)) return null;
 const validationBound=exactBound(validation?.kappa);
 const receiptMatches=multi&&/^PASS\b/.test(validation?.status??'')&&validationBound&&Math.abs(validationBound.value-parsed.value)<=parsed.value*1e-12;
 const sources=numbers.map(number=>{
  const pr=prs.find(p=>p.repo===REPOSITORY&&p.number===number);
  const head=multi?receiptMatches?validation[`source_pr${number}_head`]:null:record.reviewed_head;
  return {number,author:pr?.author??`PR #${number}`,head:/^[a-f0-9]{40}$/.test(head??'')?head:null};
 });
 const sourcePRs=prs.filter(p=>p.repo===REPOSITORY&&numbers.includes(p.number));
 const checkpoint = history.find(p => p.commit === commit.sha);
 const previousExpression=record.previous_published_kappa??record.previous_kappa;
 const previous=exactBound(previousExpression);
 const methods=checkpoint?.methods??[...new Map(sourcePRs.flatMap(pr=>pr.methods??[]).map(m=>[m.id,m])).values()];
 const fields=checkpoint?.fields??[...new Set(sourcePRs.flatMap(pr=>pr.fields??[]))];
 return {
  id:`${REPOSITORY}:selected@${commit.sha}`, kind:'reviewed', repo:REPOSITORY, commit:commit.sha,
  title:numbers.length>1?'Maintainer selection · combined result':`Maintainer selection · PR #${numbers[0]}`, author:numbers.length>1?'Combined result':sources[0].author,
  createdAt:commit.commit.committer.date, url:blob(commit.sha,SELECTED_RESULT_PATH),
  commitUrl:`https://github.com/${REPOSITORY}/commit/${commit.sha}`,
  bound:{...parsed, kind:'exact', evidence:`κ = ${record.kappa}`, source:'maintainer selected-result.json'},
  methods,fields,
  review:{formatVersion:2,sourcePR:multi?null:record.source_pr,head:multi?null:record.reviewed_head,sourcePRs:numbers,sources,parallelPRs:record.parallel_reviewed_prs??[],verificationPRs:record.verification_contributions??[],scope:record.scope,
   reviewUrl:blob(commit.sha,record.review), validationUrl:blob(commit.sha,record.validation),
   proofUrl:safePath(record.proof)?blob(commit.sha,record.proof):null,
   certificateUrl:safePath(record.certificate)?blob(commit.sha,record.certificate):null,
   manifestUrl:safePath(record.source_manifest)?blob(commit.sha,record.source_manifest):null,
   proofSupplements:record.proof_supplements&&typeof record.proof_supplements==='object'&&!Array.isArray(record.proof_supplements)?Object.entries(record.proof_supplements).filter(([path,sha256])=>safePath(path)&&/^[a-f0-9]{64}$/.test(sha256)).map(([path,sha256])=>({path,sha256,url:blob(commit.sha,path)})):[],
   reproduce:typeof record.reproduce==='string'?record.reproduce:null,
   previousBound:previous?{...previous,kind:'exact',evidence:`Previous published κ = ${previousExpression}`,source:'maintainer selected-result.json'}:null}
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
  if (cached?.review?.formatVersion===2) return cached;
  const response = await get(`/repos/${REPOSITORY}/contents/${SELECTED_RESULT_PATH}?ref=${commit.sha}`,true);
  if (!response) return null; // A deletion clears the current selection.
  let record;
  try { record = JSON.parse(Buffer.from(response.data.content,'base64').toString('utf8')); }
  catch { warnings.push(`Maintainer record ${commit.sha.slice(0,7)} could not be read.`); return null; }
  let validation=null;
  if(supportedStatus(record)&&prNumbers(record.source_prs)&&safePath(record.validation)){
   const response=await get(`/repos/${REPOSITORY}/contents/${record.validation}?ref=${commit.sha}`,true);
   try{if(response)validation=JSON.parse(Buffer.from(response.data.content,'base64').toString('utf8'));}catch{/* A malformed receipt cannot grant any PR a reviewed-head badge. */}
   if(!validation)warnings.push(`Validation receipt ${commit.sha.slice(0,7)} is unavailable; individual PR review heads are not inferred.`);
  }
  const result = normalizeSelectedResult(record,commit,{prs,history,validation});
  if (!result && (supportedStatus(record)||/selected|published|maintainer-reviewed/i.test(record?.status??''))) warnings.push(`Maintainer record ${commit.sha.slice(0,7)} has an unsupported format.`);
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
 const source=selectionSources(p).find(source=>source.number===pr.number);
 return p && source?.head && pr.repo===REPOSITORY && pr.headSha===source.head && pr.bound?.kind==='exact' && Math.abs(pr.bound.value-p.bound.value)<=p.bound.value*1e-12 ? p : null;
}
