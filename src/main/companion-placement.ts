import type {Area} from './overlay';
import {CAPSULE_LAUNCHER_WIDTH} from '../shared/companion-workspace';
/** Extend only to the right, shifting left if the work area has no room. */
export function capsuleLauncherBounds(area:Area,base:Area):Area{
 const width=Math.min(area.width,base.width+CAPSULE_LAUNCHER_WIDTH);
 return {...base,width,x:Math.max(area.x,Math.min(base.x,area.x+area.width-width))};
}
export type Placement={displayId:number;edge:'top'|'left'|'right';horizontalRatio:number;verticalRatio:number};
/** One capsule grows down from its header. Move up only when there is no legible room below. */
export function capsuleExtensionBounds(area:Area,base:Area):Area{
 const below=area.y+area.height-base.y,minHeight=Math.min(420,area.height),height=Math.min(680,below>=minHeight?below:area.height);
 return{...base,height:Math.max(base.height,height),y:below>=minHeight?base.y:Math.max(area.y,area.y+area.height-height)};
}
/** Electron setShape accepts rectangles; merge equal scan lines instead of submitting hundreds. */
export function mergeShape(rows:Area[]):Area[]{const merged:Area[]=[];for(const row of rows){const last=merged.at(-1);if(last&&last.x===row.x&&last.width===row.width&&last.y+last.height===row.y)last.height+=row.height;else merged.push({...row});}return merged;}
export function fitPanel(area:Area,bounds?:Area):Area{
 const width=Math.min(Math.max(360,bounds?.width??600),area.width),height=Math.min(Math.max(420,bounds?.height??680),area.height);
 return{width,height,x:Math.round(Math.max(area.x,Math.min(bounds?.x??area.x+area.width-width-16,area.x+area.width-width))),y:Math.round(Math.max(area.y,Math.min(bounds?.y??area.y+24,area.y+area.height-height)))};
}
export function overlaps(a:Area,b:Area){return Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)>0&&Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)>0;}
/** No show/focus side effects. User hide and an explicit invocation take priority. */
export class CapsuleVisibility{
 hidden=false;private override?:string;
 hide(){this.hidden=true;this.override=undefined;}
 invoke(foreground?:string){this.hidden=false;this.override=foreground;}
 visible(fullscreen:boolean,foreground?:string){if(this.override!==foreground)this.override=undefined;return!this.hidden&&(!fullscreen||!!foreground&&this.override===foreground);}
}
