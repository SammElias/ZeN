import { afterEach, describe, expect, it, vi } from 'vitest';
import { VoiceClient } from '../src/renderer/voice';
import type { ZenBridge } from '../src/shared/contracts';

function fixture() {
  const track = { enabled: true, stop: vi.fn() };
  const stream = { getAudioTracks: () => [track], getTracks: () => [track] };
  let answer!: (value: unknown) => void;
  const negotiated = new Promise(resolve => { answer = resolve; });
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: async () => stream } });
  vi.stubGlobal('Audio', class { autoplay = false; muted = false; srcObject = null; play = async () => {}; pause() {} });
  vi.stubGlobal('AudioContext', class { createAnalyser() { return { fftSize: 256 }; } createMediaStreamSource() { return { connect() {} }; } async close() {} });
  vi.stubGlobal('RTCPeerConnection', class {
    connectionState = 'connected'; ontrack = null; onconnectionstatechange = null;
    addTrack() {} createDataChannel() { return { readyState: 'open', onmessage: null }; }
    async createOffer() { return { sdp: 'v=0\r\n' }; } async setLocalDescription() {} async setRemoteDescription() {} close() {}
  });
  const bridge = { voiceStart: vi.fn(() => negotiated), voiceEnd: vi.fn(async () => ({ ok: true, value: true })) } as unknown as ZenBridge;
  const state = vi.fn(); const client = new VoiceClient(bridge, state, vi.fn());
  return { client, track, bridge, state, answer: () => answer({ ok: true, value: { sessionId: 'rtc_test', sdp: 'v=0\r\n' } }) };
}
afterEach(() => vi.unstubAllGlobals());
describe('micrófono push-to-talk', () => {
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
