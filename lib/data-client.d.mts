import type {PR,Research} from '../src/types';
import type {KappaData} from './kappa-state.mjs';
export interface ClientStatus {refreshing:boolean;live:boolean;error:string}
export interface ResearchClient {start:()=>Promise<void>;refresh:()=>Promise<void>;subscribe:(listener:(state:{data:Research|null;status:ClientStatus})=>void)=>()=>void}
export function validResearch(data:unknown):data is Research;
export function createResearchClient(options?:{fetcher?:typeof fetch;storage?:()=>Storage|undefined}):ResearchClient;
export function createKappaClient(options?:{fetcher?:typeof fetch;storage?:()=>Storage|undefined}):Omit<ResearchClient,'subscribe'>&{subscribe:(listener:(state:{data:KappaData|null;status:ClientStatus})=>void)=>()=>void};
export function createDescriptionClient(options?:{fetcher?:typeof fetch}):(pr:PR)=>Promise<string>;
