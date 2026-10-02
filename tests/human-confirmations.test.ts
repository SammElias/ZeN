import {describe,it,expect,vi} from 'vitest';
import {HumanConfirmations} from '../src/policy/human-confirmations';
import {confirmationCode} from '../src/shared/confirmation';
describe('Confirmación humana por voz o chat',()=>{
  it('accepts exact digits or spoken individual digits, rejects quotes, negatives and extra instructions',()=>{
    expect(confirmationCode('Confirmo 1234.')).toBe('1234');expect(confirmationCode('Confirmo el código uno dos tres cuatro')).toBe('1234');
    for(const text of ['sí','no confirmo 1234','«confirmo 1234»','confirmo 1234 pero no lo hagas','confirmo 12','confirmo 12345'])expect(confirmationCode(text)).toBeUndefined();
  });
  it('seals an immutable proposal, deduplicates refreshes and consumes before execution',async()=>{
    const execute=vi.fn(async()=>true),changed=vi.fn(),registry=new HumanConfirmations(changed);
    registry.offer('proposal','Destino exacto','v1',execute);const first=registry.list()[0];registry.offer('proposal','Destino exacto','v1',execute);expect(changed).toHaveBeenCalledOnce();
    await registry.confirm('confirmo '+first.code);await expect(registry.confirm('confirmo '+first.code)).rejects.toThrow('ya se usó');expect(execute).toHaveBeenCalledOnce();
  });
  it('invalidates changed destinations, rejects expiry/stop and never retries failed effects',async()=>{
    let now=0;const execute=vi.fn(async()=>{throw Error('effect failed');}),registry=new HumanConfirmations(()=>{},()=>now);
    registry.offer('draft','Destino A','A',execute);const old=registry.list()[0].code;registry.offer('draft','Destino B','B',execute);await expect(registry.confirm('confirmo '+old)).rejects.toThrow();
    const current=registry.list()[0].code;await expect(registry.confirm('confirmo '+current)).rejects.toThrow('effect failed');await expect(registry.confirm('confirmo '+current)).rejects.toThrow();expect(execute).toHaveBeenCalledOnce();
    registry.offer('expired','Otro destino','C',execute);const expired=registry.list()[0].code;now+=300001;await expect(registry.confirm('confirmo '+expired)).rejects.toThrow('caducó');
    registry.offer('stop','Stop','D',execute);const stopped=registry.list()[0].code;registry.clear();await expect(registry.confirm('confirmo '+stopped)).rejects.toThrow();
  });
});
