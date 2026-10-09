import {REPOSITORY, extractBound, classify} from './research.mjs';
import {firstParentCommits} from './commit-history.mjs';

const decode = response => Buffer.from(response.data.content, 'base64').toString('utf8');

export async function collectHistory({get, pages, mapLimit, readmeText, priorData, warnings, commits:providedCommits, defaultBranch='main'}) {
 const prior = priorData?.history || [];
 const pin = readmeText.match(/github\.com\/openai\/math\/tree\/([a-f0-9]{40})\/(preprints\/[^)\s]+)/i);
 const original = async () => {
  if (!pin) return prior.filter(e => e.kind === 'openai');
  const id = `openai/math@${pin[1]}`;
  const cached = prior.find(e => e.id === id);
  if (cached) return [cached];
  try {
   const [commit, intro, summary] = await Promise.all([
    get(`/repos/openai/math/commits/${pin[1]}`),
    get(`/repos/openai/math/contents/${pin[2]}/build/sections/00-introduction.tex?ref=${pin[1]}`),
    get(`/repos/openai/math/contents/${pin[2]}/README.md?ref=${pin[1]}`)
   ]);
   const bound = extractBound('', decode(intro));
   if (!bound) throw new Error('No original κ found in the pinned manuscript');
   return [{id, kind:'openai', repo:'openai/math', commit:pin[1], title:'Integer multiplication below n log n', author:'OpenAI', createdAt:commit.data.commit.committer.date, manuscriptDate:decode(summary).match(/\*\*Date:\*\*\s*(.+)/)?.[1] || null, url:`https://github.com/openai/math/blob/${pin[1]}/${pin[2]}/build/sections/00-introduction.tex`, commitUrl:commit.data.html_url, bound:{...bound, source:'pinned manuscript'}, ...classify('',decode(intro))}];
  } catch (e) {
   warnings.push(`Original OpenAI result: ${e.message}`);
   return prior.filter(e => e.kind === 'openai');
  }
 };
 let commits;
 const originalPromise = original();
 try { commits = firstParentCommits(providedCommits || await pages(`/repos/${REPOSITORY}/commits?sha=${encodeURIComponent(defaultBranch)}`)); }
 catch (e) { warnings.push(`Repository history: ${e.message}`); return [...await originalPromise, ...prior.filter(e => e.kind === 'checkpoint')]; }
 const checkpoints = await mapLimit(commits, async c => {
  const id = `${REPOSITORY}@${c.sha}`;
  const cached = prior.find(e => e.id === id);
  if (cached) return cached;
  try {
   const response = await get(`/repos/${REPOSITORY}/readme?ref=${c.sha}`, true);
   if (!response) return null;
   const body = decode(response);
   const bound = extractBound('', body);
   if (!bound) return null;
   return {id, kind:'checkpoint', repo:REPOSITORY, commit:c.sha, title:c.commit.message.split('\n')[0], author:c.author?.login || c.commit.author.name, createdAt:c.commit.committer.date, url:`https://github.com/${REPOSITORY}/blob/${c.sha}/README.md`, commitUrl:c.html_url || `https://github.com/${REPOSITORY}/commit/${c.sha}`, bound:{...bound, source:'README at commit'}, ...classify('',body)};
  } catch (e) { warnings.push(`Checkpoint ${c.sha.slice(0,7)}: ${e.message}`); return null; }
 });
 return [...await originalPromise, ...checkpoints.filter(Boolean)].sort((a,b) => Date.parse(a.createdAt)-Date.parse(b.createdAt));
}
