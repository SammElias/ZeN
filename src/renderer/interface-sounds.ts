import { useEffect, useRef } from 'react';
import type { TaskEvent } from '../shared/contracts';

export type InterfaceSound = 'hello' | 'open' | 'close' | 'send' | 'attach' | 'complete' | 'attention' | 'error';
// Short original sine tones; no WAVs, downloads, microphone or external service.
const melodies: Record<InterfaceSound, number[]> = {
  hello: [523.25, 659.25, 783.99], open: [392, 523.25], close: [440, 329.63],
  send: [587.33, 880], attach: [659.25, 783.99], complete: [659.25, 783.99, 1046.5],
  attention: [523.25, 523.25], error: [392, 293.66],
};
export class InterfaceSounds {
  private context?: AudioContext;
  private master?: GainNode;
  private idleTimer?: ReturnType<typeof setTimeout>;
  private generation = 0;
  private last = -Infinity;
  private disposed = false;
  private active = new Set<OscillatorNode>();
  async play(sound: InterfaceSound, unlock = false) {
    if (this.disposed || (!this.context && !unlock) || performance.now() - this.last < 90) return;
    try {
      this.context ??= new AudioContext();
      const ctx = this.context;
      const generation = this.generation;
      if (ctx.state === 'suspended') await ctx.resume();
      if (this.disposed || generation !== this.generation || ctx.state !== 'running' || performance.now() - this.last < 90) return;
      clearTimeout(this.idleTimer);
      this.last = performance.now();
      if (!this.master) { this.master = ctx.createGain(); this.master.connect(ctx.destination); }
      this.master.gain.setValueAtTime(.065, ctx.currentTime);
      const notes = melodies[sound];
      notes.forEach((frequency, index) => {
        const start = ctx.currentTime + .015 + index * .085;
        const oscillator = ctx.createOscillator(); const envelope = ctx.createGain();
        oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(frequency, start);
        oscillator.frequency.exponentialRampToValueAtTime(frequency * .98, start + .19);
        envelope.gain.setValueAtTime(0, start);
        envelope.gain.linearRampToValueAtTime(.8 / notes.length, start + .012);
        envelope.gain.exponentialRampToValueAtTime(.0001, start + .24);
        oscillator.connect(envelope); envelope.connect(this.master!);
        this.active.add(oscillator);
        oscillator.onended = () => { this.active.delete(oscillator); oscillator.disconnect(); envelope.disconnect(); };
        oscillator.start(start); oscillator.stop(start + .25);
      });
      this.idleTimer = setTimeout(() => { void ctx.suspend().catch(() => {}); }, 1000);
    } catch { /* A missing audio device must never interrupt a task. */ }
  }
  silence() {
    ++this.generation;
    if (this.master) { this.master.gain.cancelScheduledValues(0); this.master.gain.value = 0; }
    for (const oscillator of this.active) { try { oscillator.stop(); oscillator.disconnect(); } catch {} }
    this.active.clear();
    clearTimeout(this.idleTimer);
    void this.context?.suspend().catch(() => {});
  }
  dispose() { this.disposed = true; this.silence(); void this.context?.close().catch(() => {}); }
}

export function useInterfaceSounds(enabled: boolean, task: TaskEvent) {
  const engine = useRef<InterfaceSounds | null>(null);
  const allowed = useRef(enabled); allowed.current = enabled;
  const lastTask = useRef(`${task.id}:${task.state}`);
  useEffect(() => {
    engine.current = new InterfaceSounds();
    const greet = () => { if (allowed.current) void engine.current?.play('hello', true); };
    window.addEventListener('pointerdown', greet, { once: true });
    return () => { window.removeEventListener('pointerdown', greet); engine.current?.dispose(); engine.current = null; };
  }, []);
  useEffect(() => { if (!enabled) engine.current?.silence(); }, [enabled]);
  useEffect(() => {
    const key = `${task.id}:${task.state}`;
    if (key === lastTask.current) return;
    lastTask.current = key;
    const sound = task.state === 'completed' ? 'complete' : task.state === 'failed' ? 'error' : ['awaiting_approval', 'awaiting_input'].includes(task.state) ? 'attention' : undefined;
    if (enabled && sound) void engine.current?.play(sound);
  }, [enabled, task.id, task.state]);
  return (sound: InterfaceSound) => { if (allowed.current) void engine.current?.play(sound, true); };
}
