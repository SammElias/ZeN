import {build} from 'esbuild';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import electron from 'electron';
await build({entryPoints:['scripts/browser-web-smoke.ts'],bundle:true,platform:'node',format:'cjs',outfile:'test-results/browser-web-smoke.cjs',external:['electron']});
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.OPENAI_API_KEY;
const child=spawn(electron,[resolve('test-results/browser-web-smoke.cjs')],{env,windowsHide:true,stdio:'pipe'});child.stdout.pipe(process.stdout);child.stderr.pipe(process.stderr);const timer=setTimeout(()=>child.kill(),60000);process.exitCode=await new Promise((r,j)=>{child.once('error',j);child.once('exit',code=>r(code??1));}).finally(()=>clearTimeout(timer));
