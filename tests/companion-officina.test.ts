import {mkdirSync, mkdtempSync, readFileSync, renameSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {expect, it, vi} from 'vitest';
import {CompanionOfficina} from '../src/main/companion-officina';
import {OfficinaAction, OfficinaActor, officinaActorName, officinaOpenItems, officinaPasteLimit, officinaQa,
  type OfficinaActor as Actor, type OfficinaContribution, type OfficinaCoordinatorResult, type OfficinaObserverResult, type OfficinaRole, type OfficinaTeam} from '../src/shared/companion-officina';
import type {CompanionLastReply} from '../src/shared/codex-companion';
import {isOfficinaTabReview, officinaBrowserFor} from '../src/shared/officina-browser';
import {officinaRoleTracking} from '../src/shared/officina-tracking';
import {legacyOfficinaContextQuestion, officinaAttention, officinaContextIssue} from '../src/shared/officina-attention';
import {MAX_CODEX_REQUEST} from '../src/shared/companion-request';
import {officinaDelegatedRoles, officinaResults} from '../src/shared/officina-results';
import {officinaOutputInstructions, officinaRoleProfile} from '../src/shared/officina-instructions';
import type {OfficinaCodexTurn} from '../src/main/companion-codex-reader';
import {OfficinaProvisioning} from '../src/main/companion-officina-provision';
import {captureOfficinaSource} from '../src/main/companion-officina-context';

const rule = 'Nadie puede aprobar su propio gasto.';
const fields = {title: 'Permisos de aprobación', objective: 'Bloquear autoaprobaciones', criteria: rule, owner: 'architect' as const};
const browserRequest = 'Analizar el contenido que tenemos en google chrome usa la heramienta de chat gpt en el navegador para averiguar el contenido';

function fixture(pickContext?: (kind: 'folder' | 'file') => Promise<string[]>) {
  const path = join(mkdtempSync(join(tmpdir(), 'zen-officina-')), 'test.sqlite');
  let now = 1000, reply: CompanionLastReply | undefined;
  let observed: OfficinaCodexTurn | undefined, permission = false;
  let allowed = true;
  const queue = vi.fn(async (_: string, _prompt: string, verify: () => Promise<void>, _browser?: {id: string; name?: string}) => {await verify();});
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
  const connection = {allowed: () => allowed, now: () => now, verify, queue, provision, pickContext, openChat,
    openReferenceUrl, revealReference, read: async () => reply,
    readTurn: async () => observed, needsPermission: () => permission};
  const newSession = () => new CompanionOfficina(path, connection);
  const binding = {thread: randomUUID(), cwd: 'C:\\fixtures\\expenses', environment: 'UAT de prueba'};
  return {newSession, queue, binding, verify, threads, provision, path, openChat, openReferenceUrl, revealReference,
    observe(turn: OfficinaCodexTurn | undefined, needPermission = false) {observed = turn; permission = needPermission;},
    applyReply(result: OfficinaContribution | OfficinaCoordinatorResult['result'] | OfficinaObserverResult['result'], overrides = {}) {
    const identity = JSON.parse(queue.mock.lastCall![1].split('\n').at(-1)!).identity;
    reply = {source: 'local', turn: randomUUID(), at: ++now, truncated: false,
      text: `<zen_officina>${JSON.stringify({...identity, ...overrides, result})}</zen_officina>`};
    return reply;
  }, allow: (value: boolean) => {allowed = value;}};
}

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
    const action = {type: 'retry-closure', project, task, run: closure.id} as const;
    await app.handle(action);
    await expect(app.handle(action)).rejects.toThrow('ya no está disponible');
    expect((await sent('coordinator')).id).toBe(closure.id);
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
    expect(recovered.reviews).toEqual([{id: tester.id, scope: task, source: 'monitor', at: expect.any(Number),
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
