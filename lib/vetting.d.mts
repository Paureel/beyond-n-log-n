import type {Bound,Checkpoint,PR} from '../src/types';
export type Vetting='vetted'|'unreviewed'|'closed';
export function vetting(entry:PR|Checkpoint):Vetting;
export function counted(entry:PR|Checkpoint,unreviewed?:boolean):boolean;
export function frontierOf<T extends {bound:Bound;source:PR|Checkpoint}>(points:T[],unreviewed?:boolean):T[];
