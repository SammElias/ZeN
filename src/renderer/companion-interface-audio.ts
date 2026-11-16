import {interfaceSoundEnabled, interfaceTones, type InterfaceEffect} from '../shared/companion-interface-audio';
import type {CompanionSettings} from '../shared/codex-companion';
import {isSilenced} from '../shared/companion-presentation';

const minimumGap = 55;
const repeatGap = 125;
const resumeDeadline = 120;
const quietGain = .14;

export function renderInterfaceTone(effect: InterfaceEffect, sampleRate: number) {
  const {ms, from, to, decay, level} = interfaceTones[effect];
  const samples = new Float32Array(Math.round(ms * sampleRate / 1000));
  const attack = Math.round(.006 * sampleRate);
  const release = Math.round(.018 * sampleRate);
  let phase = 0;
  for (let i = 0; i < samples.length; i++) {
    const progress = i / (samples.length - 1);
    const rise = Math.min(1, i / attack);
    const fall = Math.min(1, (samples.length - 1 - i) / release);
    const envelope = Math.sin(Math.PI / 2 * rise) ** 2 * Math.sin(Math.PI / 2 * fall) ** 2;
    const glide = progress * progress * (3 - 2 * progress);
    phase += 2 * Math.PI * (from + (to - from) * glide) / sampleRate;
    samples[i] = (Math.sin(phase) + .13 * Math.sin(2 * phase)) * level * envelope * Math.exp(-decay * progress);
  }
  return samples;
}

export function interfaceAudioMuted(settings: CompanionSettings) {
  return settings.paused || settings.presentation || isSilenced(settings);
}

export class CompanionInterfaceAudio {
  private settings?: CompanionSettings;
  private context?: AudioContext;
  private buffers = new Map<InterfaceEffect, AudioBuffer>();
  private active?: {source: AudioBufferSourceNode; gain: GainNode};
  private idle?: ReturnType<typeof setTimeout>;
  private last?: {effect: InterfaceEffect; at: number};
  private revision = 0;

  constructor(
    private createContext = () => new AudioContext(),
    private now = () => performance.now(),
    private visible = () => !document.hidden,
  ) {}

  configure(settings: CompanionSettings) {
    const previous = this.settings;
    this.settings = settings;
    if (interfaceAudioMuted(settings) || previous && (
      previous.sounds !== settings.sounds || interfaceSoundEnabled(previous) !== interfaceSoundEnabled(settings) ||
      previous.interfaceVolume !== settings.interfaceVolume)) this.stop();
  }

  play(effect: InterfaceEffect) { this.request(effect, 'interface'); }
  notice(effect: 'success'|'attention'|'error') { this.request(effect, 'notice'); }
  preview(draft: CompanionSettings) {
    if (interfaceSoundEnabled(draft) && !interfaceAudioMuted(draft)) this.request('open', 'interface', draft.interfaceVolume);
  }

  prepare() {
    if (this.context || !(this.volume('interface') || this.volume('notice'))) return;
    try {
      this.context = this.createContext();
      this.releaseDeviceLater(this.context);
    } catch { /* The interface remains available when there is no audio device. */ }
  }

  private volume(channel: 'interface'|'notice', preview?:number) {
    const settings = this.settings;
    if (!settings || !this.visible() || interfaceAudioMuted(settings)) return 0;
    if (channel === 'notice') return settings.sounds ? .25 : 0;
    return preview !== undefined ? preview / 100 : interfaceSoundEnabled(settings) ? settings.interfaceVolume / 100 : 0;
  }

  private request(effect: InterfaceEffect, channel: 'interface'|'notice', preview?: number) {
    if (!this.volume(channel, preview)) return;
    const at = this.now();
    const gap = at - (this.last?.at ?? -Infinity);
    if (gap < minimumGap || (effect === this.last?.effect && gap < repeatGap) ||
      (effect === 'press' && this.active)) return;
    this.last = {effect, at};
    const revision = ++this.revision;
    void this.start(effect, channel, preview, at, revision).catch(() => {});
  }

  private async start(effect: InterfaceEffect, channel: 'interface'|'notice', preview: number|undefined, at: number, revision: number) {
    const context = this.context ??= this.createContext();
    if (context.state !== 'running') {
      await context.resume();
      if (this.now() - at > resumeDeadline) return;
    }
    const volume = this.volume(channel, preview);
    if (revision !== this.revision || !volume) return;
    let buffer = this.buffers.get(effect);
    if (!buffer) {
      const samples = renderInterfaceTone(effect, context.sampleRate);
      buffer = context.createBuffer(1, samples.length, context.sampleRate);
      buffer.copyToChannel(samples, 0);
      this.buffers.set(effect, buffer);
    }
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    gain.gain.value = volume * quietGain;
    source.connect(gain).connect(context.destination);

    const start = this.release(false);
    const voice = {source, gain};
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      if (this.active === voice) this.active = undefined;
    };
    this.active = voice;
    try { source.start(start); }
    catch (error) {
      this.active = undefined;
      source.disconnect();
      gain.disconnect();
      throw error;
    }
    this.releaseDeviceLater(context);
  }

  private releaseDeviceLater(context: AudioContext) {
    clearTimeout(this.idle);
    this.idle = setTimeout(() => {void context.suspend().catch(() => {});}, 15000);
  }

  private release(immediate: boolean) {
    const now = this.context?.currentTime ?? 0;
    const voice = this.active;
    if (!voice) return now;
    this.active = undefined;
    const end = immediate ? now : now + .005;
    if (!immediate) {
      voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
      voice.gain.gain.linearRampToValueAtTime(0, end);
    }
    voice.source.stop(end);
    return end;
  }

  stop() { ++this.revision; this.release(true); }

  dispose() {
    this.stop();
    clearTimeout(this.idle);
    void this.context?.close().catch(() => {});
    this.context = undefined;
    this.settings = undefined;
    this.buffers.clear();
    this.last = undefined;
  }
}

export const interfaceAudio = new CompanionInterfaceAudio();
