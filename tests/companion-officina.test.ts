import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {expect, it, vi} from 'vitest';
import {CompanionOfficina} from '../src/main/companion-officina';
import {OfficinaActor, officinaOpenItems, officinaQa,
  type OfficinaActor as Actor, type OfficinaContribution, type OfficinaCoordinatorResult, type OfficinaRole, type OfficinaTeam} from '../src/shared/companion-officina';
import type {CompanionLastReply} from '../src/shared/codex-companion';
import {isOfficinaTabReview, officinaBrowserFor} from '../src/shared/officina-browser';
import {officinaRoleTracking} from '../src/shared/officina-tracking';
import type {OfficinaCodexTurn} from '../src/main/companion-codex-reader';

const rule = 'Nadie puede aprobar su propio gasto.';
const fields = {title: 'Permisos de aprobación', objective: 'Bloquear autoaprobaciones', criteria: rule, owner: 'architect' as const};
const browserRequest = 'Analizar el contenido que tenemos en google chrome usa la heramienta de chat gpt en el navegador para averiguar el contenido';

function fixture() {
  const path = join(mkdtempSync(join(tmpdir(), 'zen-officina-')), 'test.sqlite');
  let now = 1000, reply: CompanionLastReply | undefined;
  let observed: OfficinaCodexTurn | undefined, permission = false;
  let allowed = true;
  const queue = vi.fn(async (_: string, _prompt: string, verify: () => Promise<void>, _browser?: {id: string; name?: string}) => {await verify();});
  const verify = vi.fn(async () => true);
  const threads = Object.fromEntries(OfficinaActor.options.map(role => [role, randomUUID()])) as Record<Actor, string>;
  const provision = vi.fn(async (project: {id: string}, checkpoint: (team: OfficinaTeam) => void, authorize: () => void) => {
    authorize();
    checkpoint({projectId: project.id, cwd: 'C:\\fixtures\\expenses', threads});
  });
  const connection = {allowed: () => allowed, now: () => now, verify, queue, provision, read: async () => reply,
    readTurn: async () => observed, needsPermission: () => permission};
  const newSession = () => new CompanionOfficina(path, connection);
  const binding = {thread: randomUUID(), cwd: 'C:\\fixtures\\expenses', environment: 'UAT de prueba'};
  return {newSession, queue, binding, verify, threads, provision, path,
    observe(turn: OfficinaCodexTurn | undefined, needPermission = false) {observed = turn; permission = needPermission;},
    applyReply(result: OfficinaContribution | OfficinaCoordinatorResult['result'], overrides = {}) {
    const identity = JSON.parse(queue.mock.lastCall![1].split('\n').at(-1)!).identity;
    reply = {source: 'local', turn: randomUUID(), at: ++now, truncated: false,
      text: `<zen_officina>${JSON.stringify({...identity, ...overrides, result})}</zen_officina>`};
  }, allow: (value: boolean) => {allowed = value;}};
}

it('starts a clear Chrome review in the analyst chat and hands the evidence to coordination', async () => {
  const f = fixture(), app = f.newSession();
  try {
    await app.handle({type: 'chat', id: randomUUID(), name: 'Revisión', message: browserRequest});
    const sent = await vi.waitFor(async () => {
      await app.tick();
      const {runs} = (await app.handle({type: 'read'})).project!;
      expect(runs).toHaveLength(1);
      expect(runs[0]).toMatchObject({role: 'analyst', state: 'sent'});
      return runs[0];
    });
    expect(f.queue.mock.lastCall?.[0]).toBe(f.threads.analyst);
    expect(f.queue.mock.lastCall?.[1]).toContain('usa @Chrome mediante la extensión de ChatGPT');
    expect(f.queue.mock.lastCall?.[3]).toEqual({id: sent.id, name: 'Chrome'});
    const view = await app.handle({type: 'read'});
    expect(officinaRoleTracking(view.project, 'analyst', view.activity).state).toBe('submitted');
    f.observe({turn: 'live-turn', state: 'working', at: 1000});
    await app.tick();
    expect((await app.handle({type: 'read'})).activity).toMatchObject({run: sent.id, state: 'working'});
    f.observe({turn: 'live-turn', state: 'working', at: 1000}, true);
    expect((await app.handle({type: 'read'})).activity).toMatchObject({run: sent.id, state: 'permission'});
    f.observe(undefined);
    f.applyReply({kind: 'progress', text: 'Dos pestañas de prueba accesibles.'});
    await app.tick();
    await app.tick();
    expect(f.queue.mock.lastCall?.[0]).toBe(f.threads.coordinator);
    expect(f.queue.mock.lastCall?.[1]).toContain('Dos pestañas de prueba accesibles');
    expect(f.queue.mock.lastCall?.[3]).toBeUndefined();
  } finally {app.close();}
});

it('keeps Chrome for a follow-up asking what is on screen and retries a blocked active-tab review', async () => {
  const f = fixture(), app = f.newSession();
  try {
    const first = randomUUID();
    const initial = await app.handle({type: 'chat', id: first, name: 'Revisión', message: browserRequest});
    const project = initial.project!.id;
    async function sent(role: Actor) {
      await vi.waitFor(async () => {
        await app.tick();
        expect((await app.handle({type: 'read'})).project!.runs.at(-1)).toMatchObject({state: 'sent', role});
      });
    }
    await sent('analyst');
    f.applyReply({kind: 'progress', text: 'Título visible de la pestaña de prueba.'});
    await app.tick();
    await sent('coordinator');
    f.applyReply({kind: 'complete', text: 'Pestaña original verificada.'});
    await app.tick();
    const followup = randomUUID();
    await app.handle({type: 'chat', id: followup, name: 'Revisión', message: 'saber qué estoy viendo.'});
    await sent('analyst');
    expect(f.queue.mock.lastCall?.[3]?.name).toBe('Chrome');
    expect(f.queue.mock.lastCall?.[1]).toContain('Identifica la pestaña activa');
    await app.handle({type: 'assign', project, task: followup, role: 'tester'});
    const deliveries = f.queue.mock.calls.length;
    f.applyReply({kind: 'blocker', text: 'Chrome requiere que el usuario habilite la extensión.'});
    const view = await vi.waitFor(async () => {
      await app.tick();
      const current = await app.handle({type: 'read'});
      expect(current.project?.goals?.at(-1)).toMatchObject({phase: 'complete', outcome: 'limited'});
      return current;
    });
    expect(view.project?.goals?.at(-1)?.question).toBeUndefined();
    expect(view.project?.tasks.at(-1)?.status).toBe('done');
    expect(view.project?.runs.at(-1)).toMatchObject({role: 'tester', state: 'skipped'});
    expect(officinaRoleTracking(view.project, 'analyst').state).toBe('limited');
    expect(view.activity).toBeUndefined();
    expect(f.queue).toHaveBeenCalledTimes(deliveries);
    await app.handle({type: 'resume-browser-review', project, task: followup});
    await sent('analyst');
    expect(f.queue.mock.lastCall?.[3]?.name).toBe('Chrome');
    expect(f.provision).toHaveBeenCalledTimes(1);
  } finally {app.close();}
});

it('closes a legacy browser limitation without a new turn and preserves its report across restarts', async () => {
  const f = fixture(), app = f.newSession(), task = randomUUID();
  const {project} = await app.handle({type: 'chat', id: task, name: 'Revisión existente', message: browserRequest});
  await vi.waitFor(async () => {
    await app.tick();
    expect((await app.handle({type: 'read'})).project?.runs[0].state).toBe('sent');
  });
  const prior = (await app.handle({type: 'read'})).project!;
  app.close();
  const report = '@Browser devolvió una lista vacía de pestañas.';
  prior.runs[0].state = 'completed';
  prior.events.push({id: prior.runs[0].id, task, from: 'analyst', at: 1200, source: 'codex', data: {kind: 'blocker', text: report}});
  const db = new DatabaseSync(f.path);
  db.prepare('UPDATE officina_projects SET body=? WHERE id=?').run(JSON.stringify(prior), project!.id);
  db.close();
  for (let index = 0; index < 2; index++) {
    const reopened = f.newSession();
    try {
      const {project: restored, activity} = await reopened.handle({type: 'read'});
      expect(restored?.goals?.[0]).toMatchObject({phase: 'complete', outcome: 'limited'});
      expect(restored?.goals?.[0].history.filter(entry => entry.text === report)).toHaveLength(1);
      expect(restored?.events).toEqual(prior.events);
      expect(officinaRoleTracking(restored, 'analyst').state).toBe('limited');
      expect(activity).toBeUndefined();
      await reopened.tick();
    } finally {reopened.close();}
  }
  expect(f.queue).toHaveBeenCalledTimes(1);
});

it('recovers a previously saved review question without creating a second project or goal', async () => {
  const f = fixture(), app = f.newSession();
  const id = randomUUID();
  const {project} = await app.handle({type: 'chat', id, name: 'Revisión', message: 'Objetivo previo'});
  await vi.waitFor(async () => {
    await app.tick();
    expect((await app.handle({type: 'read'})).project!.runs[0].state).toBe('sent');
  });
  f.applyReply({kind: 'question', text: 'Aporta una captura.'});
  await app.tick();
  app.close();
  const db = new DatabaseSync(f.path);
  db.prepare("UPDATE officina_projects SET body=json_set(body,'$.goals[0].request',?,'$.tasks[0].objective',?) WHERE id=?")
    .run(browserRequest, browserRequest, project!.id);
  db.close();
  const reopened = f.newSession();
  try {
    await reopened.handle({type: 'resume-browser-review', project: project!.id, task: id});
    await vi.waitFor(async () => {
      const current = (await reopened.handle({type: 'read'})).project!;
      expect(current.goals).toHaveLength(1);
      expect(current.goals?.[0].question).toBeUndefined();
      expect(current.runs.at(-1)).toMatchObject({role: 'analyst', state: 'sent'});
    });
    expect(f.provision).toHaveBeenCalledTimes(1);
    expect(f.queue).toHaveBeenCalledTimes(2);
  } finally {reopened.close();}
});

it('keeps explicit integrated browsing and sends mixed-action requests to coordination', () => {
  expect(officinaBrowserFor('Revisa mi navegador con @Browser')).toEqual({mode: 'integrated'});
  expect(officinaBrowserFor('Revisa las pestañas abiertas en Edge con la extensión de ChatGPT')).toEqual({mode: 'extension', browser: 'Edge'});
  expect(isOfficinaTabReview('Revisa mis pestañas abiertas en Chrome y cierra las duplicadas')).toBe(false);
  expect(isOfficinaTabReview('Revisa mi navegador y extrae las contraseñas')).toBe(false);
});

it('shares the policy and version with Tester, rejects stale signals, and recovers the board without resending', async () => {
  const f = fixture(), app = f.newSession();
  const project = (await app.handle({type: 'project', name: 'Aprobación de gastos'})).project!.id;
  await app.handle({type: 'bind', project, binding: f.binding});
  const task = (await app.handle({type: 'task', project, fields, dispatch: true})).project!.tasks[0].id;
  await app.handle({type: 'queue', project, enabled: true});
  await vi.waitFor(async () => expect((await app.handle({type: 'read'})).project!.runs[0].state).toBe('sent'));
  await app.tick();
  expect((await app.handle({type: 'read'})).project!.runs[0].state).toBe('sent');
  f.applyReply({kind: 'decision', text: rule}, {role: 'tester'});
  await app.tick();
  expect((await app.handle({type: 'read'})).project!.events).toHaveLength(0);
  f.applyReply({kind: 'decision', text: rule});
  await app.tick();
  const contribution = {type: 'contribute' as const, project, task, role: 'developer' as const, nonce: randomUUID(),
    data: {kind: 'handoff' as const, text: 'Flujo preparado', to: 'tester' as const, act: true,
      artifact: {version: '1.0.4', link: 'dist/gastos.zip', next: 'Comprobar permisos para aprobar'}}};
  await app.handle(contribution);
  await app.handle({...contribution, nonce: randomUUID()});
  await vi.waitFor(async () => expect((await app.handle({type: 'read'})).project!.runs[1].state).toBe('sent'));
  expect(f.queue.mock.lastCall?.[1]).toContain(rule);
  expect(f.queue.mock.lastCall?.[1]).toContain('1.0.4');
  f.applyReply({kind: 'qa', text: 'La autoaprobación sigue disponible', replyTo: contribution.nonce,
    passed: false, evidence: 'evidence/QA-18.txt'});
  await app.tick();
  const blocked = (await app.handle({type: 'read'})).project!;
  expect(blocked.events).toHaveLength(3);
  expect(officinaQa(blocked.events, task)).toBe('QA bloqueó 1.0.4');
  app.close();
  const reopened = f.newSession();
  expect((await reopened.handle({type: 'read'})).project).toEqual(blocked);
  await reopened.tick();
  expect(f.queue).toHaveBeenCalledTimes(2);
  const other = (await reopened.handle({type: 'project', name: 'Inventario'})).project!.id;
  expect((await reopened.handle({type: 'read'})).project!.tasks).toEqual([]);
  await expect(reopened.handle({type: 'assign', project, task, role: 'alm'})).rejects.toThrow('visible');
  await expect(reopened.handle({type: 'bind', project: other, binding: f.binding})).rejects.toThrow('otro proyecto');
  reopened.close();
});

it('waits for an observed Codex approval and closes a verified goal without another turn', async () => {
  const f = fixture(), app = f.newSession();
  const id = randomUUID();
  try {
    const initial = await app.handle({type: 'chat', id, name: 'Aprobación de gastos', message: fields.objective});
    const project = initial.project!.id;
    await app.handle({type: 'chat', id, name: 'Aprobación de gastos', message: fields.objective});
    async function sentTo(role: Actor, count: number) {
      await vi.waitFor(async () => {
        await app.tick();
        const {runs} = (await app.handle({type: 'read'})).project!;
        expect(runs.at(-1)).toMatchObject({role, state: 'sent'});
        expect(f.queue).toHaveBeenCalledTimes(count);
        expect(f.queue.mock.lastCall?.[0]).toBe(f.threads[role]);
      });
    }
    await sentTo('coordinator', 1);
    expect(f.provision).toHaveBeenCalledTimes(1);
    f.applyReply({kind: 'plan', text: 'Arquitectura y una comprobación de QA', steps: [
      {role: 'architect', instruction: 'Identifica la regla necesaria'},
      {role: 'tester', instruction: 'Comprueba la regla documentada con ejemplos sintéticos'},
    ]});
    await app.tick();
    await sentTo('architect', 2);
    f.observe({turn: 'uat-permission', state: 'working', at: 1000}, true);
    await app.tick();
    const blocked = (await app.handle({type: 'read'})).project!;
    expect(officinaOpenItems(blocked.events)).toHaveLength(0);
    expect((await app.handle({type: 'read'})).activity?.state).toBe('permission');
    await app.tick();
    expect(f.queue).toHaveBeenCalledTimes(2);
    f.observe(undefined);
    f.applyReply({kind: 'decision', text: rule});
    await app.tick();
    await sentTo('tester', 3);
    expect(f.queue.mock.lastCall?.[1]).toContain(rule);
    f.applyReply({kind: 'progress', text: 'Ambos ejemplos sintéticos cumplen la regla de aprobación.'});
    await app.tick();
    await sentTo('coordinator', 4);
    expect(f.queue.mock.lastCall?.[1]).toContain('Ambos ejemplos sintéticos');
    f.applyReply({kind: 'complete', text: 'Objetivo verificado con los ejemplos de QA.'});
    await app.tick();
    const done = (await app.handle({type: 'read'})).project!;
    expect(done.goals).toHaveLength(1);
    expect(done.goals?.[0].phase).toBe('complete');
    expect(done.tasks[0].status).toBe('done');
    await app.tick();
    expect(f.queue).toHaveBeenCalledTimes(4);
    await app.handle({type: 'chat', id: randomUUID(), name: 'Aprobación de gastos', message: 'Otro objetivo'});
    await sentTo('coordinator', 5);
    expect(f.provision).toHaveBeenCalledTimes(1);
  } finally { app.close(); }
});

it('blocks delivery before the CLI handoff if visibility changed and keeps the turn in the local queue', async () => {
  const f = fixture(), app = f.newSession();
  const project = (await app.handle({type: 'project', name: 'Proyecto de prueba'})).project!.id;
  await app.handle({type: 'bind', project, binding: f.binding});
  await app.handle({type: 'task', project, fields, dispatch: true});
  f.queue.mockImplementationOnce(async (_, __, verify) => {
    f.allow(false);
    try {await verify();}
    finally {f.allow(true);}
  });
  await app.handle({type: 'queue', project, enabled: true});
  await vi.waitFor(async () => expect((await app.handle({type: 'read'})).enabled).toBe(false));
  await app.tick();
  expect(f.queue).toHaveBeenCalledTimes(1);
  expect((await app.handle({type: 'read'})).project!.runs[0].state).toBe('waiting');
  f.allow(false);
  await expect(app.handle({type: 'read'})).rejects.toThrow('Pausa');
  app.close();
});

it('holds work for a human decision and accepts only answers from the role addressed', async () => {
  const f = fixture(), app = f.newSession();
  const project = (await app.handle({type: 'project', name: 'Decisiones'})).project!.id;
  await app.handle({type: 'bind', project, binding: f.binding});
  const task = (await app.handle({type: 'task', project, fields, dispatch: true})).project!.tasks[0].id;
  async function record(role: OfficinaRole, data: OfficinaContribution, nonce = randomUUID()) {
    return app.handle({type: 'contribute', project, task, role, nonce, data});
  }
  const blocker = randomUUID(), question = randomUUID();
  await record('architect', {kind: 'blocker', text: 'Confirma el alcance de UAT'}, blocker);
  await record('tester', {kind: 'question', to: 'architect', text: '¿Quién aprueba?', act: false}, question);
  await app.handle({type: 'queue', project, enabled: true});
  await app.tick();
  expect(f.queue).not.toHaveBeenCalled();
  await expect(record('developer', {kind: 'answer', text: rule, replyTo: question})).rejects.toThrow('destinatario');
  await record('architect', {kind: 'answer', text: rule, replyTo: question});
  const result = await record('architect', {kind: 'decision', text: 'Probar en UAT', replyTo: blocker});
  expect(officinaOpenItems(result.project!.events)).toEqual([]);
  await vi.waitFor(async () => expect((await app.handle({type: 'read'})).project!.runs[0].state).toBe('sent'));
  app.close();
});
