import {afterEach,describe,expect,it,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {mkdtemp,writeFile,rm,mkdir,symlink,unlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {CompanionSettingsSchema,type CompanionStatus,type CompanionSession} from '../src/shared/codex-companion';
import {CompanionHub} from '../src/main/companion-hub';
import {displayStatus} from '../src/shared/companion-privacy';
import {activeSession,codexChatUrl} from '../src/shared/companion-presentation';
import {CompanionSummaries,compareSnapshots,projectFile,projectSnapshot} from '../src/main/companion-summary';
import {CapsuleVisibility,fitPanel,overlaps} from '../src/main/companion-placement';
import {DesktopObservation} from '../src/main/companion-desktop';

const disposals:(()=>unknown)[]=[];afterEach(async()=>{for(const fn of disposals.splice(0))await fn();});
function fixture(){const notices:any[]=[];const hub=new CompanionHub(CompanionSettingsSchema.parse({}),()=>{},n=>notices.push(n),()=>1000,{session:'fixed',cwd:'C:\\Private',title:'Secret title'});disposals.push(()=>hub.dispose());const event=(event:string,extra:any={})=>{const id=randomUUID(),reply=vi.fn();hub.accept({id,event,session:'fixed',turn:'t1',cwd:'C:\\Private',...extra},reply);return{id,reply};};return{hub,event,notices};}
describe('presentation is enforced before IPC and decisions',()=>{
 it('redacts every detail while preserving exact chat routing and activity',()=>{
  const f=fixture();f.event('PreToolUse',{tool:'SecretTool',preview:'PRIVATE COMMAND'});f.event('PermissionRequest',{tool:'SecretTool',preview:'PRIVATE PERMISSION'});f.hub.update({...f.hub.settings,presentation:true});
  const raw={...f.hub.status(),desktop:{available:true,name:'PrivateApp',error:'private path'}};
  const shown=displayStatus(raw,9),json=JSON.stringify(shown);
  for(const secret of ['Secret title','PrivateApp','SecretTool','C:\\\\Private','PRIVATE COMMAND','PRIVATE PERMISSION','private path'])expect(json).not.toContain(secret);
  expect(shown.revision).toBe(9);expect(activeSession(shown)?.state).toBe('approval');expect(codexChatUrl(shown)).toBe('codex://threads/fixed');expect(shown.approvals).toHaveLength(1);expect(raw.approvals[0].preview).toBe('PRIVATE PERMISSION');
 });
 it('refuses blind allow and deny even from a stale approval panel, but permits passing to Codex',()=>{
  const f=fixture(),p=f.event('PermissionRequest',{preview:'write'});f.hub.update({...f.hub.settings,presentation:true});
  expect(()=>f.hub.decide(p.id,'allow')).toThrow('Presentación');expect(()=>f.hub.decide(p.id,'deny')).toThrow('Presentación');expect(p.reply).not.toHaveBeenCalled();f.hub.decide(p.id,'pass');expect(p.reply).toHaveBeenCalledWith('pass');
 });
 it('keeps notices and reception without external notifications or replay on exit',()=>{
  const f=fixture();f.hub.update({...f.hub.settings,presentation:true});f.event('UserPromptSubmit');f.event('Stop');expect(f.notices).toHaveLength(0);expect(f.hub.status().notices).toHaveLength(1);expect(f.hub.status().notices[0].audible).toBe(false);f.hub.update({...f.hub.settings,presentation:false});expect(f.notices).toHaveLength(0);expect(f.hub.status().notices[0].audible).toBe(false);expect(f.hub.settings).toMatchObject({sounds:true,notifications:true,paused:false});
 });
 it('does not leak summaries and never mutates the original status',()=>{
  const f=fixture();f.event('Stop');const s=f.hub.status().sessions[0];f.hub.setSummary(s.id,s.runKey!,{state:'ready',files:[{path:'private.txt',change:'added'}],omitted:0,endedAt:1000});
  const raw=f.hub.status();raw.settings.presentation=true;expect(displayStatus(raw,2).sessions[0].summary).toBeUndefined();expect(raw.sessions[0].summary?.files[0].path).toBe('private.txt');
 });
 it('migrates preferences without changing existing shortcuts, silence or account configuration',()=>{expect(CompanionSettingsSchema.parse({sounds:false,silencedUntil:1000})).toMatchObject({presentation:false,followPointerDisplay:true,respectFullscreen:true,sounds:false,silencedUntil:1000});});
});
describe('bounded observed completion',()=>{
 it('compares metadata only and reports omissions without inventing test success',()=>{
  const before={at:1,files:new Map([['old.txt','a'],['gone.txt','b']])},after={at:2,files:new Map([['old.txt','c'],...Array.from({length:35},(_,i)=>['znew'+i+'.txt','x'] as [string,string])])};const s=compareSnapshots(before,after);
  expect(s.state).toBe('ready');expect(s.files).toHaveLength(30);expect(s.omitted).toBe(7);expect(s.files).toContainEqual({path:'gone.txt',change:'removed'});expect(s.files).toContainEqual({path:'old.txt',change:'changed'});
 });
 it('reads real git project metadata without reading or executing file contents',async()=>{
  const root=await mkdtemp(join(tmpdir(),'zen-summary-'));disposals.push(()=>rm(root,{recursive:true,force:true}));execFileSync('git',['init','--quiet',root],{windowsHide:true});
  await writeFile(join(root,'.gitignore'),'ignored.txt\n');await writeFile(join(root,'kept.txt'),'private content');await writeFile(join(root,'ignored.txt'),'never inspect');const before=await projectSnapshot(root);
  expect(before.files.has('ignored.txt')).toBe(false);expect(JSON.stringify([...before.files])).not.toContain('private content');await writeFile(join(root,'kept.txt'),'new longer content');await writeFile(join(root,'new.txt'),'new');const after=await projectSnapshot(root);
  expect(compareSnapshots(before,after).files).toEqual([{path:'kept.txt',change:'changed'},{path:'new.txt',change:'added'}]);
 });
 it('rejects traversal, absolute destinations and directory junctions',async()=>{
  const root=await mkdtemp(join(tmpdir(),'zen-scope-')),outside=await mkdtemp(join(tmpdir(),'zen-outside-'));disposals.push(()=>rm(root,{recursive:true,force:true}));disposals.push(()=>rm(outside,{recursive:true,force:true}));
  await mkdir(join(root,'dir'));await writeFile(join(root,'dir','f.txt'),'ok');expect((await projectFile(root,'dir/f.txt')).missing).toBe(false);
  await expect(projectFile(root,'../outside')).rejects.toThrow();await expect(projectFile(root,outside)).rejects.toThrow();await symlink(outside,join(root,'link'),'junction');await expect(projectFile(root,'link/file.txt',true)).rejects.toThrow('enlazada');await unlink(join(root,'link'));
  expect((await projectFile(root,'dir/removed.txt',true)).folder).toBe(join(root,'dir'));
 });
 it('never applies a late summary to another received run',()=>{const f=fixture();f.event('UserPromptSubmit');const key=f.hub.status().sessions[0].runKey!;f.event('Stop');f.event('UserPromptSubmit',{turn:'t2'});f.hub.setSummary('fixed',key,{state:'ready',files:[],omitted:0,endedAt:1});expect(f.hub.status().sessions[0].summary).toBeUndefined();});
 it('does not reuse a previous duration when a session opens without its next prompt',()=>{const f=fixture();f.event('UserPromptSubmit');f.event('PreToolUse');f.event('Stop');f.event('SessionStart');f.event('Stop');expect(f.hub.status().sessions[0].observation).toEqual({since:1000,endedAt:1000,actions:0});});
 it('performs at most two reads for a received turn and ignores foreign events',async()=>{
  const done=vi.fn(),read=vi.fn(async()=>({at:1,files:new Map<string,string>()})),c=new CompanionSummaries({session:'fixed',cwd:'C:\\Private',title:'x'},done,read);
  const e:any={event:'UserPromptSubmit',session:'fixed',cwd:'C:\\Private'},s={id:'fixed',runKey:'r'} as CompanionSession;
  c.observe({...e,session:'other'},s);expect(read).not.toHaveBeenCalled();c.observe(e,s);c.observe({...e,event:'Stop'},s);c.observe({...e,event:'Stop'},s);await vi.waitFor(()=>expect(done).toHaveBeenCalledOnce());expect(read).toHaveBeenCalledTimes(2);
 });
 it('cancels asynchronous work on pause and does not invent a missing baseline',async()=>{
  const done=vi.fn(),read=vi.fn(async()=>({at:1,files:new Map<string,string>()})),c=new CompanionSummaries({session:'fixed',cwd:'C:\\Private',title:'x'},done,read),e:any={event:'Stop',session:'fixed',cwd:'C:\\Private'},s={id:'fixed',runKey:'r'} as CompanionSession;
  c.observe(e,s);expect(done.mock.calls[0][2].state).toBe('unavailable');done.mockClear();c.observe({...e,event:'UserPromptSubmit'},s);c.observe(e,s);c.clear();await new Promise(r=>setTimeout(r,10));expect(done).not.toHaveBeenCalled();
 });
});
describe('monitor placement and nonintrusive visibility',()=>{
 it('clamps panels into negative-origin monitors and small work areas',()=>{
  expect(fitPanel({x:-1600,y:-200,width:1600,height:900},{x:100,y:100,width:700,height:1000})).toEqual({x:-700,y:-200,width:700,height:900});
  expect(fitPanel({x:0,y:0,width:320,height:300})).toEqual({x:0,y:0,width:320,height:300});
 });
 it('does not confuse adjacent monitors or touch-only borders with overlap',()=>{expect(overlaps({x:-100,y:0,width:100,height:100},{x:0,y:0,width:100,height:100})).toBe(false);expect(overlaps({x:-100,y:0,width:101,height:100},{x:0,y:0,width:100,height:100})).toBe(true);});
 it('suspends for fullscreen until explicitly invoked and never restores a user-hidden capsule',()=>{const v=new CapsuleVisibility();expect(v.visible(true,'game')).toBe(false);v.invoke('game');expect(v.visible(true,'game')).toBe(true);expect(v.visible(false,'work')).toBe(true);expect(v.visible(true,'game')).toBe(false);v.hide();expect(v.visible(false,'work')).toBe(false);v.invoke();expect(v.visible(false,'work')).toBe(true);});
 it('validates native observations without window titles, input or lossy process timestamps',()=>{
  const value={previous:{handle:'100',pid:123,started:'638968241234567890'},name:'chrome',foreground:'200',fullscreen:{x:-3840,y:0,width:3840,height:2160}};
  expect(DesktopObservation.parse(value).previous?.started).toBe(value.previous.started);expect(DesktopObservation.safeParse({...value,title:'private'}).success).toBe(false);expect(DesktopObservation.safeParse({...value,previous:{...value.previous,started:638968241234567890}}).success).toBe(false);
 });
});
