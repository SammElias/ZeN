import { randomUUID } from 'node:crypto';
import type { WindowInfo } from '../tools/windows/native';

export type ScreenSnapshot = { id:string; image:string; capturedAt:number; sourceTitle?:string };
export type ScreenContextStatus = { state:'capturing'|'ready'|'queued'|'unavailable'|'expired'|'idle'; capturedAt?:number;sourceTitle?:string };
type Deps = {
  windows:(signal:AbortSignal)=>Promise<WindowInfo[]>;
  capture:(id:string,signal:AbortSignal)=>Promise<string>;
  own:(window:WindowInfo)=>boolean;
  anchorId?:()=>string;
  blocked:(window:WindowInfo)=>boolean;
  status:(status:ScreenContextStatus)=>void;
  now?:()=>number;
  ttlMs?:number;
  timeoutMs?:number;
};
// One reference image per human invocation, only in main memory. No capture loop.
export class ScreenContext {
  private generation=0;
  private controller?:AbortController;
  private snapshot?:ScreenSnapshot;
  private expiry?:ReturnType<typeof setTimeout>;
  private pending?:Promise<ScreenSnapshot|undefined>;
  constructor(private deps:Deps){}
  private now(){return this.deps.now?.()??Date.now();}
  current(){
    if(this.snapshot&&this.now()-this.snapshot.capturedAt<(this.deps.ttlMs??120000))return this.snapshot;
    if(this.snapshot){this.snapshot=undefined;this.deps.status({state:'expired'});}
    return undefined;
  }
  queued(id:string){if(this.current()?.id===id)this.deps.status({state:'queued',capturedAt:this.snapshot!.capturedAt,sourceTitle:this.snapshot!.sourceTitle});}
  cancel(){++this.generation;this.controller?.abort();this.controller=undefined;this.pending=undefined;this.snapshot=undefined;clearTimeout(this.expiry);this.deps.status({state:'idle'});}
  ensure(){return this.pending??(this.current()?Promise.resolve(this.current()):this.refresh());}
  refresh(){
    this.cancel();const generation=this.generation;const controller=new AbortController();this.controller=controller;
    this.deps.status({state:'capturing'});
    const timer=setTimeout(()=>controller.abort(),this.deps.timeoutMs??5000);timer.unref?.();
    const pending=(async()=>{
      try{
        const rows=await this.deps.windows(controller.signal);controller.signal.throwIfAborted();
        const anchorId=this.deps.anchorId?.();
        const anchor=anchorId?rows.find(row=>row.id===anchorId):undefined;
        const foreground=rows.find(row=>row.foreground);
        // Both rectangles come from native Windows in physical pixels, avoiding
        // DPI conversions. Select the topmost external window beneath ZEN's
        // horizontal centre, even when foreground focus is on another monitor.
        const point=anchor?.bounds?{x:anchor.bounds.x+anchor.bounds.width/2,y:anchor.bounds.y+anchor.bounds.height+1}:undefined;
        const below=(row:WindowInfo)=>!!point&&!!row.bounds&&point.x>=row.bounds.x&&point.x<row.bounds.x+row.bounds.width&&point.y>=row.bounds.y&&point.y<row.bounds.y+row.bounds.height;
        const selected=anchorId?rows.find(row=>!this.deps.own(row)&&below(row)):
          foreground&&!this.deps.own(foreground)?foreground:rows.find(row=>!this.deps.own(row));
        if(!selected||this.deps.own(selected)||this.deps.blocked(selected))throw new Error('No eligible window');
        const image=await this.deps.capture(selected.id,controller.signal);controller.signal.throwIfAborted();
        const afterRows=await this.deps.windows(controller.signal);const after=afterRows.find(row=>row.id===selected.id);
        controller.signal.throwIfAborted();
        if(!after||after.pid!==selected.pid||after.title!==selected.title||this.deps.blocked(after))throw new Error('Window changed');
        if(anchorId){const latest=afterRows.find(row=>row.id===anchorId);if(!latest?.bounds)throw new Error('Anchor unavailable');const x=latest.bounds.x+latest.bounds.width/2,y=latest.bounds.y+latest.bounds.height+1;const underneath=afterRows.find(row=>!this.deps.own(row)&&row.bounds&&x>=row.bounds.x&&x<row.bounds.x+row.bounds.width&&y>=row.bounds.y&&y<row.bounds.y+row.bounds.height);if(underneath?.id!==selected.id)throw new Error('Underlying window changed');}
        if(!/^data:image\/(?:jpeg|png);base64,[A-Za-z0-9+/]+=*$/.test(image)||image.length>3000000)throw new Error('Invalid image');
        if(generation!==this.generation)return;
        this.snapshot={id:randomUUID(),image,capturedAt:this.now(),sourceTitle:selected.title};this.deps.status({state:'ready',capturedAt:this.snapshot.capturedAt,sourceTitle:selected.title});
        this.expiry=setTimeout(()=>{if(generation===this.generation){this.snapshot=undefined;this.deps.status({state:'expired'});}},this.deps.ttlMs??120000);this.expiry.unref?.();
        return this.snapshot;
      }catch{if(generation===this.generation)this.deps.status({state:'unavailable'});return undefined;}
      finally{clearTimeout(timer);if(generation===this.generation){this.controller=undefined;this.pending=undefined;}}
    })();this.pending=pending;return pending;
  }
}
