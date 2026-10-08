import { latestTask, latestUtterance, beginLiveSession, type LatestState } from './latest-message';
import type { TaskEvent, Utterance } from '../shared/contracts';

// Reduce every event in order. Only presentation is batched; no text or policy event is lost.
export class MessageStore {
  private state: LatestState;
  private displayed: LatestState;
  private listeners = new Set<() => void>();
  private summaries = new Set<() => void>();
  private timer?: ReturnType<typeof setTimeout>;
  private quiet?: ReturnType<typeof setTimeout>;
  private active = false;
  private summary = '';
  constructor(initial: LatestState = {}) { this.state = this.displayed = initial; this.updateSummary(); }
  snapshot = () => this.displayed;
  metadata = () => this.summary;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  subscribeMetadata = (listener: () => void) => { this.summaries.add(listener); return () => { this.summaries.delete(listener); }; };
  private updateSummary() {
    const m = this.state.message;
    const next = JSON.stringify([m?.key, m?.speaker, this.active, this.active ? 0 : Math.ceil((m?.text.length ?? 0) / 300)]);
    if (this.summary !== next) { this.summary = next; this.summaries.forEach(listener => listener()); }
  }
  private flush = () => { clearTimeout(this.timer); this.timer = undefined; this.displayed = this.state; this.listeners.forEach(listener => listener()); this.updateSummary(); };
  private update(next: LatestState, streaming: boolean) {
    if (next === this.state) return;
    const changed = next.message?.key !== this.state.message?.key || next.message?.speaker !== this.state.message?.speaker;
    this.state = next; this.active = streaming; clearTimeout(this.quiet);
    if (streaming) this.quiet = setTimeout(() => { this.active = false; this.flush(); }, 700);
    // New speakers/messages, finals and interruptions are immediate. Deltas paint at most every 50 ms.
    if (changed || !streaming) this.flush();
    else if (!this.timer) this.timer = setTimeout(this.flush, 50);
  }
  task(event: TaskEvent) { this.update(latestTask(this.state, event), !!event.streamText); }
  utterance(event: Utterance) { this.update(latestUtterance(this.state, event), event.phase !== 'done'); }
  newRequest(event: Utterance) { this.update(latestUtterance({}, event), false); }
  startLive() { this.update(beginLiveSession(this.state), false); }
  reset() { clearTimeout(this.timer);clearTimeout(this.quiet);this.timer=undefined;this.quiet=undefined;this.active=false;this.state={};this.flush(); }
  dispose() { clearTimeout(this.timer); clearTimeout(this.quiet); }
}
