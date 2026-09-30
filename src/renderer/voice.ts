import type { ZenBridge } from '../shared/contracts';
export type VoiceStatus = 'disconnected' | 'connecting' | 'connected';
export class VoiceClient {
  private pc?: RTCPeerConnection;
  private stream?: MediaStream;
  private audio = new Audio();
  private sessionId?: string;
  private generation = 0;
  private starting = false;
  constructor(private bridge: ZenBridge, private state: (status: VoiceStatus, microphone: boolean) => void, private message: (text: string) => void) { this.audio.autoplay = true; }
  get active() { return this.starting || !!this.pc; }
  async start() {
    if (this.active) return;
    this.starting = true;
    const generation = ++this.generation;
    this.state('connecting', false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
      if (generation !== this.generation) { stream.getTracks().forEach(t => t.stop()); return; }
      this.stream = stream;
      // Do not send microphone samples before trusted backend control is connected.
      stream.getAudioTracks().forEach(track => { track.enabled = false; });
      const pc = new RTCPeerConnection(); this.pc = pc;
      pc.ontrack = event => { this.audio.srcObject = event.streams[0]; void this.audio.play().catch(() => this.message('No se pudo reproducir audio. Revisa el dispositivo de salida.')); };
      pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') { this.message('Se perdió la conexión de audio.'); void this.stop(); } };
      pc.addTrack(stream.getAudioTracks()[0], stream);
      const dc = pc.createDataChannel('oai-events');
      dc.onmessage = event => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'conversation.item.input_audio_transcription.completed') this.message(`Tú: ${data.transcript}`);
          if (data.type === 'response.output_audio_transcript.done') this.message(`ZEN (voz): ${data.transcript}`);
        } catch { this.message('Evento de audio ilegible.'); }
      };
      const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
      if (generation !== this.generation) return;
      const result = await this.bridge.voiceStart(offer.sdp!);
      if (!result.ok) throw new Error(result.error);
      if (generation !== this.generation) { await this.bridge.voiceEnd(result.value.sessionId); return; }
      this.sessionId = result.value.sessionId;
      await pc.setRemoteDescription({ type: 'answer', sdp: result.value.sdp });
      await new Promise<void>((resolve, reject) => {
        if (dc.readyState === 'open') return resolve();
        const timer = setTimeout(() => reject(new Error('Tiempo agotado al conectar audio.')), 15000);
        dc.onopen = () => { clearTimeout(timer); resolve(); };
        dc.onclose = () => { clearTimeout(timer); reject(new Error('La sesión de audio se cerró.')); };
      });
      if (generation !== this.generation) return;
      stream.getAudioTracks().forEach(track => { track.enabled = true; });
      this.state('connected', true);
    } catch (error) {
      if (generation === this.generation) {
        const e = error as Error;
        this.message(e.name === 'NotAllowedError' ? 'Micrófono denegado. Activa el consentimiento de ZEN y los permisos de micrófono de Windows.' : e.name === 'NotFoundError' ? 'No hay micrófono disponible.' : e.message || 'No se pudo conectar la voz.');
        await this.stop();
      }
    } finally { this.starting = false; }
  }
  async stop() {
    ++this.generation;
    const id = this.sessionId; this.sessionId = undefined;
    const pc = this.pc; this.pc = undefined;
    if (pc) { pc.onconnectionstatechange = null; pc.close(); }
    this.stream?.getTracks().forEach(track => track.stop()); this.stream = undefined;
    this.audio.pause(); this.audio.srcObject = null;
    this.state('disconnected', false);
    if (id) await this.bridge.voiceEnd(id);
  }
}
