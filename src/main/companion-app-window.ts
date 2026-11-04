import {readFileSync,writeFileSync,renameSync} from 'node:fs';
import {z} from 'zod';
import type {Area} from './overlay';
export const AppRect=z.object({x:z.number().int().min(-1000000).max(1000000),y:z.number().int().min(-1000000).max(1000000),width:z.number().int().positive().max(30000),height:z.number().int().positive().max(30000)}).strict();
const State=z.object({version:z.literal(1),mode:z.enum(['capsule','app']),bounds:AppRect.optional(),maximized:z.boolean().default(false)}).strict();
export function fitAppWindow(area:Area,bounds?:Area):Area{
 const width=Math.min(area.width,Math.max(320,bounds?.width??Math.round(Math.min(1280,area.width*.86)))),height=Math.min(area.height,Math.max(420,bounds?.height??Math.round(Math.min(900,area.height*.88))));
 return{width,height,x:Math.round(Math.max(area.x,Math.min(bounds?.x??area.x+(area.width-width)/2,area.x+area.width-width))),y:Math.round(Math.max(area.y,Math.min(bounds?.y??area.y+(area.height-height)/2,area.y+area.height-height)))};
}
/** Normal app geometry is independent of the capsule's dock position and old panel records. */
export class CompanionAppWindow{
 private state:z.infer<typeof State>={version:1,mode:'capsule',maximized:false};
 constructor(private path:string){try{this.state=State.parse(JSON.parse(readFileSync(path,'utf8')));}catch{}}
 get mode(){return this.state.mode;}
 get maximized(){return this.state.maximized;}
 get bounds(){return this.state.bounds?{...this.state.bounds}:undefined;}
 fit(displays:Area[],fallback:Area){const b=this.state.bounds,area=b?displays.find(a=>b.x<a.x+a.width&&b.x+b.width>a.x&&b.y<a.y+a.height&&b.y+b.height>a.y)??fallback:fallback;return fitAppWindow(area,b);}
 save(mode:'app'|'capsule',bounds?:Area,maximized=this.state.maximized){const next=State.parse({...this.state,mode,...(bounds?{bounds}:{}),maximized});try{writeFileSync(this.path+'.tmp',JSON.stringify(next));renameSync(this.path+'.tmp',this.path);this.state=next;return true;}catch{return false;}}
}
