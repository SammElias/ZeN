import { describe, expect, it } from 'vitest';
import { latestTask, latestUtterance } from '../src/renderer/latest-message';
describe('Último mensaje de voz', () => {
  it('reemplaza el mensaje, conserva usuario mientras procesa y pasa al stream de ZEN', () => {
    let state = latestUtterance({}, { speaker: 'user', id: 'u1', text: 'Busca en la web', phase: 'done' });
    expect(state.message?.speaker).toBe('user');
    state = latestTask(state, { id: 'task', request: 'Busca en la web', state: 'thinking', message: 'Preparando' });
    expect(state.message?.text).toBe('Busca en la web');
    state = latestTask(state, { id: 'task', request: 'Busca en la web', state: 'thinking', message: 'Actividad', streamText: 'Respuesta parcial' });
    expect(state.message).toMatchObject({ speaker: 'zen', text: 'Respuesta parcial', provisional: true });
    state = latestTask(state, { id: 'task', request: 'Busca en la web', state: 'completed', message: 'Respuesta final' });
    expect(state.message?.text).toBe('Respuesta final');
  });
  it('un nuevo turno no revive transcripciones o resultados antiguos y conserva fuentes durante la voz', () => {
    let state = latestUtterance({}, { speaker: 'user', id: 'new', text: '', phase: 'start' });
    state = latestUtterance(state, { speaker: 'user', id: 'old', text: 'Antiguo', phase: 'done' });
    state = latestTask(state, { id: 'old-task', request: 'Antiguo', state: 'completed', message: 'Antiguo' });
    expect(state.message?.text).toBe('');
    state = latestUtterance(state, { speaker: 'user', id: 'new', text: 'Nuevo', phase: 'done' });
    state = latestTask(state, { id: 'new-task', request: 'Nuevo', state: 'completed', message: 'Fuente https://example.com/' });
    state = latestUtterance(state, { speaker: 'zen', id: 'response', sourceItemId: 'new', text: 'Respuesta hablada', phase: 'delta' });
    expect(state.message?.text).toBe('Respuesta hablada'); expect(state.sourceText).toContain('example.com');
    const current = state;
    expect(latestUtterance(state, { speaker: 'user', id: 'new', text: 'Nuevo', phase: 'done' })).toBe(current);
    expect(latestUtterance(state, { speaker: 'zen', id: 'old-response', sourceItemId: 'old', text: 'Antiguo', phase: 'done' })).toBe(current);
  });
  it('no sustituye el mensaje por avisos de conexión, ni duplica una aprobación', () => {
    const state = latestTask({}, { id: 'task', state: 'completed', message: 'Último' });
    expect(latestTask(state, { id: 'voice', state: 'listening', message: 'Conectada' })).toBe(state);
    expect(latestTask(state, { id: 'approval', state: 'awaiting_approval', message: 'Permiso' })).toBe(state);
  });
  it('conserva resultados durante la voz, pero no los atribuye a otra tarea',()=>{
    const artifact={id:'f42f0e1d-57d3-4650-82e6-62d45f2eb74e',title:'Imagen',kind:'image' as const};
    let state=latestTask({}, {id:'first',state:'completed',message:'Imagen lista',artifacts:[artifact]});
    state=latestUtterance(state,{speaker:'zen',id:'audio',text:'Lista',phase:'done'});expect(state.artifacts).toEqual([artifact]);
    state=latestTask(state,{id:'second',state:'completed',message:'Otra respuesta'});expect(state.artifacts).toBeUndefined();
    expect(latestUtterance(state,{speaker:'user',id:'new',text:'Nuevo turno',phase:'start'}).artifacts).toBeUndefined();
  });
});
