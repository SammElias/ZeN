import { build } from 'esbuild';
import electron from 'electron';
import { spawn } from 'node:child_process';
if (process.env.ZEN_LIVE_API !== '1') throw new Error('Set ZEN_LIVE_API=1 to authorize paid API integration tests.');
await build({ entryPoints: ['scripts/live-electron.ts'], outfile: 'dist/live-test.cjs', bundle: true, platform: 'node', format: 'cjs', external: ['electron'], loader: { '.txt': 'text' } });
const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, ['dist/live-test.cjs'], { env, windowsHide: true, stdio: 'inherit' });
child.on('exit', code => process.exit(code ?? 1));
