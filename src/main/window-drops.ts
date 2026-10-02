import {spawn,type ChildProcessWithoutNullStreams} from 'node:child_process';
import {join} from 'node:path';
import {z} from 'zod';
import type {BrowserWindow} from 'electron';
const Event=z.object({state:z.enum(['hover','leave','drop']),id:z.string().regex(/^\d+$/).max(24),pid:z.number().int().positive(),name:z.string().max(256)});
export type NativeWindowDrop=z.infer<typeof Event>;
export function watchWindowDrops(window:BrowserWindow,directory:string,onEvent:(value:NativeWindowDrop)=>void,onError:()=>void){
  let child:ChildProcessWithoutNullStreams|undefined,disposed=false;
  const stop=()=>{const previous=child;child=undefined;previous?.kill();};
  const start=()=>{
    if(disposed||child||window.isDestroyed()||!window.isVisible()||window.isMinimized())return;
    const process=spawn(join(directory,'Zen.Windows.exe'),[],{windowsHide:true,stdio:['pipe','pipe','pipe']});child=process;
    const handle=window.getNativeWindowHandle();const id=handle.length===8?handle.readBigUInt64LE().toString():String(handle.readUInt32LE());
    process.stdout.setEncoding('utf8');
    process.stdin.end(JSON.stringify({command:'watch-window-drops',id,pid:global.process.pid})+'\n');process.stdin.on('error',()=>{});process.stderr.resume();let buffer='';
    const failed=()=>{if(child!==process)return;child=undefined;process.kill();onError();};
    process.stdout.on('data',chunk=>{if(child!==process)return;buffer+=chunk.toString('utf8');if(buffer.length>16000)return failed();let end;while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+1);try{const parsed=Event.safeParse(JSON.parse(line));if(parsed.success)onEvent(parsed.data);else if(JSON.parse(line).ok===false)failed();}catch{failed();}}});
    process.on('error',failed);process.on('exit',()=>{if(child===process)failed();});
  };
  window.on('show',start);window.on('restore',start);window.on('hide',stop);window.on('minimize',stop);start();
  return{dispose(){disposed=true;stop();window.removeListener('show',start);window.removeListener('restore',start);window.removeListener('hide',stop);window.removeListener('minimize',stop);}};
}
