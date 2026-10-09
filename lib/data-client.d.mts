import type {PR,Research} from '../src/types';
export interface ClientStatus {refreshing:boolean;live:boolean;error:string}
export interface ResearchClient {start:()=>Promise<void>;refresh:()=>Promise<void>;subscribe:(listener:(state:{data:Research|null;status:ClientStatus})=>void)=>()=>void}
export function validResearch(data:unknown):data is Research;
export function createResearchClient(options?:{fetcher?:typeof fetch;storage?:()=>Storage|undefined}):ResearchClient;
export function createDescriptionClient(options?:{fetcher?:typeof fetch}):(pr:PR)=>Promise<string>;
