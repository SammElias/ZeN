import {afterEach,describe,expect,it,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp,mkdir,writeFile,appendFile,open,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readCodexLastReply} from '../src/main/companion-codex-reader';
import {CompanionHub} from '../src/main/companion-hub';
import {displayStatus} from '../src/shared/companion-privacy';
import {CompanionEventSchema,CompanionSettingsSchema,COMPANION_REPLY_LIMIT,type CompanionTarget,type CompanionLastReply} from '../src/shared/codex-companion';

const target:CompanionTarget={session:'pinned-chat',cwd:'C:\\Work\\ZeN',title:'Pinned'};
vi.mock('node:fs/promises',async original=>{const actual=await original<typeof import('node:fs/promises')>();return{...actual,open:vi.fn(actual.open)};});
const disposals:(()=>unknown)[]=[];
afterEach(async()=>{for(const fn of disposals.splice(0))await fn();});
const json=(type:string,payload:unknown)=>JSON.stringify({timestamp:'2026-10-25T10:00:00.000Z',type,payload})+'\n';
const header=(extra:any={})=>json('session_meta',{id:target.session,cwd:target.cwd,source:'vscode',...extra});
const context=(extra:any={})=>json('turn_context',{turn_id:'t1',cwd:target.cwd,...extra});
const final=(text='Real final',extra:any={})=>json('response_item',{type:'message',role:'assistant',phase:'final_answer',status:'completed',content:[{type:'output_text',text}],...extra});
const complete=(text='Real final',extra:any={})=>json('event_msg',{type:'task_complete',turn_id:'t1',last_agent_message:text,...extra});
async function local(content=header()+context()+final()+complete(),row:any={}){
 const home=await mkdtemp(join(tmpdir(),'zen-reply-'));disposals.push(()=>rm(home,{recursive:true,force:true}));
 await mkdir(join(home,'sessions'));const file=join(home,'sessions','rollout-2026-10-25-'+target.session+'.jsonl');await writeFile(file,content);
 const db=new DatabaseSync(join(home,'state_5.sqlite'));db.exec('CREATE TABLE threads(id TEXT PRIMARY KEY,rollout_path TEXT,cwd TEXT,agent_path TEXT)');
 db.prepare('INSERT INTO threads(id,rollout_path,cwd,agent_path) VALUES(?,?,?,?)').run(target.session,row.path??file,row.cwd??target.cwd,row.agent??null);db.close();
 return{home,file,read:()=>readCodexLastReply(home,target)};
}
function fixture(pinned:CompanionTarget|null=target){
 let now=1000;const changed=vi.fn(),hub=new CompanionHub(CompanionSettingsSchema.parse({}),changed,()=>{},()=>now,pinned??undefined);disposals.push(()=>hub.dispose());
 const event=(event:string,extra:any={})=>{const reply=vi.fn();hub.accept({id:randomUUID(),event,session:target.session,cwd:target.cwd,turn:'t1',...extra},reply);return reply;};
 const restored:CompanionLastReply={text:'Previous confirmed answer',at:900,source:'local',turn:'previous',truncated:false};
 return{hub,event,changed,restored,advance:()=>now+=1000};
}

describe('latest confirmed answer stays independent from activity and permissions',()=>{
 it('restores one pinned answer without fabricating signals, notices or completion',()=>{
  const f=fixture();expect(f.hub.setLastReply(target.session,target.cwd,f.restored)).toBe(true);const s=f.hub.status();
  expect(s.sessions[0]).toMatchObject({state:'idle',at:0,lastReply:f.restored});expect(s.lastEventAt).toBeUndefined();expect(s.notices).toEqual([]);expect(s.approvals).toEqual([]);
  expect(f.hub.setLastReply(target.session,target.cwd,f.restored)).toBe(false);expect(f.changed).toHaveBeenCalledOnce();s.sessions[0].lastReply!.text='mutated';expect(f.hub.status().sessions[0].lastReply!.text).toBe(f.restored.text);
 });
 it('keeps the previous answer while working and replaces it only on a matching Stop',()=>{
  const f=fixture();f.hub.setLastReply(target.session,target.cwd,f.restored);f.event('UserPromptSubmit');f.event('PreToolUse');expect(f.hub.status().sessions[0].lastReply).toEqual(f.restored);
  f.advance();const reply=f.event('Stop',{lastAssistantMessage:'New real answer'});expect(reply).toHaveBeenCalledWith('pass');expect(f.hub.status().sessions[0].lastReply).toMatchObject({text:'New real answer',source:'hook',turn:'t1',at:2000,truncated:false});
  f.event('Stop',{lastAssistantMessage:'Duplicate cannot replace'});expect(f.hub.status().sessions[0].lastReply!.text).toBe('New real answer');
  expect(f.hub.status().sessions[0].steps.every(s=>s.preview===undefined)).toBe(true);expect(f.hub.status().approvals).toEqual([]);
 });
 it('does not accept foreign, unpinned, stale, failed, commentary or subagent answers',()=>{
  const f=fixture();f.hub.setLastReply(target.session,target.cwd,f.restored);f.event('UserPromptSubmit',{turn:'t2'});
  f.event('Stop',{session:'other',lastAssistantMessage:'Foreign'});f.event('Stop',{cwd:target.cwd+'-other',lastAssistantMessage:'Wrong folder'});f.event('Stop',{lastAssistantMessage:'Stale'});f.event('Stop',{turn:'t2',failed:true,lastAssistantMessage:'Failed'});
  expect(f.hub.status().sessions[0].lastReply).toEqual(f.restored);
  expect(CompanionEventSchema.safeParse({id:randomUUID(),event:'SubagentStop',session:target.session,cwd:target.cwd,lastAssistantMessage:'Subagent'}).success).toBe(false);
  expect(f.hub.setLastReply('other',target.cwd,f.restored)).toBe(false);expect(f.hub.setLastReply(target.session,target.cwd+'-other',f.restored)).toBe(false);
  expect(f.hub.setLastReply(target.session,target.cwd,{...f.restored,source:'hook'})).toBe(false);
  const unpinned=fixture(null);unpinned.event('Stop',{lastAssistantMessage:'Unpinned'});expect(unpinned.hub.status().sessions[0].lastReply).toBeUndefined();
 });
 it('refuses late older local answers and retains explicit truncation',()=>{
  const f=fixture();f.event('Stop',{lastAssistantMessage:'Confirmed',lastAssistantMessageTruncated:true});
  expect(f.hub.setLastReply(target.session,target.cwd,f.restored)).toBe(false);expect(f.hub.status().sessions[0].lastReply!.truncated).toBe(true);
 });
 it('blocks private capture while paused or presenting and strips every hidden IPC reply',()=>{
  const f=fixture();f.hub.setLastReply(target.session,target.cwd,f.restored);const visible={expanded:true,launcher:true,page:'codex' as const};
  expect(displayStatus({...f.hub.status(),workspace:visible},1).sessions[0].lastReply).toEqual(f.restored);
  for(const workspace of [undefined,{...visible,expanded:false},{...visible,page:'home' as const}])expect(displayStatus({...f.hub.status(),workspace},2).sessions[0].lastReply).toBeUndefined();
  f.hub.update({...f.hub.settings,presentation:true});f.event('Stop',{lastAssistantMessage:'Hidden new answer'});expect(f.hub.setLastReply(target.session,target.cwd,{...f.restored,text:'Local hidden'})).toBe(false);expect(f.hub.status().sessions[0].lastReply).toEqual(f.restored);
  expect(JSON.stringify(displayStatus({...f.hub.status(),workspace:visible},3))).not.toContain(f.restored.text);
  f.hub.update({...f.hub.settings,presentation:false,paused:true});expect(displayStatus({...f.hub.status(),workspace:visible},4).sessions[0].lastReply).toBeUndefined();expect(f.hub.setLastReply(target.session,target.cwd,f.restored)).toBe(false);
 });
});

describe('bounded read-only local answer recovery',()=>{
 it('reads the exact indexed chat and requires a completed assistant final with a matching cwd',async()=>{
  const f=await local();const value=await f.read();expect(value).toEqual({text:'Real final',at:Date.parse('2026-10-25T10:00:00Z'),source:'local',turn:'t1',truncated:false});
  expect(await readCodexLastReply(f.home,{...target,session:'other-chat'})).toBeUndefined();
 });
 it('accepts equivalent native extended Windows paths without matching nested folders',async()=>{
  const f=await local(header({cwd:'\\\\?\\C:\\Work\\ZeN'})+context({cwd:'c:/work/zen/'})+final()+complete(),{cwd:'\\\\?\\C:\\Work\\ZeN'});expect((await f.read())?.text).toBe('Real final');
  if(process.platform==='win32'){const db=new DatabaseSync(join(f.home,'state_5.sqlite'));db.prepare('UPDATE threads SET rollout_path=? WHERE id=?').run('\\\\?\\'+f.file,target.session);db.close();expect((await f.read())?.text).toBe('Real final');}
  const foreign=await local(header()+context({cwd:target.cwd+'\\other'})+final()+complete());expect(await foreign.read()).toBeUndefined();
 });
 it('rejects wrong index/header identities, wrong cwd and subagent transcripts',async()=>{
  for(const [content,row]of [[header({id:'other'})+context()+final()+complete(),{}],[header()+context()+final()+complete(),{cwd:target.cwd+'-other'}],[header()+context()+final()+complete(),{agent:'/root/child'}],[header({source:{subagent:'child'}})+context()+final()+complete(),{}]] as const){const f=await local(content,row);expect(await f.read()).toBeUndefined();}
 });
 it('does not present tools, commentary, incomplete finals or task-complete text without final proof',async()=>{
  for(const body of [final('Real final',{role:'user'}),final('Real final',{phase:'commentary'}),final('Real final',{status:'in_progress'}),json('response_item',{type:'function_call_output',output:'Real final'}),'']){const f=await local(header()+context()+body+complete());expect(await f.read()).toBeUndefined();}
 });
 it('keeps the latest confirmed final through a newer in-progress turn and ignores incomplete tail JSON',async()=>{
  const f=await local(header()+context()+final()+complete()+context({turn_id:'t2'})+final('Pending',{phase:'commentary'})+'{"type":"event_msg","payload":{"type":"task_complete"');expect((await f.read())?.text).toBe('Real final');
 });
 it('limits displayed text and marks it as truncated without changing the preserved prefix',async()=>{
  const text='a'.repeat(COMPANION_REPLY_LIMIT+100),f=await local(header()+context()+final(text)+complete(text)),value=await f.read();expect(value?.text).toBe(text.slice(0,COMPANION_REPLY_LIMIT));expect(value?.truncated).toBe(true);
 });
 it('recovers a final and its exact context beyond the first 2 MiB using bounded reverse windows',async()=>{
  const padding=json('response_item',{type:'function_call_output',output:'x'.repeat(3*1024*1024)}),f=await local(header()+context()+padding+final()+complete());expect((await f.read())?.text).toBe('Real final');
  const progressing=await local(header()+context()+final()+complete()+context({turn_id:'t2'})+padding);expect((await progressing.read())?.text).toBe('Real final');
 });
 it('reassembles JSON and multibyte text across a 2 MiB window boundary',async()=>{
  const text='Final 🙂 correcto',prefix=header()+context(),line=final(text),base=prefix+line+complete(text),insideEmoji=Buffer.byteLength(prefix+line.split('🙂')[0])+1;
  const padding=(value:string)=>json('response_item',{type:'message',role:'assistant',phase:'commentary',content:[{type:'output_text',text:value}]}),count=2*1024*1024+insideEmoji-Buffer.byteLength(base+padding(''));
  const f=await local(base+padding('x'.repeat(count)));expect((await f.read())?.text).toBe(text);
 });
 it('fails closed when identity or exact turn context exceeds the maximum read budget',async()=>{
  const padding=json('response_item',{type:'function_call_output',output:'x'.repeat(16*1024*1024)}),f=await local(header()+context()+padding+final()+complete());expect(await f.read()).toBeUndefined();
  const hugeHeader=await local(header({base_instructions:'x'.repeat(64*1024)})+context()+final()+complete());expect(await hugeHeader.read()).toBeUndefined();
 });
 it('never falls back to an older final when a newer final cannot be verified',async()=>{
  const previous=header()+context()+final()+complete();
  for(const newer of [context({turn_id:'t2'})+final('New answer')+complete('Different answer',{turn_id:'t2'}),context({turn_id:'t2'})+final('New unconfirmed answer'),context({turn_id:'t2',cwd:target.cwd+'-other'})+final('Foreign folder')+complete('Foreign folder',{turn_id:'t2'})]){const f=await local(previous+newer);expect(await f.read()).toBeUndefined();}
 });
 it('caches only an unchanged source in RAM and invalidates it when the file grows',async()=>{
  const actual=await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises'),f=await local();
  const first=await f.read();expect(first?.text).toBe('Real final');if(first)first.text='Changed by caller';
  let cachedReads:any;
  vi.mocked(open).mockImplementationOnce(async(path,flags,mode)=>{const handle=await actual.open(path,flags,mode);cachedReads=vi.spyOn(handle,'read');return handle;});
  expect((await f.read())?.text).toBe('Real final');expect(cachedReads).not.toHaveBeenCalled();
  await appendFile(f.file,context({turn_id:'t2'})+final('New verified answer')+complete('New verified answer',{turn_id:'t2'}));expect((await f.read())?.text).toBe('New verified answer');
 });
 it('never follows an index path outside sessions or through a directory junction',async()=>{
  const outside=await local(),f=await local(undefined,{path:outside.file});expect(await f.read()).toBeUndefined();
  const linked=join(f.home,'sessions','linked');await symlink(join(outside.home,'sessions'),linked,'junction');const db=new DatabaseSync(join(f.home,'state_5.sqlite'));db.prepare('UPDATE threads SET rollout_path=? WHERE id=?').run(join(linked,'rollout-2026-10-25-'+target.session+'.jsonl'),target.session);db.close();expect(await f.read()).toBeUndefined();
 });
});
