import {mkdirSync, mkdtempSync, readFileSync, renameSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {expect, it, vi} from 'vitest';
import {CompanionOfficina} from '../src/main/companion-officina';
import {OfficinaAction, OfficinaActor, officinaActorName, officinaOpenItems, officinaPasteLimit, officinaQa,
  type OfficinaActor as Actor, type OfficinaContribution, type OfficinaCoordinatorResult, type OfficinaDestination,
  type OfficinaObserverResult, type OfficinaProject, type OfficinaRole, type OfficinaRunIdentity, type OfficinaTeam} from '../src/shared/companion-officina';
import type {CompanionLastReply} from '../src/shared/codex-companion';
import {isOfficinaTabReview, officinaBrowserFor} from '../src/shared/officina-browser';
import {officinaFocusedTask, officinaRoleTracking, officinaTaskBoard} from '../src/shared/officina-tracking';
import {legacyOfficinaContextQuestion, officinaAttention, officinaContextIssue, officinaReplyReviewQuestion,
  officinaWaitingRuns} from '../src/shared/officina-attention';
import {MAX_CODEX_REQUEST} from '../src/shared/companion-request';
import {officinaDelegatedRoles, officinaResults} from '../src/shared/officina-results';
import {officinaOutputInstructions, officinaRoleProfile} from '../src/shared/officina-instructions';
import type {OfficinaCodexTurn} from '../src/main/companion-codex-reader';
import {OfficinaProvisioning} from '../src/main/companion-officina-provision';
import {captureOfficinaSource} from '../src/main/companion-officina-context';
import {getRunBinding, officinaReply, officinaTurn} from '../src/main/companion-officina-turn';
import {officinaProjectDecisions} from '../src/shared/officina-decisions';

const rule = 'Nadie puede aprobar su propio gasto.';
const fields = {title: 'Permisos de aprobación', objective: 'Bloquear autoaprobaciones', criteria: rule, owner: 'architect' as const};
const browserRequest = 'Analizar el contenido que tenemos en google chrome usa la heramienta de chat gpt en el navegador para averiguar el contenido';

it('projects each role on the focused task and keeps a previous delivery in its own task', () => {
  const previous = randomUUID(), current = randomUUID(), automation = randomUUID();
  const review = randomUUID(), analyst = randomUUID(), coordinator = randomUUID(), tester = randomUUID();
  const project: OfficinaProject = {id: randomUUID(), name: 'Oficina de prueba',
    tasks: [{...fields, id: previous, status: 'done'}, {...fields, id: current, title: 'Revisa el flujo', status: 'active'},
      {...fields, id: automation, status: 'active'}],
    runs: [{id: analyst, task: previous, role: 'analyst', state: 'completed', turn: 'analyst', depth: 0},
      {id: coordinator, task: current, role: 'coordinator', state: 'sent', depth: 0},
      {id: tester, task: automation, role: 'tester', state: 'sent', depth: 0}],
    events: [{id: analyst, task: previous, from: 'analyst', source: 'codex', at: 1000,
      data: {kind: 'decision', text: 'Informe anterior'}}],
    reviews: [{id: review, scope: previous, at: 1000, source: 'monitor', report: {kind: 'observation', text: 'Revisión anterior',
      proposals: [{kind: 'process', title: 'Mejora', evidence: 'Caso de prueba', validation: 'Revisión', recommendation: 'Comparar casos'}]}}],
    goals: [{task: current, request: 'Revisa el flujo', phase: 'work', history: [], round: 1, cursor: 0,
      steps: [{role: 'architect', instruction: 'Analiza la estructura'}, {role: 'tester', instruction: 'Contrasta el resultado'}]},
    {task: automation, improvement: randomUUID(), request: 'Incidencia automática', phase: 'plan', history: [], round: 0, cursor: 0, steps: []}]};

  expect(officinaFocusedTask(project)?.id).toBe(current);
  expect(officinaFocusedTask(project, previous)?.id).toBe(previous);
  expect(officinaTaskBoard(project, current).events).toEqual([]);
  expect(officinaRoleTracking(project, 'coordinator', {run: coordinator, state: 'working', at: 1100}, current)).toMatchObject({state: 'working', task: current});
  expect(officinaRoleTracking(project, 'analyst', {run: analyst, state: 'working', at: 1100}, current)).toEqual({state: 'idle', label: 'En espera'});
  expect(officinaRoleTracking(project, 'tester', {run: tester, state: 'working', at: 1100}, current)).toMatchObject({state: 'scheduled', task: current});
  expect(officinaRoleTracking(project, 'observer', undefined, current)).toMatchObject({state: 'idle'});
  expect(officinaRoleTracking(project, 'analyst', undefined, previous)).toMatchObject({state: 'done', task: previous, detail: 'Informe anterior'});
  expect(officinaRoleTracking(project, 'observer', undefined, previous)).toMatchObject({label: '1 propuesta pendiente'});
  expect(officinaRoleTracking(project, 'developer', undefined, previous)).toEqual({state: 'idle', label: 'Sin participación'});
});

it('recovers the legacy ALM limitation only for the verified turn', () => {
  const project = randomUUID(), task = randomUUID(), id = randomUUID();
  const run = {id, task, role: 'alm' as const, depth: 0, state: 'review' as const, sentAt: 1000, turn: 'original'};
  const reply = {source: 'local' as const, at: 2000, turn: 'original', truncated: false,
    text: `<zen_officina>${JSON.stringify({project, task, run: id, role: 'alm', result: {type:'blocker', text:'Falta validar el paquete.'}})}</zen_officina>`};
  expect(officinaReply(reply, project, run)).toMatchObject({result:{kind:'blocker',text:'Falta validar el paquete.'}});
  expect(officinaReply({...reply,turn:'otro'}, project, run)).toBeUndefined();
  expect(officinaReply(reply, randomUUID(), run)).toBeUndefined();
});

function fixture(pickContext?: (kind: 'folder' | 'file') => Promise<string[]>,
  missingThread?: (projectId: string, cwd: string, thread: string) => Promise<boolean>) {
  const path = join(mkdtempSync(join(tmpdir(), 'zen-officina-')), 'test.sqlite');
  let now = 1000, reply: CompanionLastReply | undefined;
  let observed: OfficinaCodexTurn | undefined, permission = false;
  let allowed = true;
  const queue = vi.fn(async (_: string, _prompt: string, verify: () => Promise<void>, _browser?: {id: string; name?: string}) => {await verify();});
  const wakeQueued = vi.fn(async (_: OfficinaDestination, _identity: OfficinaRunIdentity, authorize: () => void) => {
    authorize();
    return false;
  });
  const verify = vi.fn(async () => true);
  const openChat = vi.fn(async (_thread: string) => {});
  const openReferenceUrl = vi.fn(async (_url: string) => {});
  const revealReference = vi.fn(async (_path: string, _directory: boolean) => {});
  const threads = Object.fromEntries(OfficinaActor.options.map(role => [role, randomUUID()])) as Record<Actor, string>;
  const provision = vi.fn(async (project: {id: string; folder?: {path: string}; team?: OfficinaTeam},
    checkpoint: (team: OfficinaTeam) => void, authorize: () => void, _repair?: unknown, observer = false) => {
    authorize();
    const {observer: zen, ...workers} = threads;
    checkpoint({projectId: project.id, cwd: project.folder?.path ?? 'C:\\fixtures\\expenses',
      threads: observer ? {...project.team?.threads, observer: zen} : {...project.team?.threads, ...workers}});
  });
  const connection = {allowed: () => allowed, now: () => now, verify, queue, wakeQueued, provision, pickContext, missingThread, openChat,
    openReferenceUrl, revealReference, read: async () => reply,
    readTurn: async () => observed, needsPermission: () => permission};
  const newSession = (exactReplies = false) => new CompanionOfficina(path, {...connection,
    readTurnReply: exactReplies ? async (_target, turn) => reply?.turn === turn ? reply : undefined : undefined});
  const binding = {thread: randomUUID(), cwd: 'C:\\fixtures\\expenses', environment: 'UAT de prueba'};
  return {newSession, queue, wakeQueued, binding, verify, threads, provision, path, openChat, openReferenceUrl, revealReference,
    advance(ms: number) {now += ms;},
    observe(turn: OfficinaCodexTurn | undefined, needPermission = false) {observed = turn; permission = needPermission;},
    applyReply(result: OfficinaContribution | OfficinaCoordinatorResult['result'] | OfficinaObserverResult['result'], overrides = {}) {
    const identity = JSON.parse(queue.mock.lastCall![1].split('\n').at(-1)!).identity;
    reply = {source: 'local', turn: randomUUID(), at: ++now, truncated: false,
      text: `<zen_officina>${JSON.stringify({...identity, ...overrides, result})}</zen_officina>`};
    return reply;
  }, allow: (value: boolean) => {allowed = value;}};
}

it.each(['type', 'kind'])('records the reviewed architect decision with %s only under its original task and turn', async discriminant => {
  const f = fixture(), app = f.newSession(true), task = randomUUID();
  try {
    const view = await app.handle({type: 'chat', name: 'Decisión de prueba', id: task, role: 'architect', message: 'Diseña el indicador.'});
    const read = async () => (await app.handle({type: 'read'})).project!;
    const run = await vi.waitFor(async () => {
      await app.tick();
      const current = (await read()).runs[0];
      expect(current.state).toBe('sent');
      return current;
    });
    const incompatible = f.applyReply({kind: 'decision', text: 'Decisión de prueba.'}, {extra: true});
    f.observe({turn: incompatible.turn!, state: 'finished', at: incompatible.at});
    await app.tick();
    expect((await read()).runs[0].state).toBe('review');
    const reply = f.applyReply({kind: 'decision', text: 'Diseño comprobado.'});
    reply.turn = incompatible.turn;
    const legacy = (taskId: string) => `<zen_officina>${JSON.stringify({
      project: view.project!.id, task: taskId, run: run.id, role: 'architect',
      result: {[discriminant]: 'decision', text: 'Diseño comprobado.', markdown: 'a'.repeat(4001)},
    })}</zen_officina>`;
    reply.text = legacy(randomUUID());
    await app.tick();
    expect((await read()).events).toHaveLength(0);
    f.advance(30_001);
    reply.text = legacy(task);
    expect(officinaReply({...reply, turn: 'otro'}, view.project!.id, {...run, turn: incompatible.turn})).toBeUndefined();
    await app.tick();
    const recovered = await read();
    expect(recovered.runs[0]).toMatchObject({id: run.id, state: 'completed', turn: incompatible.turn});
    expect(recovered.events).toMatchObject([{id: run.id, task, from: 'architect', data: {
      kind: 'decision', text: 'Diseño comprobado.', markdown: expect.stringContaining('Informe abreviado'),
    }}]);
    expect(recovered.events[0].data.markdown!.length).toBeLessThanOrEqual(4000);
    await app.tick();
    expect((await read()).events).toHaveLength(1);
    expect(f.queue).toHaveBeenCalledTimes(1);
  } finally {app.close();}
});

it.each([false, true])('resumes a coordinated plan from Architecture exactly once after recovery (already saved: %s)', async alreadySaved => {
  const f = fixture(), task = randomUUID();
  let app = f.newSession(true);
  const read = async () => (await app.handle({type: 'read'})).project!;
  const sent = (role: Actor, count: number) => vi.waitFor(async () => {
    await app.tick();
    expect(f.queue).toHaveBeenCalledTimes(count);
    expect((await read()).runs.at(-1)).toMatchObject({role, state: 'sent'});
  });
  try {
    await app.handle({type: 'chat', name: 'Proyecto recuperado', id: task, message: 'Diseña y aplica la mejora.'});
    await sent('coordinator', 1);
    f.applyReply({kind: 'plan', text: 'Diseño y desarrollo.', steps: [{role: 'architect', instruction: 'Diseña.'},
      {role: 'developer', instruction: 'Aplica el diseño.'}]});
    await app.tick();
    await sent('architect', 2);
    const reply = f.applyReply({kind: 'decision', text: 'Diseño recuperado.'}, {extra: true});
    f.observe({turn: reply.turn!, state: 'finished', at: reply.at});
    await app.tick();
    const saved = await read(), architecture = saved.runs.at(-1)!;
    expect(saved.goals?.[0]).toMatchObject({phase: 'verify', cursor: 0, question: officinaReplyReviewQuestion});
    expect(architecture.state).toBe('review');
    const {extra, ...payload} = JSON.parse(reply.text.slice(14, -15));
    expect(extra).toBe(true);
    reply.text = `<zen_officina>${JSON.stringify(payload)}</zen_officina>`;
    app.close();
    if (alreadySaved) {
      architecture.state = 'completed';
      delete architecture.issue;
      saved.events.push({id: architecture.id, task, from: 'architect', at: reply.at, source: 'codex', data: payload.result});
      const db = new DatabaseSync(f.path);
      db.prepare('UPDATE officina_projects SET body=? WHERE id=?').run(JSON.stringify(saved), saved.id);
      db.close();
    }
    app = f.newSession(true);
    await read();
    await sent('developer', 3);
    expect((await read()).goals?.[0]).toMatchObject({phase: 'work', cursor: 1});
    expect((await read()).goals?.[0].question).toBeUndefined();
    expect((await read()).events.filter(event => event.id === architecture.id)).toHaveLength(1);
    expect((await read()).runs.filter(run => run.role === 'developer')).toHaveLength(1);
  } finally {app.close();}
});

it('handles a decision once after restart while other requests keep their order and task evidence', async () => {
  const f = fixture(), first = randomUUID(), second = randomUUID(), third = randomUUID();
  let app = f.newSession(true);
  const read = async () => (await app.handle({type: 'read'})).project!;
  const sent = (task: string, role: Actor, count: number) => vi.waitFor(async () => {
    await app.tick();
    expect(f.queue).toHaveBeenCalledTimes(count);
    expect((await read()).runs.find(run => run.task === task && run.state === 'sent')).toMatchObject({role});
  });
  const submit = (id: string, message: string, project?: string) => app.handle({type: 'chat', name: 'Decisiones de prueba', id, message, project});
  try {
    const {project: initial} = await submit(first, 'Prepara una propuesta.');
    const project = initial!.id;
    await sent(first, 'coordinator', 1);
    f.applyReply({kind: 'plan', text: 'Plan acordado.', steps: [{role: 'architect', instruction: 'Propón un diseño.'},
      {role: 'developer', instruction: 'Aplica el diseño aprobado.'}]});
    await app.tick();
    await sent(first, 'architect', 2);
    await submit(second, 'Segundo objetivo independiente.', project);
    await submit(third, 'Tercer objetivo independiente.', project);
    expect(officinaWaitingRuns(await read()).map(run => run.task)).toEqual([second, third]);
    f.applyReply({kind: 'request', mode: 'approval', text: 'Aprueba la propuesta para pasar a Desarrollo.', markdown: '## Propuesta',
      priority: 'blocking', impact: 'Puede modificar el entorno de producción.', sensitive: true});
    await app.tick();
    const pending = officinaAttention(await read(), undefined, first);
    expect(pending?.kind).toBe('request');
    if (pending?.kind !== 'request') throw Error('Missing request');
    app.close();
    app = f.newSession(true);
    await read();
    await sent(second, 'coordinator', 3);
    expect(f.queue.mock.lastCall?.[1]).not.toContain('Aprueba la propuesta');
    const answer = {type: 'resolve-request', project, task: first, run: pending.run.id, decision: 'approve'} as const;
    await expect(app.handle({...answer, task: third})).rejects.toThrow('ya no está pendiente');
    await expect(app.handle({...answer, decision: 'respond', message: 'Sí'})).rejects.toThrow('acción disponible');
    await expect(app.handle(answer)).rejects.toThrow('confirma la decisión');
    await expect(app.handle({...answer, decision: 'reject'})).rejects.toThrow('confirma la decisión');
    expect(officinaProjectDecisions(await read())).toMatchObject([{id: pending.run.id, status: 'pending', priority: 'blocking'}]);
    await Promise.all([app.handle({...answer, confirmed: true}), app.handle({...answer, confirmed: true})]);
    await expect(app.handle({...answer, decision: 'request-changes', message: 'Cambia el diseño'})).rejects.toThrow('ya se registró');
    expect(officinaWaitingRuns(await read()).map(run => run.task)).toEqual([third, first]);
    expect(officinaProjectDecisions(await read())).toMatchObject([{id: pending.run.id, status: 'approve', delivery: 'waiting'}]);
    f.applyReply({kind: 'limited', text: 'Segundo encargo concluido.'});
    await app.tick();
    await sent(third, 'coordinator', 4);
    f.applyReply({kind: 'limited', text: 'Tercer encargo concluido.'});
    await app.tick();
    await sent(first, 'developer', 5);
    expect(f.queue.mock.lastCall?.[1]).toContain('Aprobado');
    expect(f.queue.mock.lastCall?.[1]).toContain(pending.run.id);
    expect((await read()).runs.filter(run => run.task === first && run.role === 'developer')).toHaveLength(1);
    expect(officinaProjectDecisions(await read())).toMatchObject([{id: pending.run.id, status: 'approve', delivery: 'accepted'}]);
  } finally {app.close();}
});

it('keeps a continuation for the same agent in the chat that originated the decision', () => {
  const taskId = randomUUID(), originId = randomUUID(), continuationId = randomUUID();
  const original = {projectId: 'dedicated', cwd: 'C:\\Fixture', thread: randomUUID(), environment: 'Local'};
  const project: OfficinaProject = {
    id: randomUUID(), name: 'Decisión versionada', tasks: [{...fields, id: taskId, status: 'active'}], events: [],
    team: {projectId: original.projectId, cwd: original.cwd, threads: {architect: randomUUID()}},
    runs: [
      {id: originId, task: taskId, role: 'architect', state: 'completed', depth: 0, destination: original,
        humanAnswer: {action: 'request-changes', message: 'Conserva los permisos del equipo.', continuation: continuationId}},
      {id: continuationId, task: taskId, role: 'architect', state: 'waiting', depth: 0},
    ],
  };
  const continuation = project.runs[1];
  expect(getRunBinding(project, continuation)).toEqual(original);
  const turn = officinaTurn(project, project.tasks[0], continuation, original.cwd);
  expect(JSON.parse(turn!.prompt.split('\n').at(-1)!).humanDecision).toEqual({
    version: originId, action: 'request-changes', feedback: 'Conserva los permisos del equipo.',
  });
});

it('keeps new requests in a paused queue and moves past a confirmed interruption without resending it', async () => {
  const f = fixture(), app = f.newSession(true), first = randomUUID(), second = randomUUID();
  try {
    const {project} = await app.handle({type: 'project', name: 'Cola de prueba'});
    const read = async () => (await app.handle({type: 'read'})).project!;
    const toggle = (enabled: boolean) => app.handle({type: 'queue', project: project!.id, enabled});
    await toggle(false);
    for (const id of [first, second]) await app.handle({type: 'chat', project: project!.id, name: project!.name, id, message: 'Una tarea.'});
    await app.tick();
    expect(f.queue).not.toHaveBeenCalled();
    expect(officinaWaitingRuns(await read()).map(run => run.task)).toEqual([first, second]);
    await toggle(true);
    await vi.waitFor(async () => {
      await app.tick();
      expect((await read()).runs[0].state).toBe('sent');
    });
    f.observe({turn: 'interrupted', state: 'interrupted', at: 1100});
    await app.tick();
    expect((await read()).runs[0]).toMatchObject({state: 'review', issue: expect.stringContaining('interrumpió')});
    f.observe(undefined);
    await vi.waitFor(async () => {
      await app.tick();
      expect((await read()).runs[1].state).toBe('sent');
      expect(f.queue).toHaveBeenCalledTimes(2);
    });
  } finally {app.close();}
});

it('deletes only the selected local board and saves the fallback selection', async () => {
  const f = fixture();
  const office = f.newSession();
  const kept = (await office.handle({type: 'project', name: 'Conservar'})).project!;
  const removed = (await office.handle({type: 'project', name: 'Eliminar'})).project!;
  const file = join(dirname(f.path), 'entrega.txt');
  writeFileSync(file, 'Entregable original');
  await office.handle({type: 'bind', project: removed.id, binding: {...f.binding, cwd: dirname(f.path)}});
  await office.handle({type: 'task', project: removed.id, fields, dispatch: true});
  await expect(office.handle({type: 'delete-project', project: kept.id})).rejects.toThrow('proyecto visible cambió');
  f.allow(false);
  await expect(office.handle({type: 'delete-project', project: removed.id})).rejects.toThrow('Abre Officina');
  f.allow(true);
  expect(await office.handle({type: 'delete-project', project: removed.id})).toMatchObject({
    project: {id: kept.id}, projects: [{id: kept.id, name: kept.name}], enabled: false,
  });
  expect(readFileSync(file, 'utf8')).toBe('Entregable original');
  expect(f.queue).not.toHaveBeenCalled();
  expect(f.provision).not.toHaveBeenCalled();
  expect(f.openChat).not.toHaveBeenCalled();
  office.close();

  const reopened = f.newSession();
  try {
    expect((await reopened.handle({type: 'read'})).project?.id).toBe(kept.id);
    await expect(reopened.handle({type: 'select', project: removed.id})).rejects.toThrow('ya no está disponible');
    const empty = await reopened.handle({type: 'delete-project', project: kept.id});
    expect(empty.projects).toEqual([]);
    expect(empty.project).toBeUndefined();
    expect((await reopened.handle({type: 'project', name: kept.name})).project?.id).not.toBe(kept.id);
  } finally {
    reopened.close();
  }
});

it('never recreates a deleted project when an asynchronous chat check finishes', async () => {
  let finishCheck!: (missing: boolean) => void;
  const chatCheck = new Promise<boolean>(resolve => {finishCheck = resolve;});
  const missingThread = vi.fn(() => chatCheck);
  const f = fixture(undefined, missingThread);
  const office = f.newSession();
  try {
    const {project} = await office.handle({type: 'chat', name: 'Proyecto temporal', message: 'Prepara un análisis.', id: randomUUID()});
    await vi.waitFor(() => {
      void office.tick();
      expect(missingThread).toHaveBeenCalledOnce();
    });
    await office.handle({type: 'delete-project', project: project!.id});
    finishCheck(false);
    await new Promise<void>(resolve => setImmediate(resolve));
    expect((await office.handle({type: 'read'})).projects).toEqual([]);
    expect(f.queue).not.toHaveBeenCalled();
  } finally {
    finishCheck(false);
    office.close();
  }
});

it.skipIf(process.platform !== 'win32')('opens report links only from the visible project without sending another turn', async () => {
  const f = fixture(), officina = f.newSession();
  const root = dirname(f.path);
  const output = join(root, 'guía 100%.md');
  writeFileSync(output, 'Entregable de prueba');
  const {project} = await officina.handle({type: 'project', name: 'Proyecto'});
  const action = {type: 'open-reference', project: project!.id, target: 'gu%C3%ADa%20100%25.md:12:3', mode: 'editor'} as const;
  await officina.handle({type: 'bind', project: project!.id, binding: {...f.binding, cwd: root}});
  await officina.handle(action);
  expect(f.openReferenceUrl.mock.lastCall?.[0]).toMatch(/^vscode:\/\/file\/.*\/gu%C3%ADa%20100%25\.md:12:3$/);
  await officina.handle({...action, mode: 'explorer', target: output});
  await officina.handle({...action, mode: 'explorer', target: '.'});
  expect(f.revealReference.mock.calls).toEqual([[output, false], [root, true]]);
  await officina.handle({...action, mode: 'browser', target: 'https://example.invalid/entrega'});
  expect(f.openReferenceUrl).toHaveBeenLastCalledWith('https://example.invalid/entrega');
  await expect(officina.handle({...action, task: randomUUID()})).rejects.toThrow('tarea no pertenece');
  await expect(officina.handle({...action, mode: 'browser'})).rejects.toThrow('Elige VS Code');
  await expect(officina.handle({...action, target: 'vscode://settings'})).rejects.toThrow('enlace no es');
  f.allow(false);
  await expect(officina.handle(action)).rejects.toThrow('Abre Officina');
  f.allow(true);
  await officina.handle({type: 'project', name: 'Otro proyecto'});
  await expect(officina.handle(action)).rejects.toThrow('proyecto visible cambió');
  expect(f.openReferenceUrl).toHaveBeenCalledTimes(2);
  expect(f.queue).not.toHaveBeenCalled();
  officina.close();
});

it.skipIf(process.platform !== 'win32')('provisions the selected directory as the read-only root of each role chat', async () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'zen-officina-root-'));
  const selected = join(fixtureRoot, 'Proyecto (con espacios)');
  mkdirSync(join(selected, 'src', 'nested'), {recursive: true});
  const folder = await captureOfficinaSource(selected, 'folder');
  const project = {id: randomUUID(), name: 'Proyecto', folder, tasks: [], events: [], runs: []};
  const savedProject = {id: 'test-project', name: project.name, metadata: {zenOfficina: project.id}, roots: [{path: folder.path}]};
  const threads = new Map<string, {id: string; projectId: string; cwd: string; ephemeral: boolean; name?: string}>();
  const request = vi.fn(async (method: string, raw: unknown) => {
    const params = raw as {idempotencyKey?: string; cwd: string; threadId: string; name: string};
    switch (method) {
      case 'project/create':
      case 'project/read': return {project: savedProject};
      case 'thread/start': {
        const thread = {id: randomUUID(), projectId: savedProject.id, cwd: params.cwd, ephemeral: false};
        threads.set(thread.id, thread);
        return {thread};
      }
      case 'thread/name/set': threads.get(params.threadId)!.name = params.name; return {};
      case 'thread/read': return {thread: threads.get(params.threadId)};
      default: throw Error(method);
    }
  });
  const noop = () => {};
  const provisioning = new OfficinaProvisioning(join(fixtureRoot, 'interno'), async () => ({request,
    respond: noop, reject: noop, onMessage: noop, onClose: noop, close: noop}), async () => []);
  const checkpoint = vi.fn<(team: OfficinaTeam) => void>();
  await provisioning.ensure(project, checkpoint, noop);
  expect(request).toHaveBeenCalledWith('project/create', expect.objectContaining({roots: [{path: folder.path}]}));
  const started = request.mock.calls.filter(([method]) => method === 'thread/start');
  expect(started).toHaveLength(6);
  for (const [, params] of started) expect(params).toMatchObject({cwd: folder.path, runtimeWorkspaceRoots: [folder.path],
    sandbox: 'read-only', approvalsReviewer: 'user'});
  expect(checkpoint.mock.lastCall?.[0]).toMatchObject({cwd: folder.path, projectId: savedProject.id});
  const team = checkpoint.mock.lastCall![0];
  expect(team.threads.observer).toBeUndefined();
  request.mockClear();
  await provisioning.ensure({...project, team}, checkpoint, noop, undefined, true);
  expect(request.mock.calls.filter(([method]) => method === 'thread/start')).toEqual([
    ['thread/start', expect.objectContaining({cwd: folder.path, sandbox: 'read-only', approvalPolicy: 'never',
      developerInstructions: expect.stringContaining('No contactes a otros agentes')})],
  ]);
  expect(checkpoint.mock.lastCall?.[0].threads).toMatchObject({...team.threads, observer: expect.any(String)});
});

it('keeps ZEN observations separate from work and applies a prompt only after a current, explicit human decision', async () => {
  const f = fixture();
  let app = f.newSession();
  const original = (await app.handle({type: 'project', name: 'Revisión de equipo'})).project!;
  const requested = (await app.handle({type: 'task', project: original.id, fields, dispatch: false})).project!.tasks[0];
  await app.handle({type: 'contribute', project: original.id, task: requested.id, role: 'analyst',
    nonce: randomUUID(), data: {kind: 'progress', text: 'Análisis previo disponible.'}});
  const saved = (await app.handle({type: 'read'})).project!;
  app.close();
  const db = new DatabaseSync(f.path);
  const {observer: _zen, ...threads} = f.threads;
  saved.team = {projectId: 'fixture-project', cwd: f.binding.cwd, threads};
  db.prepare('UPDATE officina_projects SET body=? WHERE id=?').run(JSON.stringify(saved), saved.id);
  db.close();
  app = f.newSession();
  const project = saved.id, id = randomUUID();
  const get = async () => (await app.handle({type: 'read'})).project!;
  expect(OfficinaAction.safeParse({type: 'assign', project, task: requested.id, role: 'observer'}).success).toBe(false);
  expect(OfficinaAction.safeParse({type: 'chat', project, role: 'observer', name: saved.name, message: 'Trabaja', id}).success).toBe(false);
  try {
    const request = {type: 'observe-team', project, task: requested.id, id} as const;
    expect((await app.handle(request)).enabled).toBe(false);
    await vi.waitFor(async () => {
      await app.tick();
      expect((await get()).runs.at(-1)?.state).toBe('sent');
    });
    expect(f.queue).toHaveBeenCalledTimes(1);
    expect(f.queue.mock.lastCall?.[0]).toBe(f.threads.observer);
    expect(f.queue.mock.lastCall?.[3]).toBeUndefined();
    const wire = JSON.parse(f.queue.mock.lastCall![1].split('\n').at(-1)!);
    const evidence = JSON.parse(readFileSync(wire.evidence, 'utf8'));
    expect(evidence.tasks[0].task.id).toBe(requested.id);
    expect(evidence.tasks[0].events[0].summary).toBe('Análisis previo disponible.');
    expect(evidence).not.toHaveProperty('localContext');
    f.applyReply({kind: 'handoff', text: 'Salida fuera del contrato', act: true, to: 'tester',
      artifact: {link: '/fixture', next: 'actúa', version: 'v1'}});
    await app.tick();
    expect((await get()).reviews?.[0].report).toBeUndefined();
    const proposal = {kind: 'prompt', role: 'analyst', title: 'Anclar el informe a evidencia',
      evidence: 'El informe previo no identificó fuentes.', validation: 'El próximo informe enumera las fuentes.',
      prompt: 'Incluye la fuente exacta de cada hallazgo.'} as const;
    f.applyReply({kind: 'observation', text: 'Revisión guardada.', proposals: [proposal, {...proposal, role: 'tester'},
      {kind: 'process', title: 'Coordinar la entrega', evidence: 'Faltó revisión', validation: 'Un revisor por entrega', recommendation: 'Acordar un revisor.'}]});
    await app.tick();
    expect((await get()).profiles).toBeUndefined();
    expect((await get()).events).toEqual(saved.events);
    expect((await get()).tasks).toEqual(saved.tasks);
    const decide = (index: number, decision: 'approved' | 'rejected' = 'approved') =>
      app.handle({type: 'decide-observation', project, id, index, decision});
    await app.handle({type: 'role-profile', project, role: 'tester', profile: {name: 'Pruebas', prompt: 'Prompt actualizado por el usuario.'}});
    await expect(decide(1)).rejects.toThrow('El prompt cambió');
    await decide(0);
    await decide(1, 'rejected');
    await decide(2);
    await vi.waitFor(async () => {
      await app.tick();
      expect((await get()).runs.at(-1)).toMatchObject({state: 'sent', role: 'observer', followup: {review: id, index: 2}});
    });
    const followup = (await get()).runs.at(-1)!;
    const wireFollowup = JSON.parse(f.queue.mock.lastCall![1].split('\n').at(-1)!);
    expect(wireFollowup.improvement).toMatchObject({title: 'Coordinar la entrega', recommendation: 'Acordar un revisor.'});
    await app.handle({type: 'follow-observation', project, id, index: 2});
    await expect(app.handle({type: 'follow-observation', project, id, index: 1})).rejects.toThrow('aprobación disponible');
    f.applyReply({kind: 'followup', outcome: 'done', text: 'El plan para acordar un revisor quedó preparado.'});
    await app.tick();
    await expect(decide(0)).rejects.toThrow('ya no está pendiente');
    app.close();
    app = f.newSession();
    const restored = await get();
    expect(restored.profiles?.analyst).toMatchObject({name: 'Analista funcional', prompt: proposal.prompt});
    expect(restored.profiles?.tester?.prompt).toBe('Prompt actualizado por el usuario.');
    expect(restored.reviews?.[0].decisions?.map(decision => decision.status)).toEqual(['approved', 'rejected', 'approved']);
    expect(restored.runs.map(run => [run.role, run.state])).toEqual([['observer', 'completed'], ['observer', 'completed']]);
    expect(restored.runs.at(-1)).toMatchObject({id: followup.id, followup: {result: {outcome: 'done'}}});
    expect(restored.tasks).toEqual(saved.tasks);
    expect(restored.events).toEqual(saved.events);
    await app.handle({type: 'open-run-chat', project, task: followup.task, run: followup.id});
    expect(f.openChat).toHaveBeenCalledExactlyOnceWith(f.threads.observer);
    expect(f.queue).toHaveBeenCalledTimes(2);
  } finally {
    app.close();
  }
});

it.skipIf(process.platform !== 'win32')('keeps references with the goal and blocks a replaced attachment before queueing', async () => {
  let file = '';
  const f = fixture(async () => [file]), app = f.newSession();
  const original = join(dirname(f.path), 'guía.txt');
  file = original;
  writeFileSync(file, 'Contenido sintético');
  try {
    const picked = await app.handle({type: 'pick-context', kind: 'file'});
    expect(picked.context?.files[0].name).toBe('guía.txt');
    const mockDelivery = vi.fn();
    f.queue.mockImplementationOnce(async (_, prompt, verify) => {
      renameSync(original, join(dirname(f.path), 'guía anterior.txt'));
      writeFileSync(original, 'Archivo de reemplazo');
      await verify();
      mockDelivery(prompt);
    });
    const view = await app.handle({type: 'chat', name: 'Análisis de archivo', message: 'Lee el adjunto.', id: randomUUID()});
    expect(view.context).toBeUndefined();
    expect(view.project?.goals?.[0].files?.[0].name).toBe('guía.txt');
    await vi.waitFor(async () => {
      await app.tick();
      const state = await app.handle({type: 'read'});
      expect(state.project?.runs[0]).toMatchObject({state: 'review', issue: expect.stringContaining('Vuelve a adjuntarlo')});
    });
    const payload = JSON.parse(f.queue.mock.lastCall![1].split('\n').at(-1)!);
    expect(payload.localContext.files).toEqual([picked.context?.files[0].path]);
    expect(mockDelivery).not.toHaveBeenCalled();
  } finally { app.close(); }
});

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

it('instructs ALM to restart an authorized local deployment and collects its result after ZEN reopens', async () => {
  const f = fixture(), app = f.newSession(), task = randomUUID();
  await app.handle({type: 'chat', id: task, name: 'ZeN', role: 'alm', message: 'Instala localmente la revisión aprobada.'});
  try {
    await vi.waitFor(async () => {
      await app.tick();
      expect((await app.handle({type: 'read'})).project?.runs[0].state).toBe('sent');
    });
    const prompt = f.queue.mock.lastCall![1];
    expect(prompt).toContain('cierre ordenado y la reapertura');
    expect(prompt).toContain('scripts/deploy-windows.ps1 -Install');
    expect(prompt).toContain('release/deployment-windows.json');
  } finally {app.close();}
  f.applyReply({kind: 'progress', text: 'Instalación y reinicio verificados.'});
  const reopened = f.newSession();
  try {
    await reopened.handle({type: 'read'});
    await reopened.tick();
    const {project} = await reopened.handle({type: 'read'});
    expect(project?.goals?.[0]).toMatchObject({task, phase: 'complete'});
    expect(project?.goals?.[0].outcome).toBeUndefined();
    expect(project?.events).toMatchObject([{from: 'alm', data: {kind: 'progress', text: 'Instalación y reinicio verificados.'}}]);
    await reopened.tick();
    expect(f.queue).toHaveBeenCalledTimes(1);
  } finally {reopened.close();}
});

it.each([true, false])('routes one confirmed ZEN incident to the team with passing QA %s', async (passed) => {
  const f = fixture(), task = randomUUID();
  let app = f.newSession();
  const next = async (role: Actor, count: number) => vi.waitFor(async () => {
    await app.tick();
    expect(f.queue).toHaveBeenCalledTimes(count);
    const run = (await app.handle({type: 'read'})).project?.runs.at(-1);
    expect(run, `Envío ${count}: ${run?.issue ?? 'sin aviso'}`).toMatchObject({role, state: 'sent'});
    return JSON.parse(f.queue.mock.lastCall![1].split('\n').at(-1)!);
  });
  try {
    const {project} = await app.handle({type: 'chat', id: task, name: 'ZeN', role: 'alm', message: 'Comprueba el despliegue.'});
    const id = project!.id;
    await next('alm', 1);
    const enable = () => app.handle({type: 'auto-improvements', project: id, enabled: true});
    if (!passed) await enable();
    const incompatible = f.applyReply({kind: 'progress', text: 'Estado de la entrega.'}, {task: randomUUID()});
    f.observe({turn: incompatible.turn!, at: incompatible.at, state: 'finished'});
    await vi.waitFor(async () => {
      await app.tick();
      expect((await app.handle({type: 'read'})).project?.reviews?.at(-1)).toMatchObject({incident: 'reply-format', scope: task});
    });
    f.observe(undefined);
    await enable();
    const coordinator = await next('coordinator', 2);
    expect(coordinator.improvement).toMatchObject({task, turn: incompatible.turn});
    const dismiss = {type: 'dismiss-improvement' as const, project: id, task: coordinator.identity.task};
    await expect(app.handle({...dismiss, task})).rejects.toThrow('El aviso de mejora ya no está disponible');
    expect((await app.handle(dismiss)).project?.goals?.at(-1)).toMatchObject({
      task: coordinator.identity.task, phase: 'plan', improvementNoticeDismissed: true,
    });
    f.applyReply({kind: 'plan', text: 'Reparar, probar e instalar.', steps: [
      {role: 'developer', instruction: 'Corrige la respuesta.'},
      {role: 'tester', instruction: 'Prueba y valida la entrega.'},
      {role: 'alm', instruction: 'Despliega la revisión aprobada.'},
    ]});
    const develop = await next('developer', 3);
    f.applyReply({kind: 'handoff', text: 'Corrección lista.', to: 'tester', act: true,
      artifact: {version: 'v2', link: 'release/v2.sha256', next: 'Verifica el registro del informe.'}});
    const tester = await next('tester', 4);
    expect(tester.event?.id).toBe(develop.identity.run);
    f.applyReply({kind: 'qa', text: 'Comprobación de v2.', passed, replyTo: develop.identity.run, evidence: 'Prueba de registro.'});
    // The approval belongs to the saved project and the unobserved reply survives a restart.
    app.close();
    app = f.newSession();
    expect((await app.handle({type: 'read'})).project?.goals?.at(-1)?.improvementNoticeDismissed).toBe(true);
    if (passed) {
      const alm = await next('alm', 5);
      expect(alm.qa).toBe('QA validó v2');
      f.applyReply({kind: 'progress', text: 'v2 instalada y arranque verificado.'});
    }
    await next('coordinator', passed ? 6 : 5);
    f.applyReply({kind: 'complete', text: 'Resultado consolidado.'});
    await vi.waitFor(async () => {
      await app.tick();
      const current = (await app.handle({type: 'read'})).project!;
      expect(current.goals?.filter(goal => goal.improvement)).toEqual([expect.objectContaining({phase: 'complete'})]);
      expect(current.goals?.at(-1)?.outcome).toBe(passed ? undefined : 'limited');
    });
    await enable();
    await app.tick();
    expect(f.queue).toHaveBeenCalledTimes(passed ? 6 : 5);
  } finally {app.close();}
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
  const f = fixture();
  let app = f.newSession();
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
    expect(officinaAttention(blocked, (await app.handle({type: 'read'})).activity)).toMatchObject({kind: 'permission', turn: 'uat-permission'});
    await app.tick();
    expect(f.queue).toHaveBeenCalledTimes(2);
    f.observe(undefined);
    f.applyReply({kind: 'decision', text: rule});
    await app.tick();
    await sentTo('tester', 3);
    expect(f.queue.mock.lastCall?.[1]).toContain(rule);
    const markdown = '## Verificación\n\n- Dos ejemplos comprobados en `fixtures/aprobaciones.json`.';
    f.applyReply({kind: 'progress', text: 'Ambos ejemplos sintéticos cumplen la regla de aprobación.', markdown});
    await app.tick();
    await sentTo('coordinator', 4);
    expect(f.queue.mock.lastCall?.[1]).toContain('Ambos ejemplos sintéticos');
    expect(JSON.parse(f.queue.mock.lastCall![1].split('\n').at(-1)!).reports).toEqual([{role: 'tester', excerpt: markdown}]);
    const legacy = 'Objetivo verificado con los ejemplos de QA.\n\n' + 'Detalle de la comprobación sintética. '.repeat(24).trim();
    expect(legacy.length).toBeGreaterThan(700);
    f.applyReply({kind: 'complete', text: legacy});
    app.close();
    app = f.newSession();
    expect((await app.handle({type: 'read'})).project?.goals?.[0].phase).toBe('verify');
    await app.tick();
    const done = (await app.handle({type: 'read'})).project!;
    expect(done.goals).toHaveLength(1);
    expect(done.goals?.[0].phase).toBe('complete');
    expect(done.goals?.[0].history.at(-1)).toMatchObject({text: 'Objetivo verificado con los ejemplos de QA.', markdown: legacy});
    expect(done.events.at(-1)?.data.markdown).toBe(markdown);
    expect(done.tasks[0].status).toBe('done');
    expect(officinaDelegatedRoles(done, id)).toEqual(['architect', 'tester']);
    expect(officinaResults(done, id, 'coordinator')).toEqual([
      {run: done.runs.at(-1), message: expect.objectContaining({markdown: legacy})},
    ]);
    expect(officinaResults(done, id, 'tester')[0].event?.data.markdown).toBe(markdown);
    const older = structuredClone(done);
    for (const message of older.goals![0].history) delete message.reply;
    expect(officinaResults(older, id, 'coordinator')[0].message?.markdown).toBe(legacy);
    older.goals![0].history.pop();
    expect(officinaResults(older, id, 'coordinator')).toEqual([{run: done.runs.at(-1)}]);
    const action = {type: 'open-run-chat', project, task: id, run: done.runs.at(-1)!.id} as const;
    await expect(app.handle({...action, task: randomUUID()})).rejects.toThrow('no está disponible');
    await app.handle(action);
    expect(f.openChat).toHaveBeenCalledExactlyOnceWith(f.threads.coordinator);
    expect((await app.handle({type: 'read'})).project).toEqual(done);
    await app.tick();
    expect(f.queue).toHaveBeenCalledTimes(4);
    await app.handle({type: 'chat', id: randomUUID(), name: 'Aprobación de gastos', message: 'Otro objetivo'});
    await sentTo('coordinator', 5);
    expect(f.provision).toHaveBeenCalledTimes(1);
  } finally { app.close(); }
});

it('checks the visible project and delivers a direct request only to the selected specialist', async () => {
  const f = fixture(), app = f.newSession();
  try {
    const first = (await app.handle({type: 'project', name: 'Proyecto inicial'})).project!;
    const active = (await app.handle({type: 'project', name: 'Proyecto activo'})).project!;
    const request = {type: 'chat', id: randomUUID(), name: first.name, message: 'Comprueba este requisito.', role: 'tester'} as const;
    await expect(app.handle({...request, project: first.id})).rejects.toThrow('El proyecto visible cambió.');
    expect(f.queue).not.toHaveBeenCalled();
    await app.handle({...request, project: active.id});
    await vi.waitFor(async () => {
      await app.tick();
      expect(f.queue.mock.lastCall?.[0]).toBe(f.threads.tester);
    });
    f.applyReply({kind: 'progress', text: 'Requisito comprobado.', markdown: '## Resultado de Tester'});
    await app.tick();
    const project = (await app.handle({type: 'read'})).project!;
    expect(project.id).toBe(active.id);
    expect(project.goals?.[0]).toMatchObject({recipient: 'tester', phase: 'complete'});
    expect(officinaResults(project, request.id, 'tester')[0].event?.data.markdown).toBe('## Resultado de Tester');
    expect(officinaResults(project, request.id, 'coordinator')).toEqual([]);
    await app.tick();
    expect(f.queue).toHaveBeenCalledTimes(1);
  } finally { app.close(); }
});

it('keeps role profiles local to a project and applies edits only to future dispatches', async () => {
  const f = fixture();
  let app = f.newSession();
  try {
    const project = (await app.handle({type: 'project', name: 'Desarrollo de aplicaciones'})).project!;
    expect(new Set(OfficinaActor.options.map(role => officinaRoleProfile(role).prompt)).size).toBe(7);
    const initialProfile = {name: 'Calidad', prompt: 'Usa una lista de comprobaciones y anota el resultado de cada caso.'};
    const update = {type: 'role-profile', project: project.id, role: 'tester'} as const;
    await app.handle({...update, profile: initialProfile});
    expect(f.queue).not.toHaveBeenCalled();
    app.close();
    app = f.newSession();
    expect(officinaRoleProfile('tester', (await app.handle({type: 'read'})).project)).toEqual(initialProfile);
    const other = (await app.handle({type: 'project', name: 'Otro equipo'})).project!;
    expect(officinaActorName('tester', other)).toBe('Tester');
    await expect(app.handle({...update, profile: null})).rejects.toThrow('El proyecto visible cambió.');
    await app.handle({type: 'select', project: project.id});

    const changed = {...initialProfile, name: 'QA de aplicaciones'};
    f.queue.mockImplementationOnce(async (_, prompt, verify) => {
      expect(prompt).toContain(officinaOutputInstructions);
      await app.handle({...update, profile: changed});
      await verify();
    });
    const send = () => app.handle({type: 'chat', project: project.id, name: project.name, role: 'tester',
      id: randomUUID(), message: 'Comprueba el recorrido de la aplicación.'});
    async function sent(count: number) {
      await vi.waitFor(async () => {
        await app.tick();
        expect((await app.handle({type: 'read'})).project?.runs.at(-1)?.state).toBe('sent');
        expect(f.queue).toHaveBeenCalledTimes(count);
      });
      const [thread, prompt] = f.queue.mock.lastCall!;
      expect(thread).toBe(f.threads.tester);
      return JSON.parse(prompt.split('\n').at(-1)!);
    }
    await send();
    expect(await sent(1)).toMatchObject({identity: {role: 'tester'}, roleProfile: initialProfile});
    f.applyReply({kind: 'progress', text: 'Recorrido verificado.', markdown: '## Resumen\n\n- Recorrido verificado.'});
    await app.tick();
    await send();
    expect(await sent(2)).toMatchObject({roleProfile: changed});
    f.applyReply({kind: 'progress', text: 'Comprobación cerrada.'});
    await app.tick();
    expect((await app.handle({...update, profile: null})).project?.profiles).toBeUndefined();
    await send();
    expect(await sent(3)).toMatchObject({roleProfile: officinaRoleProfile('tester')});
  } finally { app.close(); }
});

it('reuses the complete pasted document across handoffs without expanding the Codex request', async () => {
  const f = fixture(), app = f.newSession();
  const id = randomUUID();
  const pastedText = '# Revisión del proyecto\n\n' + 'Consulta las fuentes del encargo.\n'.repeat(460) + '\nÚltima instrucción.\n';
  const action = {type: 'chat', name: 'Proyecto con un prompt largo', id, pastedText} as const;
  try {
    expect(OfficinaAction.safeParse({...action, pastedText: 'x'.repeat(officinaPasteLimit + 1)}).success).toBe(false);
    const initial = await app.handle(OfficinaAction.parse(action));
    expect(initial.project?.tasks[0]).toMatchObject({title: 'Revisión del proyecto'});
    await vi.waitFor(async () => {
      await app.tick();
      expect(f.queue).toHaveBeenCalledTimes(1);
      expect((await app.handle({type: 'read'})).project?.runs.at(-1)?.state).toBe('sent');
    });
    const path = join(dirname(f.path), 'officina-pastes', id + '.md');
    expect(readFileSync(path, 'utf8')).toBe(pastedText);
    const instruction = 'Consulta el texto y conserva los contratos públicos. '.repeat(11).trim();
    expect(instruction.length).toBeGreaterThan(500);
    const transitions: [OfficinaCoordinatorResult['result'] | OfficinaContribution, Actor][] = [
      [{kind: 'plan', text: 'Analiza el proyecto', steps: [{role: 'analyst', instruction}]}, 'analyst'],
      [{kind: 'progress', text: 'Análisis disponible.'}, 'coordinator'],
    ];
    for (const [result, role] of transitions) {
      f.applyReply(result);
      const count = f.queue.mock.calls.length + 1;
      await vi.waitFor(async () => {
        await app.tick();
        expect(f.queue).toHaveBeenCalledTimes(count);
        expect((await app.handle({type: 'read'})).project?.runs.at(-1)).toMatchObject({role, state: 'sent'});
      });
    }
    expect(JSON.parse(f.queue.mock.calls[1][1].split('\n').at(-1)!).instruction).toBe(instruction);
    for (const [, prompt] of f.queue.mock.calls) {
      expect(prompt).toContain('Léelo completo');
      expect(prompt).not.toContain('Última instrucción.');
      expect(JSON.parse(prompt.split('\n').at(-1)!).localContext.pastedText).toBe(path);
    }
    expect((await app.handle({type: 'read'})).project?.goals?.[0].pastedText).toBe(pastedText);
  } finally { app.close(); }
});

it('recovers a closure that never reached Codex, keeping the complete reports and one QA turn for the delivery', async () => {
  const f = fixture();
  let app = f.newSession();
  const task = randomUUID();
  try {
    const initial = await app.handle({type: 'chat', name: 'Cierre de una entrega', id: task, message: 'Valida la entrega y publica la conclusión en Officina.'});
    const project = initial.project!.id;
    const sent = async (role: Actor) => vi.waitFor(async () => {
      await app.tick();
      const run = (await app.handle({type: 'read'})).project!.runs.at(-1)!;
      expect(run).toMatchObject({role, state: 'sent'});
      return run;
    });
    await sent('coordinator');
    f.applyReply({kind: 'plan', text: 'Entrega y validación', steps: [
      {role: 'developer', instruction: 'Entrega v2.'}, {role: 'tester', instruction: 'Valida la versión entregada.'},
    ]});
    const developer = await sent('developer');
    f.applyReply({kind: 'handoff', to: 'tester', act: true, text: 'Versión disponible.',
      artifact: {version: 'v2', link: 'dist/app.zip', next: 'Comprueba la versión v2.'}});
    await app.tick();
    const withHandoff = (await app.handle({type: 'read'})).project!;
    expect(withHandoff.runs.at(-1)).toMatchObject({role: 'tester', state: 'waiting', event: developer.id});
    app.close();
    // A legacy board can have the committed handoff but still lack its planned run.
    withHandoff.runs.pop();
    withHandoff.goals![0].cursor = 0;
    const handoffDb = new DatabaseSync(f.path);
    handoffDb.prepare('UPDATE officina_projects SET body=? WHERE id=?').run(JSON.stringify(withHandoff), project);
    handoffDb.close();
    app = f.newSession();
    await app.handle({type: 'read'});
    const tester = await sent('tester');
    expect(tester).toMatchObject({step: 1, event: developer.id});
    expect(JSON.parse(f.queue.mock.lastCall![1].split('\n').at(-1)!)).toMatchObject({
      instruction: 'Valida la versión entregada.', event: {id: developer.id},
    });
    const largeReport = 'Detalle de la evidencia. '.repeat(120).trim();
    for (let n = 0; n < 10; n++) {
      await app.handle({type: 'contribute', project, task, role: 'analyst', nonce: randomUUID(),
        data: {kind: 'decision', text: `Registro ${n}. ${'Referencia comprobada. '.repeat(26).trim()}`, markdown: largeReport}});
    }
    f.applyReply({kind: 'qa', text: 'Pruebas aprobadas.', markdown: '## Validación completa\n\nSe comprobó la versión v2.',
      evidence: 'QA-2', replyTo: developer.id, passed: true});
    const previous = await vi.waitFor(async () => {
      const current = (await app.handle({type: 'read'})).project!;
      if (current.runs.length === 3) await app.tick();
      const next = (await app.handle({type: 'read'})).project!;
      expect(next.runs.map(run => run.role)).toEqual(['coordinator', 'developer', 'tester', 'coordinator']);
      return next;
    });
    const closure = previous.runs.at(-1)!;
    expect(closure).toMatchObject({role: 'coordinator', state: 'waiting'});
    app.close();
    const db = new DatabaseSync(f.path);
    Object.assign(closure, {state: 'review', issue: officinaContextIssue});
    previous.goals![0].question = legacyOfficinaContextQuestion;
    db.prepare('UPDATE officina_projects SET body=? WHERE id=?').run(JSON.stringify(previous), project);
    db.close();
    app = f.newSession();
    const restored = (await app.handle({type: 'read'})).project!;
    expect(officinaAttention(restored)).toMatchObject({kind: 'closure', run: {id: closure.id}});
    await expect(app.handle({type: 'answer-goal', project, task, message: 'Continúa.'})).rejects.toThrow('Reintentar cierre');
    expect(await sent('coordinator')).toMatchObject({id: closure.id, closureRetried: true});
    await expect(app.handle({type: 'retry-closure', project, task, run: closure.id})).rejects.toThrow('ya no está disponible');
    const command = f.queue.mock.lastCall![1];
    expect(command.length).toBeLessThanOrEqual(MAX_CODEX_REQUEST);
    const payload = JSON.parse(command.split('\n').at(-1)!);
    const evidence = JSON.parse(readFileSync(payload.localContext.turnEvidence, 'utf8'));
    expect(evidence.identity).toEqual(payload.identity);
    expect(evidence.events).toEqual(previous.events);
    expect(evidence.events.some((event: typeof previous.events[number]) => event.data.markdown === largeReport)).toBe(true);
    f.applyReply({kind: 'complete', text: 'Entrega v2 validada.'});
    await app.tick();
    const done = (await app.handle({type: 'read'})).project!;
    expect(done.tasks[0].status).toBe('done');
    expect(officinaAttention(done)).toBeUndefined();
    expect(f.queue).toHaveBeenCalledTimes(4);
  } finally { app.close(); }
});

it('recovers a Tester limitation from its original turn after a separate development request', async () => {
  const f = fixture();
  let app = f.newSession();
  const task = randomUUID(), cleanup = randomUUID();
  try {
    const view = await app.handle({type: 'chat', name: 'Diagramas', id: task, message: 'Genera los diagramas y valida la entrega.'});
    const project = view.project!.id;
    const read = async () => (await app.handle({type: 'read'})).project!;
    async function sent(role: Actor, goal: string) {
      return vi.waitFor(async () => {
        await app.tick();
        const run = (await read()).runs.find(item => item.role === role && item.task === goal && item.state === 'sent');
        expect(run).toBeDefined();
        return run!;
      });
    }
    await sent('coordinator', task);
    f.applyReply({kind: 'plan', text: 'Entrega y valida', steps: [
      {role: 'developer', instruction: 'Entrega los diagramas.'}, {role: 'tester', instruction: 'Valida los visores.'},
    ]});
    const delivery = await sent('developer', task);
    await app.handle({type: 'chat', project, name: 'Diagramas', id: cleanup, role: 'developer', message: 'Inventaría archivos antiguos.'});
    f.applyReply({kind: 'handoff', text: 'Versión corregida.', to: 'tester', act: true,
      artifact: {version: 'v2', link: 'docs/index.html', next: 'Prueba el zoom.'}});
    await sent('developer', cleanup);
    f.applyReply({kind: 'progress', text: 'Inventario listo.'});
    const tester = await sent('tester', task);
    const result = {kind: 'blocker', replyTo: delivery.id,
      text: 'El recorte se corrigió. El navegador no pudo repetir la prueba interactiva.'} as const;
    f.applyReply(result);
    app.close();
    app = f.newSession();
    await app.handle({type: 'read'});
    await app.tick();
    await app.tick();
    const recovered = await read();
    expect(recovered.tasks).toEqual([
      expect.objectContaining({id: task, status: 'done'}), expect.objectContaining({id: cleanup, status: 'done'}),
    ]);
    expect(recovered.goals?.[0]).toMatchObject({phase: 'complete', outcome: 'limited'});
    expect(recovered.events.find(event => event.id === tester.id)?.data).toEqual(result);
    expect(officinaQa(recovered.events, task)).toBe('QA pendiente para v2');
    expect(recovered.reviews).toEqual([{id: tester.id, scope: task, source: 'monitor', incident: 'delivery-check', at: expect.any(Number),
      report: expect.objectContaining({proposals: [expect.objectContaining({kind: 'process', evidence: result.text})]})}]);
    expect(officinaRoleTracking(recovered, 'observer').label).toBe('1 propuesta pendiente');
    expect(f.queue).toHaveBeenCalledTimes(4);
  } finally {app.close();}
});

it('reports an invalid final answer only once Codex confirms that exact turn', async () => {
  const f = fixture(), app = f.newSession(), task = randomUUID();
  try {
    const view = await app.handle({type: 'chat', name: 'Respuesta fuera de formato', id: task, role: 'tester', message: 'Revisa la entrega.'});
    const project = view.project!.id;
    const read = async () => (await app.handle({type: 'read'})).project!;
    const sent = await vi.waitFor(async () => {
      await app.tick();
      const run = (await read()).runs[0];
      expect(run.state).toBe('sent');
      return run;
    });
    const malformed = f.applyReply({kind: 'progress', text: 'Informe listo.'}, {unexpected: 'Campo fuera de contrato'});
    f.observe({turn: 'otro-turno', state: 'finished', at: malformed.at});
    await app.tick();
    expect((await read()).reviews).toBeUndefined();
    f.observe({turn: malformed.turn!, state: 'finished', at: malformed.at}, true);
    await app.tick();
    expect((await read()).runs[0].state).toBe('sent');
    f.observe({turn: malformed.turn!, state: 'finished', at: malformed.at});
    await app.tick();
    await app.tick();
    const reviewed = await read();
    expect(reviewed.runs[0]).toMatchObject({id: sent.id, state: 'review', turn: malformed.turn});
    expect(reviewed.events).toEqual([]);
    expect(reviewed.reviews).toHaveLength(1);
    expect(reviewed.reviews?.[0]).toMatchObject({source: 'monitor', id: sent.id, scope: task});
    expect(officinaAttention(reviewed)).toMatchObject({kind: 'dispatch', run: {id: sent.id, state: 'review'}});
    await app.handle({type: 'open-run-chat', project, task, run: sent.id});
    expect(f.openChat).toHaveBeenCalledExactlyOnceWith(f.threads.tester);
    expect(f.queue).toHaveBeenCalledTimes(1);
  } finally {app.close();}
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
  await vi.waitFor(async () => expect((await app.handle({type: 'read'})).project?.runs[0]).toMatchObject({state: 'waiting', retryAttempt: 1}));
  await app.tick();
  expect(f.queue).toHaveBeenCalledTimes(1);
  expect((await app.handle({type: 'read'})).project!.runs[0].state).toBe('waiting');
  f.allow(false);
  await expect(app.handle({type: 'read'})).rejects.toThrow('Pausa');
  app.close();
});

it.each([true, false])('retains the persisted queue choice after restarting with a failed preflight, pause %s', async paused => {
  const f = fixture(), task = randomUUID();
  let app = f.newSession();
  try {
    f.queue.mockRejectedValueOnce(Error('Codex no está listo'));
    const {project} = await app.handle({type: 'chat', id: task, name: 'Recuperación local', message: 'Revisa el proyecto.'});
    const projectId = project!.id;
    const original = await vi.waitFor(async () => {
      await app.tick();
      const {project} = await app.handle({type: 'read'});
      expect(project?.runs[0]).toMatchObject({state: 'waiting', retryAttempt: 1});
      return project!.runs[0].id;
    });
    if (paused) await app.handle({type: 'queue', project: projectId, enabled: false});
    app.close();
    app = f.newSession();
    expect((await app.handle({type: 'read'})).enabled).toBe(!paused);
    f.advance(2000);
    f.allow(false);
    await app.tick();
    f.allow(true);
    expect(f.queue).toHaveBeenCalledTimes(1);
    if (paused) {
      await app.tick();
      expect(f.queue).toHaveBeenCalledTimes(1);
      await app.handle({type: 'queue', project: projectId, enabled: true});
    }
    await vi.waitFor(async () => {
      await app.tick();
      expect((await app.handle({type: 'read'})).project?.runs).toEqual([expect.objectContaining({id: original, state: 'sent'})]);
    });
    expect(f.queue).toHaveBeenCalledTimes(2);
  } finally {app.close();}
});

it.each([true, false])('recovers an uncertain dispatch without a second submission, queued %s', async queued => {
  const f = fixture(), task = randomUUID();
  let app = f.newSession();
  try {
    f.queue.mockImplementationOnce(async (_thread, _text, verify) => {await verify(); throw Error('Acuse perdido');});
    const {project} = await app.handle({type: 'chat', id: task, name: 'Confirmar Codex', message: 'Revisa el proyecto.'});
    const original = await vi.waitFor(async () => {
      await app.tick();
      const {project} = await app.handle({type: 'read'});
      expect(project?.runs[0].state).toBe('uncertain');
      return project!.runs[0].id;
    });
    app.close();
    if (queued) f.wakeQueued.mockImplementationOnce(async (_binding, _identity, authorize) => {authorize(); return true;});
    app = f.newSession();
    await app.handle({type: 'read'});
    await app.tick();
    expect(f.wakeQueued).toHaveBeenLastCalledWith(expect.objectContaining({thread: f.threads.coordinator}),
      {project: project!.id, task, run: original, role: 'coordinator'}, expect.any(Function));
    let snapshot = await app.handle({type: 'read'});
    expect(snapshot.project?.runs[0].state).toBe(queued ? 'sent' : 'uncertain');
    if (queued) expect(officinaRoleTracking(snapshot.project, 'coordinator').state).toBe('queued');
    f.advance(16 * 60_000);
    f.observe({turn: 'turn-original', state: 'working', at: 1002});
    await app.tick();
    snapshot = await app.handle({type: 'read'});
    expect(snapshot.project?.runs[0]).toMatchObject({id: original, state: 'sent'});
    expect(snapshot.activity?.state).toBe('working');
    expect(f.queue).toHaveBeenCalledTimes(1);
  } finally {app.close();}
});

it('stops retrying a preflight failure and allows reopening only that unsent run', async () => {
  const f = fixture(), task = randomUUID(), app = f.newSession();
  try {
    for (let n = 0; n < 4; n++) f.queue.mockRejectedValueOnce(Error('Codex no disponible'));
    const {project} = await app.handle({type: 'chat', id: task, name: 'Revisión local', message: 'Revisa el proyecto.'});
    await vi.waitFor(async () => {
      await app.tick();
      const current = await app.handle({type: 'read'});
      expect(current.project?.runs[0].retryAttempt).toBe(1);
    });
    for (const ms of [2000, 5000, 15000]) {
      f.advance(ms);
      await app.tick();
    }
    const snapshot = await app.handle({type: 'read'});
    const run = snapshot.project!.runs[0];
    expect(run).toMatchObject({state: 'review', retryAttempt: 4});
    expect(run.destination).toBeUndefined();
    expect(officinaAttention(snapshot.project!)).toMatchObject({kind: 'dispatch', run: {id: run.id}});
    f.advance(60_000);
    await app.tick();
    expect(f.queue).toHaveBeenCalledTimes(4);
    await app.handle({type: 'retry-send', project: project!.id, task, run: run.id});
    await vi.waitFor(async () => {
      await app.tick();
      expect((await app.handle({type: 'read'})).project?.runs).toEqual([expect.objectContaining({id: run.id, state: 'sent'})]);
    });
    expect(f.queue).toHaveBeenCalledTimes(5);
  } finally {app.close();}
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
