import OpenAI from 'openai';
import { mkdir, writeFile } from 'node:fs/promises';
if (process.env.ZEN_LIVE_API !== '1') throw new Error('Opt-in required: set ZEN_LIVE_API=1. This test may consume API balance.');
if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY absent');
const client = new OpenAI({ maxRetries: 0, timeout: 90000 });
const rows = [];
for (const model of ['gpt-6-astra', 'gpt-realtime-2.1', 'gpt-4o-mini-transcribe']) {
  try { await client.models.retrieve(model); rows.push({ check: 'model-access', model, passed: true }); }
  catch (e) { rows.push({ check: 'model-access', model, passed: false, status: e.status, code: e.code }); }
}
try {
  const response = await client.responses.create({ model: 'gpt-6-astra', store: false, reasoning: { effort: 'medium' }, max_output_tokens: 2048, input: 'Abre el Bloc de notas', instructions: 'Para abrir Bloc de notas usa exclusivamente open_application con application notepad.', tools: [{ type: 'function', name: 'open_application', strict: true, description: 'Abre Bloc de notas', parameters: { type: 'object', properties: { application: { type: 'string', enum: ['notepad'] } }, required: ['application'], additionalProperties: false } }], parallel_tool_calls: false });
  const call = response.output.find(item => item.type === 'function_call');
  rows.push({ check: 'responses-function-calling', model: response.model, status: response.status, requestId: response._request_id, passed: call?.name === 'open_application' && JSON.parse(call.arguments).application === 'notepad', usage: response.usage });
  // This probe deliberately does not execute a local action.
} catch (e) { rows.push({ check: 'responses-function-calling', passed: false, status: e.status, code: e.code, name: e.name }); }
try {
  const secret = await client.realtime.clientSecrets.create({ session: { type: 'realtime', model: 'gpt-realtime-2.1', audio: { output: { voice: 'marin' } } } });
  rows.push({ check: 'realtime-client-secret', passed: typeof secret.value === 'string', expiresAt: secret.expires_at });
} catch (e) { rows.push({ check: 'realtime-client-secret', passed: false, status: e.status, code: e.code, name: e.name }); }
const result = { at: new Date().toISOString(), sdk: '7.25.0', rows };
await mkdir('test-results', { recursive: true }); await writeFile('test-results/api.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
