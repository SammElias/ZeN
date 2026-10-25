import type {CodexTransport} from './codex-rpc';
import type {CompanionSession} from '../shared/codex-companion';
import {hookEvents} from '../shared/codex-companion';
import {hookConnection} from '../shared/companion-presentation';
import {matchesTarget} from '../shared/companion-presentation';
import {CompanionTargetSchema,COMPANION_REPLY_LIMIT,type CompanionTarget,type CompanionLastReply} from '../shared/codex-companion';
import {DatabaseSync} from 'node:sqlite';
import {lstat,open,realpath,type FileHandle} from 'node:fs/promises';
import {basename,isAbsolute,join,relative,resolve,sep} from 'node:path';
/** Read-only metadata. Never resumes a chat, reads turns, submits work or changes trust. */
export async function inspectCodexCompanion(rpc:Pick<CodexTransport,'request'>,command:string,cwd:string,sessions:CompanionSession[]){
 const account=await rpc.request('account/read',{refreshToken:false});
 const connection=hookConnection(await rpc.request('hooks/list',{cwds:[cwd]}),command,hookEvents.length);
 const titles=new Map<string,string>();
 for(const session of sessions.filter(s=>!s.title).slice(0,6)){
  try{const result=await rpc.request('thread/read',{threadId:session.id,includeTurns:false});const name=result.thread?.name;if(result.thread?.id===session.id&&typeof name==='string'&&name.trim()&&name.length<=200)titles.set(session.id,name.trim());}
  catch{/* A missing title never prevents the hook status from being shown. */}
 }
 return{account:account.account?.type==='chatgpt'?'chatgpt' as const:account.account?'unsupported' as const:'missing' as const,connection,titles};
}

const MAX_REPLY_HEADER=64*1024,REPLY_WINDOW=2*1024*1024,MAX_REPLY_SCAN=16*1024*1024;
type ReplyCache={key:string;dev:number;ino:number;size:number;mtimeMs:number;ctimeMs:number;reply?:CompanionLastReply};
// Only one pinned source is retained, in RAM. Nothing is written to the Codex profile.
let replyCache:ReplyCache|undefined;
const nativeCwd=(cwd:string)=>cwd.replace(/^\\\\\?\\UNC\\/i,'\\\\').replace(/^\\\\\?\\(?=[a-z]:[\\/])/i,'');
const sameReplyProject=(target:CompanionTarget,id:string,cwd:unknown)=>typeof cwd==='string'&&matchesTarget({...target,cwd:nativeCwd(target.cwd)},id,nativeCwd(cwd));

/** No junctions/symlinks, traversal or paths outside the exact local Codex home. */
async function confinedFile(home:string,path:string){
 const root=resolve(home),file=resolve(path),rel=relative(root,file);
 if(!rel||rel==='..'||rel.startsWith('..'+sep)||isAbsolute(rel)||(await lstat(root)).isSymbolicLink())throw Error('Untrusted local path');
 let current=root;
 for(const part of rel.split(sep)){current=join(current,part);if((await lstat(current)).isSymbolicLink())throw Error('Linked local path');}
 const canonicalRoot=await realpath(root),canonical=await realpath(file),canonicalRelative=relative(canonicalRoot,canonical);
 if(canonicalRelative!==rel)throw Error('Changed local path');
 if(!(await lstat(canonical)).isFile())throw Error('Not a local file');
 return canonical;
}

/** Read backward in bounded windows and decode only complete JSONL lines. */
async function* reverseReplyLines(handle:FileHandle,size:number){
 let cursor=size,spent=0,carry:Buffer=Buffer.alloc(0),skipIncompleteEnd=true;
 while(cursor>0&&spent<MAX_REPLY_SCAN){
  const length=Math.min(REPLY_WINDOW,cursor,MAX_REPLY_SCAN-spent),start=cursor-length,buffer=Buffer.alloc(length),read=await handle.read(buffer,0,length,start);
  if(read.bytesRead!==length)return;
  cursor=start;spent+=length;
  const combined=carry.length?Buffer.concat([buffer,carry]):buffer;let end=combined.length;
  if(skipIncompleteEnd){end=combined.lastIndexOf(10);if(end<0)continue;skipIncompleteEnd=false;}
  while(end>0){
   const previous=combined.lastIndexOf(10,end-1);
   if(previous<0){
    if(start===0)yield combined.subarray(0,end).toString('utf8');
    else carry=combined.subarray(0,end);
    break;
   }
   yield combined.subarray(previous+1,end).toString('utf8');end=previous;
  }
  if(end===0)carry=Buffer.alloc(0);
 }
}

async function scanLastReply(handle:FileHandle,size:number,target:CompanionTarget):Promise<CompanionLastReply|undefined>{
 let candidate:{text:string;turn:string;at:number;finalMatches:boolean}|undefined;
 for await(const line of reverseReplyLines(handle,size)){
  if(!/"type"\s*:\s*"(?:task_complete|turn_context|task_started)"|"phase"\s*:\s*"final_answer"/.test(line))continue;
  let item:any;try{item=JSON.parse(line);}catch{continue;}
  const p=item?.payload;
  if(item?.type==='event_msg'&&p?.type==='task_complete'){
   if(candidate)return undefined;
   // An empty completion may follow a turn with no answer. A newer final still
   // blocks any older fallback when encountered below.
   if(typeof p.last_agent_message!=='string'||!p.last_agent_message.trim())continue;
   const at=Date.parse(item.timestamp);
   if(typeof p.turn_id!=='string'||!p.turn_id||p.turn_id.length>160||!Number.isSafeInteger(at)||at<0||at>8640000000000000)return undefined;
   candidate={text:p.last_agent_message,turn:p.turn_id,at,finalMatches:false};continue;
  }
  if(item?.type==='response_item'&&p?.type==='message'&&p.role==='assistant'&&p.phase==='final_answer'){
   // Never return an older answer when the newer final cannot be confirmed.
   if(!candidate||candidate.finalMatches||p.status!=='completed'||!Array.isArray(p.content))return undefined;
   const parts=p.content.filter((part:any)=>part?.type==='output_text'&&typeof part.text==='string').map((part:any)=>part.text);
   if(!parts.length||parts.join('')!==candidate.text&&parts.join('\n')!==candidate.text)return undefined;
   candidate.finalMatches=true;continue;
  }
  if(!candidate)continue;
  if(item?.type==='event_msg'&&p?.type==='task_started')return undefined;
  if(item?.type==='turn_context'){
   if(!candidate.finalMatches||p?.turn_id!==candidate.turn||!sameReplyProject(target,target.session,p.cwd))return undefined;
   return{text:candidate.text.slice(0,COMPANION_REPLY_LIMIT),at:candidate.at,source:'local',turn:candidate.turn,truncated:candidate.text.length>COMPANION_REPLY_LIMIT};
  }
 }
 return undefined;
}

/**
 * Read only the pinned index row, a 64 KiB identity header and backward windows
 * of at most 2 MiB, stopping at the latest verified answer or 16 MiB total.
 * Unchanged sources use a single RAM cache; no transcript/text is persisted.
 * Missing/unsupported data stays unavailable; no chat is resumed and no API is used.
 */
export async function readCodexLastReply(codexHome:string,target:CompanionTarget):Promise<CompanionLastReply|undefined>{
 if(!CompanionTargetSchema.safeParse(target).success)return undefined;
 try{
  const database=await confinedFile(codexHome,join(codexHome,'state_5.sqlite'));
  const db=new DatabaseSync(database,{readOnly:true});let row:Record<string,unknown>|undefined;
  try{db.exec('PRAGMA query_only=ON; PRAGMA busy_timeout=50');row=db.prepare('SELECT rollout_path,cwd,agent_path FROM threads WHERE id=? LIMIT 1').get(target.session);}
  finally{db.close();}
  if(!row||!sameReplyProject(target,target.session,row.cwd)||row.agent_path!==null&&row.agent_path!==''||typeof row.rollout_path!=='string')return undefined;
  const rollout=resolve(nativeCwd(row.rollout_path)),folder=relative(resolve(codexHome),rollout).split(sep)[0];
  if(!['sessions','archived_sessions'].includes(folder)||!basename(rollout).endsWith('-'+target.session+'.jsonl'))return undefined;
  const file=await confinedFile(codexHome,rollout),handle=await open(file,'r');
  try{
   const stat=await handle.stat(),current=await lstat(file);
   if(!stat.isFile()||current.isSymbolicLink()||stat.ino!==current.ino||stat.dev!==current.dev)return undefined;
   const key=file+'\0'+target.session+'\0'+nativeCwd(target.cwd).replace(/\//g,'\\').replace(/\\+$/,'').toLowerCase();
   if(replyCache?.key===key&&replyCache.dev===stat.dev&&replyCache.ino===stat.ino&&replyCache.size===stat.size&&replyCache.mtimeMs===stat.mtimeMs&&replyCache.ctimeMs===stat.ctimeMs)return replyCache.reply?{...replyCache.reply}:undefined;
   replyCache=undefined;
   const header=Buffer.alloc(Math.min(MAX_REPLY_HEADER,stat.size)),headRead=await handle.read(header,0,header.length,0),head=header.subarray(0,headRead.bytesRead).toString('utf8'),end=head.indexOf('\n');
   if(end<0)return undefined;
   const meta=JSON.parse(head.slice(0,end)),identity=meta?.payload;
   if(meta?.type!=='session_meta'||identity?.id!==target.session||!sameReplyProject(target,identity.id,identity.cwd)||typeof identity.source!=='string'||/subagent/i.test(identity.source))return undefined;
   const reply=await scanLastReply(handle,stat.size,target),after=await handle.stat();
   // A concurrent rewrite/truncation is retried next time; a pure append leaves
   // the snapshot valid but is deliberately not cached under its newer size.
   if(after.ino!==stat.ino||after.dev!==stat.dev||after.size<stat.size||after.size===stat.size&&(after.mtimeMs!==stat.mtimeMs||after.ctimeMs!==stat.ctimeMs))return undefined;
   if(after.size===stat.size)replyCache={key,dev:stat.dev,ino:stat.ino,size:stat.size,mtimeMs:stat.mtimeMs,ctimeMs:stat.ctimeMs,reply:reply?{...reply}:undefined};
   return reply;
  }finally{await handle.close();}
 }catch{/* Missing, busy or changed local data never exposes another chat or diagnostic contents. */}
 return undefined;
}
