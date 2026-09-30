import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PersonalStore } from '../src/storage/personal';
import { audible, controlIntent, relevantMemory, type Memory } from '../src/shared/personal';
describe('Memoria y modo de respuesta', () => {
  it.each([['Cállate', 'silence'], ['Oye Zen, para, que estoy en una reunión. Déjamelo por escrito', 'silence'], ['Para la tarea', 'cancel'], ['Cancela la búsqueda', 'cancel'], ['Espera', 'pause'], ['Continúa', 'resume'], ['Ocúltate', 'hide'], ['Ya puedes hablar', 'speak'], ['para', 'ambiguous-stop'], ['Lee este documento', null]])('interpreta %s', (text, intent) => expect(controlIntent(text!)).toBe(intent));
  it('reunión prevalece sobre voz y auto', () => { expect(audible({ response: 'voice', meeting: true })).toBe(false); expect(audible({ response: 'auto', meeting: false })).toBe(true); expect(audible({ response: 'text', meeting: false })).toBe(false); expect(controlIntent('Busca licencias para una reunión de Teams')).toBeNull(); });
  it('perfil vacío, CRUD, modo persistente y reinicio sin reejecutar', () => {
    const directory = mkdtempSync(join(tmpdir(), 'zen-personal-'));
    try {
      const store = new PersonalStore(directory); expect(store.profile()).toEqual([]);
      const record: Memory = { id: randomUUID(), field: 'goals', kind: 'fact', content: 'Aprender diseño', source: 'Usuario de prueba', updatedAt: new Date().toISOString() };
      store.saveProfile([record]); store.saveMode({ response: 'text', meeting: true });
      store.task({ id: 'running', state: 'executing', message: 'Trabajando' }); store.task({ id: 'done', state: 'completed', message: 'Resultado' });
      const restarted = new PersonalStore(directory); restarted.recover();
      expect(restarted.profile()).toEqual([record]); expect(restarted.mode().meeting).toBe(true);
      expect(restarted.tasks().find(row => row.id === 'running')?.state).toBe('failed'); expect(restarted.tasks().find(row => row.id === 'done')?.message).toBe('Resultado');
      restarted.saveProfile([{ ...record, content: 'Otro objetivo' }]); expect(restarted.profile()[0].content).toBe('Otro objetivo');
      restarted.saveProfile([]); expect(restarted.profile()).toEqual([]);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
  it('no transmite el perfil completo ni datos sin relación', () => {
    const row = (field: Memory['field'], content: string): Memory => ({ id: randomUUID(), field, kind: 'fact', content, source: 'Prueba', updatedAt: new Date().toISOString() });
    expect(relevantMemory([row('professional', 'información no relacionada'), row('goals', 'Aprender diseño')], 'Responde según mis objetivos')).toHaveLength(1);
  });
  it('streaming updates remain transient and do not replace durable task state', () => {
    const directory = mkdtempSync(join(tmpdir(), 'zen-stream-'));
    try { const store = new PersonalStore(directory); store.task({ id: 'task', state: 'thinking', message: 'Preparando' }); store.task({ id: 'task', state: 'thinking', message: 'Actividad en directo', streamText: 'Texto provisional' }); expect(store.tasks()).toEqual([{ id: 'task', state: 'thinking', message: 'Preparando' }]); }
    finally { rmSync(directory, { recursive: true, force: true }); }
  });
});
