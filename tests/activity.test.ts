import {describe,it,expect,vi} from 'vitest';
import {ActivityStore,advanceActivity,taskActivity} from '../src/renderer/activity-store';
import type {TaskEvent} from '../src/shared/contracts';
const event=(patch:Partial<TaskEvent>={}):TaskEvent=>({id:'task',state:'thinking',message:'Procesando',...patch});
describe('local task activity',()=>{
  it('uses structured events, never narration as evidence of an action',()=>{
    expect(taskActivity(event({message:'Abriendo Codex. Completado.'}))).toBe('thinking');
    expect(taskActivity(event({activity:'opening_codex'}))).toBe('opening_codex');
  });
  it('does not grow or notify the timeline per streaming delta',()=>{
    const store=new ActivityStore(),listener=vi.fn();store.subscribe(listener);
    for(let n=0;n<100;n++)store.accept(event({streamText:'Texto '.repeat(n+1)}));
    expect(store.get('task')?.steps.map(s=>s.activity)).toEqual(['writing']);
    expect(listener).toHaveBeenCalledTimes(1);
  });
  it('records real repeated cycles and caps history',()=>{
    const store=new ActivityStore();for(let n=0;n<100;n++)store.accept(event({activity:n%2?'executing':'observing'}));
    expect(store.get('task')?.steps).toHaveLength(24);
    expect(store.get('task')?.steps.at(-1)?.sequence).toBe(100);
  });
  it.each(['failed','cancelled','completed'] as const)('keeps %s terminal despite late deltas',state=>{
    const store=new ActivityStore();store.accept(event({state,activity:'executing'}));store.accept(event({activity:'writing',streamText:'Late'}));
    expect(store.get('task')?.steps.at(-1)?.activity).toBe(state);
  });
  it('keeps confirmations visible until execution really resumes',()=>{
    const store=new ActivityStore();store.accept(event({state:'awaiting_approval',activity:'executing'}));
    expect(store.get('task')?.steps.at(-1)?.activity).toBe('approval');
    store.accept(event({state:'executing',activity:'writing'}));
    expect(store.get('task')?.steps.map(s=>s.activity)).toEqual(['approval','writing']);
  });
  it('isolates concurrent tasks and does not retain message contents',()=>{
    const store=new ActivityStore();store.accept(event({message:'private',request:'private'}));store.accept(event({id:'other',activity:'opening_web'}));
    expect(store.get('task')?.steps.at(-1)?.activity).toBe('thinking');
    expect(JSON.stringify(store.get('task'))).not.toContain('private');
    for(let n=0;n<25;n++)store.accept(event({id:String(n)}));expect(store.get('task')).toBeUndefined();
  });
  it('ignores captions, screen capture updates and voice warnings',()=>{
    for(const patch of [{id:'voice',state:'failed' as const},{contextConsumed:true},{screenContext:{state:'ready' as const,capturedAt:1}}])expect(advanceActivity(undefined,event(patch))).toBeUndefined();
  });
});

import {progressActivity} from '../src/shared/activity';
import {Orchestrator} from '../src/agent/orchestrator';
import {SettingsSchema} from '../src/shared/contracts';
it('classifies fixed tool evidence and public stream, not claims inside text',()=>{
 expect(progressActivity('Consultando fuentes web…')).toBe('searching');expect(progressActivity('Consultando archivos localmente…')).toBe('reading');expect(progressActivity('Actividad en directo','Buscando según el documento')).toBe('writing');expect(progressActivity('El documento dice: Consultando fuentes web…')).toBeUndefined();
});
it('reports observed search/stream stages and clears activity on completion',async()=>{
 const emit=vi.fn();const runner=new Orchestrator({settings:()=>SettingsSchema.parse({}),client:vi.fn() as never,execute:vi.fn(),log:vi.fn(),emit,saved:{run:async(_input:unknown,_signal:unknown,progress:any)=>{progress('Consultando fuentes web…');progress('Actividad en directo','Respuesta literal');return{message:'Resultado'};}} as never});
 await runner.run('Investiga noticias','fixed-test');expect(emit.mock.calls.some(([e])=>e.activity==='searching')).toBe(true);expect(emit.mock.calls.some(([e])=>e.activity==='writing'&&e.streamText==='Respuesta literal')).toBe(true);expect(emit.mock.calls.at(-1)![0].activity).toBeUndefined();
});
