import {build} from 'esbuild';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import electron from 'electron';
await mkdir('test-results',{recursive:true});
await build({entryPoints:['scripts/browser-smoke.ts'],bundle:true,platform:'node',format:'cjs',outfile:'test-results/browser-smoke.cjs',external:['electron']});
const profile=await mkdtemp(join(tmpdir(),'zen-browser-test-'));
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.OPENAI_API_KEY;
const results=[];
for(const phase of ['write','read']){
  const child=spawn(electron,[resolve('test-results/browser-smoke.cjs'),profile,phase],{env,windowsHide:true});let output='',errors='';child.stdout.on('data',s=>output+=s);child.stderr.on('data',s=>errors+=s);const timer=setTimeout(()=>child.kill(),45000);
  const code=await new Promise((r,j)=>{child.once('error',j);child.once('exit',r);}).finally(()=>clearTimeout(timer));
  if(code!==0)throw Error(output+'\n'+errors);
  const result=JSON.parse(output.split(/\r?\n/).find(row=>row.startsWith('{'))??'{}');if(!result.passed)throw Error('Missing fixture report');results.push(result);
}
const report={at:new Date().toISOString(),passed:true,scope:'real Electron, synthetic HTTPS fixture, persistent cookies and storage across two processes',results,realGoogleLoginVerified:false,realChatGptLoginVerified:false,apiCalled:false};
await writeFile('docs/evidence/browser-native.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
