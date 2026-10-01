import { build } from 'esbuild';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
if(!process.env.OPENAI_API_KEY)throw Error('Falta la clave autorizada.');
await build({entryPoints:['scripts/visual-tool-smoke.ts'],bundle:true,platform:'node',format:'cjs',outfile:'test-results/visual-tool.cjs',external:['electron']});
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const child=spawn('node_modules/electron/dist/electron.exe',['test-results/visual-tool.cjs'],{env,windowsHide:true});
const started=Date.now();child.stdout.resume();let diagnostic='';child.stderr.on('data',chunk=>diagnostic+=chunk);const timer=setTimeout(()=>child.kill(),110000);
const code=await new Promise(resolve=>{child.on('error',()=>resolve(1));child.on('exit',resolve);});clearTimeout(timer);
let report;try{report=JSON.parse(await readFile('docs/evidence/toolkit-live-browser.json','utf8'));}catch{}
if(code!==0||!report?.passed||Date.parse(report.at)<started){console.error('La prueba visual no terminó correctamente. Consulta docs/evidence/toolkit-live-browser.json.');process.exitCode=1;}else console.log(JSON.stringify(report));
