import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {dirname, resolve} from 'node:path';
import {
  OfficinaParticipant, OfficinaProject, officinaMaxFiles, officinaOpenItems, officinaPasteTitle,
  type OfficinaAction, type OfficinaActor, type OfficinaBinding, type OfficinaContribution, type OfficinaDestination, type OfficinaEvent,
  type OfficinaRole, type OfficinaRun, type OfficinaRunActivity, type OfficinaRunIdentity, type OfficinaTask,
  type OfficinaTeam, type OfficinaView, type OfficinaLocalSource, type OfficinaDirectActivity,
} from '../shared/companion-officina';
import type {CompanionLastReply, CompanionTarget} from '../shared/codex-companion';
import type {OfficinaCodexTurn} from './companion-codex-reader';
import {normalizeTargetFolder} from '../shared/companion-target';
import {officinaReference} from '../shared/officina-reference';
import {officinaEditorUrl, officinaReferenceScope, resolveOfficinaReference} from './companion-officina-reference';
import {OfficinaSourceUnavailable, captureOfficinaSource, prepareOfficinaFile, prepareOfficinaImages, verifyOfficinaSource} from './companion-officina-context';
import {isOfficinaTabReview, officinaGoalBrowser, officinaGoalRequest} from '../shared/officina-browser';
import {officinaRoleProfile} from '../shared/officina-instructions';
import {officinaApprovedImprovement, officinaObservationTasks} from '../shared/officina-observer';
import {decideOfficinaObservation, officinaFollowupTurn, officinaObserveTurn, queueOfficinaFollowup,
  queueOfficinaImprovement, recordOfficinaIncident} from './companion-officina-observer';
import {legacyOfficinaContextQuestion, officinaClosureRetry, officinaContextIssue, officinaReplyReviewQuestion,
  officinaSendRetry, officinaWaitingRuns} from '../shared/officina-attention';
import {browserForTask, getRunBinding, officinaTurn, officinaReply} from './companion-officina-turn';
import {applyOfficinaCoordination, continueOfficinaGoal, createOfficinaRun, finishOfficinaGoal, goalFor, logOfficinaGoal, officinaImprovementQa,
  pauseOfficinaGoal, planOfficinaTabReview, recoverOfficinaHandoff, recoverOfficinaPlan, recordOfficinaRequest, resolveOfficinaRequest,
  restoreOfficinaReviewStep, settleSavedOfficinaGoals, plannedOfficinaHandoff} from './companion-officina-workflow';

const maxDepth = 5;
const waitLimit = 15 * 60_000;
const retryDelays = [2000, 5000, 15000];
const inFlight = (run: OfficinaRun) => ['sending', 'sent', 'uncertain'].includes(run.state);
const targetFor = (binding: OfficinaBinding): CompanionTarget => ({session: binding.thread, cwd: binding.cwd, title: 'Officina'});
const sourceLabel = ({id, name, path}: OfficinaLocalSource) => ({id, name, path});
const invalidReplyIssue = 'Codex terminó. Abre su respuesta para revisar el resultado con el formato original.';

type DraftContext = {folder?: OfficinaLocalSource; files: OfficinaLocalSource[]};

type Dependencies = {
  allowed: () => boolean;
  verify: (binding: OfficinaDestination) => Promise<boolean>;
  queue: (thread: string, text: string, verify: () => Promise<void>,
    browser?: {id: string; name?: string}, images?: {id: string; paths: string[]}) => Promise<unknown>;
  read: (target: CompanionTarget) => Promise<CompanionLastReply | undefined>;
  readTurn?: (target: CompanionTarget, identity: OfficinaRunIdentity, since: number) => Promise<OfficinaCodexTurn | undefined>;
  wakeQueued?: (binding: OfficinaDestination, identity: OfficinaRunIdentity, authorize: () => void) => Promise<boolean>;
  readTurnReply?: (target: CompanionTarget, turn: string) => Promise<CompanionLastReply | undefined>;
  readDirectTurn?: (target: CompanionTarget) => Promise<OfficinaCodexTurn | undefined>;
  needsPermission?: (target: CompanionTarget, turn: string) => boolean;
  provision?: (project: OfficinaProject, checkpoint: (team: OfficinaTeam) => void, authorize: () => void,
    repair?: {role: OfficinaActor; thread: string}, observer?: boolean) => Promise<void>;
  missingThread?: (projectId: string, cwd: string, thread: string) => Promise<boolean>;
  openChat?: (thread: string) => Promise<void>;
  openProject?: (cwd: string) => Promise<void>;
  openReferenceUrl?: (url: string) => Promise<void>;
  revealReference?: (path: string, directory: boolean) => Promise<void>;
  copyProjectPath?: (cwd: string) => void;
  verifyProject?: (projectId: string, cwd: string) => Promise<boolean>;
  pickContext?: (kind: 'folder' | 'file') => Promise<string[]>;
  now?: () => number;
};

export class CompanionOfficina {
  private db?: DatabaseSync;
  private observerQueue = new Set<string>();
  private running = false;
  private closed = false;
  private draft: DraftContext = {files: []};
  private picking = false;
  private observedTurn?: {project: string; run: string; target: CompanionTarget; turn: OfficinaCodexTurn};
  private direct?: {project: string; activity: OfficinaView['directActivity']};
  private readingDirect = false;
  private checkedReviews = new Map<string, number>();
  private queueProbe?: {run: string; next: number};

  constructor(private path: string, private deps: Dependencies) {}

  private database() {
    if (this.closed) throw Error('Officina se está cerrando.');
    if (this.db) return this.db;
    const db = new DatabaseSync(this.path);
    try {
      db.exec(`CREATE TABLE IF NOT EXISTS officina_projects (id TEXT PRIMARY KEY, name TEXT NOT NULL, body TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS officina_selection (slot INTEGER PRIMARY KEY CHECK(slot=1), project TEXT NOT NULL);`);
      // A process can stop after handing work to Codex but before storing its receipt.
      const rows = db.prepare("SELECT body FROM officina_projects WHERE body LIKE '%\"sending\"%'").all();
      db.exec('BEGIN');
      for (const row of rows) {
        const project = OfficinaProject.parse(JSON.parse(String(row.body)));
        for (const run of project.runs) if (run.state === 'sending') {
          run.state = 'uncertain';
          run.issue = 'ZEN se cerró durante el envío. Revisa el chat antes de liberar la cola.';
        }
        this.write(db, project);
      }
      db.exec('COMMIT');
    } catch (error) {
      db.close();
      throw error;
    }
    this.db = db;
    return db;
  }

  private write(db: DatabaseSync, project: OfficinaProject) {
    if (!OfficinaProject.safeParse(project).success) throw Error('El tablero ha alcanzado su límite de almacenamiento.');
    db.prepare(`INSERT INTO officina_projects(id,name,body) VALUES(?,?,?)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name, body=excluded.body`)
      .run(project.id, project.name, JSON.stringify(project));
  }

  private readProject(id: string) {
    const row = this.database().prepare('SELECT body FROM officina_projects WHERE id=?').get(id);
    if (!row) throw Error('El proyecto ya no está disponible.');
    const project = OfficinaProject.parse(JSON.parse(String(row.body)));
    settleSavedOfficinaGoals(project);
    return project;
  }

  private selected() {
    const row = this.database().prepare('SELECT project FROM officina_selection WHERE slot=1').get();
    return typeof row?.project === 'string' ? row.project : undefined;
  }

  private select(id: string) {
    if (id !== this.selected()) {
      this.draft = {files: []};
      this.suspend(true);
    }
    this.database().prepare('INSERT OR REPLACE INTO officina_selection(slot,project) VALUES(1,?)').run(id);
  }

  private deleteProject(id: string) {
    const db = this.database();
    db.exec('BEGIN');
    try {
      db.prepare('DELETE FROM officina_projects WHERE id=?').run(id);
      const next = db.prepare('SELECT id FROM officina_projects ORDER BY rowid DESC LIMIT 1').get()?.id;
      if (typeof next === 'string') db.prepare('UPDATE officina_selection SET project=? WHERE slot=1').run(next);
      else db.prepare('DELETE FROM officina_selection WHERE slot=1').run();
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    this.draft = {files: []};
    this.suspend(true);
    return this.snapshot();
  }

  private requireView() {
    if (this.closed || !this.deps.allowed()) throw Error('Abre Officina y desactiva Pausa o Presentación.');
  }

  private requireProject(id: string) {
    this.requireView();
    if (id !== this.selected()) throw Error('El proyecto visible cambió.');
    return this.readProject(id);
  }

  private now() { return this.deps.now?.() ?? Date.now(); }

  private canDispatch(project: OfficinaProject, run: OfficinaRun) {
    if (run.role === 'observer') return this.observerQueue.has(run.id);
    const goal = goalFor(project, run.task);
    return goal?.improvement ? !!project.autoImprovements?.enabled && !goal.question : !!project.queueEnabled;
  }

  private deferPreflight(run: OfficinaRun) {
    const attempt = (run.retryAttempt ?? 0) + 1;
    const delay = retryDelays[attempt - 1];
    run.retryAttempt = attempt;
    run.retryAt = delay === undefined ? undefined : this.now() + delay;
    run.state = delay === undefined ? 'review' : 'waiting';
    run.issue = delay === undefined ? 'Codex sigue sin estar disponible. Puedes reintentar este envío.' : undefined;
  }

  private recoverHandoffsAndClosure(project: OfficinaProject) {
    if (recoverOfficinaHandoff(project, run => this.canDispatch(project, run))) return true;
    for (const task of project.tasks) {
      const run = officinaClosureRetry(project, task.id);
      const goal = goalFor(project, task.id);
      if (!run || !goal || run.closureRetried || !this.canDispatch(project, run)) continue;
      run.closureRetried = true;
      run.state = 'waiting';
      run.issue = undefined;
      goal.question = undefined;
      return true;
    }
    return false;
  }

  private snapshot(): OfficinaView {
    const id = this.selected(), project = id ? this.readProject(id) : undefined;
    const active = this.active();
    const observed = this.observedTurn;
    let activity: OfficinaRunActivity | undefined;
    if (observed && active?.project === id && observed.project === id && observed.run === active?.run) {
      const {target, turn, run} = observed;
      const waiting = turn.state === 'working' && this.deps.needsPermission?.(target, turn.turn);
      activity = {run, state: waiting ? 'permission' : turn.state, at: turn.at, turn: waiting ? turn.turn : undefined};
    }
    return {
      projects: this.database().prepare('SELECT id,name FROM officina_projects ORDER BY rowid').all()
        .map(row => ({id: String(row.id), name: String(row.name)})),
      project, activity, directActivity: this.direct?.project === id ? this.direct?.activity : undefined,
      enabled: !!project?.queueEnabled,
      observerQueued: project?.runs.filter(run => run.state === 'waiting' && this.observerQueue.has(run.id)).map(run => run.id),
      dispatchBlock: active && active.project !== id ? 'Otro proyecto tiene un encargo pendiente en Codex.' : undefined,
      context: this.draft.folder || this.draft.files.length ? {
        folder: this.draft.folder && sourceLabel(this.draft.folder),
        folderProject: this.draft.folder && this.folderDestination(this.draft.folder, project).name,
        files: this.draft.files.map(sourceLabel),
      } : undefined,
    };
  }

  private active() {
    const row = this.database().prepare(`SELECT p.id AS project, json_extract(r.value,'$.id') AS run
      FROM officina_projects p, json_each(p.body,'$.runs') r
      WHERE json_extract(r.value,'$.state') IN ('sending','sent','uncertain') LIMIT 1`).get();
    return row && {project: String(row.project), run: String(row.run)};
  }

  suspend(force = false) {
    this.observedTurn = undefined;
    this.direct = undefined;
    if (force) this.observerQueue.clear();
  }
  close() { this.closed = true; this.suspend(true); this.draft = {files: []}; this.db?.close(); this.db = undefined; }

  private async pickContext(kind: 'folder' | 'file') {
    if (!this.deps.pickContext) throw Error('La selección de contexto no está disponible.');
    if (this.picking) throw Error('Termina la selección de archivos abierta.');
    const draft = this.draft;
    this.picking = true;
    try {
      const paths = await this.deps.pickContext(kind);
      this.requireDraft(draft);
      if (!paths.length) return this.snapshot();
      if (paths.length > (kind === 'folder' ? 1 : officinaMaxFiles)) throw Error('Selecciona una carpeta o hasta ocho archivos.');
      const selected = await Promise.all(paths.map(path => captureOfficinaSource(path, kind)));
      this.requireDraft(draft);
      if (kind === 'folder') this.draft = {...draft, folder: selected[0]};
      else {
        const files = new Map([...draft.files, ...selected].map(file => [normalizeTargetFolder(file.path), file]));
        if (files.size > officinaMaxFiles) throw Error('Puedes adjuntar hasta ocho archivos a cada encargo.');
        this.draft = {...draft, files: [...files.values()]};
      }
      return this.snapshot();
    } finally {
      this.picking = false;
    }
  }

  private requireDraft(draft: DraftContext) {
    this.requireView();
    if (this.draft !== draft) throw Error('El contexto del encargo cambió. Vuelve a intentarlo.');
  }

  async handle(action: OfficinaAction): Promise<OfficinaView> {
    this.requireView();
    if (action.type === 'read') return this.snapshot();
    if (action.type === 'pick-context') return this.pickContext(action.kind);
    if (action.type === 'remove-context') {
      this.draft = {folder: this.draft.folder?.id === action.id ? undefined : this.draft.folder,
        files: this.draft.files.filter(file => file.id !== action.id)};
      return this.snapshot();
    }
    if (action.type === 'chat') return this.postGoal(action);
    if (action.type === 'project') {
      const db = this.database(), projects = this.snapshot().projects;
      if (projects.length >= 50) throw Error('Officina admite hasta 50 proyectos.');
      if (projects.some(project => project.name.toLocaleLowerCase() === action.name.toLocaleLowerCase())) {
        throw Error('Ya existe un proyecto con ese nombre.');
      }
      const project = {id: randomUUID(), name: action.name, tasks: [], events: [], runs: []};
      db.exec('BEGIN');
      try {
        this.write(db, project);
        this.select(project.id);
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
      return this.snapshot();
    }
    if (action.type === 'select') {
      this.readProject(action.project);
      this.select(action.project);
      return this.snapshot();
    }
    let project = this.requireProject(action.project);
    if (action.type === 'delete-project') return this.deleteProject(project.id);
    if (action.type === 'dismiss-improvement') {
      const goal = goalFor(project, action.task);
      if (!goal?.improvement) throw Error('El aviso de mejora ya no está disponible.');
      if (!goal.improvementNoticeDismissed) {
        goal.improvementNoticeDismissed = true;
        this.write(this.database(), project);
      }
      return this.snapshot();
    }
    if (action.type === 'auto-improvements') {
      if (action.enabled && (!project.team?.cwd || !project.team.projectId)) throw Error('Vincula primero el equipo del proyecto a Codex.');
      if (project.autoImprovements?.enabled === action.enabled) return this.snapshot();
      if (action.enabled && !project.autoImprovements) queueOfficinaImprovement(project);
      project.autoImprovements = {enabled: action.enabled, since: this.now()};
      this.write(this.database(), project);
      void this.tick();
      return this.snapshot();
    }
    if (action.type === 'role-profile') {
      const profiles = {...project.profiles};
      const defaults = officinaRoleProfile(action.role);
      const profile = action.profile && (action.role === 'observer' ? {...action.profile, name: defaults.name} : action.profile);
      if (profile && (profile.name !== defaults.name || profile.prompt !== defaults.prompt)) profiles[action.role] = profile;
      else delete profiles[action.role];
      project.profiles = Object.keys(profiles).length ? profiles : undefined;
      this.write(this.database(), project);
      return this.snapshot();
    }
    if (action.type === 'observe-team') {
      if (!project.team || !this.deps.provision) throw Error('Vincula el proyecto mediante un encargo de Chat global.');
      if (!officinaObservationTasks(project).some(task => !action.task || task.id === action.task)) {
        throw Error('Todavía no hay actividad guardada para revisar en ese ámbito.');
      }
      const saved = project.reviews?.find(review => review.id === action.id);
      const run = project.runs.find(run => run.role === 'observer' && run.id === action.id);
      if (saved || run) {
        if (!saved || !run || saved.scope !== action.task) throw Error('Cambió el ámbito de la revisión.');
        if (run.state !== 'waiting' && (run.state !== 'review' || run.sentAt !== undefined)) return this.snapshot();
        run.state = 'waiting';
        run.issue = undefined;
      } else {
        if (project.runs.some(run => run.role === 'observer' && (inFlight(run) || run.state === 'waiting' ||
          run.state === 'review' && run.sentAt === undefined))) throw Error('Ya hay una revisión de ZEN pendiente en este proyecto.');
        project.reviews = [...(project.reviews ?? []), {id: action.id, scope: action.task, at: this.now()}];
        project.runs.push({id: action.id, task: action.id, role: 'observer', depth: 0, state: 'waiting'});
      }
      this.write(this.database(), project);
      this.observerQueue.add(action.id);
      void this.tick();
      return this.snapshot();
    }
    if (action.type === 'decide-observation' || action.type === 'follow-observation') {
      const review = project.reviews?.find(item => item.id === action.id);
      if (action.type === 'decide-observation') decideOfficinaObservation(project, review, action.index, action.decision, this.now());
      const shouldFollow = action.type === 'follow-observation' ||
        action.decision === 'approved' && review?.report?.proposals[action.index]?.kind === 'process';
      if (shouldFollow && (!project.team || !this.deps.provision)) throw Error('Vincula el proyecto mediante un encargo de Chat global.');
      const queued = shouldFollow ? queueOfficinaFollowup(project, action.id, action.index) : undefined;
      this.write(this.database(), project);
      if (queued) {
        this.observerQueue.add(queued);
        void this.tick();
      }
      return this.snapshot();
    }
    if (action.type === 'open-run-chat') {
      const destination = (current: OfficinaProject) => current.runs.find(run => run.id === action.run && run.task === action.task &&
        run.sentAt !== undefined && (run.role === 'observer' ? current.reviews?.some(review => review.id === (run.followup?.review ?? run.id)) :
          current.tasks.some(task => task.id === run.task)))?.destination;
      const binding = destination(project);
      if (!binding || !this.deps.openChat || !await this.deps.verify(binding)) throw Error('La conversación de este encargo ya no está disponible en Codex.');
      if (JSON.stringify(destination(this.requireProject(action.project))) !== JSON.stringify(binding)) {
        throw Error('Cambió la conversación de este encargo.');
      }
      await this.deps.openChat(binding.thread);
      return this.snapshot();
    }
    if (action.type === 'open-reference') {
      if (action.task && !project.tasks.some(task => task.id === action.task)) throw Error('La tarea no pertenece al proyecto visible.');
      const reference = officinaReference(action.target);
      if (!reference) throw Error('El enlace no es una ruta local o una URL web válida.');
      if (reference.kind === 'web') {
        if (action.mode !== 'browser' || !this.deps.openReferenceUrl) throw Error('Abre esta URL en el navegador.');
        await this.deps.openReferenceUrl(reference.url);
        return this.snapshot();
      }
      if (action.mode === 'browser') throw Error('Elige VS Code o el Explorador para abrir esta ruta.');
      const scope = officinaReferenceScope(project, action.task);
      const target = await resolveOfficinaReference(reference, scope);
      const current = this.requireProject(action.project);
      if (JSON.stringify(scope) !== JSON.stringify(officinaReferenceScope(current, action.task))) {
        throw Error('Cambió la carpeta de trabajo o los archivos adjuntos.');
      }
      if (action.mode === 'explorer' && this.deps.revealReference) {
        await this.deps.revealReference(target.path, target.directory);
      } else if (action.mode === 'editor' && this.deps.openReferenceUrl) {
        if (target.directory) throw Error('Es una carpeta. Puedes abrirla en el Explorador.');
        const url = officinaEditorUrl(target.path, reference);
        try {await this.deps.openReferenceUrl(url);}
        catch {throw Error('Windows no pudo abrir VS Code. Puedes mostrar el archivo en el Explorador.');}
      } else throw Error('No está disponible el destino elegido.');
      return this.snapshot();
    }
    if (action.type === 'open-team-project' || action.type === 'copy-team-project-path') {
      const team = project.team;
      const perform = action.type === 'open-team-project' ? this.deps.openProject : this.deps.copyProjectPath;
      if (project.folder) await verifyOfficinaSource(project.folder, 'folder');
      if (!team?.cwd || !team.projectId || !perform ||
        !await this.deps.verifyProject?.(team.projectId, team.cwd)) {
        throw Error('La carpeta del proyecto todavía no está disponible.');
      }
      project = this.requireProject(action.project);
      if (project.team?.cwd !== team.cwd || project.team.projectId !== team.projectId) throw Error('Cambió la carpeta del proyecto.');
      await perform(team.cwd);
      return this.snapshot();
    }
    if (action.type === 'open-team-chat') {
      const thread = project.team?.threads[action.role];
      const binding = project.team?.cwd && thread && project.team.projectId ? {thread, cwd: project.team.cwd,
        projectId: project.team.projectId, environment: project.binding?.environment ?? 'Por confirmar'} : undefined;
      if (!binding || !this.deps.openChat || !await this.deps.verify(binding)) throw Error('El chat del puesto aún no está disponible.');
      project = this.requireProject(action.project);
      if (project.team?.threads[action.role] !== thread || project.team?.cwd !== binding.cwd ||
        project.team?.projectId !== binding.projectId) throw Error('El chat del puesto cambió.');
      await this.deps.openChat(binding.thread);
      return this.snapshot();
    }
    if (action.type === 'bind') {
      const binding = {...action.binding, thread: action.binding.thread.toLowerCase()};
      if (!await this.deps.verify(binding)) throw Error('No se encontró ese chat dedicado en la carpeta indicada.');
      project = this.requireProject(action.project);
      if (project.runs.some(run => run.sentAt !== undefined)) {
        throw Error('Este proyecto ya tiene historial de ejecución con su chat. Crea otro proyecto para usar un entorno distinto.');
      }
      const used = this.database().prepare(`SELECT id FROM officina_projects WHERE id<>?
        AND json_extract(body,'$.binding.thread')=?`).get(project.id, binding.thread);
      if (used) throw Error('Ese chat ya está vinculado a otro proyecto de Officina.');
      project.binding = binding;
    } else if (action.type === 'queue') {
      if (action.enabled && !project.binding && !project.team) throw Error('Vincula primero un chat dedicado de Codex.');
      project.queueEnabled = action.enabled;
      if (!action.enabled) {
        this.observerQueue.clear();
        if (project.autoImprovements?.enabled) project.autoImprovements.enabled = false;
      }
      this.write(this.database(), project);
      void this.tick();
      return this.snapshot();
    } else if (action.type === 'task') {
      const task: OfficinaTask = {...action.fields, id: randomUUID(), status: 'pending'};
      project.tasks.push(task);
      if (action.dispatch) this.addRun(project, task, task.owner);
    } else if (action.type === 'release') {
      const run = project.runs.find(item => item.id === action.run);
      if (!run || run.state === 'sending' || !inFlight(run)) throw Error('Ese encargo ya no está pendiente.');
      if (run.role === 'observer') {
        this.observedTurn = undefined;
        this.observerQueue.delete(run.id);
      } else {
        project.queueEnabled = false;
        this.suspend(true);
      }
      run.state = 'released';
      run.issue = 'Cola liberada tras revisar el chat. El encargo original no se vuelve a enviar.';
      const goal = goalFor(project, run.task);
      if (goal) pauseOfficinaGoal(goal, 'Turno liberado. Indica el siguiente paso para retomar el objetivo.');
    } else {
      const task = project.tasks.find(item => item.id === action.task);
      if (!task) throw Error('La tarea no pertenece al proyecto visible.');
      const goal = goalFor(project, task.id);
      if (action.type === 'retry-closure') {
        const run = officinaClosureRetry(project, task.id);
        if (!goal || run?.id !== action.run) throw Error('Ese cierre ya no está disponible para reintentar.');
        run.state = 'waiting';
        run.issue = undefined;
        goal.question = undefined;
        project.queueEnabled = true;
      }
      if (action.type === 'retry-send') {
        const run = project.runs.find(item => item.id === action.run && item.task === task.id);
        if (!run || !officinaSendRetry(run) || task.status === 'done') throw Error('Ese envío ya no está disponible para reintentar.');
        run.state = 'waiting';
        run.issue = undefined;
        run.retryAttempt = undefined;
        run.retryAt = undefined;
        if (goal?.improvement) {
          if (!project.autoImprovements?.enabled) throw Error('Activa Mejoras automáticas para retomar este encargo.');
        } else project.queueEnabled = true;
      }
      if (action.type === 'resume-browser-review') {
        if (!goal || (task.status === 'done' && goal.outcome !== 'limited') ||
            project.runs.some(run => run.task === task.id && (inFlight(run) || run.state === 'waiting')) ||
            !isOfficinaTabReview(officinaGoalRequest(goal), officinaGoalBrowser(project, goal))) {
          throw Error('La revisión ya no está pendiente.');
        }
        const blocker = officinaOpenItems(project.events).find(event => event.task === task.id &&
          event.from === 'analyst' && event.data.kind === 'blocker');
        if ((goal.phase === 'work' || goal.outcome === 'limited') && blocker && goal.steps[goal.cursor]?.role === 'analyst') {
          goal.phase = 'work';
          goal.outcome = undefined;
          task.status = 'active';
          this.addEvent(project, task, 'analyst', {kind: 'decision', replyTo: blocker.id,
            text: 'El usuario pidió reintentar la revisión con la extensión de ChatGPT del navegador.'}, 'user', randomUUID());
        } else if (!goal.question || !planOfficinaTabReview(project, task, goal)) {
          throw Error('La revisión ya no está pendiente.');
        }
        project.queueEnabled = true;
      }
      if (action.type === 'answer-goal') {
        if (!goal?.question || task.status === 'done') throw Error('La pregunta ya no está pendiente.');
        if (officinaClosureRetry(project, task.id)) throw Error('Usa Reintentar cierre para recuperar el encargo de Coordinación.');
        logOfficinaGoal(goal, 'human', action.message);
        goal.question = undefined;
        goal.round = 0;
        if (goal.recipient) {
          goal.phase = 'work';
          const previous = project.runs.filter(run => run.task === task.id).at(-1);
          createOfficinaRun(project, task.id, previous?.role ?? goal.recipient,
            {step: previous?.step, event: previous?.event, depth: previous?.depth ?? 0});
        } else createOfficinaRun(project, task.id, 'coordinator');
        project.queueEnabled = true;
      }
      if (action.type === 'resolve-request') {
        const origin = project.runs.find(run => run.id === action.run && run.task === task.id);
        resolveOfficinaRequest(project, task, goal, origin, {action: action.decision, message: action.message});
      }
      if (action.type === 'edit') {
        if (goal?.phase === 'complete' && action.status !== 'done') throw Error('Este encargo está cerrado. Envía un objetivo nuevo para continuar.');
        Object.assign(task, action.fields, {status: action.status});
        if (goal && task.status === 'done') finishOfficinaGoal(project, task, goal, 'El usuario cerró el encargo desde el tablero.', 'zen');
      }
      if (action.type === 'assign') {
        if (goal?.humanRequest) throw Error('Resuelve la decisión pendiente antes de asignar otro turno a este encargo.');
        this.addRun(project, task, action.role);
      }
      if (action.type === 'contribute') this.addEvent(project, task, action.role, action.data, 'user', action.nonce);
      if (goal) continueOfficinaGoal(project, task, goal);
    }
    this.write(this.database(), project);
    void this.tick();
    return this.snapshot();
  }

  private pastePath(task: string) {
    return resolve(dirname(this.path), 'officina-pastes', task + '.md');
  }

  private buildTurn(project: OfficinaProject, task: OfficinaTask, run: OfficinaRun, paste?: string) {
    return officinaTurn(project, task, run, resolve(dirname(this.path), 'officina-turns'), paste);
  }

  private async postGoal({name, message, pastedText, images, id, project: selected, role = 'coordinator'}: Extract<OfficinaAction, {type: 'chat'}>) {
    if (!this.deps.provision) throw Error('La creación de proyectos de Codex no está disponible.');
    if (!message && !pastedText && !images?.length) throw Error('Escribe un objetivo o adjunta texto o imágenes.');
    const current = selected ? this.requireProject(selected) : undefined;
    if (selected === null && this.selected()) throw Error('El proyecto visible cambió.');
    const db = this.database();
    const draft = this.draft;
    const prior = db.prepare(`SELECT p.id FROM officina_projects p, json_each(p.body,'$.goals') g
      WHERE json_extract(g.value,'$.task')=? LIMIT 1`).get(id);
    if (prior) return this.snapshot();
    let project = this.projectForGoal(name, draft.folder, current);
    if (project.folder) await verifyOfficinaSource(project.folder, 'folder');
    await Promise.all(draft.files.map(file => verifyOfficinaSource(file, 'file')));
    const attachedImages = images?.length ? await prepareOfficinaImages(resolve(dirname(this.path), 'officina-images'), id, images) : undefined;
    this.requireDraft(draft);
    if (selected === null && this.selected()) throw Error('El proyecto visible cambió.');
    project = this.projectForGoal(name, draft.folder, selected ? this.requireProject(selected) : undefined);
    if (draft.folder && selected !== undefined && project.name !== name) throw Error('Cambió el proyecto de la carpeta elegida. Revisa el destino del envío.');
    if (!goalFor(project, id)) {
      if (project.tasks.some(task => task.id === id)) throw Error('El objetivo ya existe.');
      const request = message ?? (pastedText ? officinaPasteTitle(pastedText) : 'Analiza las imágenes adjuntas.');
      const title = request.split(/\r?\n/, 1)[0].slice(0, 120).replace(/[\uD800-\uDBFF]$/u, '').trim() || 'Objetivo de Officina';
      project.team ??= {threads: {}};
      project.goals ??= [];
      const task: OfficinaTask = {id, title, objective: request, owner: role === 'coordinator' ? 'analyst' : role, status: 'pending',
        criteria: 'El equipo deduce de lo que pidió el usuario qué resultado cumple el objetivo.'};
      const goal: NonNullable<OfficinaProject['goals']>[number] = {
        task: id, request, steps: [], cursor: 0, round: 0, phase: 'plan', history: [{from: 'human', text: request}],
        files: draft.files.length ? draft.files : undefined, images: attachedImages, pastedText,
      };
      project.tasks.push(task);
      project.goals.push(goal);
      if (role === 'coordinator') {
        if (!planOfficinaTabReview(project, task, goal)) createOfficinaRun(project, id, role);
      } else {
        goal.recipient = role;
        goal.phase = 'work';
        goal.steps = [{role, instruction: 'Atiende la petición que el usuario ha enviado directamente a tu puesto.'}];
        task.status = 'active';
        createOfficinaRun(project, id, role, {step: 0});
      }
      const firstRun = project.runs.find(run => run.task === id);
      if ((draft.files.length || pastedText || attachedImages) && firstRun && !this.buildTurn(project, task, firstRun, pastedText ? this.pastePath(id) : undefined)) {
        throw Error('El contexto del encargo supera el límite del puente de Codex.');
      }
    }
    project.queueEnabled ??= true;
    db.exec('BEGIN');
    try {
      this.write(db, project);
      this.select(project.id);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    this.draft = {files: []};
    void this.tick();
    return this.snapshot();
  }

  private folderDestination(folder: OfficinaLocalSource, current?: OfficinaProject) {
    const match = this.database().prepare(`SELECT id, name FROM officina_projects WHERE json_extract(body,'$.folder.path')=? COLLATE NOCASE
      AND json_extract(body,'$.folder.device')=? AND json_extract(body,'$.folder.inode')=? LIMIT 1`)
      .get(folder.path, folder.device, folder.inode);
    if (match) return {id: String(match.id), name: String(match.name)};
    if (current && !current.folder && !current.binding && !current.team && !current.runs.length) return {name: current.name, attach: current};
    return {name: folderProjectName(folder.name, this.database().prepare('SELECT name FROM officina_projects').all()
      .map(row => ({name: String(row.name)})))};
  }

  private projectForGoal(name: string, folder?: OfficinaLocalSource, current?: OfficinaProject): OfficinaProject {
    if (folder) {
      const selected = this.selected();
      const target = this.folderDestination(folder, current ?? (selected ? this.readProject(selected) : undefined));
      if (target.id) return this.readProject(target.id);
      if (target.attach) return {...target.attach, folder};
      name = target.name;
    } else {
      if (current) return current;
      const existing = this.database().prepare('SELECT id,name FROM officina_projects').all()
        .find(row => String(row.name).toLocaleLowerCase() === name.toLocaleLowerCase());
      if (existing) return this.readProject(String(existing.id));
    }
    const count = this.database().prepare('SELECT count(*) AS total FROM officina_projects').get();
    if (Number(count?.total) >= 50) throw Error('Officina admite hasta 50 proyectos.');
    return {id: randomUUID(), name, folder, tasks: [], runs: [], events: []};
  }

  private addRun(project: OfficinaProject, task: OfficinaTask, role: OfficinaRole, event?: string, depth = 0) {
    if (task.status === 'done') throw Error('La tarea ya está cerrada.');
    if (!event && project.runs.some(run => run.task === task.id && run.role === role &&
      !run.event && (run.state === 'waiting' || inFlight(run)))) return;
    createOfficinaRun(project, task.id, role, {event, depth});
  }

  private addEvent(project: OfficinaProject, task: OfficinaTask, from: OfficinaRole,
    data: OfficinaContribution, source: OfficinaEvent['source'], id: string, depth = 0) {
    if (project.events.some(event => event.id === id)) return;
    const related = 'replyTo' in data && project.events.find(event => event.id === data.replyTo && event.task === task.id);
    if (data.kind === 'answer' && (!related || related.data.kind !== 'question' || related.data.to !== from)) {
      throw Error('La respuesta debe venir del puesto destinatario de una pregunta de esta tarea.');
    }
    if (data.kind === 'decision' && data.replyTo && (!related || related.data.kind !== 'blocker' || source !== 'user')) {
      throw Error('La resolución debe registrarse en la tarea correspondiente.');
    }
    if (data.kind === 'blocker' && data.replyTo) {
      const delivery = project.runs.find(run => run.id === id)?.event;
      if (!related || related.data.kind !== 'handoff' || related.data.to !== from || delivery && delivery !== related.id) {
        throw Error('La limitación debe identificar un traspaso del puesto en esta tarea.');
      }
    }
    if (data.kind === 'qa' && (from !== 'tester' || !related || related.data.kind !== 'handoff' ||
      related.from !== 'developer' || related.data.to !== from)) throw Error('QA debe identificar un traspaso de Desarrollo a Tester.');
    if ('to' in data && data.to === from) throw Error('Elige un puesto destinatario distinto.');
    if ('to' in data && data.act && task.status === 'done') throw Error('La tarea ya está cerrada.');
    const duplicate = project.events.some(event => event.task === task.id && event.from === from &&
      JSON.stringify(event.data) === JSON.stringify(data));
    if (duplicate && source === 'user') return;
    if (source === 'codex' && (data.kind === 'decision' || data.kind === 'blocker') && task.status === 'done') {
      throw Error('La tarea se cerró mientras Codex preparaba su respuesta.');
    }
    project.events.push({id, task: task.id, from, at: this.now(), data, source});
    const goal = goalFor(project, task.id);
    const managed = source === 'codex' && goal && !goal.recipient;
    if ('to' in data && data.act && !duplicate && !managed &&
      !(depth < maxDepth && plannedOfficinaHandoff(project, task.id, id, from, data, source))) {
      if (depth < maxDepth) this.addRun(project, task, data.to, id, depth + 1);
      else project.events.push({id: randomUUID(), task: task.id, from, at: this.now(), source,
        data: {kind: 'blocker', text: 'Se alcanzó el límite de traspasos automáticos para este encargo.'}});
    }
    if (source === 'user' && data.kind === 'decision' && data.replyTo) {
      const blocked = project.runs.find(run => run.id === data.replyTo);
      if (goal && blocked?.event && blocked.step === undefined) {
        const attempts = project.runs.filter(run => run.task === task.id && run.event === blocked.event &&
          run.role === blocked.role).length;
        if (attempts < 3) createOfficinaRun(project, task.id, blocked.role, {event: blocked.event, depth: blocked.depth});
        else pauseOfficinaGoal(goal, 'El puesto aún necesita ayuda. Indica cómo retomar el encargo.');
      }
    }
  }

  async tick() {
    if (this.running || !this.db || !this.deps.allowed()) return;
    this.running = true;
    try {
      const id = this.selected();
      if (id) void this.refreshDirectActivity(id);
      const active = this.active();
      if (active) {
        await this.observe(active.project, active.run);
        return;
      }
      if (!id) return;
      if (await this.recoverReviewedReply(this.readProject(id))) return;
      let project = this.requireProject(id);
      const restored = project.goals?.some(goal => {
        const task = project.tasks.find(item => item.id === goal.task);
        return task && recoverOfficinaPlan(project, task, goal);
      });
      if (restored) this.write(this.database(), project);
      if (!project.queueEnabled && !this.observerQueue.size && !project.autoImprovements?.enabled) return;
      if (this.recoverHandoffsAndClosure(project)) {
        this.write(this.database(), project);
        project = this.requireProject(id);
      }
      let run = officinaWaitingRuns(project).find(item => this.canDispatch(project, item) &&
        (item.retryAt === undefined || item.retryAt <= this.now()));
      run ??= project.runs.find(item => item.role === 'observer' && item.state === 'waiting' && this.canDispatch(project, item));
      if (!run && project.autoImprovements?.enabled && queueOfficinaImprovement(project, project.autoImprovements.since)) {
        this.write(this.database(), project);
        project = this.requireProject(id);
        run = project.runs.at(-1);
      }
      if (!run) return;
      const observer = run.role === 'observer';
      if (project.team && (!project.team.projectId || !project.team.cwd ||
        (observer ? !project.team.threads.observer : !OfficinaParticipant.options.every(role => project.team?.threads[role])))) {
        await this.provision(project, run);
        return;
      }
      const binding = getRunBinding(project, run);
      if (binding?.projectId && this.deps.missingThread) {
        let missing: boolean;
        try { missing = await this.deps.missingThread(binding.projectId, binding.cwd, binding.thread); }
        catch {
          const latest = this.requireProject(id);
          const pending = latest.runs.find(item => item.id === run.id && item.state === 'waiting');
          if (pending && !observer && this.canDispatch(latest, pending)) {
            this.deferPreflight(pending);
            this.write(this.database(), latest);
          }
          return;
        }
        if (!this.canDispatch(this.requireProject(id), run)) return;
        if (missing) {
          await this.provision(project, run, {role: run.role, thread: binding.thread});
          return;
        }
      }
      if (binding) await this.dispatch(project, run, binding);
    } catch {
      // A read or write failure keeps the persisted queue unchanged for the next check.
    } finally {
      this.running = false;
    }
  }

  private async refreshDirectActivity(id: string) {
    if (!this.deps.readDirectTurn || this.readingDirect) return;
    this.readingDirect = true;
    try {
      const team = this.readProject(id).team;
      if (!team?.cwd || !team.projectId) return;
      const {cwd, projectId} = team;
      const activity = await Promise.all(Object.entries(team.threads).map(async ([role, thread]) => {
        const binding = {thread, cwd, projectId, environment: 'Proyecto local'};
        const target = targetFor(binding);
        if (!await this.deps.verify(binding)) return;
        const turn = await this.deps.readDirectTurn!(target);
        if (!turn) return;
        const state = turn.state === 'working' && this.deps.needsPermission?.(target, turn.turn) ? 'permission' : turn.state;
        return [role, {state, at: turn.at}] as const;
      }));
      if (this.closed || !this.deps.allowed() || this.selected() !== id) return;
      if (JSON.stringify(this.readProject(id).team) !== JSON.stringify(team)) return;
      this.direct = {project: id, activity: Object.fromEntries(activity.filter((item): item is readonly [string, OfficinaDirectActivity] => !!item))};
    } catch { /* A local chat can disappear while it is being checked. */ }
    finally { this.readingDirect = false; }
  }

  private async recoverReviewedReply(project: OfficinaProject) {
    const read = this.deps.readTurnReply;
    if (!read) return false;
    const run = project.runs.find(item => item.state === 'review' && item.issue === invalidReplyIssue && item.turn &&
      item.destination && item.role !== 'observer' && (this.checkedReviews.get(item.id) ?? 0) <= this.now() &&
      project.tasks.some(task => task.id === item.task && task.status !== 'done') &&
      project.runs.filter(candidate => candidate.task === item.task).at(-1)?.id === item.id);
    if (!run?.destination || !run.turn) return false;
    this.checkedReviews.set(run.id, this.now() + 30_000);
    const target = targetFor(run.destination);
    if (!await this.deps.verify(run.destination)) return false;
    const reply = await read(target, run.turn);
    const result = officinaReply(reply, project.id, run, !!goalFor(project, run.task)?.improvement);
    if (!result || result.role === 'observer' || this.deps.needsPermission?.(target, run.turn)) return false;
    const current = this.requireProject(project.id);
    const saved = current.runs.filter(item => item.task === run.task).at(-1);
    const task = current.tasks.find(item => item.id === run.task && item.status !== 'done');
    if (!task || !saved || saved.id !== run.id || saved.state !== 'review' || saved.turn !== run.turn) return false;
    try {
      this.acceptReply(current, task, saved, result, run.turn);
    } catch { return false; }
    this.write(this.database(), current);
    return true;
  }

  private acceptReply(project: OfficinaProject, task: OfficinaTask, run: OfficinaRun,
    result: Exclude<NonNullable<ReturnType<typeof officinaReply>>, {role: 'observer'}>, turn?: string) {
    if (project.events.length >= 1798 || project.runs.length >= 450) throw Error('Tablero lleno.');
    const goal = goalFor(project, task.id);
    if (result.result.kind === 'request') {
      if (!goal || task.status === 'done') throw Error('El objetivo no está disponible.');
      restoreOfficinaReviewStep(goal, run);
      recordOfficinaRequest(goal, run, result.result);
    } else if (result.role === 'coordinator') {
      if (!goal) throw Error('El objetivo no está disponible.');
      restoreOfficinaReviewStep(goal, run);
      run.state = 'completed';
      if (result.result.kind !== 'question' || !planOfficinaTabReview(project, task, goal)) {
        applyOfficinaCoordination(project, task, goal, result.result, run.id);
      }
    } else {
      run.state = 'completed';
      this.addEvent(project, task, result.role, result.result, 'codex', run.id, run.depth);
      if (goal) restoreOfficinaReviewStep(goal, run);
      if (result.result.kind === 'blocker') {
        if (result.result.replyTo) recordOfficinaIncident(project, run, this.now(), result.result.text);
        if (goal) finishOfficinaGoal(project, task, goal, result.result.text, 'zen', true, result.result.markdown);
      } else if (goal) continueOfficinaGoal(project, task, goal);
    }
    run.state = 'completed';
    run.turn = turn;
    run.issue = undefined;
  }

  private async provision(project: OfficinaProject, run: OfficinaRun, repair?: {role: OfficinaActor; thread: string}) {
    const checkpoint = (team: OfficinaTeam) => {
      const latest = this.readProject(project.id);
      latest.team = team;
      this.write(this.database(), latest);
    };
    const observer = run.role === 'observer';
    try {
      if (!this.deps.provision) throw Error('No se puede crear el equipo en Codex.');
      await this.deps.provision(project, checkpoint, () => {
        if (!this.canDispatch(this.requireProject(project.id), run)) throw Error('La cola está detenida.');
      }, repair, observer);
    } catch (error) {
      if (this.closed) return;
      const latest = this.readProject(project.id);
      if (observer) {
        this.observerQueue.delete(run.id);
        const waiting = latest.runs.find(item => item.id === run.id && item.state === 'waiting');
        if (waiting) {
          waiting.issue = 'No se pudo preparar el chat de ZEN. Comprueba Codex y retoma el encargo.';
          this.write(this.database(), latest);
        }
        return;
      }
      const pending = latest.runs.find(item => item.id === run.id && item.state === 'waiting');
      if (!pending || this.selected() !== project.id || !this.deps.allowed() || !this.canDispatch(latest, pending)) return;
      if (error instanceof OfficinaSourceUnavailable) {
        pending.state = 'review';
        pending.issue = error.message;
        pending.retryAt = undefined;
        pending.retryAttempt = undefined;
      } else this.deferPreflight(pending);
      this.write(this.database(), latest);
    }
  }

  private async dispatch(project: OfficinaProject, run: OfficinaRun, binding: OfficinaDestination) {
    const update = (apply: (saved: OfficinaRun, project: OfficinaProject) => void) => {
      const latest = this.readProject(project.id);
      const saved = latest.runs.find(item => item.id === run.id);
      if (!saved || saved.state !== 'sending') return;
      apply(saved, latest);
      this.write(this.database(), latest);
    };
    const observer = run.role === 'observer';
    const review = observer ? project.reviews?.find(item => item.id === run.id) : undefined;
    const task = project.tasks.find(item => item.id === run.task);
    if (observer ? !review && !run.followup : !task || task.status === 'done') {
      run.state = 'review';
      run.issue = 'La tarea se cerró antes del envío.';
      this.write(this.database(), project);
      return;
    }
    const goal = task && goalFor(project, task.id);
    if (goal?.improvement && run.role === 'alm' &&
      (run.step !== goal.steps.length - 1 || officinaImprovementQa(project, run.task)?.passed !== true)) {
      run.state = 'review';
      run.issue = 'El despliegue de la mejora requiere QA de Tester para esta versión exacta.';
      this.write(this.database(), project);
      return;
    }
    const paste = goal?.pastedText ? {text: goal.pastedText, path: this.pastePath(run.task)} : undefined;
    if (review) review.baseline = Object.fromEntries(OfficinaParticipant.options.map(role => [role, officinaRoleProfile(role, project).prompt]));
    const build = (current: OfficinaProject) => {
      if (observer) {
        if (run.followup) return officinaFollowupTurn(current, run, resolve(dirname(this.path), 'officina-turns'));
        const audit = current.reviews?.find(item => item.id === run.id);
        return audit && officinaObserveTurn(current, audit, run, resolve(dirname(this.path), 'officina-turns'));
      }
      const fields = current.tasks.find(item => item.id === run.task && item.status !== 'done');
      return fields && this.buildTurn(current, fields, run, paste?.path);
    };
    const turn = build(project);
    if (!turn) {
      run.state = 'review';
      run.issue = observer ? 'La evidencia del encargo de ZEN no está disponible. Comprueba el historial y retómalo.' : officinaContextIssue;
      if (observer) this.observerQueue.delete(run.id);
      if (goal && (goal.phase !== 'verify' || run.role !== 'coordinator')) pauseOfficinaGoal(goal, legacyOfficinaContextQuestion);
      this.write(this.database(), project);
      return;
    }
    run.state = 'sending';
    run.sentAt = this.now();
    run.destination = binding;
    this.write(this.database(), project);
    let verified = false;
    let destinationUnavailable = false;
    let sourceIssue: string | undefined;
    try {
      const browser = task && !observer && run.role !== 'coordinator' ? browserForTask(project, task) : undefined;
      await this.deps.queue(binding.thread, turn.prompt, async () => {
        const available = await this.deps.verify(binding);
        try {
          if (project.folder) {
            const root = await verifyOfficinaSource(project.folder, 'folder');
            if (normalizeTargetFolder(root) !== normalizeTargetFolder(binding.cwd)) {
              throw new OfficinaSourceUnavailable('El chat de Codex no usa la carpeta elegida. Revisa el proyecto antes de continuar.');
            }
          }
          await Promise.all([...(goal?.files ?? []), ...(goal?.images ?? [])].map(file => verifyOfficinaSource(file, 'file')));
          if (paste) await prepareOfficinaFile(paste.path, paste.text,
            'El texto pegado cambió en disco o no se pudo preparar. Vuelve a enviarlo desde Officina.');
          if (turn.evidence) await prepareOfficinaFile(turn.evidence.path, turn.evidence.text,
            'Officina no pudo preparar los informes para este turno. Revisa el almacenamiento del perfil.');
        } catch (error) {
          if (error instanceof OfficinaSourceUnavailable) sourceIssue = error.message;
          throw error;
        }
        const latest = this.requireProject(project.id);
        if (!this.canDispatch(latest, run) ||
          goal?.improvement && run.role === 'alm' && officinaImprovementQa(latest, run.task)?.passed !== true ||
          JSON.stringify(getRunBinding(latest, run)) !== JSON.stringify(binding) ||
          // A profile edit affects the next dispatch without changing the turn already being sent.
          build({...latest, profiles: project.profiles})?.prompt !== turn.prompt) {
          throw Error('El encargo cambió antes del envío.');
        }
        if (!available) {
          destinationUnavailable = true;
          throw Error('El chat cambió, está archivado o no está disponible.');
        }
        verified = true;
      }, browser?.mode === 'extension' ? {id: run.id, name: browser.browser} : undefined,
      goal?.images?.length ? {id: run.id, paths: goal.images.map(image => image.path)} : undefined);
      update(saved => {
        saved.state = 'sent';
        saved.issue = undefined;
        saved.retryAt = undefined;
        saved.retryAttempt = undefined;
      });
      if (observer) this.observerQueue.delete(run.id);
    } catch {
      update((saved, latest) => {
        if (verified) {
          saved.state = 'uncertain';
          saved.issue = 'Codex no confirmó el envío. Officina buscará el encargo en la cola y en el chat.';
          saved.retryAt = undefined;
          saved.retryAttempt = undefined;
          return;
        }
        saved.sentAt = undefined;
        saved.destination = undefined;
        saved.state = 'waiting';
        saved.issue = undefined;
        if (this.selected() !== project.id || !this.deps.allowed() || !this.canDispatch(latest, saved)) return;
        if (sourceIssue || destinationUnavailable || observer) {
          saved.state = 'review';
          saved.issue = sourceIssue ?? (destinationUnavailable ? 'El chat cambió o no está disponible. Comprueba el destino en Codex.' :
            'No se pudo preparar el envío de ZEN. Comprueba Codex y retoma la revisión.');
          saved.retryAt = undefined;
          saved.retryAttempt = undefined;
        } else this.deferPreflight(saved);
      });
      if (observer) this.observerQueue.delete(run.id);
    }
  }

  private async observe(projectId: string, runId: string) {
    const project = this.readProject(projectId);
    const sent = project.runs.find(run => run.id === runId);
    const destination = sent?.destination ?? project.binding;
    if (!destination || sent?.sentAt === undefined) return;
    const target = targetFor(destination);
    const identity = {project: projectId, task: sent.task, run: sent.id, role: sent.role};
    let reply = await this.deps.read(target);
    let exact: OfficinaCodexTurn | undefined;
    if (this.deps.readTurn && !officinaReply(reply, projectId, sent)) {
      exact = await this.deps.readTurn(target, identity, sent.sentAt);
      if (exact?.state === 'finished' && this.deps.readTurnReply) reply = await this.deps.readTurnReply(target, exact.turn);
    }
    if (!this.deps.allowed()) return;
    const latest = this.readProject(projectId);
    const run = latest.runs.find(item => item.id === runId);
    if (!run || !inFlight(run) || run.sentAt === undefined) return;
    const verified = exact?.state === 'finished' && !run.turn ? {...run, turn: exact.turn} : run;
    const result = officinaReply(reply, projectId, verified, !!goalFor(latest, run.task)?.improvement);
    if (!result) {
      if (exact?.state === 'interrupted' && (!run.turn || run.turn === exact.turn) &&
        !this.deps.needsPermission?.(target, exact.turn)) {
        run.state = 'review';
        run.turn = exact.turn;
        run.issue = 'Codex interrumpió este encargo. Revisa su chat para decidir cómo retomarlo.';
        const goal = goalFor(latest, run.task);
        if (goal) pauseOfficinaGoal(goal, run.issue);
        this.write(this.database(), latest);
        return;
      }
      if (exact && run.state === 'uncertain') {
        run.state = 'sent';
        run.turn = exact.turn;
        run.issue = undefined;
        this.write(this.database(), latest);
      } else if (!exact && run.state === 'sent' && this.now() - (run.queuedAt ?? run.sentAt) >= waitLimit) {
        run.state = 'uncertain';
        run.issue = 'Falta una respuesta verificable de Codex. Decide si esperar o liberar el turno tras revisar el chat.';
        this.write(this.database(), latest);
      }
      const turn = exact;
      if (turn?.state === 'finished' && (!run.turn || run.turn === turn.turn) &&
          (reply?.turn === turn.turn && reply.at >= run.sentAt || this.now() - turn.at >= 30_000) &&
          !this.deps.needsPermission?.(target, turn.turn)) {
          const saved = this.readProject(projectId);
          const pending = saved.runs.find(item => item.id === runId && inFlight(item));
          if (pending) {
            pending.state = 'review';
            pending.turn = turn.turn;
            pending.issue = invalidReplyIssue;
            const goal = goalFor(saved, pending.task);
            if (pending.role === 'coordinator' && goal?.phase === 'verify' && !goal.question && this.canDispatch(saved, pending) &&
              !saved.runs.some(item => item.task === pending.task && item.closureRetried)) {
              createOfficinaRun(saved, pending.task, 'coordinator', {closureRetried: true});
            } else {
              if (goal) pauseOfficinaGoal(goal, officinaReplyReviewQuestion);
              recordOfficinaIncident(saved, pending, this.now());
            }
            this.write(this.database(), saved);
          }
          return;
      }
      if (this.selected() === projectId) {
        this.observedTurn = turn ? {project: projectId, run: runId, target, turn} : undefined;
        if (!turn && run.state === 'uncertain') await this.reconcileQueued(latest, run, destination, identity);
      }
      return;
    }
    if (reply?.turn && this.deps.needsPermission?.(target, reply.turn)) return;
    if (result.role === 'observer') {
      const review = latest.reviews?.find(item => item.id === run.id && item.id === run.task);
      const followup = run.followup;
      if (followup && result.result.kind === 'followup' && !followup.result && officinaApprovedImprovement(latest, followup)) {
        followup.result = result.result;
      } else if (!followup && result.result.kind === 'observation' && review?.baseline && !review.report) {
        review.report = result.result;
      } else {
        run.state = 'review';
        run.turn = reply?.turn;
        run.issue = 'El formato de la respuesta de ZEN no coincide con este encargo. Revisa el turno en Codex.';
        this.write(this.database(), latest);
        return;
      }
      run.state = 'completed';
      run.turn = reply?.turn;
      run.issue = undefined;
      this.write(this.database(), latest);
      return;
    }
    const task = latest.tasks.find(item => item.id === run.task);
    if (!task) return;
    const goal = goalFor(latest, task.id);
    try {
      this.acceptReply(latest, task, run, result, reply?.turn);
    } catch {
      run.state = 'review';
      run.turn = reply?.turn;
      run.issue = 'Codex terminó. Revisa la contribución en el chat y regístrala desde la ficha de la tarea.';
      if (goal) pauseOfficinaGoal(goal, officinaReplyReviewQuestion);
      recordOfficinaIncident(latest, run, this.now());
    }
    this.write(this.database(), latest);
  }

  private async reconcileQueued(project: OfficinaProject, run: OfficinaRun, destination: OfficinaDestination, identity: OfficinaRunIdentity) {
    if (!this.deps.wakeQueued || !this.canDispatch(project, run) ||
      this.queueProbe?.run === run.id && this.queueProbe.next > this.now()) return;
    this.queueProbe = {run: run.id, next: this.now() + 15_000};
    const current = () => {
      const latest = this.requireProject(project.id);
      const pending = latest.runs.find(item => item.id === run.id && item.state === 'uncertain');
      if (!pending || !this.canDispatch(latest, pending) ||
        JSON.stringify(pending.destination) !== JSON.stringify(destination)) throw Error('Cambió el destino del encargo.');
      return {latest, pending};
    };
    if (!await this.deps.wakeQueued(destination, identity, current)) return;
    const {latest, pending} = current();
    pending.state = 'sent';
    pending.queuedAt = this.now();
    pending.issue = undefined;
    this.write(this.database(), latest);
  }
}

function folderProjectName(name: string, projects: Pick<OfficinaProject, 'name'>[]) {
  const names = new Set(projects.map(project => project.name.toLocaleLowerCase()));
  const withSuffix = (suffix: string) => name.slice(0, 120 - suffix.length).replace(/[\uD800-\uDBFF]$/u, '').trim() + suffix;
  let title = withSuffix('');
  for (let number = 2; names.has(title.toLocaleLowerCase()); number++) title = withSuffix(` (${number})`);
  return title;
}
