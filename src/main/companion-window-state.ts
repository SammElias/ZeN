import {readFileSync,writeFileSync,renameSync} from 'node:fs';
import {z} from 'zod';
import {fitPanel} from './companion-placement';
import type {Area} from './overlay';
const Rect=z.object({x:z.number().int().min(-1000000).max(1000000),y:z.number().int().min(-1000000).max(1000000),width:z.number().int().positive().max(100000),height:z.number().int().positive().max(100000)}).strict();
const Entry=z.object({key:z.enum(['workspace','notices']),displayId:z.number().int(),bounds:Rect,area:Rect,maximized:z.boolean()}).strict();
export type SavedWindow=z.infer<typeof Entry>;
export type WorkDisplay={id:number;workArea:Area};
export function restoreWindow(saved:SavedWindow|undefined,displays:WorkDisplay[],fallback:number){
 const d=displays.find(d=>d.id===saved?.displayId)??displays.find(d=>d.id===fallback)??displays[0];if(!d)throw Error('No hay monitor disponible.');
 let bounds:Area|undefined;
 if(saved){const b=saved.bounds,a=saved.area;if(saved.displayId===d.id)bounds={...b,x:d.workArea.x+b.x-a.x,y:d.workArea.y+b.y-a.y};else{const size=fitPanel(d.workArea,b),ratio=(p:number,origin:number,total:number,size:number)=>Math.max(0,Math.min(1,(p-origin)/Math.max(1,total-size)));bounds={...size,x:Math.round(d.workArea.x+ratio(b.x,a.x,a.width,b.width)*(d.workArea.width-size.width)),y:Math.round(d.workArea.y+ratio(b.y,a.y,a.height,b.height)*(d.workArea.height-size.height))};}}
 return{bounds:fitPanel(d.workArea,bounds),displayId:d.id,maximized:saved?.maximized??false};
}
/** Geometry only, outside the repository. No window content or renderer-provided paths. */
export class CompanionWindowState{
 private values=new Map<string,SavedWindow>();
 constructor(private file:string){try{const v=z.object({version:z.literal(1),windows:z.array(Entry).max(2)}).strict().parse(JSON.parse(readFileSync(file,'utf8')));for(const e of v.windows)this.values.set(e.key,e);}catch{/* Missing/invalid state uses visible defaults. */}}
 get(key:SavedWindow['key']){const v=this.values.get(key);return v?structuredClone(v):undefined;}
 save(value:SavedWindow){const e=Entry.parse(value);this.values.set(e.key,e);try{writeFileSync(this.file+'.tmp',JSON.stringify({version:1,windows:[...this.values.values()]}));renameSync(this.file+'.tmp',this.file);return true;}catch{return false;}}
 restore(key:SavedWindow['key'],displays:WorkDisplay[],fallback:number){return restoreWindow(this.get(key),displays,fallback);}
}
