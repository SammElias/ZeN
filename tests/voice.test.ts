import { describe, it, expect, vi, afterEach } from 'vitest';
import { VoiceBackend, voiceConfiguration } from '../src/agent/voice';
import { SettingsSchema } from '../src/shared/contracts';
import WebSocket from 'ws';
function setup(audible = true) {
  const run = vi.fn().mockResolvedValue({ state: 'completed', message: 'Verificado' });
  const stop = vi.fn(); const send = vi.fn(); const log = vi.fn();
  const spending = { reserve: vi.fn(), record: vi.fn().mockReturnValue(true), check: vi.fn(), finish: vi.fn(), tool: vi.fn() };
  const backend = new VoiceBackend({ spending, key: () => 'dummy', settings: () => SettingsSchema.parse({ voiceConsent: true }), orchestrator: { run, stop, busy: false } as any, audible: () => audible, emit: vi.fn(), log });
  const internal = backend as any;
  internal.callId = 'rtc_test'; internal.reservation = 'budget'; internal.socket = { readyState: WebSocket.OPEN, send, close: vi.fn() };
  return { internal, run, stop, send, log, spending };
}
const transcript = (id = 'i1', text = 'Abre el Bloc de notas') => ({ type: 'conversation.item.input_audio_transcription.completed', item_id: id, transcript: text, usage: { input_tokens: 20, output_tokens: 5 } });
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe('single response voice', () => {
  it('dispatches authenticated transcript and reads once without history', async () => {
    const { internal, run, send } = setup(); internal.event(transcript()); await flush();
    expect(run.mock.calls[0][0]).toBe('Abre el Bloc de notas');
    const events = send.mock.calls.map(args => JSON.parse(args[0]));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'response.create', response: { conversation: 'none', tool_choice: 'none', max_output_tokens: 400, input: [{ content: [{ text: 'Verificado' }] }] } });
  });
  it('ignores model-authored function requests', () => { const { internal, run, send } = setup(); internal.event({ type: 'response.function_call_arguments.done', name: 'delegate_to_zen', call_id: 'evil', arguments: '{"text":"Abre el Bloc de notas"}' }); expect(run).not.toHaveBeenCalled(); expect(send).not.toHaveBeenCalled(); });
  it('deduplicates transcripts and usage', async () => { const { internal, run, send, spending } = setup(); internal.event(transcript()); internal.event(transcript()); await flush(); expect(run).toHaveBeenCalledOnce(); expect(send).toHaveBeenCalledOnce(); expect(spending.record).toHaveBeenCalledOnce(); });
  it('counts but does not execute stale transcripts', () => { const { internal, run, spending } = setup(); internal.event({ type: 'input_audio_buffer.speech_started', item_id: 'new' }); internal.event(transcript('old')); expect(run).not.toHaveBeenCalled(); expect(spending.record).toHaveBeenCalledOnce(); });
  it('interrupts stale speech without cancelling research', async () => {
    const { internal, run, send, stop } = setup(); let resolve!: (value: any) => void;
    run.mockImplementation(() => new Promise(r => { resolve = r; }));
    internal.event(transcript()); internal.event({ type: 'input_audio_buffer.speech_started', item_id: 'new' }); resolve({ message: 'Old result' }); await flush();
    expect(stop).not.toHaveBeenCalled(); expect(send.mock.calls.map(args => JSON.parse(args[0]).type)).toEqual(['output_audio_buffer.clear']);
  });
  it('meeting mode generates no paid audio response', async () => { const { internal, run, send } = setup(false); internal.event(transcript()); await flush(); expect(run).toHaveBeenCalledOnce(); expect(send).not.toHaveBeenCalled(); });
  it('does not read long code aloud', async () => { const { internal, run, send } = setup(); run.mockResolvedValue({ message: '```python\n' + 'print(1)\n'.repeat(200) }); internal.event(transcript()); await flush(); const text = JSON.parse(send.mock.calls[0][0]).response.input[0].content[0].text; expect(text.length).toBeLessThan(420); expect(text).toContain('Actividad'); });
  it('logs usage without private transcripts', () => { const { internal, log } = setup(); internal.event({ type: 'response.done', response: { id: 'r1', usage: { input_tokens: 20, output_tokens: 5 }, output: [{ transcript: 'sensitive' }] } }); expect(log.mock.calls[0][0].channel).toBe('voice'); expect(JSON.stringify(log.mock.calls)).not.toContain('sensitive'); });
  it('uses mini without automatic responses or tools', () => { const c = voiceConfiguration(SettingsSchema.parse({})); expect(c.model).toBe('gpt-realtime-2.1-mini'); expect(c.audio.input.turn_detection.create_response).toBe(false); expect(c.tools).toEqual([]); expect(c.max_output_tokens).toBe(400); });
  it('hide preserves work and incomplete usage reservations', async () => { const { internal, stop, spending } = setup(); internal.outstandingSpeech.add('pending'); vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true })); await internal.stop(false); expect(stop).not.toHaveBeenCalled(); expect(spending.finish).toHaveBeenCalledWith('budget', false); });
  it('Stop cancels task ownership', async () => { const { internal, stop } = setup(); vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true })); await internal.stop(); expect(stop).toHaveBeenCalledOnce(); });
  it('closes idle microphone after 90 seconds', async () => { vi.useFakeTimers(); const { internal } = setup(); vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true })); internal.resetIdle(); await vi.advanceTimersByTimeAsync(90000); expect(internal.callId).toBeUndefined(); });
});
