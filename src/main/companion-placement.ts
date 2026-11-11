import type {Area} from '../shared/overlay-position';

/** Use the monitor's work area without changing the compact anchor. */
export function capsuleExtensionBounds(area:Area,base:Area):Area {
 return {...base,y:area.y,height:area.height};
}

/** Electron setShape accepts rectangles; merge equal scan lines instead of submitting hundreds. */
export function mergeShape(rows:Area[]):Area[]{const merged:Area[]=[];for(const row of rows){const last=merged.at(-1);if(last&&last.x===row.x&&last.width===row.width&&last.y+last.height===row.y)last.height+=row.height;else merged.push({...row});}return merged;}
export function overlaps(a:Area,b:Area){return Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)>0&&Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)>0;}
/** No show/focus side effects. User hide and an explicit invocation take priority. */
export class CapsuleVisibility{
 hidden=false;private override?:string;
 hide(){this.hidden=true;this.override=undefined;}
 invoke(foreground?:string){this.hidden=false;this.override=foreground;}
 visible(fullscreen:boolean,foreground?:string,keepOnTop=false){
  if(this.override!==foreground)this.override=undefined;
  return !this.hidden&&(keepOnTop||!fullscreen||!!foreground&&this.override===foreground);
 }
}
