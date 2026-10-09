export type TimelineBase=2|10;
export function superscript(value:number):string;
export function logValue(value:number,base:TimelineBase):number;
export function logDomain(low:number,high:number,base:TimelineBase,recent?:boolean):{min:number;max:number};
export function formatKappa(value:number,base:TimelineBase,digits?:number):string;
