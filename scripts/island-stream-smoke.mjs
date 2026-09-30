// Opt-in, single informational API request. No desktop effects or configuration changes.
import OpenAI from 'openai';
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
if (!process.env.OPENAI_API_KEY) throw Error('Falta la clave de pruebas autorizada; no se muestran credenciales.');
await mkdir('test-results', { recursive: true });
await build({ entryPoints: ['src/agent/saved.ts'], bundle: true, platform: 'node', format: 'esm', outfile: 'test-results/island-agent.mjs', loader: { '.txt': 'text' }, external: ['openai'] });
const { SavedAgent } = await import('../test-results/island-agent.mjs');
let completed = false; const updates = []; const metadata = []; const started = Date.now();
const agent = new SavedAgent({ client: () => new OpenAI({ maxRetries: 0, timeout: 90000 }), log: row => metadata.push(row) });
try {
  const result = await agent.run('Prueba informativa de interfaz. En el campo result usa una cadena de texto con tres frases breves en español sobre cómo organizar tareas pendientes. Mantén el formato de respuesta indicado por tus instrucciones. No busques en internet ni realices acciones externas.', AbortSignal.timeout(90000), (message, streamText) => { if (streamText) updates.push({ beforeCompletion: !completed, elapsedMs: Date.now() - started, characters: streamText.length }); });
  completed = true;
  const report = { at: new Date().toISOString(), passed: updates.length > 0 && updates.every(row => row.beforeCompletion) && !!result.message, durationMs: Date.now() - started, structured: result.structured, streamUpdates: updates, resultLength: result.message.length, configurationChanged: false, desktopEffects: false, requestCount: 1, metadata };
  await writeFile('docs/evidence/island-stream-live.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, streamUpdates: updates.length, resultLength: result.message.length, configurationChanged: false }));
  if (!report.passed) process.exitCode = 1;
} catch (error) { await writeFile('test-results/island-stream-failed.json', JSON.stringify({ message: error.message, durationMs: Date.now() - started, metadata }, null, 2)); console.error('La prueba del stream real no terminó correctamente.'); process.exitCode = 1; }
