import { spawn } from 'node:child_process';
import electron from 'electron';
if (process.env.ZEN_LIVE_API !== '1' || !process.env.OPENAI_API_KEY) throw Error('API real: requiere clave segura y ZEN_LIVE_API=1.');
const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, ['.', '--zen-desktop-live-smoke'], { env, windowsHide: true });
let output = ''; let errors = ''; child.stdout.on('data', chunk => output += chunk); child.stderr.on('data', chunk => errors += chunk);
const timer = setTimeout(() => child.kill(), 200000);
const code = await new Promise(resolve => { child.on('exit', resolve); child.on('error', () => resolve(1)); }); clearTimeout(timer);
const line = output.split(/\r?\n/).find(row => row.startsWith('{'));
if (!line || code !== 0) { console.error('Prueba del puente fallida; revisa docs/evidence/desktop-bridge-live.json. ' + errors.slice(0, 500)); process.exitCode = 1; }
else { const report = JSON.parse(line); if (Object.values(report.objective ?? {}).some(value => value !== true)) process.exitCode = 1; console.log(JSON.stringify({ passed: process.exitCode !== 1, objective: report.objective })); }
