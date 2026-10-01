import type { Utterance } from './contracts';
export type LiveFragment = { type: 'session.input_transcript.delta' | 'session.output_transcript.delta'; event_id: string; delta: string; start_ms: number; end_ms: number };
export type LiveSegment = { speaker: 'user' | 'zen'; id: string; text: string; start: number; end: number; revision: number };
// Live has no turns or transcript.done. Group intervals independently per speaker.
// Delivery order preserves verbatim deltas; timeline order decides what is visible.
export class LiveTranscript {
  private seen = new Set<string>();
  private speakers: Partial<Record<'user' | 'zen', LiveSegment>> = {};
  private latestEnd = -1;
  private latestUser?: string;
  consume(event: unknown): { segment: LiveSegment; utterance?: Utterance } | undefined {
    const e = event as LiveFragment;
    if (!e || !['session.input_transcript.delta', 'session.output_transcript.delta'].includes(e.type) || typeof e.event_id !== 'string' || typeof e.delta !== 'string' || !Number.isFinite(e.start_ms) || !Number.isFinite(e.end_ms) || e.start_ms < 0 || e.end_ms < e.start_ms || this.seen.has(e.event_id)) return;
    if (this.seen.size > 10000) throw new Error('Demasiados fragmentos de voz; vuelve a conectar.');
    this.seen.add(e.event_id);
    const speaker = e.type === 'session.input_transcript.delta' ? 'user' : 'zen';
    const previous = this.speakers[speaker];
    const other = this.speakers[speaker === 'user' ? 'zen' : 'user'];
    const fresh = !previous || e.start_ms > previous.end + 1200 || (other && other.start >= previous.end && e.start_ms >= other.start);
    const segment: LiveSegment = fresh ? { speaker, id: `live-${speaker}-${e.start_ms}`, text: e.delta, start: e.start_ms, end: e.end_ms, revision: 1 } : { ...previous, text: previous.text + e.delta, end: Math.max(previous.end, e.end_ms), revision: previous.revision + 1 };
    if (segment.text.length > 64000) throw new Error('Fragmento de voz demasiado largo; vuelve a conectar.');
    this.speakers[speaker] = segment;
    if (speaker === 'user') this.latestUser = segment.id;
    if (e.end_ms < this.latestEnd) return { segment };
    this.latestEnd = e.end_ms;
    return { segment, utterance: { speaker, id: segment.id, text: segment.text, phase: fresh ? 'start' : 'delta', sourceItemId: speaker === 'zen' ? this.latestUser : undefined, timeline: { startMs: segment.start, endMs: segment.end } } };
  }
  user() { return this.speakers.user; }
}
