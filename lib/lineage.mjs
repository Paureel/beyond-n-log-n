const ROOT='CrocSwap/integer-mult-bounds';
const reuse=/\b(?:build(?:s|ing)? on|built on|based on|inherit(?:s|ed|ing)?|retain(?:s|ed|ing)?|reus(?:e[sd]?|ing)|borrow(?:s|ed|ing)?|adapt(?:s|ed|ation)?|adopt(?:s|ed)?|combin(?:e[sd]?|ing)|compos(?:e[sd]?|ing)|import(?:s|ed)?|integrat(?:e[sd]?|ing)|extend(?:s|ed)?|dependenc(?:y|ies)|ancestry|translate[sd]?|reverses?|applying|using that|with contributions from)\b/i;
const fromMethod=/\b(?:approach|method|bas(?:is|es)|schedule|construction|framework|producer|compiler|DAGs?|geometry|corners?|centers?|networks?|profiles?|parameters|work|ideas|techniques|assembly|pipeline|star rules|bank.matching).{0,70}\b(?:from|of|in)\b/i;
const scopeReuse=/inherit|dependenc|reus|source inputs|base and|result and dependency/i;
const credit=/^\s*(?:[-*]\s*)?(?:credit\b|attribution\b|thanks\b|acknowledg)/i;
const clean=s=>s.replace(/https?:\/\/github\.com\/([^\s/]+\/[^\s/]+)\/pull\/(\d+)/g,'$1#$2').replace(/[*`]/g,'').replace(/\s+/g,' ').trim();

// Source descriptions are evidence, not proof of priority or mathematical dependence.
export function extractIdeaLinks(body='',repo=ROOT,number=0){
 const found=new Map();let section='',lead='';
 for(const line of body.replace(/\r/g,'').split('\n')){
  if(/^\s*#{1,6}\s/.test(line)){section=line.replace(/^\s*#+\s*/,'');lead='';continue;}
  if(!line.trim()){lead='';continue;}
  const list=/^\s*[-*]\s/.test(line);
  const intro=list?lead:'';
  if(!list&&/:\s*$/.test(line))lead=line;
  for(const sentence of line.split(/(?<=[.!?])\s+(?=[A-Z*])|;\s+/)){
   const pattern=/https?:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/pull\/(\d+)|\bPRs?\s*#?\s*(\d+)\b|(?<![\w])#(\d+)\b/gi;
   for(const match of sentence.matchAll(pattern)){
    const targetRepo=match[1]||repo,n=Number(match[2]||match[3]||match[4]);
    if(targetRepo===repo&&n===number)continue;
    const before=sentence.slice(Math.max(0,match.index-100),match.index),after=sentence.slice(match.index+match[0].length,match.index+match[0].length+110);
    const local=before+match[0]+after;
    const negated=/\b(?:not|never|does not|do not|did not|without)\s+(?:actually\s+)?(?:use|reuse|build on|adopt|depend on)|independent of/i.test(local);
    const compared=/\b(?:above|below|ahead of|relative to|times|compared (?:with|to)|comparison (?:with|to)|versus|vs\.?|over)\s*(?:\*\*|the (?:latest|current)\s+|PR\s*)?$/i.test(before.replace(/[*`]/g,''))||/\bcompar(?:ison|ator|e[sd]?)\b/i.test(section)||/\b(?:improves?|improvement|stronger|weaker|reject(?:s|ed)?)\b/i.test(sentence)&&!reuse.test(sentence)&&!fromMethod.test(sentence);
    const credits=credit.test(clean(sentence))||/attribution|credits|acknowledg/i.test(section);
    const context=intro+' '+sentence;
    const action=/^\s*(?:\*\*)?\s*supplies\b/i.test(after)||reuse.test(context)||fromMethod.test(context)||scopeReuse.test(section)||/\b(?:This (?:PR |work |change |branch )?(?:uses?|fixes?|preserves?)|We use|Keeping (?:its|their)|unchanged.*(?:saving|construction|network))\b/i.test(context);
    let kind=negated||compared?'comparison':!credits&&action?'reuse':'citation';
    const id=`${targetRepo}#${n}`,candidate={repo:targetRepo,number:n,kind,evidence:clean((intro?intro+' ':'')+sentence),section:clean(section)};
    const rank={citation:0,comparison:1,reuse:2};
    if(!found.has(id)||rank[kind]>rank[found.get(id).kind])found.set(id,candidate);
   }
  }
 }
 return [...found.values()];
}

export function buildIdeaGraph(prs){
 const nodes=[...new Map(prs.map(p=>[p.id,p])).values()].sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt)||a.id.localeCompare(b.id));
 const byId=new Map(nodes.map(p=>[p.id,p])),edges=[],missing=[];
 for(const target of nodes)for(const relation of target.ideaLinks??extractIdeaLinks(target.body,target.repo,target.number)){
  const id=`${relation.repo}#${relation.number}`,source=byId.get(id);
  if(!source){missing.push({...relation,target:target.id});continue;}
  const chronological=Date.parse(source.createdAt)<Date.parse(target.createdAt);
  edges.push({id:`${source.id}->${target.id}`,source:source.id,target:target.id,kind:relation.kind,chronological,crossUser:source.author!==target.author,evidence:relation.evidence,section:relation.section});
 }
 return {nodes,edges,missing};
}

export function ancestors(id,edges){
 const visited=new Set([id]),queue=[id];
 while(queue.length){const next=queue.shift();for(const e of edges)if(e.kind==='reuse'&&e.chronological&&e.target===next&&!visited.has(e.source)){visited.add(e.source);queue.push(e.source);}}
 return visited;
}
