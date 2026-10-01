import { afterEach, describe, expect, it, vi } from 'vitest';
import { VoiceClient } from '../src/renderer/voice';
import type { ZenBridge } from '../src/shared/contracts';

function fixture() {
  const channel = { readyState: 'open', onmessage: null as null | ((event: { data: string }) => void) };
  const track = { enabled: true, stop: vi.fn() };
  const stream = { getAudioTracks: () => [track], getTracks: () => [track] };
  let answer!: (value: unknown) => void;
  const negotiated = new Promise(resolve => { answer = resolve; });
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: async () => stream } });
  vi.stubGlobal('Audio', class { autoplay = false; muted = false; srcObject = null; play = async () => {}; pause() {} });
  vi.stubGlobal('AudioContext', class { createAnalyser() { return { fftSize: 256 }; } createMediaStreamSource() { return { connect() {} }; } async close() {} });
  vi.stubGlobal('RTCPeerConnection', class {
    connectionState = 'connected'; ontrack = null; onconnectionstatechange = null;
    addTrack() {} createDataChannel() { return channel; }
    async createOffer() { return { sdp: 'v=0\r\n' }; } async setLocalDescription() {} async setRemoteDescription() {} close() {}
  });
  const bridge = { voiceStart: vi.fn(() => negotiated), voiceEnd: vi.fn(async () => ({ ok: true, value: true })) } as unknown as ZenBridge;
  const state = vi.fn(); const transcript = vi.fn(); const client = new VoiceClient(bridge, state, vi.fn(), vi.fn(), transcript);
  return { client, track, bridge, state, transcript, event: (data: unknown) => channel.onmessage?.({data:JSON.stringify(data)}), answer: () => answer({ ok: true, value: { sessionId: 'rtc_test', sdp: 'v=0\r\n' } }) };
}
afterEach(() => vi.unstubAllGlobals());
describe('micrófono push-to-talk', () => {
  it('muestra voz de ZEN vinculada al turno y descarta audio antiguo tras interrupción o cierre', async () => {
    const f = fixture(); const starting = f.client.start(true);
    await vi.waitFor(() => expect(f.bridge.voiceStart).toHaveBeenCalled()); f.answer(); await starting;
    f.event({type:'response.created',response:{id:'r1',metadata:{zen_utterance_id:'u1'}}});
    f.event({type:'response.output_audio_transcript.delta',response_id:'other',delta:'incorrecto'});
    expect(f.transcript).not.toHaveBeenCalled();
    f.event({type:'response.output_audio_transcript.delta',response_id:'r1',delta:'Hola '});
    f.event({type:'response.output_audio_transcript.done',response_id:'r1',transcript:'Hola Sam.'});
    expect(f.transcript).toHaveBeenLastCalledWith({speaker:'zen',id:'r1',sourceItemId:'u1',text:'Hola Sam.',phase:'done'});
    f.event({type:'input_audio_buffer.speech_started'});
    f.event({type:'response.output_audio_transcript.delta',response_id:'r1',delta:'antiguo'});
    expect(f.transcript).toHaveBeenCalledTimes(2);
    await f.client.stop(); f.event({type:'response.created',response:{id:'r2'}});
    f.event({type:'response.output_audio_transcript.done',response_id:'r2',transcript:'tardío'});
    expect(f.transcript).toHaveBeenCalledTimes(2);
  });
  it('conecta silenciado, no envía durante negociación y solo habilita por orden explícita', async () => {
    const f = fixture(); const starting = f.client.start(true);
    await vi.waitFor(() => expect(f.bridge.voiceStart).toHaveBeenCalled());
    expect(f.track.enabled).toBe(false);
    f.answer(); await starting;
    expect(f.track.enabled).toBe(false); expect(f.state).toHaveBeenLastCalledWith('connected', false);
    f.client.setMicrophoneEnabled(true); expect(f.track.enabled).toBe(true);
    f.client.setMicrophoneEnabled(false); expect(f.track.enabled).toBe(false);
    await f.client.stop(); expect(f.track.stop).toHaveBeenCalled();
  });
  it('soltar durante negociación evita activación tardía', async () => {
    const f = fixture(); const starting = f.client.start(true);
    await vi.waitFor(() => expect(f.bridge.voiceStart).toHaveBeenCalled());
    f.client.setMicrophoneEnabled(true); expect(f.track.enabled).toBe(false); f.client.setMicrophoneEnabled(false);
    f.answer(); await starting; expect(f.track.enabled).toBe(false); await f.client.stop();
  });
  it('cancelar negociación impide reactivar pistas y cierra la sesión tardía', async () => {
    const f = fixture(); const starting = f.client.start(true);
    await vi.waitFor(() => expect(f.bridge.voiceStart).toHaveBeenCalled());
    await f.client.stop(); f.answer(); await starting;
    expect(f.track.enabled).toBe(false); expect(f.track.stop).toHaveBeenCalled();
    expect(f.bridge.voiceEnd).toHaveBeenCalledWith('rtc_test');
  });
});
