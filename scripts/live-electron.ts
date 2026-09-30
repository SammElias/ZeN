// Opt-in integration harness: uses application modules, synthetic input audio,
// actual OpenAI and actual Windows executor. Never writes the API key.
import { app, BrowserWindow, ipcMain } from 'electron';
import { join, resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import OpenAI from 'openai';
import { Orchestrator } from '../src/agent/orchestrator';
import { SavedAgent } from '../src/agent/saved';
import { VoiceBackend } from '../src/agent/voice';
import { openNotepad } from '../src/tools/windows/notepad';
import { SettingsSchema } from '../src/shared/contracts';
if (process.env.ZEN_LIVE_API !== '1' || !process.env.OPENAI_API_KEY) { console.error('Live opt-in and key required.'); app.exit(1); }
const timer = setTimeout(() => { console.error('Live integration timeout'); app.exit(1); }, 90000);
void app.whenReady().then(async () => {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0, timeout: 90000 });
  const settings = SettingsSchema.parse({ voiceConsent: true });
  const metadata: Record<string, unknown>[] = [];
  const events: any[] = [];
  const interruptionTest = process.env.ZEN_TEST_INTERRUPT === '1'; let audible = true; let busyAtInterrupt = false;
  const saved = new SavedAgent({ client: () => client, log: row => metadata.push(row) });
  const orchestrator = new Orchestrator({ client: () => client, saved, settings: () => settings, execute: signal => openNotepad(resolve('dist/tools/notepad.ps1'), signal), emit: e => events.push(e), log: row => metadata.push(row) });
  const text = await orchestrator.run('Abre el Bloc de notas', randomUUID());
  if (text.state !== 'completed' || !text.evidence) throw new Error('Live text failed: ' + text.message);
  const backend = new VoiceBackend({ key: () => process.env.OPENAI_API_KEY!, settings: () => settings, orchestrator, audible: () => audible, log: row => metadata.push(row), emit: e => events.push(e) });
  // OpenAI-generated test utterance, not a microphone recording.
  const speech = await client.audio.speech.create({ model: 'gpt-4o-mini-tts', voice: 'coral', input: interruptionTest ? 'Busca qué es Microsoft 365 Business Basic, con fuentes oficiales de Microsoft.' : 'Abre el Bloc de notas.', response_format: 'wav' });
  const wave = Buffer.from(await speech.arrayBuffer()).toString('base64');
  const window = new BrowserWindow({ show: false, webPreferences: { preload: resolve('dist/preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false } });
  ipcMain.handle('zen:settings', () => ({ ok: true, value: { settings, hasKey: true, shortcutRegistered: false, protectedStorage: true } }));
  ipcMain.handle('zen:layout', () => ({ ok: true, value: true }));
  ipcMain.handle('zen:mode', () => ({ ok: true, value: { response: 'auto', meeting: false } }));
  ipcMain.handle('zen:tasks', () => ({ ok: true, value: [] }));
  ipcMain.handle('zen:voice-end', async () => { await backend.stop(false); return { ok: true, value: true }; });
  ipcMain.handle('zen:voice-interrupt', async () => {
    // Wait for actual research ownership, not an invented progress indication.
    const deadline = Date.now() + 8000;
    while (!orchestrator.busy && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    busyAtInterrupt = orchestrator.busy; audible = false; backend.interrupt(); return { ok: true, value: true };
  });
  ipcMain.handle('zen:voice-start', (_e, sdp) => backend.start(sdp).then(value => ({ ok: true, value })).catch(error => ({ ok: false, error: error?.status ? `HTTP ${error.status}` : error.message })));
  await window.loadFile(resolve('dist/renderer/index.html'));
  // Test page gets no credentials. It only receives generated audio.
  const result = await window.webContents.executeJavaScript(`(async () => {
    const context = new AudioContext(); await context.resume();
    const audio = Uint8Array.from(atob(${JSON.stringify(wave)}), c => c.charCodeAt(0));
    const buffer = await context.decodeAudioData(audio.buffer);
    const destination = context.createMediaStreamDestination();
    // Keep transmitting silent frames after the utterance so server VAD can
    // observe its end; Chromium can stop an otherwise idle audio graph.
    const silence = context.createOscillator(); const gain = context.createGain(); gain.gain.value = 0.000001;
    silence.connect(gain); gain.connect(destination); silence.start();
    const source = context.createBufferSource(); source.buffer = buffer; source.connect(destination);
    const pc = new RTCPeerConnection(); pc.addTrack(destination.stream.getAudioTracks()[0], destination.stream);
    const dc = pc.createDataChannel('oai-events');
    const interruptionTest = ${JSON.stringify(interruptionTest)};
    let transcript = ''; let spoken = ''; let receivedAudio = false; let toolReturned = false; let interrupted = false; let cleared = false; let written = ''; let interruptSent = 0; let clearRoundTripMs = null; const types = [];
    pc.ontrack = e => { receivedAudio = true; const monitor = document.createElement('audio'); monitor.muted = true; monitor.srcObject = e.streams[0]; monitor.play().catch(() => {}); };
    const finished = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Voice response timeout: ' + types.join(',') + '; context=' + context.state + '; time=' + context.currentTime + '; utteranceDuration=' + buffer.duration + '; pc=' + pc.connectionState)), 45000);
      dc.onmessage = e => { const event = JSON.parse(e.data); types.push(event.type);
        if (interruptionTest && event.type === 'output_audio_buffer.started' && !interrupted) { interrupted = true; interruptSent = performance.now(); void window.zen.voiceInterrupt(); }
        if (interruptionTest && event.type === 'output_audio_buffer.cleared') { cleared = true; clearRoundTripMs = performance.now() - interruptSent; }
        if (event.type === 'conversation.item.input_audio_transcription.completed') transcript = event.transcript;
        if (event.type === 'response.output_audio_transcript.done') spoken = event.transcript;
        if (event.type === 'conversation.item.added' && event.item?.type === 'function_call_output') { toolReturned = true; written = JSON.parse(event.item.output).message; }
        if (interruptionTest ? cleared && toolReturned : event.type === 'response.done' && spoken && toolReturned) { clearTimeout(timer); resolve({ transcript, spoken, written, receivedAudio, toolReturned, interrupted, cleared, clearRoundTripMs, types }); }
      };
    });
    const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
    const connection = await window.zen.voiceStart(offer.sdp); if (!connection.ok) throw new Error(connection.error);
    await pc.setRemoteDescription({ type: 'answer', sdp: connection.value.sdp });
    await new Promise(resolve => dc.onopen = resolve);
    source.start(context.currentTime + .5);
    const result = await finished; pc.close(); await context.close(); return result;
  })()`);
  await backend.stop();
  const voiceTask = events.filter(e => e.state === 'completed').at(-1);
  const report = { at: new Date().toISOString(), text, voice: result, voiceTask, metadata, busyAtInterrupt, passed: interruptionTest ? busyAtInterrupt && voiceTask?.state === 'completed' && result.cleared && result.written.includes('Microsoft') : !!voiceTask?.evidence && result.receivedAudio && /bloc de notas/i.test(result.spoken) };
  mkdirSync('test-results', { recursive: true }); writeFileSync(interruptionTest ? 'docs/evidence/voice-interruption-live.json' : 'test-results/live-integration.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ text: text.state, voice: result, voiceTask, passed: report.passed }));
  clearTimeout(timer); app.exit(report.passed ? 0 : 1);
}).catch(error => { clearTimeout(timer); console.error('Live integration failed:', error?.status ?? error.message); app.exit(1); });
