import {build} from 'esbuild';
import {spawn} from 'node:child_process';
await build({entryPoints:['scripts/conversations-live.ts'],outfile:'release/conversations-live.cjs',bundle:true,platform:'node',format:'cjs'});
const child=spawn(process.execPath,['release/conversations-live.cjs'],{windowsHide:true,stdio:'inherit',env:process.env});
child.on('exit',code=>process.exit(code??1));
