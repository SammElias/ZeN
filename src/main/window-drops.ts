import {spawn,type ChildProcessWithoutNullStreams} from 'node:child_process';
import {join} from 'node:path';
import {z} from 'zod';
import type {BrowserWindow} from 'electron';
const Event=z.union([z.object({state:z.enum(['hover','leave','drop']),id:z.string().regex(/^\d+$/).max(24),pid:z.number().int().positive(),name:z.string().max(256)}),z.object({state:z.literal('foreground'),fullscreen:z.boolean()}),z.object({state:z.literal('moving'),active:z.boolean()})]);
export type NativeWindowDrop=z.infer<typeof Event>;
export function watchWindowDrops(target:BrowserWindow|BrowserWindow[],directory:string,onEvent:(value:NativeWindowDrop)=>void,onError:()=>void){
  const windows=Array.isArray(target)?target:[target],window=windows[0];
  let child:ChildProcessWithoutNullStreams|undefined,disposed=false;
  const stop=()=>{const previous=child;child=undefined;previous?.kill();onEvent({state:'moving',active:false});};
  const visible=()=>windows.some(w=>!w.isDestroyed()&&w.isVisible()&&!w.isMinimized());
  const visibility=()=>{if(visible())start();else stop();};
  const start=()=>{
    if(disposed||child||window.isDestroyed()||!visible())return;
    const process=spawn(join(directory,'Zen.Windows.exe'),[],{windowsHide:true,stdio:['pipe','pipe','pipe']});child=process;
    const handle=window.getNativeWindowHandle();const id=handle.length===8?handle.readBigUInt64LE().toString():String(handle.readUInt32LE());
    process.stdout.setEncoding('utf8');
    const targets=windows.filter(w=>!w.isDestroyed()).map(w=>{const h=w.getNativeWindowHandle();return h.length===8?h.readBigUInt64LE().toString():String(h.readUInt32LE());});
    process.stdin.end(JSON.stringify({command:'watch-window-drops',id,targets,pid:global.process.pid})+'\n');process.stdin.on('error',()=>{});process.stderr.resume();let buffer='';
    const failed=()=>{if(child!==process)return;child=undefined;process.kill();onEvent({state:'moving',active:false});onError();};
    process.stdout.on('data',chunk=>{if(child!==process)return;buffer+=chunk.toString('utf8');if(buffer.length>16000)return failed();let end;while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+1);try{const parsed=Event.safeParse(JSON.parse(line));if(parsed.success)onEvent(parsed.data);else if(JSON.parse(line).ok===false)failed();}catch{failed();}}});
    process.on('error',failed);process.on('exit',()=>{if(child===process)failed();});
  };
  for(const w of windows){w.on('show',visibility);w.on('restore',visibility);w.on('hide',visibility);w.on('minimize',visibility);}start();
  return{dispose(){disposed=true;stop();for(const w of windows){w.removeListener('show',visibility);w.removeListener('restore',visibility);w.removeListener('hide',visibility);w.removeListener('minimize',visibility);}}};
}
