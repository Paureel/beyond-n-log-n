import {createHash} from 'node:crypto';
import {extractIdeaLinks} from './lineage.mjs';

const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function descriptionVersion(pr){return hash([pr.headSha,pr.updatedAt,pr.body??'']);}
export function compactResearch(data){
 const {readme,...repository}=data.repository??{};
 const projectPR=({body,...pr})=>({...pr,descriptionVersion:descriptionVersion({...pr,body}),ideaLinks:extractIdeaLinks(body,pr.repo,pr.number)});
 const compact={...data,payloadVersion:1,repository,prs:(data.prs??[]).map(projectPR),forks:(data.forks??[]).map(({readme,detailsFetchedAt,prs,...fork})=>({...fork,prs:prs.map(projectPR)}))};
 // Collection timestamps and quota counters change even when the research does not.
 const {fetchedAt,live,refreshError,revision,...content}=compact;
 const {apiRemaining,...coverage}=content.coverage??{};
 return {...compact,revision:hash({...content,coverage})};
}
export function matchesETag(header,etag){
 const weak=value=>value.trim().replace(/^W\//,'');
 return !!header&&header.split(',').some(value=>value.trim()==='*'||weak(value)===weak(etag));
}
