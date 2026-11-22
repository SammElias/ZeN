import {matchesTarget,normalizeTargetFolder,stripWindowsPathPrefix} from '../shared/companion-target';
import {CompanionTargetSchema,COMPANION_REPLY_LIMIT,type CompanionTarget,type CompanionLastReply,type CompanionSession} from '../shared/codex-companion';
import type {OfficinaRunIdentity} from '../shared/companion-officina';
import {DatabaseSync} from 'node:sqlite';
import {lstat,open,realpath,type FileHandle} from 'node:fs/promises';
import type {Stats} from 'node:fs';
import {basename,isAbsolute,join,relative,resolve,sep} from 'node:path';
const MAX_REPLY_HEADER=64*1024,REPLY_WINDOW=2*1024*1024,MAX_REPLY_SCAN=16*1024*1024;
// The rollout can retain a trailing memory citation block omitted by task_complete.
const memoryCitationSuffix=/^[ \t\r\n]*<oai-mem-citation>\r?\n<citation_entries>[^<]*<\/citation_entries>\r?\n<rollout_ids>[^<]*<\/rollout_ids>\r?\n<\/oai-mem-citation>[ \t\r\n]*$/;
type ReplyCache={key:string;dev:number;ino:number;size:number;mtimeMs:number;ctimeMs:number;reply?:CompanionLastReply};

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

async function* reverseReplyLines(handle:FileHandle,size:number,limit=MAX_REPLY_SCAN){
 let cursor=size,spent=0,carry:Buffer=Buffer.alloc(0),skipIncompleteEnd=true;
 while(cursor>0&&spent<limit){
  const length=Math.min(REPLY_WINDOW,cursor,limit-spent),start=cursor-length,buffer=Buffer.alloc(length),read=await handle.read(buffer,0,length,start);
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

export type OfficinaCodexTurn = {turn: string; state: 'working' | 'finished' | 'interrupted'; at: number};

async function scanOfficinaTurn(handle:FileHandle,size:number,target:CompanionTarget,identity:OfficinaRunIdentity,since:number):Promise<OfficinaCodexTurn|undefined>{
 const stopped=new Map<string,'finished'|'interrupted'>();
 let newerTurn:string|undefined;
 for await(const line of reverseReplyLines(handle,size,REPLY_WINDOW)){
  if(!/"(?:task_started|task_complete|turn_aborted|item_completed)"/.test(line))continue;
  let item:any;try{item=JSON.parse(line);}catch{continue;}
  const p=item?.payload,turn=p?.turn_id,at=Date.parse(item.timestamp);
  if(item.type!=='event_msg'||typeof turn!=='string'||!turn||turn.length>160||!Number.isFinite(at)||at<since||p.root_turn_id&&p.root_turn_id!==turn)continue;
  if(p.type==='task_started'){
   newerTurn??=turn;
   continue;
  }
  if(p.type==='task_complete'||p.type==='turn_aborted'){
   if(!stopped.has(turn))stopped.set(turn,p.type==='task_complete'?'finished':'interrupted');
   continue;
  }
  if(p.type!=='item_completed'||p.thread_id!==target.session||p.item?.type!=='UserMessage'||!Array.isArray(p.item.content))continue;
  for(const part of p.item.content){
   if(part?.type!=='text'||typeof part.text!=='string'||!part.text.includes(identity.run))continue;
   try{
    const recorded=JSON.parse(part.text.trimEnd().split('\n').at(-1)!).identity;
    if(recorded&&recorded.run===identity.run&&recorded.task===identity.task&&recorded.project===identity.project&&recorded.role===identity.role){
     const state=stopped.get(turn);
     if(state)return {turn,state,at};
     return !newerTurn||newerTurn===turn?{turn,state:'working',at}:undefined;
    }
   }catch{/* Only the matching Officina delivery can identify the active turn. */}
  }
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
   const completed=candidate.text;
   if(!parts.length||![parts.join(''),parts.join('\n')].some(text=>text===completed||text.startsWith(completed)&&memoryCitationSuffix.test(text.slice(completed.length))))return undefined;
   candidate.finalMatches=true;continue;
  }
  if(!candidate)continue;
  if(item?.type==='event_msg'&&p?.type==='task_started')return undefined;
  if(item?.type==='turn_context'){
   if(!candidate.finalMatches||p?.turn_id!==candidate.turn||!matchesTarget(target,target.session,p.cwd))return undefined;
   return{text:candidate.text.slice(0,COMPANION_REPLY_LIMIT),at:candidate.at,source:'local',turn:candidate.turn,truncated:candidate.text.length>COMPANION_REPLY_LIMIT};
  }
 }
 return undefined;
}

function projectRootMatches(db: DatabaseSync, projectId: string, cwd: string) {
 const roots=db.prepare(`SELECT r.path FROM project_roots r JOIN projects p ON p.id=r.project_id
  WHERE r.project_id=? LIMIT 2`).all(projectId);
 const root=roots[0]?.path;
 return roots.length===1&&typeof root==='string'&&normalizeTargetFolder(root)===normalizeTargetFolder(cwd);
}

/**
 * Read-only recovery from the local Codex index and rollout. Only one pinned
 * answer is cached in RAM. Missing or unsupported data stays unavailable.
 */
export class CodexReplyReader {
 private replyCache?: ReplyCache;

 constructor(private codexHome: string) {}

 async hasOfficinaProject(projectId: string, cwd: string) {
  try {
   return await this.readOfficinaIndex(db=>projectRootMatches(db,projectId,cwd));
  } catch {return false;}
 }

 async missingOfficinaThread(projectId: string, cwd: string, thread: string) {
  try {
   return await this.readOfficinaIndex(db=>
    projectRootMatches(db,projectId,cwd)&&!db.prepare('SELECT 1 FROM threads WHERE id=?').get(thread));
  } catch {return false;}
 }

 private async readOfficinaIndex<T>(read: (db: DatabaseSync) => T) {
  const database=await confinedFile(this.codexHome,join(this.codexHome,'state_5.sqlite'));
  const db=new DatabaseSync(database,{readOnly:true});
  try {
   db.exec('PRAGMA query_only=ON; PRAGMA busy_timeout=50');
   return read(db);
  } finally {db.close();}
 }

 async hasDedicatedThread(target: CompanionTarget, projectId?: string) {
  try {
   return await this.readOfficinaIndex(db=>{
    const row=db.prepare(projectId
     ? 'SELECT cwd,archived,agent_path,project_id FROM threads WHERE id=?'
     : 'SELECT cwd,archived,agent_path FROM threads WHERE id=?').get(target.session);
    if(row?.archived!==0||row.agent_path!==null&&row.agent_path!==''||!matchesTarget(target,target.session,row.cwd))return false;
    if(!projectId)return true;
    // Desktop builds can resume an Officina chat without its project assignment.
    // The exact recorded thread and folder remain required, and a different assigned project is rejected.
    return (row.project_id===projectId||row.project_id===null)&&projectRootMatches(db,projectId,target.cwd);
   });
  } catch {return false;}
 }

 async officinaProjectThreads(projectId: string, cwd: string, pendingName?: string) {
  const database=await confinedFile(this.codexHome,join(this.codexHome,'state_5.sqlite'));
  const db=new DatabaseSync(database,{readOnly:true});
  try {
   db.exec('PRAGMA query_only=ON; PRAGMA busy_timeout=50');
   const rows=db.prepare("SELECT id,cwd,name,has_user_event FROM threads WHERE project_id=? AND archived=0 AND (agent_path IS NULL OR agent_path='') LIMIT 51").all(projectId);
   if(rows.length>50)throw Error('Revisa los chats de este proyecto en Codex.');
   return rows.filter(row=>typeof row.cwd==='string'&&normalizeTargetFolder(row.cwd)===normalizeTargetFolder(cwd)&&
    (!pendingName||row.name===pendingName&&row.has_user_event===0)).map(row=>String(row.id));
  } finally {db.close();}
 }

 async observedTitles(sessions:ReadonlyArray<Pick<CompanionSession,'id'|'cwd'>>){
  const titles=new Map<string,string>();
  try{
   const database=await confinedFile(this.codexHome,join(this.codexHome,'state_5.sqlite'));
   const db=new DatabaseSync(database,{readOnly:true});
   try{
    db.exec('PRAGMA query_only=ON; PRAGMA busy_timeout=50');
    const lookup=db.prepare('SELECT title,cwd FROM threads WHERE id=?');
    for(const {id,cwd} of sessions){
     const row=lookup.get(id),folder=normalizeTargetFolder(cwd);
     if(folder&&typeof row?.cwd==='string'&&normalizeTargetFolder(row.cwd)===folder&&typeof row.title==='string'&&row.title.trim()){
      titles.set(id,row.title.trim().slice(0,200));
     }
    }
   }finally{db.close();}
  }catch{/* The project folder remains the label when local metadata is unavailable. */}
  return titles;
 }

 private async withRollout<T>(target:CompanionTarget, use:(handle:FileHandle,stat:Stats,file:string,checkHeader:()=>Promise<boolean>)=>Promise<T>):Promise<T|undefined>{
 const codexHome = this.codexHome;
 if(!CompanionTargetSchema.safeParse(target).success)return undefined;
 try{
  const database=await confinedFile(codexHome,join(codexHome,'state_5.sqlite'));
  const db=new DatabaseSync(database,{readOnly:true});let row:Record<string,unknown>|undefined;
  try{db.exec('PRAGMA query_only=ON; PRAGMA busy_timeout=50');row=db.prepare('SELECT rollout_path,cwd,agent_path FROM threads WHERE id=? LIMIT 1').get(target.session);}
  finally{db.close();}
  if(!row||!matchesTarget(target,target.session,row.cwd)||row.agent_path!==null&&row.agent_path!==''||typeof row.rollout_path!=='string')return undefined;
  const rollout=resolve(stripWindowsPathPrefix(row.rollout_path)),folder=relative(resolve(codexHome),rollout).split(sep)[0];
  if(!['sessions','archived_sessions'].includes(folder)||!basename(rollout).endsWith('-'+target.session+'.jsonl'))return undefined;
  const file=await confinedFile(codexHome,rollout),handle=await open(file,'r');
  try{
   const stat=await handle.stat(),current=await lstat(file);
   if(!stat.isFile()||current.isSymbolicLink()||stat.ino!==current.ino||stat.dev!==current.dev)return undefined;
   const checkHeader=async()=>{
    const header=Buffer.alloc(Math.min(MAX_REPLY_HEADER,stat.size)),headRead=await handle.read(header,0,header.length,0),head=header.subarray(0,headRead.bytesRead).toString('utf8'),end=head.indexOf('\n');
    if(end<0)return false;
    const meta=JSON.parse(head.slice(0,end)),identity=meta?.payload;
    return meta?.type==='session_meta'&&matchesTarget(target,identity?.id,identity?.cwd)&&typeof identity.source==='string'&&!/subagent/i.test(identity.source);
   };
   return await use(handle,stat,file,checkHeader);
  }finally{await handle.close();}
 }catch{/* Missing, busy or changed local data never exposes another chat or diagnostic contents. */}
 return undefined;
 }

 async readOfficinaTurn(target:CompanionTarget,identity:OfficinaRunIdentity,since:number):Promise<OfficinaCodexTurn|undefined>{
  return this.withRollout(target,async(handle,stat,_file,checkHeader)=>{
   if(!await checkHeader())return undefined;
   const turn=await scanOfficinaTurn(handle,stat.size,target,identity,since),after=await handle.stat();
   return after.size===stat.size&&after.mtimeMs===stat.mtimeMs&&after.ctimeMs===stat.ctimeMs?turn:undefined;
  });
 }

 async read(target:CompanionTarget):Promise<CompanionLastReply|undefined>{
  return this.withRollout(target,async(handle,stat,file,checkHeader)=>{
   const key=file+'\0'+target.session+'\0'+normalizeTargetFolder(target.cwd),replyCache=this.replyCache;
   if(replyCache?.key===key&&replyCache.dev===stat.dev&&replyCache.ino===stat.ino&&replyCache.size===stat.size&&replyCache.mtimeMs===stat.mtimeMs&&replyCache.ctimeMs===stat.ctimeMs)return replyCache.reply?{...replyCache.reply}:undefined;
   this.replyCache=undefined;
   if(!await checkHeader())return undefined;
   const reply=await scanLastReply(handle,stat.size,target),after=await handle.stat();
   if(after.ino!==stat.ino||after.dev!==stat.dev||after.size<stat.size||after.size===stat.size&&(after.mtimeMs!==stat.mtimeMs||after.ctimeMs!==stat.ctimeMs))return undefined;
   if(after.size===stat.size)this.replyCache={key,dev:stat.dev,ino:stat.ino,size:stat.size,mtimeMs:stat.mtimeMs,ctimeMs:stat.ctimeMs,reply:reply?{...reply}:undefined};
   return reply;
  });
 }
}
