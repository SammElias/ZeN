import {afterEach,describe,expect,it,vi} from 'vitest';
import {registerVaultIpc} from '../src/main/companion-vault';
import {VAULT_REVEAL_MS,VaultRequest} from '../src/shared/password-vault';

afterEach(()=>vi.useRealTimers());
function fixture(){
 let locked=true,allowed=true,focused=true;
 const send=vi.fn(),copy=vi.fn(async()=>{}),lock=vi.fn(()=>{locked=true;});
 const vault={lock,snapshot:()=>({exists:true,locked,...(!locked?{projects:[]}: {})}),
  unlock:vi.fn(async()=>{locked=false;return vault.snapshot();}),
  unlockHello:vi.fn(async(check:()=>void)=>{check();locked=false;return vault.snapshot();}),
  enableHello:vi.fn(async(_master:string,check:()=>void)=>{check();return vault.snapshot();}),
  disableHello:vi.fn(async(check:()=>void)=>{check();return vault.snapshot();}),
  create:vi.fn(async()=>{locked=false;return vault.snapshot();}),
  change:vi.fn(async()=>vault.snapshot()),secret:vi.fn(()=>{if(locked)throw Error('locked');return 'synthetic';})};
 const window={isDestroyed:()=>false,isFocused:()=>focused,webContents:{send}};
 let request:(action:any)=>Promise<any>;
 const controller=registerVaultIpc(((_name:any,_schema:any,run:any)=>{request=run;}) as any,window as any,vault as any,()=>allowed,copy);
 const enter=async()=>{const value=await request!({type:'enter'});return value.session;};
 return {request:(action:any)=>request!(action),enter,controller,vault,send,copy,allow:(value:boolean)=>{allowed=value;},focus:(value:boolean)=>{focused=value;}};
}
describe('vault IPC policy',()=>{
 it('requires the current visible session and revokes it on lock independently of window pinning',async()=>{
  const f=fixture(),session=await f.enter();
  await f.request({type:'unlock',session,master:'synthetic'});
  f.controller.lock();await expect(f.request({type:'reveal',session,project:'p',id:'a'})).rejects.toThrow('bloqueado');
  const next=await f.enter();expect(next).not.toBe(session);
  f.allow(false);await expect(f.request({type:'unlock',session:next,master:'synthetic'})).rejects.toThrow();
  expect(f.vault.unlock).toHaveBeenCalledTimes(1);expect(f.copy).not.toHaveBeenCalled();
 });
 it('allows hovering to enter a locked view but requires focus to unlock or reveal',async()=>{
  const f=fixture();f.focus(false);const session=await f.enter();
  await expect(f.request({type:'unlock',session,master:'synthetic'})).rejects.toThrow('Activa ZEN');
  expect(f.vault.unlock).not.toHaveBeenCalled();
 });
 it('requires focus and a current session for Windows Hello operations',async()=>{
  const f=fixture(),session=await f.enter();
  f.focus(false);
  await expect(f.request({type:'hello-unlock',session})).rejects.toThrow('Activa ZEN');
  expect(f.vault.unlockHello).not.toHaveBeenCalled();
  f.focus(true);
  await f.request({type:'hello-unlock',session});
  await f.request({type:'hello-enable',session,master:'synthetic'});
  f.controller.lock();
  await expect(f.request({type:'hello-disable',session})).rejects.toThrow('bloqueado');
  expect(f.vault.disableHello).not.toHaveBeenCalled();
 });
 it('never returns passwords for copy and sends a conceal signal at ten seconds',async()=>{
  vi.useFakeTimers();const f=fixture(),session=await f.enter();await f.request({type:'unlock',session,master:'synthetic'});
  const revealed=await f.request({type:'reveal',session,project:'p',id:'a'});expect(revealed.type).toBe('secret');
  f.send.mockClear();vi.advanceTimersByTime(VAULT_REVEAL_MS-1);expect(f.send).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);expect(f.send).toHaveBeenCalledWith('companion:vault-signal','conceal');
  expect(await f.request({type:'copy',session,project:'p',id:'a',field:'password'})).toEqual({type:'copied'});
  expect(f.copy).toHaveBeenCalledWith('synthetic');
 });
 it('rejects surplus fields and never lets an edit request return an existing password',()=>{
  expect(VaultRequest.safeParse({type:'change',session:'s',change:{type:'account',project:'p',id:'a',service:'s',user:'u'}}).success).toBe(true);
  expect(VaultRequest.safeParse({type:'reveal',session:'s',project:'p',id:'a',extra:true}).success).toBe(false);
 });
});
