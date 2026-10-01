import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScreenContext } from '../src/main/screen-context';
const image='data:image/jpeg;base64,ZmFrZQ==';
const external={id:'12',pid:100,title:'Fixture',foreground:true};
const zen={id:'99',pid:200,title:'ZEN',foreground:true};
const deferred=<T>()=>{let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>resolve=r);return{promise,resolve};};
function fixture(){const status=vi.fn(),capture=vi.fn().mockResolvedValue(image),windows=vi.fn().mockResolvedValue([external]);const context=new ScreenContext({windows,capture,own:row=>row.pid===200,blocked:row=>/password/i.test(row.title),status,ttlMs:50});return{context,status,capture,windows};}
afterEach(()=>vi.useRealTimers());
describe('automatic invocation context',()=>{
  it('does nothing at startup; captures once per invocation and renews its identity',async()=>{
    const f=fixture();expect(f.capture).not.toHaveBeenCalled();const first=await f.context.refresh();expect(first?.image).toBe(image);expect(f.capture).toHaveBeenCalledWith('12',expect.any(AbortSignal));
    expect(await f.context.ensure()).toBe(first);expect(f.capture).toHaveBeenCalledOnce();const second=await f.context.refresh();expect(second?.id).not.toBe(first?.id);expect(f.capture).toHaveBeenCalledTimes(2);f.context.cancel();
  });
  it('uses the foremost external window when a click has focused ZEN, not another monitor',async()=>{
    const f=fixture();f.windows.mockResolvedValue([zen,{...external,foreground:false}]);expect((await f.context.refresh())?.image).toBe(image);f.context.cancel();
  });
  it('does not skip an excluded foreground window to capture a different app',async()=>{
    const f=fixture();f.windows.mockResolvedValue([{...external,title:'Password manager'},{...external,id:'44',foreground:false}]);expect(await f.context.refresh()).toBeUndefined();expect(f.capture).not.toHaveBeenCalled();expect(f.status).toHaveBeenLastCalledWith({state:'unavailable'});
  });
  it('captures the window beneath the capsule instead of foreground on another monitor',async()=>{
    const f=fixture();const anchor={...zen,bounds:{x:2000,y:0,width:640,height:48}};
    const behind={...external,id:'44',title:'Trading fixture',foreground:false,bounds:{x:1920,y:0,width:1920,height:1080}};
    f.windows.mockResolvedValue([{...external,bounds:{x:0,y:0,width:1920,height:1080}},anchor,behind]);
    const context=new ScreenContext({windows:f.windows,capture:f.capture,own:row=>row.pid===200,anchorId:()=>zen.id,blocked:()=>false,status:f.status});
    expect((await context.refresh())?.sourceTitle).toBe('Trading fixture');expect(f.capture).toHaveBeenCalledWith('44',expect.any(AbortSignal));context.cancel();
  });
  it('handles negative native coordinates and two windows side by side without DPI conversion',async()=>{
    const f=fixture();const anchor={...zen,bounds:{x:-1800,y:-100,width:640,height:210}};
    const behind={...external,id:'44',foreground:false,bounds:{x:-1920,y:-100,width:960,height:1080}};
    f.windows.mockResolvedValue([{...external,bounds:{x:-960,y:-100,width:960,height:1080}},anchor,behind]);
    const context=new ScreenContext({windows:f.windows,capture:f.capture,own:row=>row.pid===200,anchorId:()=>zen.id,blocked:()=>false,status:f.status});
    expect(await context.refresh()).toBeDefined();expect(f.capture).toHaveBeenCalledWith('44',expect.any(AbortSignal));context.cancel();
  });
  it('fails closed if capsule coordinates are unavailable or the underlying window is excluded',async()=>{
    const f=fixture();const context=new ScreenContext({windows:f.windows,capture:f.capture,own:row=>row.pid===200,anchorId:()=>zen.id,blocked:row=>/password/i.test(row.title),status:f.status});
    expect(await context.refresh()).toBeUndefined();expect(f.capture).not.toHaveBeenCalled();
    f.windows.mockResolvedValue([{...zen,bounds:{x:100,y:0,width:640,height:48}},{...external,title:'Password',bounds:{x:0,y:0,width:1920,height:1080}}]);
    expect(await context.refresh()).toBeUndefined();expect(f.capture).not.toHaveBeenCalled();context.cancel();
  });
  it('rejects a capture when the capsule moves or another window covers the target mid-capture',async()=>{
    const f=fixture();const anchor={...zen,bounds:{x:100,y:0,width:640,height:48}},behind={...external,bounds:{x:0,y:0,width:1920,height:1080}};
    f.windows.mockResolvedValueOnce([anchor,behind]).mockResolvedValueOnce([{...anchor,bounds:{...anchor.bounds,x:2000}},behind]);
    const context=new ScreenContext({windows:f.windows,capture:f.capture,own:row=>row.pid===200,anchorId:()=>zen.id,blocked:()=>false,status:f.status});
    expect(await context.refresh()).toBeUndefined();expect(context.current()).toBeUndefined();context.cancel();
    f.windows.mockResolvedValueOnce([anchor,behind]).mockResolvedValueOnce([anchor,{...behind,id:'777',title:'Other'},behind]);
    expect(await context.refresh()).toBeUndefined();context.cancel();
  });
  it('keeps a valid capture when expanding the capsule still covers the same external window',async()=>{
    const f=fixture();const anchor={...zen,bounds:{x:400,y:0,width:640,height:48}},behind={...external,bounds:{x:0,y:0,width:1920,height:1080}};
    f.windows.mockResolvedValueOnce([anchor,behind]).mockResolvedValueOnce([{...anchor,bounds:{x:160,y:0,width:1120,height:210}},behind]);
    const context=new ScreenContext({windows:f.windows,capture:f.capture,own:row=>row.pid===200,anchorId:()=>zen.id,blocked:()=>false,status:f.status});expect(await context.refresh()).toBeDefined();context.cancel();
  });
  it('discards recycled handles or changed titles before any upload',async()=>{
    const f=fixture();f.windows.mockResolvedValueOnce([external]).mockResolvedValueOnce([{...external,pid:999}]);expect(await f.context.refresh()).toBeUndefined();expect(f.context.current()).toBeUndefined();
  });
  it('deduplicates pending ensure and discards late captures after Stop',async()=>{
    const f=fixture(),pending=deferred<string>();f.capture.mockReturnValue(pending.promise);const run=f.context.refresh();expect(f.context.ensure()).toBe(run);await Promise.resolve();f.context.cancel();pending.resolve(image);await run;expect(f.context.current()).toBeUndefined();expect(f.status).toHaveBeenLastCalledWith({state:'idle'});
  });
  it('a newer invocation wins even if an old native operation returns later',async()=>{
    const f=fixture(),old=deferred<string>();f.capture.mockReturnValueOnce(old.promise);const first=f.context.refresh();await Promise.resolve();const second=await f.context.refresh();old.resolve(image);await first;expect(f.context.current()).toBe(second);f.context.cancel();
  });
  it('expires the reference without recapturing and exposes only metadata',async()=>{
    vi.useFakeTimers();const f=fixture();const snapshot=await f.context.refresh();f.context.queued(snapshot!.id);await vi.advanceTimersByTimeAsync(51);expect(f.context.current()).toBeUndefined();expect(f.capture).toHaveBeenCalledOnce();expect(f.status).toHaveBeenLastCalledWith({state:'expired'});expect(JSON.stringify(f.status.mock.calls)).not.toContain(image);f.context.cancel();
  });
  it('aborts a slow native capture and does not retain invalid image data',async()=>{
    vi.useFakeTimers();const f=fixture();f.capture.mockImplementation((_id,signal)=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('abort')))));const run=f.context.refresh();await vi.advanceTimersByTimeAsync(5001);expect(await run).toBeUndefined();expect(f.status).toHaveBeenLastCalledWith({state:'unavailable'});
  });
});
