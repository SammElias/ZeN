import {spawn,type ChildProcessWithoutNullStreams} from 'node:child_process';
import {existsSync,readdirSync} from 'node:fs';
import {join,delimiter} from 'node:path';
import {createInterface} from 'node:readline';
import {ZenError} from '../shared/errors';

export interface CodexTransport {
 request(method:string,params:unknown):Promise<any>;
 respond(id:string|number,result:unknown):void;
 reject(id:string|number):void;
 onMessage:(message:any)=>void;
 onClose:()=>void;
 close():void;
}
/** Fixed executable/stdio protocol. No renderer-selected program, shell, tokens or RPC method. */
export function findCodex(){
 const candidates=(process.env.PATH??'').split(delimiter).map(p=>join(p,'codex.exe'));
 const root=join(process.env.LOCALAPPDATA??'','OpenAI','Codex','bin');
 if(existsSync(root))for(const dir of readdirSync(root).reverse())candidates.push(join(root,dir,'codex.exe'));
 const found=candidates.find(existsSync);if(!found)throw new ZenError('Instala o abre Codex del escritorio e inicia sesión con ChatGPT. No se usará una clave API.');return found;
}
export function codexEnvironment(env:NodeJS.ProcessEnv){const clean={...env};for(const key of Object.keys(clean))if(/API_KEY|ACCESS_TOKEN|AUTH_TOKEN|CODEX_API|OPENAI_BASE_URL/i.test(key))delete clean[key];return clean;}
export class CodexRpc implements CodexTransport {
 private child:ChildProcessWithoutNullStreams;
 private next=0;
 private pending=new Map<number,{resolve:(v:any)=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
 private closed=false;
 onMessage:(message:any)=>void=()=>{};
 onClose:()=>void=()=>{};
 constructor(private requestTimeoutMs=30000){
  this.child=spawn(findCodex(),['app-server','--stdio','-c','model_provider="openai"','-c','forced_login_method="chatgpt"'],{shell:false,windowsHide:true,env:codexEnvironment(process.env),stdio:['pipe','pipe','pipe']});
  // Stderr may contain paths or upstream details; never persist it in ZEN logs.
  this.child.stderr.resume();
  createInterface({input:this.child.stdout}).on('line',line=>{if(line.length>8_000_000){this.close();return;}try{const m=JSON.parse(line);if(m.method){this.onMessage(m);return;}const p=this.pending.get(m.id);if(!p)return;this.pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(new ZenError('Codex rechazó la operación ('+String(m.error.code??'error')+'). Revisa Codex; no se reenvió la petición.')):p.resolve(m.result);}catch{/* Non-protocol diagnostics are ignored. */}});
  this.child.on('error',()=>this.close());this.child.on('exit',()=>this.close());
 }
 private write(message:unknown){if(this.closed||!this.child.stdin.writable)throw new ZenError('Codex se desconectó. No se reenvía el trabajo automáticamente.');this.child.stdin.write(JSON.stringify(message)+'\n');}
 async initialize(experimentalApi=false){await this.request('initialize',{clientInfo:{name:'zen_local',title:'ZEN',version:'0.2.0'},capabilities:{experimentalApi}});this.write({method:'initialized',params:{}});}
 request(method:string,params:unknown){return new Promise<any>((resolve,reject)=>{const id=++this.next;const timer=setTimeout(()=>{this.pending.delete(id);reject(new ZenError('Codex no confirmó la operación a tiempo. Revisa el chat en Codex antes de reintentar.'));this.close();},this.requestTimeoutMs);this.pending.set(id,{resolve,reject,timer});try{this.write({id,method,params});}catch(e){clearTimeout(timer);this.pending.delete(id);reject(e);}});}
 respond(id:string|number,result:unknown){this.write({id,result});}
 reject(id:string|number){this.write({id,error:{code:-32601,message:'Request not supported by ZEN; no permission granted.'}});}
 close(){if(this.closed)return;this.closed=true;for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(new ZenError('Codex se desconectó. El estado del trabajo debe revisarse.'));}this.pending.clear();this.child.stdin.destroy();this.child.kill();this.onClose();}
}
