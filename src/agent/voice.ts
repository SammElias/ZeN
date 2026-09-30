import WebSocket from 'ws';
import { randomUUID } from 'node:crypto';
import type { Settings, TaskEvent } from '../shared/contracts';
import { ZenError, diagnose } from '../shared/errors';
import type { Orchestrator } from './orchestrator';
export const voiceConfiguration = (settings: Settings) => ({
  type: 'realtime', model: settings.voiceModel, output_modalities: ['audio'],
  instructions: 'Eres la voz de ZEN. Habla en español. Delega cada petición en delegate_to_zen. Solo el resultado de esa herramienta confirma acciones. Lee su mensaje fielmente. Nunca declares una acción realizada por tu cuenta.',
  audio: { input: { transcription: { model: 'gpt-4o-mini-transcribe', language: 'es' }, turn_detection: { type: 'server_vad', create_response: false, interrupt_response: true } }, output: { voice: 'marin' } },
  tools: [{ type: 'function', name: 'delegate_to_zen', description: 'Delega el turno de voz actual a ZeN; la transcripción y la autorización son resueltas por el servidor.', parameters: { type: 'object', properties: {}, additionalProperties: false, required: [] } }],
  tool_choice: 'auto'
});
type Deps = { key: () => string; settings: () => Settings; orchestrator: { run: (text: string, requestId: string) => Promise<import('../shared/contracts').TaskResult>; stop: () => void; readonly busy: boolean }; log: (row: Record<string, unknown>) => void; emit: (event: TaskEvent) => void; audible?: () => boolean; control?: (text: string) => boolean };
export class VoiceBackend {
  private socket?: WebSocket;
  private callId?: string;
  private starting = false;
  private generation = 0;
  private pending?: { text: string; itemId: string; generation: number };
  private calls = new Set<string>();
  private items = new Set<string>();
  private controller?: AbortController;
  private expiry?: ReturnType<typeof setTimeout>;
  private latestSpeechItem?: string;
  private audioResponseId?: string;
  private audioGenerating = false;
  constructor(private deps: Deps) {}
  get active() { return this.starting || !!this.callId; }
  async start(sdp: string) {
    if (this.active || this.deps.orchestrator.busy) throw new ZenError('Ya hay una sesión o tarea activa.');
    if (!this.deps.settings().voiceConsent) throw new ZenError('Activa el consentimiento de voz en Configuración antes de usar el micrófono.');
    this.starting = true;
    const generation = ++this.generation;
    this.controller = new AbortController();
    const signal = AbortSignal.any([this.controller.signal, AbortSignal.timeout(20000)]);
    try {
      const key = this.deps.key();
      const fd = new FormData();
      fd.set('sdp', sdp); fd.set('session', JSON.stringify(voiceConfiguration(this.deps.settings())));
      const r = await fetch('https://api.openai.com/v1/realtime/calls', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: fd, signal });
      if (!r.ok) throw { status: r.status };
      const answer = await r.text();
      const id = r.headers.get('location')?.split('/').pop();
      if (!id || !/^rtc_[a-zA-Z0-9_-]+$/.test(id)) throw new ZenError('OpenAI no devolvió un identificador válido para controlar la voz.');
      this.callId = id;
      signal.throwIfAborted();
      const socket = new WebSocket(`wss://api.openai.com/v1/realtime?call_id=${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${key}` }, handshakeTimeout: 10000 });
      this.socket = socket;
      socket.on('message', data => { if (this.socket !== socket) return; try { this.event(JSON.parse(data.toString())); } catch { this.fail('Evento de voz inválido; sesión detenida.'); } });
      socket.on('error', () => { if (this.socket === socket) this.fail('Falló la conexión de control de voz. Revisa conectividad y permisos del modelo.'); });
      socket.on('close', () => { if (this.socket === socket) this.fail('La conexión de voz se cerró.'); });
      await new Promise<void>((resolve, reject) => {
        const abort = () => reject(signal.reason);
        signal.addEventListener('abort', abort, { once: true });
        socket.once('open', () => { signal.removeEventListener('abort', abort); resolve(); });
        socket.once('error', () => { signal.removeEventListener('abort', abort); reject(new ZenError('No se pudo conectar el control de voz.')); });
      });
      if (generation !== this.generation) throw new DOMException('Stopped', 'AbortError');
      this.expiry = setTimeout(() => this.fail('Sesión de voz finalizada tras cinco minutos. Puedes volver a invocar ZEN.'), 300000);
      this.deps.log({ type: 'voice_session', channel: 'voice', model: this.deps.settings().voiceModel, state: 'connected' });
      this.deps.emit({ id: 'voice', state: 'listening', message: 'Voz conectada. Puedes hablar; el audio se envía a OpenAI.' });
      return { sessionId: id, sdp: answer };
    } catch (error) { await this.stop(); throw error; }
    finally { this.starting = false; }
  }
  private send(event: object) { if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(event)); }
  private event(e: any) {
    if (!this.callId) return;
    if (e.type === 'input_audio_buffer.speech_started') {
      ++this.generation;
      this.pending = undefined;
      this.latestSpeechItem = e.item_id;
      // Speech interrupts playback; a transcript determines whether work is cancelled.
      this.interrupt();
      this.deps.emit({ id: 'voice', state: 'listening', message: 'Escuchando un nuevo turno…' });
    }
    if (e.type === 'conversation.item.input_audio_transcription.failed') this.fail('No se pudo transcribir el turno de voz. Comprueba acceso al modelo de transcripción.');
    if (e.type === 'conversation.item.input_audio_transcription.completed') {
      if (typeof e.transcript !== 'string' || typeof e.item_id !== 'string' || this.items.has(e.item_id) || (this.latestSpeechItem && e.item_id !== this.latestSpeechItem)) return;
      this.items.add(e.item_id);
      if (!e.transcript.trim() || e.transcript.length > 8000) return;
      if (this.deps.control?.(e.transcript)) return;
      this.pending = { text: e.transcript, itemId: e.item_id, generation: this.generation };
      this.send({ type: 'response.create', response: { tool_choice: 'required' } });
    }
    if (e.type === 'response.function_call_arguments.done') void this.delegate(e);
    if (e.type === 'response.output_audio_transcript.delta') { this.audioResponseId = e.response_id; this.audioGenerating = true; }
    if (e.type === 'response.done') {
      if (e.response?.id === this.audioResponseId) this.audioGenerating = false;
      this.deps.log({ type: 'usage', channel: 'voice', model: this.deps.settings().voiceModel, responseId: e.response?.id, usage: e.response?.usage, costEstimate: null });
    }
    if (e.type === 'error' && e.error?.code !== 'response_cancel_not_active') { this.deps.log({ type: 'voice_error', code: e.error?.code, parameter: e.error?.param }); this.fail('OpenAI rechazó un evento o la configuración de voz. No se ha cambiado de modelo.'); }
  }
  private async delegate(e: { name?: string; call_id?: string; arguments?: string }) {
    if (!this.callId || typeof e.call_id !== 'string' || this.calls.has(e.call_id)) return;
    this.calls.add(e.call_id);
    const pending = this.pending;
    this.pending = undefined;
    const generation = this.generation;
    let message: string;
    let validArguments = false;
    try { const args = JSON.parse(e.arguments ?? ''); validArguments = args !== null && typeof args === 'object' && !Array.isArray(args) && Object.keys(args).length === 0; } catch {}
    if (e.name !== 'delegate_to_zen' || !validArguments || !pending || pending.generation !== generation) message = 'Delegación bloqueada: no hay un turno de voz válido y vigente.';
    else {
      try { message = (await this.deps.orchestrator.run(pending.text, randomUUID())).message; }
      catch (error) { message = diagnose(error); }
    }
    if (!this.callId || generation !== this.generation) return;
    this.send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: e.call_id, output: JSON.stringify({ message }) } });
    if (this.deps.audible?.() !== false) this.send({ type: 'response.create', response: { tool_choice: 'none', instructions: `Lee en español el mensaje del resultado de la herramienta sin añadir afirmaciones de ejecución.` } });
  }
  private fail(message: string) { this.deps.emit({ id: 'voice', state: 'failed', message }); void this.stop(false); }
  interrupt() { if (this.audioGenerating && this.audioResponseId) this.send({ type: 'response.cancel', response_id: this.audioResponseId }); this.send({ type: 'output_audio_buffer.clear' }); }
  async stop(cancelTask = true) {
    this.controller?.abort(new DOMException('Stopped', 'AbortError'));
    ++this.generation; this.pending = undefined;
    this.audioResponseId = undefined; this.audioGenerating = false;
    if (cancelTask) this.deps.orchestrator.stop();
    clearTimeout(this.expiry);
    const id = this.callId; this.callId = undefined;
    const socket = this.socket; this.socket = undefined;
    socket?.close();
    this.calls.clear(); this.items.clear();
    if (id) {
      try { await fetch(`https://api.openai.com/v1/realtime/calls/${encodeURIComponent(id)}/hangup`, { method: 'POST', headers: { Authorization: `Bearer ${this.deps.key()}` }, signal: AbortSignal.timeout(5000) }); } catch {}
      this.deps.log({ type: 'voice_session', channel: 'voice', state: 'closed', finalUsageConfirmed: false, costEstimate: null });
    }
  }
}
