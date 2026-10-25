import {describe,it,expect} from 'vitest';
import {CompanionSettingsSchema,type CompanionStatus,type CompanionSession} from '../src/shared/codex-companion';
import {orbitalPresentation} from '../src/shared/orbital-presentation';
const session:CompanionSession={id:'fixed',cwd:'C:\\fixture',label:'Fixture',state:'working',at:1,runKey:'turn-a',steps:Array.from({length:7},(_,i)=>({id:String(i),label:'Observed',at:i}))};
const status=(extra:Partial<CompanionStatus>={}):CompanionStatus=>({settings:CompanionSettingsSchema.parse({}),account:'unchecked',checking:false,integration:'waiting',sessions:[session],approvals:[],notices:[],target:{session:'fixed',cwd:'C:\\fixture',title:'Fixture'},...extra});
describe('orbital observed state',()=>{
 it('never borrows work or trace from another chat',()=>{expect(orbitalPresentation(status({sessions:[{...session,id:'foreign'}]}))).toMatchObject({state:'unknown',steps:0,runKey:undefined});});
 it('keeps observed work despite an independent connection diagnostic failure',()=>{expect(orbitalPresentation(status({connection:{state:'unavailable',total:0,trusted:0,enabled:0}}))).toMatchObject({state:'working',steps:3});});
 it('hides the trace in presentation while preserving the observed phase',()=>{expect(orbitalPresentation(status({settings:CompanionSettingsSchema.parse({presentation:true})}))).toMatchObject({state:'working',steps:0});});
 it('keeps pending permissions ahead of pause and never turns unknown into working',()=>{const s=status({settings:CompanionSettingsSchema.parse({paused:true}),approvals:[{id:'permission',session:'fixed',turn:'a',label:'Review',tool:'write',preview:'Review first',expiresAt:100}]});expect(orbitalPresentation(s).state).toBe('approval');expect(orbitalPresentation(status({sessions:[{...session,state:'unknown'}]})).state).toBe('unknown');});
});
