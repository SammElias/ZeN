import OpenAI from 'openai';
import {mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {generatedFiles} from '../src/tools/generated-files';
import {Artifacts} from '../src/tools/artifacts';
import {exportResult} from '../src/main/result-export';
import {estimateUsd} from '../src/storage/spending';
import saved from '../config/saved-agent.json';
async function main(){
 if(process.env.ZEN_LIVE_API!=='1'||!process.env.OPENAI_API_KEY)throw new Error('Explicit live opt-in and existing key required');
 const client=new OpenAI({maxRetries:0,timeout:60000}),signal=AbortSignal.timeout(65000);
 const response=await client.responses.create({model:saved.model,store:false,reasoning:{effort:'low'},max_output_tokens:1000,input:'Crea /mnt/data/zen-prueba.csv con contenido exacto nombre,valor\nZEN,7\n usando Python en Code Interpreter. Responde solo con un enlace al archivo generado. No uses red ni otros archivos.',tools:[{type:'code_interpreter',container:{type:'auto',memory_limit:'1g',network_policy:{type:'disabled'}}}],tool_choice:{type:'code_interpreter'}},{signal});
 const store=new Artifacts(),containers=new Set(response.output.filter(row=>row.type==='code_interpreter_call'&&row.status==='completed').map(row=>row.container_id));
 const files=await generatedFiles(client,response,containers,store,signal);assert.equal(files.length,1);const item=store.get(files[0].id);assert.match(item.data.toString(),/ZEN,7/);
 const folder=await mkdtemp(join(tmpdir(),'zen-generated-result-'));const path=await exportResult(join(folder,'zen-prueba.csv'),item.data,'.csv');assert.equal(await readFile(path,'utf8'),item.data.toString());
 const result={at:new Date().toISOString(),passed:true,scope:'real-responses-code-interpreter-download-and-local-export',model:response.model,apiCalled:true,usage:response.usage,estimatedTokenUsd:estimateUsd(saved.model,response.usage),containerFees:'not included in token estimate',bytes:item.data.length,title:item.meta.title};await writeFile('docs/evidence/generated-file-live.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
void main().catch(async error=>{const result={at:new Date().toISOString(),passed:false,apiCalled:true,status:error.status,code:error.code,name:error.name};await writeFile('docs/evidence/generated-file-live.json',JSON.stringify(result,null,2));console.error(JSON.stringify(result));process.exitCode=1;});
