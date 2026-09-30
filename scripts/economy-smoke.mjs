import OpenAI from 'openai';
import WebSocket from 'ws';
import { build } from 'esbuild';
import { mkdir, writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
if (!process.env.OPENAI_API_KEY) throw Error('Missing API key; credentials are never printed.');
await mkdir('test-results', { recursive: true });
await build({ stdin: { contents: "export { SavedAgent, SAVED_AGENT_ID } from './src/agent/saved'; export { Spending } from './src/storage/spending'; export { SettingsSchema } from './src/shared/contracts'; export { voiceConfiguration } from './src/agent/voice';", resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', outfile: 'test-results/economy.mjs', loader: { '.txt': 'text' }, external: ['openai', 'ws'] });
const { SavedAgent, Spending, SettingsSchema, SAVED_AGENT_ID, voiceConfiguration } = await import('../test-results/economy.mjs');
const client = new OpenAI({ maxRetries: 0, timeout: 90000 });
const config = SettingsSchema.parse({});
const spending = new Spending(await mkdtemp(join(tmpdir(), 'zen-economy-live-')), () => config);
const metadata = [];
const agent = new SavedAgent({ client: () => client, log: row => metadata.push(row), settings: () => config, spending });
const report = { at: new Date().toISOString(), mode: 'live', paidTasks: 0 };
try {
  const before = await client.beta.agents.retrieve(SAVED_AGENT_ID);
  const first = await agent.run('Responde solo con la palabra listo. No uses herramientas.', AbortSignal.timeout(90000), () => {});
  report.paidTasks++;
  const second = await agent.run('Repite esa misma palabra. No uses herramientas.', AbortSignal.timeout(90000), () => {}, undefined, { sessionId: first.sessionId, requestId: crypto.randomUUID(), summary: first.message });
  report.paidTasks++;
  const session = await client.beta.agents.sessions.retrieve(second.sessionId);
  report.agent = { completed: first.message.trim() === 'listo' && second.message.trim() === 'listo', continuedSameSession: first.sessionId === second.sessionId, model: session.agent.model, multiAgent: session.agent.multi_agent, metadata: session.metadata, reasoning: session.agent.reasoning, serviceTier: session.agent.service_tier, usage: session.usage };
  report.spending = spending.summary();
  report.savedAgentUnchanged = JSON.stringify(before) === JSON.stringify(await client.beta.agents.retrieve(SAVED_AGENT_ID));
  report.voiceConfiguration = await new Promise((resolve, reject) => {
    const socket = new WebSocket(`wss://api.openai.com/v1/realtime?model=${encodeURIComponent(config.voiceModel)}`, { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, handshakeTimeout: 10000 });
    const timer = setTimeout(() => { socket.close(); reject(Error('Voice configuration timed out')); }, 20000);
    socket.on('open', () => socket.send(JSON.stringify({ type: 'session.update', session: voiceConfiguration(config) })));
    socket.on('message', data => { const e = JSON.parse(data.toString()); if (e.type === 'session.updated') { clearTimeout(timer); socket.close(); resolve({ accepted: true, model: e.session.model, automaticResponse: e.session.audio.input.turn_detection.create_response, tools: e.session.tools.length, generatedAudio: false }); } else if (e.type === 'error') { clearTimeout(timer); socket.close(); reject(Error(`Voice configuration rejected: ${e.error?.code} (${e.error?.param})`)); } });
    socket.on('error', () => { clearTimeout(timer); reject(Error('Voice connection failed')); });
  });
  if (!report.agent.completed || !report.agent.continuedSameSession || !report.savedAgentUnchanged) throw Error('Live economy verification failed');
} catch (error) { report.error = error.message; process.exitCode = 1; }
await writeFile('docs/evidence/economy-live.json', JSON.stringify({ ...report, metadata }, null, 2));
console.log(JSON.stringify(report));
