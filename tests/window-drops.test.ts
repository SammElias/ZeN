import {EventEmitter} from 'node:events';
import {describe,it,expect,vi} from 'vitest';
import type {BrowserWindow} from 'electron';
vi.mock('node:child_process',()=>({spawn:vi.fn()}));
import {spawn} from 'node:child_process';
import {watchWindowDrops} from '../src/main/window-drops';
const window=(id:number,visible:boolean)=>Object.assign(new EventEmitter(),{visible,isDestroyed:()=>false,isVisible(){return this.visible;},isMinimized:()=>false,getNativeWindowHandle:()=>{const b=Buffer.alloc(8);b.writeBigUInt64LE(BigInt(id));return b;}});
describe('native window drag lifecycle',()=>{
 it('observes capsule and chat, accepts chat when capsule is hidden, and clears drag state on shutdown',()=>{
  const child=Object.assign(new EventEmitter(),{kill:vi.fn(),stdin:Object.assign(new EventEmitter(),{end:vi.fn()}),stdout:Object.assign(new EventEmitter(),{setEncoding:vi.fn()}),stderr:{resume:vi.fn()}});
  vi.mocked(spawn).mockReturnValue(child as never);
  const capsule=window(101,false),chat=window(202,true),event=vi.fn(),error=vi.fn();
  const watcher=watchWindowDrops([capsule,chat] as unknown as BrowserWindow[],'fixture',event,error);
  expect(JSON.parse(child.stdin.end.mock.calls[0][0])).toMatchObject({targets:['101','202'],pid:process.pid});
  child.stdout.emit('data','{"state":"moving","active":true}\n{"state":"hover","id":"303","pid":123,"name":"Fixture"}\n');
  expect(event).toHaveBeenCalledWith({state:'moving',active:true});expect(event).toHaveBeenCalledWith({state:'hover',id:'303',pid:123,name:'Fixture'});
  chat.visible=false;chat.emit('hide');expect(child.kill).toHaveBeenCalledTimes(1);expect(event).toHaveBeenLastCalledWith({state:'moving',active:false});
  watcher.dispose();expect(chat.listenerCount('show')).toBe(0);expect(capsule.listenerCount('hide')).toBe(0);expect(error).not.toHaveBeenCalled();
 });
});
