import OpenAI from 'openai';
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
if (!process.env.OPENAI_API_KEY) throw Error('Falta OPENAI_API_KEY; no se muestran credenciales.');
await mkdir('test-results', { recursive: true });
await build({ entryPoints: ['src/agent/saved.ts'], bundle: true, platform: 'node', format: 'esm', outfile: 'test-results/saved-agent.mjs', loader: { '.txt': 'text' }, external: ['openai'] });
const { SavedAgent } = await import('../test-results/saved-agent.mjs');
const metadata = []; const start = Date.now();
const agent = new SavedAgent({ client: () => new OpenAI({ maxRetries: 0, timeout: 90000 }), log: row => metadata.push(row) });
try {
  const result = await agent.run('Busca en documentación oficial de Microsoft qué es Microsoft 365 Business Basic. Responde en español con fuentes oficiales enlazadas y fecha de consulta. No realices acciones sobre archivos ni equipos.', AbortSignal.timeout(90000), () => {});
  const report = { at: new Date().toISOString(), durationMs: Date.now() - start, sessionId: result.sessionId, turnId: result.turnId, structured: result.structured, result: result.message, metadata, remoteActions: false };
  await writeFile('docs/evidence/saved-agent-live.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ durationMs: report.durationMs, sessionId: result.sessionId, structured: result.structured, responseLength: result.message.length, events: metadata.length }));
} catch (error) { await writeFile('test-results/saved-agent-failed.json', JSON.stringify({ error: error.message, durationMs: Date.now() - start, metadata }, null, 2)); console.error(error.message); process.exitCode = 1; }
