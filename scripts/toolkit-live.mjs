import OpenAI from 'openai';
import { build } from 'esbuild';
import { mkdtemp, writeFile, mkdir, rm, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
if(!process.env.OPENAI_API_KEY)throw Error('La clave autorizada no está disponible.');
const selected=process.argv.find(arg=>arg.startsWith('--kind='))?.split('=')[1]??'web';
if(!/^[a-z-]+$/.test(selected))throw Error('Prueba inválida.');
const compiled='test-results/toolkit-live-'+selected;
await mkdir(compiled,{recursive:true});
await build({entryPoints:['src/tools/toolkit.ts','src/tools/artifacts.ts','src/tools/library.ts','src/agent/saved.ts','src/storage/spending.ts','src/shared/contracts.ts'],bundle:true,platform:'node',format:'esm',outdir:compiled,loader:{'.txt':'text'},external:['openai']});
const {Toolkit}=await import('../'+compiled+'/tools/toolkit.js'),{LocalLibrary}=await import('../'+compiled+'/tools/library.js'),{Artifacts}=await import('../'+compiled+'/tools/artifacts.js'),{SavedAgent}=await import('../'+compiled+'/agent/saved.js'),{Spending}=await import('../'+compiled+'/storage/spending.js'),{SettingsSchema}=await import('../'+compiled+'/shared/contracts.js');
const client=new OpenAI({maxRetries:0,timeout:90000}),settings=SettingsSchema.parse({}),rows=[];
const temp=await mkdtemp(join(tmpdir(),'zen-toolkit-live-'));
const spending=new Spending(join(temp,'usage'),()=>settings),artifacts=new Artifacts(),library=new LocalLibrary(()=>[join(temp,'files')]);
await mkdir(join(temp,'files'));await writeFile(join(temp,'files','zen-toolkit-fixture.txt'),'Archivo sintético de prueba de ZEN. Número de verificación: 7319.');
const toolkit=new Toolkit({client:()=>client,settings:()=>settings,log:row=>rows.push(row),library,artifacts,spending,...(selected==='mcp'?{mcp:()=>({label:'openai_docs',url:'https://developers.openai.com/mcp',tools:['search_openai_docs']})}:{})});
const agent=new SavedAgent({client:()=>client,settings:()=>settings,spending,maxToolCalls:()=>4,log:row=>rows.push(row)});
const report={at:new Date().toISOString(),kind:selected,model:'gpt-6.1-sol',realApi:true,passed:false,syntheticDataOnly:true,localFilesUploaded:false,windowsEffects:false};
try {
 if(selected==='web'||selected==='files'||selected==='bridge-code') {
  const text=selected==='web'?'Busca en la web, en la documentación oficial de Microsoft, qué es Microsoft 365 Business Basic. Cita al menos una fuente con su enlace. No consultes archivos ni ejecutes acciones.':selected==='files'?'Busca mis archivos con el nombre zen-toolkit-fixture.txt y dime el número que contiene. Usa la búsqueda local zen_files; no busques en la web.':'Calcula la media de los datos 7, 11 y 18 usando Code Interpreter con zen_cloud, kind code. Comprueba el cálculo ejecutando código; no basta con calcularlo de memoria.';
  const result=await agent.run(text,AbortSignal.timeout(90000),()=>{},undefined,undefined,undefined,toolkit.handler(text));
  report.state=result.needsInput?'awaiting_input':'completed';report.result=result.message;report.sessionId=result.sessionId;
  report.toolNames=rows.filter(row=>row.type==='toolkit_tool').map(row=>({name:row.name,success:row.success}));
  report.webSearchCompleted=rows.some(row=>row.type==='web_tool'&&row.status==='completed');
  report.sourceLinks=result.message.match(/https?:\/\/[^\s)<>]+/g)??[];
  report.cloudItems=rows.filter(row=>row.type==='cloud_response').flatMap(row=>row.items);
  report.passed=!result.needsInput&&(selected==='web'?report.sourceLinks.length>0&&report.webSearchCompleted:selected==='files'?result.message.includes('7319')&&report.toolNames.some(row=>row.name==='zen_files'&&row.success):report.cloudItems.some(row=>row.type==='code_interpreter_call'&&row.status==='completed'));
 } else {
  const prompts={mcp:'Consulta MCP search_openai_docs con estos argumentos JSON exactos: {"query":"Responses API shell tool","limit":1}. Usa solo esa consulta y responde con un enlace de documentación.',code:'Calcula la media de 7, 11 y 18 con Code Interpreter. Verifica con assert que es 12.',shell:'Ejecuta una shell en el contenedor aislado para comprobar que 6 por 7 son 42, con Python y assert. No accedas a la red.',skills:'Usa la habilidad zen-analysis para comprobar en el contenedor que la media de 7, 11 y 18 es 12. Lee su SKILL.md y ejecuta una comprobación con assert.',patch:'Crea un parche en el espacio aislado: un archivo demo.py con assert 6 * 7 == 42. Usa apply_patch; no ejecutes el código ni edites el PC.',image:'Genera una imagen simple de un círculo violeta sobre fondo blanco, sin texto.'};
  if(!prompts[selected])throw Error('Tipo de prueba no reconocido.');
  const result=await toolkit.cloud({kind:selected,prompt:prompts[selected],url:null},prompts[selected],AbortSignal.timeout(90000));
  const content=JSON.parse(result.agentContent);report.result=content.result;report.artifacts=result.artifacts.map(meta=>({...meta,bytes:artifacts.get(meta.id).data.length}));report.localFilesChanged=content.localFilesChanged;
  report.cloudItems=rows.filter(row=>row.type==='cloud_response').flatMap(row=>row.items);report.passed=content.verified===true;
 }
 report.spending=spending.summary();
} catch(error) {report.error=error?.status?`API ${error.status}: ${String(error.code??error.type??'rejected')}`:error.message;report.diagnostic=String(error.message??'').replace(/sk-[A-Za-z0-9_-]+/g,'[redacted]').slice(0,1200);report.parameter=error.param;report.spending=spending.summary();}
finally {await writeFile(`docs/evidence/toolkit-live-${selected}.json`,JSON.stringify(report,null,2));await rm(temp,{recursive:true,force:true});}
console.log(JSON.stringify({...report,result:undefined,sourceLinks:report.sourceLinks?.length}));if(!report.passed)process.exitCode=1;
