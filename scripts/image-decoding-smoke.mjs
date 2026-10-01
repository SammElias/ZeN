import {build} from 'esbuild';
import {spawn} from 'node:child_process';
import electron from 'electron';
await build({entryPoints:['scripts/image-decoding-smoke.ts'],bundle:true,platform:'node',format:'cjs',outfile:'test-results/image-decoding-smoke.cjs',external:['electron']});
const env={...process.env};delete env.OPENAI_API_KEY;delete env.ELECTRON_RUN_AS_NODE;
const child=spawn(electron,['test-results/image-decoding-smoke.cjs'],{env,windowsHide:true});let output='';child.stdout.on('data',chunk=>output+=chunk);const timer=setTimeout(()=>child.kill(),20000);const code=await new Promise(resolve=>child.on('exit',resolve));clearTimeout(timer);const line=output.split(/\r?\n/).find(row=>row.startsWith('{'));if(code!==0||!line)throw Error('No se completó la prueba local de imagen.');const report=JSON.parse(line);console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
