import {expect,it} from 'vitest';
import {allowedPortal,ShellActionSchema,ShellStatusSchema,initialShellStatus} from '../src/shared/desktop-shell';
import {capsuleStatus} from '../src/renderer/capsule-status';
it('permissions and pauses never animate as ongoing work',()=>{
 const busy={...initialShellStatus,state:'thinking' as const,busy:true};
 expect(capsuleStatus(busy).animate).toBe(true);
 expect(capsuleStatus({...busy,permission:true})).toMatchObject({kind:'permission',action:'permissions',animate:false});
 expect(capsuleStatus({...busy,paused:true})).toMatchObject({kind:'paused',action:'activity',animate:false});
 expect(capsuleStatus({...busy,external:true})).toMatchObject({kind:'external',animate:false});
 expect(capsuleStatus({...initialShellStatus,state:'awaiting_input'})).toMatchObject({kind:'input',action:'chat',animate:false});
 expect(capsuleStatus({...initialShellStatus,state:'awaiting_input',external:true})).toMatchObject({kind:'external',action:'activity',animate:false});
 expect(capsuleStatus({...busy,state:'failed'})).toMatchObject({kind:'error',action:'activity',animate:false});
});
it('voice and local context remain visible without inventing task progress',()=>{
 expect(capsuleStatus({...initialShellStatus,microphone:true})).toMatchObject({kind:'listening',detail:'Micrófono activo',animate:false});
 expect(capsuleStatus({...initialShellStatus,speaking:true})).toMatchObject({kind:'speaking',detail:'Reproduciendo voz',animate:false});
 expect(capsuleStatus({...initialShellStatus,contextReady:true})).toMatchObject({kind:'idle',detail:'Contexto preparado',animate:false});
});
it('allows only named local presentation windows',()=>{expect(allowedPortal('about:blank','zen-projects')).toBe(true);for(const [url,name]of [['https://example.com','zen-projects'],['file:///C:/other.html','zen-activity'],['about:blank','arbitrary'],['about:blank#other','zen-voice']])expect(allowedPortal(url,name)).toBe(false);});
it('capsule messages cannot carry prompts, paths or approval payloads',()=>{expect(ShellActionSchema.safeParse('stop').success).toBe(true);expect(ShellActionSchema.safeParse({action:'chat',prompt:'run'}).success).toBe(false);expect(ShellStatusSchema.safeParse({...initialShellStatus,apiKey:'secret'}).success).toBe(false);expect(ShellStatusSchema.safeParse({...initialShellStatus,label:'x'.repeat(91)}).success).toBe(false);});
