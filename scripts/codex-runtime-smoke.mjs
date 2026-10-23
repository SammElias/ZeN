import {build} from 'esbuild';
import {spawn} from 'node:child_process';
await build({stdin:{contents:`
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {randomUUID} from 'node:crypto';
import {ConversationStore} from './src/storage/conversations';
import {HumanConfirmations} from './src/policy/human-confirmations';
import {CodexRuntime} from './src/main/codex-runtime';
import {CodexRpc} from './src/main/codex-rpc';
const directory=mkdtempSync(join(tmpdir(),'zen-codex-native-')),store=new ConversationStore(directory),rpc=new CodexRpc();
const events:any[]=[];const runtime=new CodexRuntime({directory,store,transport:()=>rpc,confirmations:new HumanConfirmations(()=>{}),emit:e=>events.push({state:e.state,activity:e.activity,delta:!!e.streamText}),changed:()=>{}});
const chat=store.create(null),id=randomUUID();store.begin(chat.id,id,'Synthetic integration check');
try{const account=await runtime.check();const result=await runtime.run({id,chatId:chat.id,text:'Responde exactamente CODEX_ZEN_OK. No uses herramientas ni archivos. Esta es una prueba de conexión.',signal:AbortSignal.timeout(90000)});const report={at:new Date().toISOString(),scope:'Codex installed app-server, managed ChatGPT account, one synthetic turn',account:account.account,state:result.state,exactResponse:result.message.trim()==='CODEX_ZEN_OK',streamObserved:events.some(e=>e.delta),threadPersisted:!!runtime.threadId(chat.id),apiKeyUsed:false,userMessagesReplayed:false,model:'gpt-6.1-sol',passed:result.state==='completed'&&result.message.trim()==='CODEX_ZEN_OK'};if(result.sessionId)await rpc.request('thread/archive',{threadId:result.sessionId});writeFileSync('docs/evidence/codex-runtime-native.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;}catch(e){console.error(e instanceof Error?e.message:'Error');process.exitCode=1;}finally{runtime.dispose();rpc.close();store.close();rmSync(directory,{recursive:true,force:true});}
`,resolveDir:process.cwd(),sourcefile:'codex-runtime-probe.ts',loader:'ts'},bundle:true,platform:'node',format:'esm',outfile:'release/codex-runtime-probe.mjs'});
const child=spawn(process.execPath,['release/codex-runtime-probe.mjs'],{windowsHide:true,stdio:'inherit'});
process.exitCode=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',code=>resolve(code??1));});
