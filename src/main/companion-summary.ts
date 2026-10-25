import {execFile} from 'node:child_process';
import {lstat,realpath} from 'node:fs/promises';
import {resolve,relative,isAbsolute,dirname,join} from 'node:path';
import type {CompanionEvent,CompanionSession,CompanionSummary,CompanionTarget} from '../shared/codex-companion';
import {matchesTarget} from '../shared/companion-presentation';

type Snapshot={at:number;files:Map<string,string>};
const MAX_FILES=2000;
export async function projectFile(root:string,name:string,allowMissing=false){
 if(!name||/[\0\r\n]/.test(name)||isAbsolute(name))throw Error('Ubicación no válida.');
 const base=await realpath(root),full=resolve(base,name),part=relative(base,full);
 if(!part||part==='..'||part.startsWith('..'+(process.platform==='win32'?'\\':'/'))||isAbsolute(part))throw Error('Ubicación fuera del proyecto.');
 let current=base;const segments=part.split(/[\\/]/);
 for(let i=0;i<segments.length;i++){
  current=join(current,segments[i]);
  try{const s=await lstat(current);if(s.isSymbolicLink()||i<segments.length-1&&!s.isDirectory())throw Error('Ubicación enlazada no permitida.');}
  catch(e){if(allowMissing&&(e as NodeJS.ErrnoException).code==='ENOENT')return{file:full,folder:dirname(current),missing:true};throw e;}
 }
 return{file:full,folder:dirname(full),missing:false};
}
export async function projectSnapshot(root:string):Promise<Snapshot>{
 const base=await realpath(root);
 const listed=await new Promise<string>((ok,fail)=>execFile('git',['--no-optional-locks','-c','core.fsmonitor=false','ls-files','--cached','--others','--exclude-standard','-z'],{cwd:base,windowsHide:true,timeout:3000,maxBuffer:1024*1024,encoding:'utf8',env:{...process.env,GIT_OPTIONAL_LOCKS:'0'}},(e,out)=>e?fail(e):ok(out)));
 const names=[...new Set(listed.split('\0').filter(Boolean))];
 // No partial baseline: an incomplete listing must never invent deleted files.
 if(names.length>MAX_FILES)throw Error('Proyecto demasiado grande para el resumen local.');
 const files=new Map<string,string>();
 for(let offset=0;offset<names.length;offset+=40)await Promise.all(names.slice(offset,offset+40).map(async name=>{
  try{const p=await projectFile(base,name),s=await lstat(p.file,{bigint:true});if(s.isFile())files.set(name,[s.size,s.mtimeNs,s.ctimeNs,s.mode].join(':'));}
  catch(e){if(!['ENOENT','ENOTDIR'].includes((e as NodeJS.ErrnoException).code??''))throw e;}
 }));
 return{at:Date.now(),files};
}
export function compareSnapshots(before:Snapshot,after:Snapshot):CompanionSummary{
 const files:CompanionSummary['files']=[];
 for(const [path,value]of after.files){const old=before.files.get(path);if(old!==value)files.push({path,change:old===undefined?'added':'changed'});}
 for(const path of before.files.keys())if(!after.files.has(path))files.push({path,change:'removed'});
 files.sort((a,b)=>a.path.localeCompare(b.path));
 return{state:'ready',files:files.slice(0,30),omitted:Math.max(0,files.length-30),startedAt:before.at,endedAt:after.at};
}
/** Two bounded metadata reads per received turn; never resumes a Codex session. */
export class CompanionSummaries{
 private run?:{key:string;before:Promise<Snapshot|null>;stopped:boolean};
 constructor(private target:CompanionTarget|undefined,private done:(session:string,key:string,value:CompanionSummary)=>void,private snapshot=projectSnapshot){}
 clear(){this.run=undefined;}
 observe(e:CompanionEvent,s:CompanionSession){
  if(!this.target||!matchesTarget(this.target,e.session,e.cwd))return;
  if(['SessionStart','Interrupt','SessionEnd'].includes(e.event)){this.clear();return;}
  if(e.event==='UserPromptSubmit'){this.run={key:s.runKey!,before:this.snapshot(this.target.cwd).catch(()=>null),stopped:false};return;}
  if(e.event!=='Stop')return;
  const run=this.run;
  if(!run||run.key!==s.runKey){this.done(s.id,s.runKey!,{state:'unavailable',files:[],omitted:0,endedAt:Date.now()});return;}
  if(run.stopped)return;run.stopped=true;
  void(async()=>{
   const before=await run.before;if(this.run!==run)return;const after=before?await this.snapshot(this.target!.cwd).catch(()=>null):null;
   if(this.run!==run)return;
   this.done(s.id,run.key,before&&after?compareSnapshots(before,after):{state:'unavailable',files:[],omitted:0,endedAt:Date.now()});
  })();
 }
}
