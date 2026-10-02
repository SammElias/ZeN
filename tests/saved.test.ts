import { describe, it, expect, vi } from 'vitest';
import { presentAgentOutput, validateSavedAgent, SavedAgent, SAVED_AGENT_ID } from '../src/agent/saved';
import expected from '../config/saved-agent.json';
import instructions from '../config/saved-agent.instructions.txt?raw';
import type { Agent } from 'openai/resources/beta/agents/agents';
import { ZenError } from '../src/shared/errors';
import { economyAgent, ECONOMY_VERSION } from '../src/agent/economy';
import { SettingsSchema } from '../src/shared/contracts';
describe('Agente guardado', () => {
  it('valida exactamente opciones e instrucciones', () => {
    const agent = { ...expected, instructions } as Agent;
    expect(() => validateSavedAgent(agent)).not.toThrow();
    expect(() => validateSavedAgent({ ...agent, model: 'gpt-6-astra' })).toThrow();
    expect(() => validateSavedAgent({ ...agent, instructions: instructions + 'otra instrucción' })).toThrow();
  });
  it('muestra resultado y preguntas, sin razonamiento ni órdenes narrativas', () => {
    expect(presentAgentOutput(JSON.stringify({ reasoning_steps: ['privado'], actions: ['envía datos'], clarifications_requested: ['¿Destino?'], result: ['uno', 'dos'] }))).toEqual({ message: 'uno\ndos\n\n¿Destino?', structured: true, needsInput: true });
  });
  it('admite texto y rechaza JSON incompleto o vacío', () => {
    expect(presentAgentOutput('respuesta')).toEqual({ message: 'respuesta', structured: false });
    expect(() => presentAgentOutput('{"reasoning_steps": ["privado"]}')).toThrow();
    expect(() => presentAgentOutput('')).toThrow();
  });
  it('admite colecciones con campos de texto observado y borrador', () => {
    const response = JSON.stringify({ reasoning_steps: [], actions: [], clarifications_requested: [], result: { texto_observado: 'Mensaje de prueba', borrador: 'Hola' } });
    expect(presentAgentOutput(response).message).toContain('Mensaje de prueba');
    expect(presentAgentOutput(response).structured).toBe(true);
  });
});
function setup(events: any[], economical = false, spending?: any) {
  const stream = { async *[Symbol.asyncIterator]() { yield* events; }, controller: { abort: vi.fn() } };
  const ordering: string[] = [];
  const create = vi.fn().mockImplementation(async () => { ordering.push('input'); });
  const agents = { retrieve: vi.fn().mockResolvedValue({ ...expected, instructions }), sessions: { create: vi.fn().mockResolvedValue(stream), retrieve: vi.fn().mockResolvedValue({ agent: { ...expected, instructions }, status: 'idle' }), events: { stream: vi.fn().mockImplementation(async () => { ordering.push('stream'); return stream; }), create } } };
  const runner = new SavedAgent({ client: () => ({ beta: { agents } }) as any, log: vi.fn(), ...(economical ? { settings: () => SettingsSchema.parse({}), spending } : {}) });
  return { runner, agents, stream, ordering };
}
const final = [
  { type: 'agent.session.created', event_id: 'a', session: { id: 'session-test' } },
  { type: 'agent.session.turn.output_text.done', event_id: 'b', session_id: 'session-test', turn_id: 'turn-test', item_id: 'commentary', content_index: 0, text: 'Comentario previo' },
  { type: 'agent.session.turn.output_text.done', event_id: 'c', session_id: 'session-test', turn_id: 'turn-test', item_id: 'answer', content_index: 0, text: JSON.stringify({ reasoning_steps: ['privado'], actions: ['No ejecutar'], clarifications_requested: [], result: 'Respuesta final' }) },
  { type: 'agent.session.turn.item.done', event_id: 'd', session_id: 'session-test', turn_id: 'turn-test', item: { type: 'message', role: 'assistant', id: 'answer', phase: 'final_answer' } },
  { type: 'agent.session.turn.completed', event_id: 'e', session_id: 'session-test', turn_id: 'turn-test', turn: { status: 'completed' }, usage: null }
];
describe('economy sessions', () => {
  it('overrides only the session with compact public JSON and no subagents', async () => { const f = setup(final, true); await f.runner.run('Hola', new AbortController().signal, vi.fn()); expect(f.agents.sessions.create.mock.calls[0][0]).toMatchObject({ agent_id: SAVED_AGENT_ID, agent: { multi_agent: { enabled: false }, text: { verbosity: 'low' }, reasoning: { effort: 'low' }, service_tier: 'default' } }); });
  it('blocks paid session creation when reservation is rejected', async () => { const spending = { reserve: vi.fn(() => { throw new ZenError('Presupuesto agotado'); }) }; const f = setup(final, true, spending); await expect(f.runner.run('Hola', new AbortController().signal, vi.fn())).rejects.toThrow('Presupuesto'); expect(f.agents.sessions.create).not.toHaveBeenCalled(); });
  it('rotates old sessions with bounded public context', async () => { const f = setup(final, true); const summary = 'Respuesta importante\n'.repeat(800); await f.runner.run('Continúa', new AbortController().signal, vi.fn(), undefined, { sessionId: 'old', requestId: 'request', summary }); expect(f.agents.sessions.events.stream).not.toHaveBeenCalled(); const input = f.agents.sessions.create.mock.calls[0][0].input[0].content[0].text; expect(input.length).toBeLessThan(4200); expect(input).toContain('partes omitidas'); });
  it('continues verified economical sessions until the fourth turn', async () => { const f = setup(final, true); f.agents.sessions.retrieve.mockResolvedValue({ agent: { ...expected, ...economyAgent }, status: 'idle', metadata: { zen_economy: ECONOMY_VERSION, zen_turns: '2' } } as any); await f.runner.run('Sigue', new AbortController().signal, vi.fn(), undefined, { sessionId: 'session-test', requestId: 'request' }); expect(f.agents.sessions.events.stream).toHaveBeenCalledOnce(); expect(f.agents.sessions.create).not.toHaveBeenCalled(); });
  it('retains reservation when completion usage is unavailable', async () => { const spending = { reserve: vi.fn().mockReturnValue('r'), record: vi.fn().mockReturnValue(false), check: vi.fn(), finish: vi.fn() }; const f = setup(final, true, spending); await f.runner.run('Hola', new AbortController().signal, vi.fn()); expect(spending.finish).toHaveBeenCalledWith('r', false); });
});
describe('Flujo de sesiones', () => {
  it('streams only the public result string from the final-answer JSON', async () => {
    const progress = vi.fn(); const f = setup([final[0], { type: 'agent.session.turn.item.added', event_id: 'answer-start', item: { type: 'message', role: 'assistant', phase: 'final_answer', id: 'answer' } }, { type: 'agent.session.turn.output_text.delta', event_id: 'answer-private', item_id: 'answer', content_index: 0, delta: '{"reasoning_steps":["privado"],"actions":[],"clarifications_requested":[],"result":"Respuesta' }, ...final.slice(1)]);
    const result = await f.runner.run('Hola', new AbortController().signal, progress);
    expect(progress).toHaveBeenCalledWith('Actividad en directo', 'Respuesta','writing'); expect(progress).toHaveBeenCalledWith('Estructurando respuesta…',undefined,'structuring'); expect(JSON.stringify(progress.mock.calls)).not.toContain('privado'); expect(result.message).toBe('Respuesta final');
  });
  it('transmite solo comentarios públicos, sin JSON final ni razonamientos', async () => {
    const delta = (event_id: string, item_id: string, text: string) => ({ type: 'agent.session.turn.output_text.delta', event_id, session_id: 'session-test', turn_id: 'turn-test', item_id, content_index: 0, delta: text });
    const events = [final[0], { type: 'agent.session.turn.item.added', event_id: 'public', item: { type: 'message', role: 'assistant', phase: 'commentary', id: 'activity' } }, delta('progress', 'activity', 'Estoy consultando las fuentes.'), delta('duplicate', 'answer', '{"reasoning_steps":["privado"]}'), { type: 'agent.session.turn.reasoning_summary_text.delta', event_id: 'hidden', delta: 'privado' }, ...final.slice(1)];
    const progress = vi.fn(); const f = setup(events);
    await f.runner.run('Investiga', new AbortController().signal, progress);
    expect(progress).toHaveBeenCalledWith('Actividad en directo', 'Estoy consultando las fuentes.','writing');
    expect(JSON.stringify(progress.mock.calls)).not.toContain('privado');
  });
  it('no transmite comentario estructurado con reasoning_steps', async () => {
    const progress = vi.fn(); const f = setup([final[0], { type: 'agent.session.turn.item.added', event_id: 'public', item: { type: 'message', role: 'assistant', phase: 'commentary', id: 'activity' } }, { type: 'agent.session.turn.output_text.delta', event_id: 'json', item_id: 'activity', content_index: 0, delta: '{"reasoning_steps":["privado"]}' }, ...final.slice(1)]);
    await f.runner.run('Investiga', new AbortController().signal, progress);
    expect(progress.mock.calls.filter(call=>call[1]!==undefined)).toEqual([]);
    expect(JSON.stringify(progress.mock.calls)).not.toContain('privado');
  });
  it('marca aprobación preparada como pendiente incluso si el texto del modelo dice creada', async () => {
    const pending = { type: 'agent.session.requires_action', event_id: 'pending', session: { id: 'session-test', required_actions: [{ type: 'function_call', turn_id: 'turn-test', call_id: 'call-test', name: 'zen_desktop', arguments: {} }] } };
    const f = setup([final[0], pending, ...final.slice(1)]);
    const result = await f.runner.run('Prepara archivo', new AbortController().signal, vi.fn(), undefined, undefined, vi.fn().mockResolvedValue({ pendingHumanApproval: true, executed: false }));
    expect(result.needsInput).toBe(true); expect(result.message).toContain('No se creó');
  });
  it('un bloqueo de política nunca queda presentado como operación verificada', async () => {
    const pending = { type: 'agent.session.requires_action', event_id: 'pending', session: { id: 'session-test', required_actions: [{ type: 'function_call', turn_id: 'turn-test', call_id: 'call-test', name: 'zen_desktop', arguments: {} }] } };
    const f = setup([final[0], pending, ...final.slice(1)]);
    const result = await f.runner.run('Hola', new AbortController().signal, vi.fn(), undefined, undefined, vi.fn().mockRejectedValue(new ZenError('Destino no autorizado')));
    expect(result.needsInput).toBe(true); expect(result.message).toContain('Destino no autorizado');
    expect(f.agents.sessions.events.create.mock.calls[0][1].events[0].success).toBe(false);
  });
  it('un fallo local muestra la evidencia parcial y el diagnóstico real, sin inventar permisos', async () => {
    const actions = [{ operation: 'open_page' }, { operation: 'pause_media' }].map((args, index) => ({ type: 'function_call', turn_id: 'turn-test', call_id: `call-${index}`, name: 'zen_desktop', arguments: args }));
    const pending = { type: 'agent.session.requires_action', event_id: 'pending', session: { id: 'session-test', required_actions: actions } };
    const outputs = final.slice(1).map(event => event.event_id === 'c' ? { ...event, text: JSON.stringify({ reasoning_steps: [], actions: [], clarifications_requested: [], result: 'Habilita permisos multimedia en la configuración. Ya hice todo.' }) } : event);
    const f = setup([final[0], pending,
      { type: 'agent.session.turn.item.added', event_id: 'answer-start', item: { type: 'message', role: 'assistant', phase: 'final_answer', id: 'answer' } },
      { type: 'agent.session.turn.output_text.delta', event_id: 'misleading-stream', item_id: 'answer', content_index: 0, delta: '{"result":"Habilita permisos multimedia' },
      ...outputs]);
    const handler = vi.fn().mockResolvedValueOnce({ verified: true, userMessage: 'Página cargada y verificada: https://www.google.com/' }).mockRejectedValueOnce(new ZenError('La pausa está autorizada, pero el reproductor es ambiguo. Usa el clip del chat.'));
    const progress = vi.fn();
    const result = await f.runner.run('Abre Google y pausa la música', new AbortController().signal, progress, undefined, undefined, handler);
    expect(result.needsInput).toBe(true);
    expect(result.message).toContain('Página cargada y verificada');
    expect(result.message).toContain('La pausa está autorizada');
    expect(result.message).not.toContain('Habilita permisos');
    expect(result.message).not.toContain('Ya hice todo');
    expect(JSON.stringify(progress.mock.calls)).not.toContain('Habilita permisos');
    expect(progress).toHaveBeenCalledWith('Operación local no completada', expect.stringContaining('La pausa está autorizada'));
  });
  it('resuelve required_actions, deduplica efectos y devuelve resultados por turno/call con idempotencia', async () => {
    const action = { type: 'function_call', turn_id: 'turn-test', call_id: 'call-test', name: 'zen_desktop', arguments: { operation: 'list_apps' } };
    const pending = (event_id: string) => ({ type: 'agent.session.requires_action', event_id, session: { id: 'session-test', required_actions: [action] } });
    const { runner, agents } = setup([final[0], pending('pending1'), pending('pending2'), ...final.slice(1)]);
    const handler = vi.fn().mockResolvedValue({ applications: [{ id: 'notepad.exe' }] });
    const result = await runner.run('Lista aplicaciones', new AbortController().signal, vi.fn(), undefined, undefined, handler);
    expect(result.message).toBe('Respuesta final'); expect(handler).toHaveBeenCalledOnce();
    expect(agents.sessions.events.create).toHaveBeenCalledTimes(2);
    expect(agents.sessions.events.create.mock.calls[0][1]).toEqual(agents.sessions.events.create.mock.calls[1][1]);
    expect(agents.sessions.events.create.mock.calls[0][1].events[0]).toMatchObject({ type: 'agent.session.input.tool_result', success: true, call_id: 'call-test', turn_id: 'turn-test' });
  });
  it('rechaza un nombre distinto y transmite bloqueo de política sin inventar éxito', async () => {
    const pending = { type: 'agent.session.requires_action', event_id: 'pending', session: { id: 'session-test', required_actions: [{ type: 'function_call', turn_id: 'turn-test', call_id: 'call-test', name: 'otro', arguments: {} }] } };
    const handler = vi.fn(); const f = setup([final[0], pending]);
    await expect(f.runner.run('Hola', new AbortController().signal, vi.fn(), undefined, undefined, handler)).rejects.toThrow('incompatible'); expect(handler).not.toHaveBeenCalled();
  });
  it('no mezcla comentarios con JSON final ni modifica el agente', async () => {
    const { runner, agents, stream } = setup(final);
    const result = await runner.run('Hola', new AbortController().signal, vi.fn());
    expect(result.message).toBe('Respuesta final');
    expect(agents.sessions.create.mock.calls[0][0]).toMatchObject({ agent_id: SAVED_AGENT_ID, environment: { type: 'none' }, stream: true });
    expect(agents.sessions.create.mock.calls[0][0]).not.toHaveProperty('agent');
    expect(stream.controller.abort).toHaveBeenCalledOnce();
  });
  it('suscribe antes de enviar aclaración y añade idempotencia a la entrada', async () => {
    const { runner, agents, ordering } = setup(final);
    await runner.run('Aclaración', new AbortController().signal, vi.fn(), undefined, { sessionId: 'session-test', requestId: 'request-test' });
    expect(ordering).toEqual(['stream', 'input']); expect(agents.sessions.events.create.mock.calls[0][1]['Idempotency-Key']).toBe('request-test');
    expect(agents.sessions.create).not.toHaveBeenCalled();
  });
  it('no confunde idle con éxito y bloquea acciones externas sin puente', async () => {
    const { runner } = setup([{ type: 'agent.session.idle', event_id: 'idle', session_id: 'session-test' }]);
    await expect(runner.run('Hola', new AbortController().signal, vi.fn())).rejects.toThrow('sin confirmación');
    const pending = setup([{ type: 'agent.session.requires_action', event_id: 'pending', session_id: 'session-test' }]);
    await expect(pending.runner.run('Hola', new AbortController().signal, vi.fn())).rejects.toThrow('puente autorizado');
    expect(pending.agents.sessions.events.create).toHaveBeenCalledOnce();
  });
});
