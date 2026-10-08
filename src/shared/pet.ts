import {z} from 'zod';
import type {TaskEvent} from './contracts';
import type {Area} from '../main/overlay';
export const PetPositionSchema=z.object({displayId:z.number().int(),xRatio:z.number().min(0).max(1),yRatio:z.number().min(0).max(1)}).strict();
export type PetPosition=z.infer<typeof PetPositionSchema>;
export type PetSurface='none'|'bubble'|'menu'|'fan';
export type PetGeometry={bounds:Area;avatar:Area;surface:Area;actions?:Area[]};
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
export function petGeometry(area:Area,position:Pick<PetPosition,'xRatio'|'yRatio'>,size:number,kind:PetSurface='none'):PetGeometry{
  size=Math.min(clamp(size,72,128),area.width,area.height);
  const ax=area.x+Math.round((area.width-size)*clamp(position.xRatio,0,1)),ay=area.y+Math.round((area.height-size)*clamp(position.yRatio,0,1));
  if(kind==='fan'){
    // Try arcs pointing into the available desktop. Transparent gaps never become hit targets.
    for(const rotation of [0,180,90,270]){
      const buttons=[-165,-115,-65,-15].map(angle=>{const a=(angle+rotation)*Math.PI/180;return{x:Math.round(ax+size/2+Math.cos(a)*120-32),y:Math.round(ay+size/2+Math.sin(a)*120-26),width:64,height:52};});
      const inside=(r:Area)=>r.x>=area.x&&r.y>=area.y&&r.x+r.width<=area.x+area.width&&r.y+r.height<=area.y+area.height;
      if(!buttons.every(inside))continue;
      const rects=[{x:ax,y:ay,width:size,height:size},...buttons],x=Math.min(...rects.map(r=>r.x)),y=Math.min(...rects.map(r=>r.y));
      return{bounds:{x,y,width:Math.max(...rects.map(r=>r.x+r.width))-x,height:Math.max(...rects.map(r=>r.y+r.height))-y},avatar:{x:ax-x,y:ay-y,width:size,height:size},surface:{x:0,y:0,width:0,height:0},actions:buttons.map(r=>({...r,x:r.x-x,y:r.y-y}))};
    }
  }
  const width=Math.min(300,area.width),height=Math.min(390,area.height);
  const x=clamp(ax-(width-size)/2,area.x,area.x+area.width-width),y=clamp(ay-252,area.y,area.y+area.height-height);
  const avatar={x:Math.round(ax-x),y:Math.round(ay-y),width:size,height:size};
  const sw=Math.min(kind==='menu'||kind==='fan'?240:280,width),sh=Math.min(kind==='menu'?300:kind==='fan'?160:84,height);
  const surface={x:Math.round(clamp(avatar.x+size/2-sw/2,0,width-sw)),y:Math.round(avatar.y>=sh+8?avatar.y-sh-8:clamp(avatar.y+size+8,0,height-sh)),width:sw,height:sh};
  return{bounds:{x:Math.round(x),y:Math.round(y),width,height},avatar,surface};
}
export function petPositionAt(area:Area,x:number,y:number,size:number){return{xRatio:clamp((x-area.x)/Math.max(1,area.width-size),0,1),yRatio:clamp((y-area.y)/Math.max(1,area.height-size),0,1)};}
export function petShape(geometry:PetGeometry,kind:PetSurface):Area[]{
  const a=geometry.avatar,rects:Area[]=[];
  // A visible circular halo is the input target. Its transparent corners pass through.
  for(let y=0;y<a.height;y+=2){const mid=(y+1-a.height/2)/(a.height/2),half=Math.sqrt(Math.max(0,1-mid*mid))*a.width/2;rects.push({x:Math.floor(a.x+a.width/2-half),y:a.y+y,width:Math.max(1,Math.ceil(half*2)),height:Math.min(2,a.height-y)});}
  if(kind!=='none')for(const r of geometry.actions??[geometry.surface]){for(let y=0;y<r.height;y+=2){const d=Math.max(0,12-Math.min(y+1,r.height-y-1)),inset=d?12-Math.sqrt(144-d*d):0;rects.push({x:Math.ceil(r.x+inset),y:r.y+y,width:Math.max(1,Math.floor(r.width-2*inset)),height:Math.min(2,r.height-y)});}}
  return rects;
}
export function effectiveMotion(choice:'system'|'reduced'|'normal'|'expressive',systemReduced:boolean,animations=true){return !animations||choice==='reduced'||choice==='system'&&systemReduced?'reduced':choice==='expressive'?'expressive':'normal';}
export function nearbyGaze(point:{x:number;y:number}|null,box:Area,radius=240){if(!point)return false;return Math.hypot(point.x-box.x-box.width/2,point.y-box.y-box.height/2)<=radius;}
export function explicitThanks(text:string){return /^(?:muchas\s+)?gracias(?:\s+zen)?[!.\s]*$/iu.test(text.trim());}
export class CompletionGestures {
  private states=new Map<string,TaskEvent['state']>();
  private active?:string;
  hydrate(events:TaskEvent[]){for(const e of events)this.states.set(e.id,e.state);}
  start(id:string){this.active=id;this.states.set(id,'queued');}
  accept(event:TaskEvent){
    if(['voice','storage','control'].includes(event.id)||event.streamText!==undefined||event.utterance)return false;
    if(event.requestId&&this.active===event.requestId){this.active=event.id;this.states.set(event.id,this.states.get(event.requestId)??'queued');this.states.delete(event.requestId);}
    const previous=this.states.get(event.id);if(previous&&['completed','failed','cancelled'].includes(previous))return false;
    this.states.set(event.id,event.state);if(this.states.size>100)this.states.delete(this.states.keys().next().value!);
    if(['queued','thinking','executing'].includes(event.state)&&!this.active)this.active=event.id;
    const celebrate=this.active===event.id&&!!previous&&['queued','thinking','executing','awaiting_approval'].includes(previous)&&event.state==='completed'&&event.workContext?.phase!=='external';
    if(this.active===event.id&&['completed','failed','cancelled','awaiting_input'].includes(event.state))this.active=undefined;
    return celebrate;
  }
}
