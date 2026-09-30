import { build } from 'esbuild';
import { spawn } from 'node:child_process';
import electron from 'electron';
await build({ entryPoints: ['scripts/native-electron.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: 'test-results/native-electron.cjs', external: ['electron'], loader: { '.txt': 'text' } });
const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE; if (env.ZEN_TEST_VISION !== '1') delete env.OPENAI_API_KEY;
const child = spawn(electron, ['test-results/native-electron.cjs'], { env, stdio: 'inherit', windowsHide: true });
const timer = setTimeout(() => child.kill(), env.ZEN_TEST_VISION === '1' ? 100000 : 30000);
child.on('exit', code => { clearTimeout(timer); process.exitCode = code ?? 1; });
