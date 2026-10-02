import {build} from 'esbuild';
import {spawn} from 'node:child_process';
import electron from 'electron';
await build({entryPoints:['scripts/computer-native.ts'],bundle:true,platform:'node',format:'cjs',outfile:'test-results/computer-native.cjs',external:['electron','playwright']});
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.OPENAI_API_KEY;
const child=spawn(electron,['test-results/computer-native.cjs'],{env,windowsHide:true,stdio:'inherit'});const timer=setTimeout(()=>child.kill(),45000);child.on('exit',code=>{clearTimeout(timer);process.exitCode=code??1;});
