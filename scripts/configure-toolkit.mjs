import OpenAI from 'openai';
import { build } from 'esbuild';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
if(!process.env.OPENAI_API_KEY)throw Error('Falta la clave ya autorizada.');
await mkdir('test-results',{recursive:true});
await build({entryPoints:['src/tools/toolkit.ts'],bundle:true,platform:'node',format:'esm',outfile:'test-results/toolkit.mjs',loader:{'.txt':'text'},external:['openai']});
const {toolkitTools}=await import('../test-results/toolkit.mjs');
const client=new OpenAI({maxRetries:0,timeout:30000});
const saved=JSON.parse(await readFile('config/saved-agent.json','utf8')),instructions=await readFile('config/saved-agent.instructions.txt','utf8');
const id='agent_98652f2661104ff282e5e5c9ca817ef1325ffa8195414c009f';
const canonical=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
const remote=await client.beta.agents.retrieve(id);
for(const key of ['name','model','tools','multi_agent','reasoning','text'])if(canonical(remote[key])!==canonical(saved[key]))throw Error('Configuración remota divergente en '+key+'; no se sobrescribe.');
if(remote.instructions.replace(/\r\n/g,'\n')!==instructions.replace(/\r\n/g,'\n'))throw Error('Las instrucciones cambiaron; no se sobrescriben.');
const extras=toolkitTools.filter(tool=>!remote.tools.some(existing=>existing.type===tool.type&&(tool.type!=='function'||existing.name===tool.name)));
const refreshed=toolkitTools.filter(tool=>tool.type==='function'&&remote.tools.some(existing=>existing.type==='function'&&existing.name===tool.name&&existing.description!==tool.description));
if(!extras.length&&!refreshed.length){console.log(JSON.stringify({alreadyConfigured:true,model:remote.model}));process.exit(0);}
try{await access('config/saved-agent.desktop.json');}catch{await writeFile('config/saved-agent.desktop.json',JSON.stringify(saved,null,2)+'\n');}
// User explicitly authorized all pictured tool categories on 2026-10-01.
const updated=await client.beta.agents.update(id,{tools:[...remote.tools.map(tool=>refreshed.find(replacement=>replacement.type==='function'&&tool.type==='function'&&replacement.name===tool.name)??tool),...extras]});
for(const key of ['name','model','multi_agent','reasoning','text','instructions'])if(canonical(updated[key])!==canonical(remote[key]))throw Error('Se detectó un cambio imprevisto en '+key+'. Revisar antes de usar.');
const verified=await client.beta.agents.retrieve(id);
if(canonical(verified.tools)!==canonical(updated.tools))throw Error('No se verificó la actualización de herramientas.');
await writeFile('config/saved-agent.json',JSON.stringify({...saved,tools:verified.tools},null,2)+'\n');
const report={at:new Date().toISOString(),agentId:id,model:verified.model,added:verified.tools.filter(tool=>tool.type==='tool_search'||tool.type==='function'&&['zen_files','zen_cloud'].includes(tool.name)).map(tool=>tool.type==='function'?tool.name:tool.type),refreshed:refreshed.map(tool=>tool.type==='function'?tool.name:tool.type),preserved:['name','model','multi_agent','reasoning','text','instructions'],verified:true,hostedViaResponses:true,localShell:false,localFilesUploaded:false};
await writeFile('docs/evidence/toolkit-config.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
