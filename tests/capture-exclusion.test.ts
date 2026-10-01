import {describe,it,expect,vi} from 'vitest';
import {CaptureExclusion} from '../src/main/capture-exclusion';
const deferred=()=>{let resolve!:(value:string)=>void;const promise=new Promise<string>(r=>resolve=r);return{promise,resolve};};
describe('own capsule capture exclusion',()=>{
  it('does not re-include the capsule while another capture is pending, even after cancellation',async()=>{
    const window={isDestroyed:()=>false,isContentProtected:()=>false,setContentProtection:vi.fn()},guard=new CaptureExclusion(window),a=deferred(),b=deferred(),cancel=new AbortController();
    const first=guard.during(cancel.signal,()=>a.promise),second=guard.during(new AbortController().signal,()=>b.promise);cancel.abort();a.resolve('a');await expect(first).rejects.toThrow();expect(window.setContentProtection.mock.calls).toEqual([[true]]);b.resolve('b');expect(await second).toBe('b');expect(window.setContentProtection.mock.calls).toEqual([[true],[false]]);
  });
  it('restores pre-existing protection after an error and rejects aborted work before capture',async()=>{
    const window={isDestroyed:()=>false,isContentProtected:()=>true,setContentProtection:vi.fn()},guard=new CaptureExclusion(window);await expect(guard.during(new AbortController().signal,async()=>{throw Error('fixture');})).rejects.toThrow('fixture');expect(window.setContentProtection.mock.calls).toEqual([[true],[true]]);
    const signal=AbortSignal.abort();const operation=vi.fn();await expect(guard.during(signal,operation)).rejects.toThrow();expect(operation).not.toHaveBeenCalled();
  });
});
