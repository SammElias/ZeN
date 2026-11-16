import {afterEach, describe, expect, it, vi} from 'vitest';
import {CompanionSettingsSchema} from '../src/shared/codex-companion';
import {PortableSettings} from '../src/shared/companion-backup';
import {interfaceSoundEnabled, interfaceTones, surfaceSound, type InterfaceEffect} from '../src/shared/companion-interface-audio';
import {CompanionInterfaceAudio, renderInterfaceTone} from '../src/renderer/companion-interface-audio';

function playback(state: AudioContextState='running') {
  let time=0;
  const events: string[]=[];
  const connect=vi.fn().mockReturnValue({connect:vi.fn()});
  const gain={gain:{value:0,setValueAtTime:vi.fn(),linearRampToValueAtTime:vi.fn()},connect,disconnect:vi.fn()};
  const context={state, currentTime:1, sampleRate:48000, resume:vi.fn().mockResolvedValue(undefined),
    close:vi.fn().mockResolvedValue(undefined), suspend:vi.fn().mockResolvedValue(undefined),
    createBuffer:vi.fn().mockReturnValue({copyToChannel:vi.fn()}),
    createBufferSource:vi.fn(()=>({connect,disconnect:vi.fn(),start:vi.fn(()=>events.push('start')),stop:vi.fn(()=>events.push('stop'))})),
    createGain:vi.fn(()=>gain),
  };
  const create=vi.fn(()=>context as unknown as AudioContext);
  const audio=new CompanionInterfaceAudio(create,()=>time,()=>true);
  fixtures.push(audio);
  return {audio,context,create,events,gain,advance:(ms:number)=>{time+=ms;}};
}

const fixtures: CompanionInterfaceAudio[]=[];
afterEach(()=>{fixtures.splice(0).forEach(audio=>audio.dispose());});

describe('ZEN interface audio',()=>{
  it('preserves legacy silence and accepts portable volume and an explicit override',()=>{
    const old=CompanionSettingsSchema.parse({sounds:false});
    expect(interfaceSoundEnabled(old)).toBe(false);
    expect(old.interfaceVolume).toBe(18);
    const portable=JSON.parse(JSON.stringify(PortableSettings.parse({...PortableSettings.parse({}),sounds:false,interfaceSounds:true,interfaceVolume:31})));
    expect(interfaceSoundEnabled(portable)).toBe(true);
    expect(PortableSettings.parse(portable).interfaceVolume).toBe(31);
    expect(CompanionSettingsSchema.safeParse({interfaceVolume:101}).success).toBe(false);
  });

  it('classifies a compound change once and ignores an already selected section',()=>{
    const island={island:true,expanded:false,page:'home',tab:'activity'};
    const panel={...island,island:false,expanded:true,page:'codex'};
    expect(surfaceSound(island,panel)).toBe('expand');
    expect(surfaceSound(panel,panel)).toBeUndefined();
    expect(surfaceSound(panel,{...panel,tab:'summary'})).toBe('navigate');
    expect(surfaceSound(panel,{...panel,page:'options',disclosure:'options'})).toBe('open');
    expect(surfaceSound(panel,{...panel,expanded:false})).toBe('close');
    expect(surfaceSound(panel,island)).toBe('collapse');
  });

  it('renders a short shaped envelope at different device sample rates',()=>{
    for(const rate of [44100,48000]) for(const effect of Object.keys(interfaceTones) as InterfaceEffect[]) {
      const samples=renderInterfaceTone(effect,rate);
      expect(samples.length).toBe(Math.round(interfaceTones[effect].ms*rate/1000));
      expect(Math.abs(samples[0])).toBe(0);
      expect(Math.abs(samples.at(-1)!)).toBe(0);
      expect(Math.max(...samples)).toBeLessThan(1);
      expect(Math.max(...samples)).toBeGreaterThan(.25);
    }
  });

  it('creates nothing on configuration, drops fast repeats and replaces the voice in order',()=>{
    const p=playback();
    p.audio.configure(CompanionSettingsSchema.parse({motion:false}));
    expect(p.create).not.toHaveBeenCalled();
    p.audio.play('expand');
    p.advance(20);p.audio.play('collapse');
    p.advance(60);p.audio.play('expand');
    expect(p.events).toEqual(['start']);
    p.audio.play('close');
    expect(p.events).toEqual(['start','stop','start']);
    expect(p.context.createBufferSource.mock.results[0].value.stop).toHaveBeenCalledWith(1.005);
    expect(p.context.createBufferSource.mock.results[1].value.start).toHaveBeenCalledWith(1.005);
  });

  it('uses draft volume for preview and honors zero, mute and presentation independently of motion',()=>{
    const p=playback();
    const saved=CompanionSettingsSchema.parse({interfaceSounds:false,interfaceVolume:0,motion:false});
    p.audio.configure(saved);
    p.audio.play('open');
    expect(p.create).not.toHaveBeenCalled();
    const draft={...saved,interfaceSounds:true,interfaceVolume:31};
    p.audio.preview(draft);
    expect(p.gain.gain.value).toBeCloseTo(.31*.14);
    for(const mute of [{presentation:true},{paused:true},{silencedUntil:Date.now()+10000}]) {
      p.audio.configure({...draft,...mute});
      p.advance(200);p.audio.preview(draft);p.audio.notice('attention');
    }
    expect(p.events).toEqual(['start','stop']);
  });

  it('discards a delayed resume and allows the next interaction even if audio previously failed',async()=>{
    const p=playback('suspended');
    let resume!:()=>void;
    p.context.resume.mockImplementationOnce(()=>new Promise<void>(resolve=>{resume=resolve;}));
    p.audio.configure(CompanionSettingsSchema.parse({}));
    p.audio.play('expand');
    p.advance(200);resume();await Promise.resolve();
    expect(p.events).toEqual([]);
    p.context.resume.mockRejectedValueOnce(new Error('No audio output'));
    expect(()=>p.audio.play('open')).not.toThrow();
    await Promise.resolve();
    p.advance(200);p.audio.play('close');await Promise.resolve();
    expect(p.events).toEqual(['start']);
  });
});
