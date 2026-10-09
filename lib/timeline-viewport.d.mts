export interface Viewport {x:number;y:number;width:number;height:number}
export const MAX_ZOOM:number;
export const FULL_VIEW:Readonly<Viewport>;
export function zoomViewport(view:Viewport,factor:number,anchorX?:number,anchorY?:number):Viewport;
export function panViewport(view:Viewport,deltaX:number,deltaY:number):Viewport;
