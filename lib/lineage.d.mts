import type {PR} from '../src/types';
export type RelationKind='reuse'|'comparison'|'citation';
export interface IdeaLink {repo:string;number:number;kind:RelationKind;evidence:string;section:string}
export interface IdeaEdge {id:string;source:string;target:string;kind:RelationKind;chronological:boolean;crossUser:boolean;evidence:string;section:string}
export interface IdeaGraph {nodes:PR[];edges:IdeaEdge[];missing:(IdeaLink&{target:string})[]}
export function extractIdeaLinks(body?:string,repo?:string,number?:number):IdeaLink[];
export function buildIdeaGraph(prs:PR[]):IdeaGraph;
export function ancestors(id:string,edges:IdeaEdge[]):Set<string>;
