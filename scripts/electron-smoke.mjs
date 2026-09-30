import { spawn } from 'node:child_process';
import electron from 'electron';
import { mkdir, writeFile } from 'node:fs/promises';
const environment = { ...process.env }; delete environment.ELECTRON_RUN_AS_NODE; delete environment.OPENAI_API_KEY;
const child = spawn(electron, ['.', '--zen-smoke'], { env: environment, windowsHide: true });
let output = ''; let errors = '';
child.stdout.on('data', chunk => output += chunk); child.stderr.on('data', chunk => errors += chunk);
const timer = setTimeout(() => { child.kill(); }, 30000);
const code = await new Promise(resolve => child.on('exit', resolve)); clearTimeout(timer);
const line = output.split(/\r?\n/).find(line => line.startsWith('{'));
if (!line || code !== 0) { console.error('Electron smoke failed:', code, errors.slice(0, 2000)); process.exit(1); }
const result = JSON.parse(line);
if (!result.bridge || !result.nodeAbsent || !result.rendered || !result.settings.ok || !result.protectedRoundTrip || !result.trayCreated) throw new Error('Electron assertions failed: ' + JSON.stringify(result));
await mkdir('test-results', { recursive: true }); await writeFile('test-results/electron.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
