import {randomUUID} from 'node:crypto';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {expect, it, vi} from 'vitest';
import {OfficinaGlanceState, readOfficinaGlance} from '../src/main/officina-glance';
import type {OfficinaGlanceItem} from '../src/shared/companion-officina';

it('deduplicates roles, prioritizes decisions, and signals only evidenced completions', () => {
  const state = new OfficinaGlanceState();
  const update = (items: [string, OfficinaGlanceItem][], now: number, completed: string[] = [], unknown = false) =>
    state.update({items: new Map(items), completed: new Set(completed), unknown, queued: 0}, now).badge;
  const developer = {project: 'p', projectName: 'Prueba', role: 'developer', kind: 'working'} as const;
  const tester = {...developer, role: 'tester'} as const;
  const working: [string, OfficinaGlanceItem][] = [['a', developer], ['b', developer], ['c', tester]];
  expect(update([], 0)).toBeUndefined();
  expect(update(working.slice(0, 2), 1)).toEqual({kind: 'working', count: 1, pulse: 1});
  expect(update(working, 2)).toEqual({kind: 'working', count: 2, pulse: 2});
  expect(update(working, 3)).toEqual({kind: 'working', count: 2, pulse: 2});
  expect(update([['c', {...tester, kind: 'permission'}], ...working.slice(0, 2)], 4, [], true))
    .toEqual({kind: 'decision', decisions: 1, count: 1, offline: true, lastSync: 3});
  expect(update(working, 5)).toEqual({kind: 'working', count: 2, pulse: 2});
  expect(update([], 6, ['a', 'b', 'c'])).toEqual({kind: 'finished'});
  expect(update([], 3006)).toBeUndefined();
  expect(update([['c', tester]], 3007)).toEqual({kind: 'working', count: 1, pulse: 3});
  expect(update([], 3008)).toBeUndefined();
  expect(update([], 3009, [], true)).toEqual({kind: 'unknown', offline: true, lastSync: 3008});
  expect(update(working, 3010)).toEqual({kind: 'working', count: 2, pulse: 3});
  expect(update([], 3011, ['a', 'b', 'c'])).toEqual({kind: 'finished'});
  expect(update([['c', tester]], 3012)).toEqual({kind: 'working', count: 1, pulse: 4});
  expect(state.update({items: new Map(working), completed: new Set(), unknown: false, queued: 3}, 3013))
    .toMatchObject({badge: {kind: 'working', count: 2}, queued: 3});
});

it('observes a dedicated chat with the board unopened and leaves its stored state intact', async () => {
  const path = join(mkdtempSync(join(tmpdir(), 'zen-glance-')), 'officina.sqlite');
  const project = randomUUID(), thread = randomUUID();
  const task = {id: randomUUID(), title: 'Siguiente encargo', objective: 'Prueba', criteria: 'Resultado',
    owner: 'developer', status: 'active'};
  const done = {...task, id: randomUUID(), status: 'done'};
  const body = JSON.stringify({id: project, name: 'Prueba', queueEnabled: false, tasks: [task, done], events: [],
    runs: [
      {id: randomUUID(), task: task.id, role: 'developer', state: 'waiting', depth: 0},
      {id: randomUUID(), task: task.id, role: 'observer', state: 'waiting', depth: 0},
      {id: randomUUID(), task: done.id, role: 'tester', state: 'waiting', depth: 0},
    ],
    team: {projectId: project, cwd: 'C:\\Prueba', threads: {developer: thread}}});
  const db = new DatabaseSync(path);
  try {
    db.exec('CREATE TABLE officina_projects (body TEXT)');
    db.prepare('INSERT INTO officina_projects VALUES (?)').run(body);
    const probe = vi.fn(async () => ({turn: {turn: 'turno', state: 'working' as const, at: 1}}));
    const reader = {probeOfficinaDirectTurn: probe, probeOfficinaTurn: vi.fn(), readOfficinaTurnReply: vi.fn()};
    const verify = vi.fn(async () => true);
    const observed = await readOfficinaGlance(path, reader, false, verify, () => false);
    expect([...observed.items.values()]).toMatchObject([{project, role: 'developer', kind: 'working'}]);
    expect(observed.queued).toBe(1);
    expect(await readOfficinaGlance(path, reader, true, verify, () => false)).toMatchObject({unknown: true, queued: 1});
    expect(probe).toHaveBeenCalledTimes(1);
    expect(db.prepare('SELECT body FROM officina_projects').get()?.body).toBe(body);
  } finally {db.close();}
});
