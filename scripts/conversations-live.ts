import OpenAI from 'openai';
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {ConversationStore} from '../src/storage/conversations';
import {ConversationProvider} from '../src/agent/conversation-provider';
import {SettingsSchema} from '../src/shared/contracts';
import {Spending} from '../src/storage/spending';

// Explicit opt-in; synthetic text only. Never output credentials or full HTTP errors.
async function main(){
if(process.env.ZEN_LIVE_API!=='1'||!process.env.OPENAI_API_KEY)throw Error('Live probe needs configured credentials and explicit opt-in.');
const directory=mkdtempSync(join(tmpdir(),'zen-conversations-live-'));
const client=new OpenAI({maxRetries:0,timeout:60000}),settings=SettingsSchema.parse({taskBudgetEur:.2});
let store=new ConversationStore(directory);
const spending=new Spending(directory,()=>settings);
const createProvider=()=>new ConversationProvider({client:()=>client,store,settings:()=>settings,spending});
let provider=createProvider();const chat=store.create(null),nonce='ZEN-'+randomUUID().slice(0,8);
const report:Record<string,unknown>={at:new Date().toISOString(),realApi:true,model:'gpt-6.1-sol',personalDataSent:false,toolsExecuted:false};
const turn=async(text:string)=>{const id=randomUUID();store.begin(chat.id,id,text);const result=await provider.run(chat.id,id,text,new AbortController().signal,(message,streamText)=>store.accept({id,requestId:id,state:'thinking',message,streamText}));store.finish(id,{id,state:'completed',message:result.message});return result;};
try{
 const first=await turn(`Prueba técnica. Recuerda solo en este chat la etiqueta ${nonce}. Responde 'Guardado'. No uses herramientas.`);report.firstCompleted=!!first.message;
 const current=store.context(chat.id);try{const compact=await client.responses.compact({model:'gpt-6.1-sol',input:current.items},{maxRetries:0});store.saveContext(chat.id,current.seq,compact.output,true);report.realCompaction=compact.output.some(i=>i.type==='compaction');}catch(e){report.realCompaction=false;report.compactionError={status:(e as any).status,code:(e as any).code};}
 store.close();store=new ConversationStore(directory);provider=createProvider();
 const second=await turn('¿Cuál es la etiqueta que te di antes? Devuelve solo esa etiqueta y no uses herramientas.');report.continuityAfterRestart=second.message.includes(nonce);report.localMessages=store.messages(chat.id).length;report.passed=report.firstCompleted&&report.continuityAfterRestart;
}catch(e){report.passed=false;report.error={status:(e as any).status,code:(e as any).code,type:(e as Error).name};}
finally{store.delete(chat.id);report.pendingCleanup=await provider.cleanup();store.close();mkdirSync('docs/evidence',{recursive:true});writeFileSync('docs/evidence/conversations-api.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
process.exitCode=report.passed?0:1;

}
void main();
