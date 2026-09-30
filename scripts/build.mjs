import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('dist/tools', { recursive: true });
await build({ entryPoints: ['src/main/index.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: 'dist/main.cjs', external: ['electron'], loader: { '.txt': 'text' } });
await build({ entryPoints: ['src/preload/index.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: 'dist/preload.cjs', external: ['electron'] });
await build({ entryPoints: ['src/tools/windows/notepad.ts'], bundle: true, platform: 'node', format: 'esm', outfile: 'dist/tools/notepad.mjs' });
await copyFile('src/tools/windows/notepad.ps1', 'dist/tools/notepad.ps1');
