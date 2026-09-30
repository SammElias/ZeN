// Opt-in integration harness: uses application modules, synthetic input audio,
// actual OpenAI and actual Windows executor. Never writes the API key.
import { app, BrowserWindow, ipcMain } from 'electron';
import { join, resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import OpenAI from 'openai';
import { Orchestrator } from '../src/agent/orchestrator';
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
  const orchestrator = new Orchestrator({ client: () => client, settings: () => settings, execute: signal => openNotepad(resolve('dist/tools/notepad.ps1'), signal), emit: e => events.push(e), log: row => metadata.push(row) });
  const text = await orchestrator.run('Abre el Bloc de notas', randomUUID());
  if (text.state !== 'completed' || !text.evidence) throw new Error('Live text failed: ' + text.message);
  const backend = new VoiceBackend({ key: () => process.env.OPENAI_API_KEY!, settings: () => settings, orchestrator, log: row => metadata.push(row), emit: e => events.push(e) });
  // OpenAI-generated test utterance, not a microphone recording.
  const speech = await client.audio.speech.create({ model: 'gpt-4o-mini-tts', voice: 'coral', input: 'Abre el Bloc de notas.', response_format: 'wav' });
  const wave = Buffer.from(await speech.arrayBuffer()).toString('base64');
  const window = new BrowserWindow({ show: false, webPreferences: { preload: resolve('dist/preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  ipcMain.handle('zen:settings', () => ({ ok: true, value: { settings, hasKey: true, shortcutRegistered: false, protectedStorage: true } }));
  ipcMain.handle('zen:voice-start', (_e, sdp) => backend.start(sdp).then(value => ({ ok: true, value })).catch(error => ({ ok: false, error: error?.status ? `HTTP ${error.status}` : error.message })));
  await window.loadFile(resolve('dist/renderer/index.html'));
  // Test page gets no credentials. It only receives generated audio.
  const result = await window.webContents.executeJavaScript(`(async () => {
    const context = new AudioContext(); await context.resume();
    const audio = Uint8Array.from(atob(${JSON.stringify(wave)}), c => c.charCodeAt(0));
    const buffer = await context.decodeAudioData(audio.buffer);
    const destination = context.createMediaStreamDestination();
    const source = context.createBufferSource(); source.buffer = buffer; source.connect(destination);
    const pc = new RTCPeerConnection(); pc.addTrack(destination.stream.getAudioTracks()[0], destination.stream);
    const dc = pc.createDataChannel('oai-events');
    let transcript = ''; let spoken = ''; let receivedAudio = false; let toolReturned = false; const types = [];
    pc.ontrack = e => { receivedAudio = true; const monitor = document.createElement('audio'); monitor.muted = true; monitor.srcObject = e.streams[0]; monitor.play().catch(() => {}); };
    const finished = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Voice response timeout: ' + types.join(','))), 45000);
      dc.onmessage = e => { const event = JSON.parse(e.data); types.push(event.type);
        if (event.type === 'conversation.item.input_audio_transcription.completed') transcript = event.transcript;
        if (event.type === 'response.output_audio_transcript.done') spoken = event.transcript;
        if (event.type === 'conversation.item.added' && event.item?.type === 'function_call_output') toolReturned = true;
        if (event.type === 'response.done' && spoken && toolReturned) { clearTimeout(timer); resolve({ transcript, spoken, receivedAudio, toolReturned, types }); }
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
  const report = { at: new Date().toISOString(), text, voice: result, voiceTask, metadata, passed: !!voiceTask?.evidence && result.receivedAudio && /bloc de notas/i.test(result.spoken) };
  mkdirSync('test-results', { recursive: true }); writeFileSync('test-results/live-integration.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ text: text.state, voice: result, voiceTask, passed: report.passed }));
  clearTimeout(timer); app.exit(report.passed ? 0 : 1);
}).catch(error => { clearTimeout(timer); console.error('Live integration failed:', error?.status ?? error.message); app.exit(1); });
