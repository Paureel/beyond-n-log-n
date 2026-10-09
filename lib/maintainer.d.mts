import type {PR,Checkpoint,ReviewedCheckpoint,MaintainerRecord,SelectionSource} from '../src/types';
export const SELECTED_RESULT_PATH:string;
export function upstreamTimeline(history?:Checkpoint[],maintainer?:MaintainerRecord|null):Checkpoint[];
export function reviewedPRResult(pr:PR,maintainer?:MaintainerRecord|null):ReviewedCheckpoint|null;
export function selectionSources(point?:Checkpoint|null):SelectionSource[];
export function selectionReference(point:Checkpoint):string;
