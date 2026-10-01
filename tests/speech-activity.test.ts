import {describe,it,expect,vi} from 'vitest';
import {SpeechActivity} from '../src/renderer/speech-activity';
describe('speaking display stability',()=>{
  it('holds the speaking state through pauses between words, emitting only transitions',()=>{
    const changed=vi.fn(),activity=new SpeechActivity(changed);
    activity.sample(.02,true,100);activity.sample(0,true,200);activity.sample(0,true,600);activity.sample(.02,true,700);activity.sample(0,true,1200);
    expect(changed.mock.calls).toEqual([[true]]);activity.sample(0,true,1600);expect(changed.mock.calls).toEqual([[true],[false]]);
  });
  it('uses hysteresis for quiet syllables and ignores low background noise',()=>{
    const changed=vi.fn(),activity=new SpeechActivity(changed);
    activity.sample(.004,true,100);expect(changed).not.toHaveBeenCalled();activity.sample(.02,true,200);activity.sample(.004,true,1000);activity.sample(0,true,1600);expect(changed.mock.calls).toEqual([[true]]);activity.sample(0,true,1900);expect(changed.mock.calls).toEqual([[true],[false]]);
  });
  it('clears immediately when muted or disconnected instead of waiting for silence',()=>{
    const changed=vi.fn(),activity=new SpeechActivity(changed);activity.sample(.02,true,100);activity.sample(.02,false,110);activity.reset();expect(changed.mock.calls).toEqual([[true],[false]]);
  });
});
