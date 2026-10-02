import {build} from 'esbuild';
import {spawn} from 'node:child_process';
import electron from 'electron';
await build({entryPoints:['scripts/computer-live.ts'],bundle:true,platform:'node',format:'cjs',outfile:'test-results/computer-live.cjs',external:['electron','playwright']});
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const child=spawn(electron,['test-results/computer-live.cjs'],{env,windowsHide:true,stdio:'inherit'});const timer=setTimeout(()=>child.kill(),240000);child.on('exit',code=>{clearTimeout(timer);process.exitCode=code??1;});
