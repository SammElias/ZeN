import {it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {advanceGuide,guideStale,GuideSchema,guideSteps,responseMarks,SendGate,VisualReferenceSchema} from '../src/shared/interactions';
import {DropContext} from '../src/main/drop-context';
import {TaskManager} from '../src/agent/tasks';
import {SettingsSchema} from '../src/shared/contracts';
import {overlayBounds} from '../src/main/overlay';
const reference=()=>({id:randomUUID(),width:800,height:450,capturedAt:1000,source:'Captura elegida'});
const guide=()=>GuideSchema.parse({id:randomUUID(),projectId:null,taskId:randomUUID(),goal:'Revisar una conexión',steps:['Abre la lista','Comprueba el nombre'],index:0,status:'active',updatedAt:1000});
it('rejects wrong-image, out-of-bounds, malformed and oversized response annotations',()=>{
 const image=reference(),mark={imageId:image.id,type:'circle',points:[{x:.1,y:.2},{x:.3,y:.4}],explanation:'Campo seleccionado'};
 const text=(value:unknown)=>'```zen-visual\n'+JSON.stringify(value)+'\n```';
 expect(responseMarks(text([mark]),image)).toHaveLength(1);
 expect(responseMarks(text([{...mark,imageId:randomUUID()}]),image)).toEqual([]);
 expect(responseMarks(text([{...mark,points:[{x:-.1,y:0},{x:1.2,y:1}]}]),image)).toEqual([]);
 expect(responseMarks(text(Array(9).fill(mark)),image)).toEqual([]);
 expect(responseMarks('Solo una explicación textual',image)).toEqual([]);
 expect(VisualReferenceSchema.safeParse({...image,width:0}).success).toBe(false);
});
it('only manually advances an active guide and blocks stale visual instructions',()=>{
 const first=guide();expect(advanceGuide(first,'next',2000).index).toBe(1);
 const paused=advanceGuide(first,'pause',2000);expect(advanceGuide(paused,'next',3000)).toEqual(paused);
 const resumed=advanceGuide(paused,'resume',4000);expect(advanceGuide(advanceGuide(resumed,'next',5000),'next',6000).status).toBe('completed');
 const stale={...first,visual:reference()};expect(guideStale(stale,121000)).toBe(true);expect(advanceGuide(stale,'next',121000).index).toBe(0);
 expect(guideSteps('1. Abre la lista\nComprueba que sea la correcta.\n2. Lee el nombre')).toEqual(['Abre la lista\nComprueba que sea la correcta.','Lee el nombre']);
 expect(guideSteps('No puedo identificar el botón.')).toEqual(['No puedo identificar el botón.']);
});
it('deduplicates simultaneous sends, but permits a different draft and deliberate later retry',()=>{
 const gate=new SendGate();expect(gate.begin('same')).toBe(true);expect(gate.begin('same')).toBe(false);expect(gate.begin('different')).toBe(true);gate.end('same');expect(gate.begin('same')).toBe(true);
});
it('freezes submitted context while additions, edits and removals change only the next draft',async()=>{
 const context=new DropContext(value=>value),original=context.text('Antes de enviar: 739162'),other=context.text('No seleccionado'),signal=new AbortController().signal;
 const read=context.freeze([original.id]);context.revoke(original.id);context.text('Editado después: 000000');context.revoke(other.id);
 const snapshot=await read('resume',signal,1000);expect(snapshot.text).toContain('739162');expect(snapshot.text).not.toContain('000000');expect(snapshot.text).not.toContain('No seleccionado');
 expect(()=>context.freeze([original.id])).toThrow('caducó');
 const aborted=new AbortController();aborted.abort();await expect(read('resume',aborted.signal,1000)).rejects.toThrow();
});
it('a guide cannot call computer, project, direct, desktop or toolkit effects',async()=>{
 const effect=vi.fn(),emit=vi.fn();const run=vi.fn(async(...args:unknown[])=>{expect(args[5]).toBeUndefined();expect(args[6]).toBeUndefined();return{message:'1. Abre Bloc de notas tú mismo.\n2. Comprueba la ventana.'};});
 const manager=new TaskManager({saved:{run} as any,client:effect as any,settings:()=>SettingsSchema.parse({}),execute:effect,computer:effect,project:effect,direct:effect,desktop:()=>effect,toolkit:effect,emit,log:vi.fn()},()=>1);
 const requestId=randomUUID(),result=await manager.run('Abre Bloc de notas',requestId,undefined,undefined,undefined,2,undefined,undefined,true);
 expect(result.state).toBe('completed');expect(effect).not.toHaveBeenCalled();expect(run).toHaveBeenCalledOnce();expect(emit.mock.calls.every(([event])=>event.requestId===requestId)).toBe(true);
});
it('quick cards fit inside small and scaled monitor work areas',()=>{
 for(const area of [{x:-1920,y:-200,width:1920,height:1080},{x:0,y:0,width:320,height:400}])for(const edge of ['top','left','right'] as const){const rect=overlayBounds(area,{mode:'quick',height:600},1,edge,1);expect(rect.width).toBeLessThanOrEqual(380);expect(rect.x).toBeGreaterThanOrEqual(area.x);expect(rect.y).toBeGreaterThanOrEqual(area.y);expect(rect.x+rect.width).toBeLessThanOrEqual(area.x+area.width);expect(rect.y+rect.height).toBeLessThanOrEqual(area.y+area.height);}
});
