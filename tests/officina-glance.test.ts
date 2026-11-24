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
    state.update({items: new Map(items), completed: new Set(completed), unknown}, now).badge;
  const developer = {project: 'p', projectName: 'Prueba', role: 'developer', kind: 'working'} as const;
  const tester = {...developer, role: 'tester'} as const;
  const working: [string, OfficinaGlanceItem][] = [['a', developer], ['b', developer], ['c', tester]];
  expect(update([], 0)).toBeUndefined();
  expect(update(working.slice(0, 2), 1)).toEqual({kind: 'working', count: 1, pulse: 1});
  expect(update(working, 2)).toEqual({kind: 'working', count: 2, pulse: 2});
  expect(update(working, 3)).toEqual({kind: 'working', count: 2, pulse: 2});
  expect(update([['c', {...tester, kind: 'permission'}], ...working.slice(0, 2)], 4, [], true)).toEqual({kind: 'decision'});
  expect(update(working, 5)).toEqual({kind: 'working', count: 2, pulse: 2});
  expect(update([], 6, ['a', 'b', 'c'])).toEqual({kind: 'finished'});
  expect(update([], 3006)).toBeUndefined();
  expect(update([['c', tester]], 3007)).toEqual({kind: 'working', count: 1, pulse: 3});
  expect(update([], 3008)).toBeUndefined();
  expect(update([], 3009, [], true)).toEqual({kind: 'unknown'});
  expect(update(working, 3010)).toEqual({kind: 'working', count: 2, pulse: 3});
  expect(update([], 3011, ['a', 'b', 'c'])).toEqual({kind: 'finished'});
  expect(update([['c', tester]], 3012)).toEqual({kind: 'working', count: 1, pulse: 4});
});

it('observes a dedicated chat with the board unopened and leaves its stored state intact', async () => {
  const path = join(mkdtempSync(join(tmpdir(), 'zen-glance-')), 'officina.sqlite');
  const project = randomUUID(), thread = randomUUID();
  const body = JSON.stringify({id: project, name: 'Prueba', tasks: [], runs: [], events: [],
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
    expect((await readOfficinaGlance(path, reader, true, verify, () => false)).unknown).toBe(true);
    expect(probe).toHaveBeenCalledTimes(1);
    expect(db.prepare('SELECT body FROM officina_projects').get()?.body).toBe(body);
  } finally {db.close();}
});
