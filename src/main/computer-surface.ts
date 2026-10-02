import {createHash} from 'node:crypto';
import type {ComputerFrame,ComputerSurface} from '../agent/computer';
import {actionReview,computerActions,computerEffect,type ComputerAction} from '../shared/computer';
import type {WindowInfo} from '../tools/windows/native';
import {ZenError} from '../shared/errors';
import {underlyingPoint} from './screen-context';
import type {DockEdge} from '../shared/contracts';
export type FrameCapture={image:string;width:number;height:number;bounds:{x:number;y:number;width:number;height:number}};
type Deps={windows:(signal:AbortSignal)=>Promise<WindowInfo[]>;anchor:()=>string;edge?:()=>DockEdge;ownerPid:number;blocked:(row:WindowInfo)=>boolean;capture:(target:WindowInfo,signal:AbortSignal,initial:boolean)=>Promise<FrameCapture>;action:(target:WindowInfo,action:ComputerAction,bounds:FrameCapture['bounds'],signal:AbortSignal)=>Promise<void>;serial:<T>(signal:AbortSignal,operation:()=>Promise<T>)=>Promise<T>};
export function selectComputerWindow(request:string,rows:WindowInfo[],anchorId:string,ownerPid:number,blocked:(row:WindowInfo)=>boolean,edge:DockEdge='top'){
  const candidates=rows.filter(row=>row.pid!==ownerPid&&!blocked(row));
  const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const words=normalize(request).match(/\b(?:dataverse|powerapps|powerautomate|chrome|edge|firefox|excel|notepad|bloc de notas)\b/g)??[];
  const named=words.length?candidates.filter(row=>words.some(word=>normalize(`${row.title} ${row.processName??''}`).includes(word))):[];
  if(named.length===1)return named[0];
  if(named.length>1){const foreground=named.find(row=>row.foreground);if(foreground)return foreground;throw new ZenError('Hay varias ventanas de esa aplicación. Activa la que quieres controlar y vuelve a pedir la tarea.');}
  const foreground=candidates.find(row=>row.foreground);if(foreground)return foreground;
  const anchor=rows.find(row=>row.id===anchorId);
  const point=anchor?.bounds?underlyingPoint(anchor.bounds,edge):undefined;
  const below=point?candidates.find(row=>row.bounds&&row.bounds.x<=point.x&&row.bounds.x+row.bounds.width>point.x&&row.bounds.y<=point.y&&row.bounds.y+row.bounds.height>point.y):undefined;
  if(below)return below;if(candidates.length===1)return candidates[0];throw new ZenError('Activa la aplicación que quieres controlar y pide la tarea desde ZEN.');
}
export class WindowsComputerSurface implements ComputerSurface{
  private target?:WindowInfo;private last?:ComputerFrame;private capture?:FrameCapture;private closed=false;private request='';
  private attempted=new Set<string>();
  constructor(private deps:Deps){}
  private async current(signal:AbortSignal,initial=false){
    signal.throwIfAborted();if(this.closed||!this.target)throw new ZenError('El control visual está cerrado.');
    const rows=await this.deps.windows(signal),target=rows.find(row=>row.id===this.target!.id);
    if(!target||target.pid!==this.target.pid||this.deps.blocked(target))throw new ZenError('La ventana seleccionada cambió, se cerró o está excluida.');
    const foreground=rows.find(row=>row.foreground);if(!initial&&foreground&&foreground.pid!==this.deps.ownerPid&&foreground.id!==target.id)throw new ZenError('Cambiaste de aplicación. Control detenido para no actuar en otra ventana.');
    const capture=await this.deps.capture(target,signal,initial);signal.throwIfAborted();this.target=target;this.capture=capture;
    return this.last={image:capture.image,width:capture.width,height:capture.height,target:{id:target.id,pid:target.pid,title:target.title},capturedAt:Date.now()};
  }
  async start(request:string,signal:AbortSignal){this.request=request;return this.deps.serial(signal,async()=>{this.target=selectComputerWindow(request,await this.deps.windows(signal),this.deps.anchor(),this.deps.ownerPid,this.deps.blocked,this.deps.edge?.());return this.current(signal,true);});}
  async act(raw:ComputerAction[],frame:ComputerFrame,signal:AbortSignal,review:(label:string,signature:string)=>Promise<void>,safety?:string){
    if(frame!==this.last)throw new ZenError('La acción no corresponde a la captura vigente.');
    const originalBounds=this.capture?.bounds;
    const actions=computerActions(raw,frame.width,frame.height),signature=JSON.stringify({request:this.request,target:frame.target,bounds:originalBounds,imageHash:createHash('sha256').update(frame.image).digest('hex'),actions,safety});
    if(this.attempted.has(signature))throw new ZenError('Bloque visual ya intentado; no se repite automáticamente.');
    const effect=actions.some(computerEffect)||!!safety;
    if(effect)await review(`En «${frame.target.title}», para: ${this.request}\n${actionReview(actions)}${safety?`\nAviso: ${safety}`:''}`,signature);
    signal.throwIfAborted();
    return this.deps.serial(signal,async()=>{
      const before=await this.current(signal);const same=before.image===frame.image&&before.width===frame.width&&before.height===frame.height&&JSON.stringify(originalBounds)===JSON.stringify(this.capture?.bounds);
      // A stale approval is never applied to changed pixels or a moved window.
      if(effect&&!same)return{frame:before,executed:false};
      this.attempted.add(signature);
      for(const action of actions){signal.throwIfAborted();if(action.type==='wait'){await new Promise<void>((resolve,reject)=>{const stop=()=>{clearTimeout(timer);reject(signal.reason);};const timer=setTimeout(()=>{signal.removeEventListener('abort',stop);resolve();},300);signal.addEventListener('abort',stop,{once:true});});}else if(action.type!=='screenshot'){
        const bounds=this.capture!.bounds,scale=(p:{x:number;y:number})=>({x:Math.min(bounds.width-1,Math.floor(p.x*bounds.width/frame.width)),y:Math.min(bounds.height-1,Math.floor(p.y*bounds.height/frame.height))});
        const physical='x'in action?{...action,...scale(action)}:action.type==='drag'?{...action,path:action.path.map(scale)}:action;
        await this.deps.action(this.target!,physical,bounds,signal);signal.throwIfAborted();
      }}
      return{frame:await this.current(signal),executed:true};
    });
  }
  close(){this.closed=true;this.last=undefined;this.capture=undefined;this.target=undefined;this.attempted.clear();}
}
