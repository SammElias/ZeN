import {randomUUID,createHash} from 'node:crypto';
import {CompanionTargetSchema,type CompanionTarget} from '../shared/codex-companion';
import type {GmailMessage} from '../shared/companion-gmail';
import {MailAnalysisPrepare,buildMailAnalysis,type MailAnalysisInput,type MailAnalysisPreview,type MailAnalysisReceipt,type MailReply} from '../shared/companion-mail-analysis';
import {correlatedResult,type CodexResult,type CodexResultState} from '../shared/companion-codex-result';
import type {CompanionLastReply} from '../shared/codex-companion';
type Receipt={marker:string;fingerprint:string;target:CompanionTarget;expires:number;since:number;action:MailAnalysisInput['action'];label:string;result?:CodexResult;flight?:Promise<CodexResultState>};
type Source={version:string;thread:GmailMessage;context?:string};
type Deps={source:(thread:string)=>Source;policy:()=>{visible:boolean;presentation:boolean;paused:boolean;target?:CompanionTarget;targetError?:string};copy:(text:string)=>void;openChat:(id:string)=>Promise<void>;readReply?:(target:CompanionTarget)=>Promise<CompanionLastReply|undefined>;now?:()=>number};
const fingerprint=(source:Source)=>createHash('sha256').update(JSON.stringify([source.context,source.thread.id,source.thread.subject,source.thread.messageCount,source.thread.truncated,source.thread.omittedMessages,source.thread.messages.map(m=>[m.id,m.text,m.from,m.to,m.subject,m.date,m.truncated])])).digest('hex');
/** Immutable, one-use clipboard handoff. This never starts work or calls a model/provider. */
export class CompanionMailAnalysis{
 private proposal?:{preview:MailAnalysisPreview;version:string;thread:string;target:CompanionTarget;replyMarker?:string;action:MailAnalysisInput['action']};private timer?:ReturnType<typeof setTimeout>;private closed=false;private now:()=>number;
 private replies=new Map<string,Receipt>();
 constructor(private deps:Deps){this.now=deps.now??Date.now;}
 private target(){const p=this.deps.policy();if(this.closed||!p.visible||p.presentation||p.paused){this.invalidate();throw Error('Abre Gmail y desactiva Presentación o pausa para preparar el análisis.');}if(!p.target||p.targetError){this.invalidate();throw Error('Revisa el chat y proyecto fijados en Preferencias.');}return CompanionTargetSchema.parse(p.target);}
 invalidate(){clearTimeout(this.timer);this.timer=undefined;this.proposal=undefined;}
 cancel(id:string){if(this.proposal?.preview.id===id)this.invalidate();}
 prepare(raw:MailAnalysisInput):MailAnalysisPreview{
  this.invalidate();const target=this.target(),input=MailAnalysisPrepare.parse(raw),source=this.deps.source(input.thread),id=randomUUID(),replyMarker=id,built=buildMailAnalysis(input,source.thread,replyMarker);
  const preview={...built,id,targetTitle:target.title,expiresAt:this.now()+120000};this.proposal={preview:{...preview},version:source.version,thread:input.thread,target:{...target},replyMarker,action:input.action};
  this.timer=setTimeout(()=>{if(this.proposal?.preview.id===preview.id)this.invalidate();},120000);this.timer.unref();return{...preview};
 }
 async handoff(id:string):Promise<MailAnalysisReceipt>{
  const target=this.target(),proposal=this.proposal;
  if(!proposal||proposal.preview.id!==id||proposal.preview.expiresAt<=this.now())throw Error('La petición ya se utilizó o caducó. Vuelve a revisarla.');
  if(target.session!==proposal.target.session||target.cwd.toLowerCase()!==proposal.target.cwd.toLowerCase()){this.invalidate();throw Error('El chat de destino cambió. Revisa de nuevo la petición.');}
  let source:Source;try{source=this.deps.source(proposal.thread);}catch{this.invalidate();throw Error('El correo abierto cambió. Revisa de nuevo la petición.');}
  if(source.version!==proposal.version){this.invalidate();throw Error('El correo abierto cambió. Revisa de nuevo la petición.');}
  this.invalidate();this.deps.copy(proposal.preview.prompt);this.replies.delete(proposal.thread);
  if(proposal.replyMarker){if(this.replies.size>=8)this.replies.delete(this.replies.keys().next().value!);this.replies.set(proposal.thread,{marker:proposal.replyMarker,fingerprint:fingerprint(source),target:{...target},expires:this.now()+1800000,since:this.now(),action:proposal.action,label:proposal.preview.label});}
  let opened=false;try{await this.deps.openChat(target.session);opened=true;}catch{/* The explicit copy succeeded; do not retry or send work. */}
  return{copied:true,opened,at:this.now()};
 }
 observeReply(session:string,cwd:string,reply:CompanionLastReply){
  const p=this.deps.policy();if(this.closed||p.paused||p.presentation||p.targetError||!p.target)return;
  for(const [thread,receipt]of this.replies){
   if(receipt.expires<=this.now()){this.replies.delete(thread);continue;}
   if(receipt.result||session!==receipt.target.session||cwd.toLowerCase()!==receipt.target.cwd.toLowerCase()||p.target.session!==receipt.target.session||p.target.cwd.toLowerCase()!==receipt.target.cwd.toLowerCase())continue;
   const text=correlatedResult(reply,receipt.marker,receipt.action==='reply'?'zen_respuesta':'zen_resultado',receipt.since);
   if(text!==undefined)receipt.result={id:receipt.marker,text,at:reply.at,targetTitle:receipt.target.title,label:receipt.label,action:receipt.action};
  }
 }
 async result(thread:string):Promise<CodexResultState>{
  const target=this.target(),receipt=this.replies.get(thread);if(!receipt)return{state:'none'};
  if(receipt.expires<=this.now()){this.replies.delete(thread);return{state:'expired'};}
  const source=this.deps.source(thread);
  const valid=()=>{const current=this.target();return this.replies.get(thread)===receipt&&receipt.expires>this.now()&&receipt.fingerprint===fingerprint(this.deps.source(thread))&&current.session===receipt.target.session&&current.cwd.toLowerCase()===receipt.target.cwd.toLowerCase();};
  if(!valid()){this.replies.delete(thread);return{state:'changed'};}
  if(receipt.result)return{state:'ready',result:{...receipt.result}};
  if(!this.deps.readReply)return{state:'waiting'};
  if(receipt.flight)return receipt.flight;
  const pending=(async():Promise<CodexResultState>=>{
   try{
    const reply=await this.deps.readReply!(target);this.target();
    if(!valid()||source.version!==this.deps.source(thread).version)throw Error('El correo o la petición cambió. Vuelve a traer la respuesta.');
    const text=correlatedResult(reply,receipt.marker,receipt.action==='reply'?'zen_respuesta':'zen_resultado',receipt.since);
    if(text===undefined)return{state:'waiting'};
    receipt.result={id:receipt.marker,text,at:reply!.at,targetTitle:target.title,label:receipt.label,action:receipt.action};
    return{state:'ready',result:{...receipt.result}};
   }finally{receipt.flight=undefined;}
  })();receipt.flight=pending;return pending;
 }
 async reply(thread:string):Promise<MailReply>{
  if(this.replies.get(thread)?.action!=='reply')throw Error('Prepara Sugerir respuesta para este correo y envíalo en Codex.');
  const result=await this.result(thread);
  if(result.state!=='ready')throw Error('Todavía no hay una respuesta completa para esta petición. Revisa Codex.');
  return{text:result.result.text,at:result.result.at,targetTitle:result.result.targetTitle};
 }
 clearReplies(){this.replies.clear();}
 close(){this.closed=true;this.invalidate();this.clearReplies();}
}
