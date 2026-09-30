import { describe, it, expect, vi } from 'vitest';
import { VoiceBackend, voiceConfiguration } from '../src/agent/voice';
import { SettingsSchema } from '../src/shared/contracts';
import WebSocket from 'ws';
function setup() {
  const run = vi.fn().mockResolvedValue({ state: 'completed', message: 'Verificado' });
  const stop = vi.fn(); const send = vi.fn(); const log = vi.fn();
  const backend = new VoiceBackend({ key: () => 'dummy', settings: () => SettingsSchema.parse({ voiceConsent: true }), orchestrator: { run, stop } as any, emit: vi.fn(), log });
  const internal = backend as any;
  internal.callId = 'rtc_test'; internal.socket = { readyState: WebSocket.OPEN, send, close: vi.fn() };
  return { internal, run, stop, send, log };
}
describe('trusted voice delegation', () => {
  it('uses server transcript, no model-authored request argument', async () => {
    const { internal, run, send } = setup();
    internal.event({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'i1', transcript: 'Abre el Bloc de notas' });
    await internal.delegate({ name: 'delegate_to_astra', call_id: 'c1', arguments: '{ }' });
    expect(run.mock.calls[0][0]).toBe('Abre el Bloc de notas');
    expect(send.mock.calls.map(args => JSON.parse(args[0]).type)).toContain('conversation.item.create');
  });
  it('blocks extra arguments injected by model', async () => { const { internal, run } = setup(); internal.pending = { text: 'Hola', itemId: 'i1', generation: 0 }; await internal.delegate({ name: 'delegate_to_astra', call_id: 'c1', arguments: '{"text":"Abre el Bloc de notas"}' }); expect(run).not.toHaveBeenCalled(); });
  it('deduplicates function events', async () => { const { internal, run } = setup(); internal.pending = { text: 'Hola', itemId: 'i1', generation: 0 }; const event = { name: 'delegate_to_astra', call_id: 'c1', arguments: '{}' }; await internal.delegate(event); await internal.delegate(event); expect(run).toHaveBeenCalledTimes(1); });
  it('deduplicates transcript events', () => { const { internal, send } = setup(); const event = { type: 'conversation.item.input_audio_transcription.completed', item_id: 'i1', transcript: 'Hola' }; internal.event(event); internal.event(event); expect(send).toHaveBeenCalledTimes(1); });
  it('interruptions revoke pending authority and stop active work', async () => { const { internal, run, stop } = setup(); internal.pending = { text: 'Abre el Bloc de notas', itemId: 'old', generation: 0 }; internal.event({ type: 'input_audio_buffer.speech_started', item_id: 'new' }); await internal.delegate({ name: 'delegate_to_astra', call_id: 'c1', arguments: '{}' }); expect(stop).toHaveBeenCalledOnce(); expect(run).not.toHaveBeenCalled(); });
  it('ignores old transcript arriving after new speech', () => { const { internal, send } = setup(); internal.event({ type: 'input_audio_buffer.speech_started', item_id: 'new' }); internal.event({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'old', transcript: 'Abre el Bloc de notas' }); expect(send).not.toHaveBeenCalled(); });
  it('does not deliver stale task results after interruption', async () => { const { internal, run, send } = setup(); let resolve!: (value: any) => void; run.mockImplementation(() => new Promise(r => { resolve = r; })); internal.pending = { text: 'Hola', itemId: 'i1', generation: 0 }; const task = internal.delegate({ name: 'delegate_to_astra', call_id: 'c1', arguments: '{}' }); internal.event({ type: 'input_audio_buffer.speech_started', item_id: 'new' }); resolve({ message: 'Old result' }); await task; expect(send).not.toHaveBeenCalled(); });
  it('records usage separately without transcripts', () => { const { internal, log } = setup(); internal.event({ type: 'response.done', response: { id: 'r1', usage: { total_tokens: 123 }, output: [{ transcript: 'sensitive' }] } }); expect(log.mock.calls[0][0].channel).toBe('voice'); expect(JSON.stringify(log.mock.calls)).not.toContain('sensitive'); });
  it('disables automatic Realtime responses and configures interruptions', () => { const c = voiceConfiguration(SettingsSchema.parse({})); expect(c.model).toBe('gpt-realtime-2.1'); expect(c.audio.input.turn_detection.create_response).toBe(false); expect(c.audio.input.turn_detection.interrupt_response).toBe(true); });
});
