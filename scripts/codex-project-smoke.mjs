import { build } from 'esbuild';
import { mkdir, writeFile, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import OpenAI from 'openai';
if(!process.env.OPENAI_API_KEY)throw Error('Falta la clave de entorno autorizada.');
const folder=resolve('test-results/codex-project-'+Date.now());await mkdir(folder,{recursive:true});
await build({entryPoints:['src/agent/codex-projects.ts','src/tools/project-drafts.ts'],bundle:true,platform:'node',format:'esm',outdir:folder,outExtension:{'.js':'.mjs'},packages:'external'});
const {CodexProjects}=await import(pathToFileURL(folder+'/agent/codex-projects.mjs').href),{ProjectDrafts}=await import(pathToFileURL(folder+'/tools/project-drafts.mjs').href);
const logs=[],progress=[];const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY,maxRetries:0,timeout:90000});
const codex=new CodexProjects({client:()=>client,log:row=>logs.push(row)});
const report={at:new Date().toISOString(),realApi:true,model:'gpt-6.1-sol',codexHostedHarness:true,personalFoldersUploaded:false,newExecutableCreated:false,passed:false};
try{
  const bundle=await codex.prepare('Crea una carpeta nueva llamada ZEN-Codex-fixture con subcarpetas docs y src y exactamente un archivo README.md cuyo contenido exacto sea: Proyecto sintético de prueba. Código: 62917. Sin otros archivos ni explicaciones en el archivo. Comprueba el contenido y entrega el manifiesto solicitado.',AbortSignal.timeout(90000),(message)=>{progress.push(message);if(progress.at(-2)!==message)console.log(message);});
  report.bundleVerified=bundle.name==='ZEN-Codex-fixture'&&bundle.directories.includes('docs')&&bundle.directories.includes('src')&&bundle.files.length===1&&bundle.files[0].path==='README.md'&&bundle.files[0].content.includes('62917');
  if(!report.bundleVerified)throw Error('La propuesta sintética no coincide con lo solicitado.');
  const drafts=new ProjectDrafts(),draft=drafts.add(bundle),parent=await mkdtemp(join(tmpdir(),'zen-codex-fixture-'));
  const review=await drafts.destination(draft.id,parent);const saved=await drafts.approve(draft.id,review.approvalId,new AbortController().signal);
  report.windowsExportVerified=saved.verified&&(await readFile(join(saved.destination,'README.md'),'utf8')).includes('62917');
  report.cleanupConfirmed=logs.some(row=>row.type==='codex_cleanup'&&row.confirmed);report.session=logs.find(row=>row.type==='codex_project')?.sessionId;
  report.passed=report.bundleVerified&&report.windowsExportVerified&&report.cleanupConfirmed;
}catch(error){report.error=error?.status?`OpenAI HTTP ${error.status}`:error?.message||'Prueba incompleta';}
finally{report.logs=logs;report.progress=progress;await writeFile('docs/evidence/codex-project-live.json',JSON.stringify(report,null,2));}
console.log(JSON.stringify({passed:report.passed,error:report.error,evidence:'docs/evidence/codex-project-live.json'}));if(!report.passed)process.exitCode=1;
