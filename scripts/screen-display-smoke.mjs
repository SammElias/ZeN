import {build} from 'esbuild';
import {spawn} from 'node:child_process';
import electron from 'electron';
await build({entryPoints:['scripts/screen-display-smoke.ts'],bundle:true,platform:'node',format:'cjs',external:['electron'],outfile:'test-results/screen-display-smoke.cjs'});
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.OPENAI_API_KEY;
const child=spawn(electron,['test-results/screen-display-smoke.cjs'],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});let output='',errors='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>errors+=chunk);const timer=setTimeout(()=>child.kill(),30000);const code=await new Promise(resolve=>child.once('exit',resolve));clearTimeout(timer);const line=output.split(/\r?\n/).find(row=>row.startsWith('{'));if(code!==0||!line){console.error('Display probe failed:',code,errors.slice(0,800));process.exitCode=1;}else console.log(line);
