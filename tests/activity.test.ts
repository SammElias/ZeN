import {it,expect,vi} from 'vitest';
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
