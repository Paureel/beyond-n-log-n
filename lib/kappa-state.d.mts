import type {Research,MaintainerRecord} from '../src/types';
export interface KappaData {schemaVersion:number;revision:string;fetchedAt:string;maintainer:MaintainerRecord;warnings:string[];live?:boolean;refreshError?:string}
export function validKappa(data:unknown):data is KappaData;
export function mergeKappa(research:Research|null,kappa:KappaData|null):Research|null;
