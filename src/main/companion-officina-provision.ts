import {lstat, mkdir, realpath} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {z} from 'zod';
import {
  OfficinaParticipant, OfficinaId, officinaActorName, type OfficinaActor, type OfficinaProject, type OfficinaTeam,
} from '../shared/companion-officina';
import {officinaRoleInstructions} from '../shared/officina-instructions';
import {normalizeTargetFolder} from '../shared/companion-target';
import {CodexMissingThread, type CodexTransport} from './codex-rpc';
import {verifyOfficinaSource} from './companion-officina-context';

const SavedProject = z.object({id: z.string().min(1).max(200), name: z.string(),
  metadata: z.record(z.string(), z.string()), roots: z.array(z.object({path: z.string()}))});
const SavedThread = z.object({id: OfficinaId, projectId: z.string(), cwd: z.string(),
  name: z.string().nullable().optional(), ephemeral: z.literal(false)});

/** Create real Codex projects and persistent role chats through the installed app-server. */
export class OfficinaProvisioning {
  constructor(private directory: string, private connect: () => Promise<CodexTransport>,
    private persistedThreads: (projectId: string, cwd: string, pendingName: string) => Promise<string[]>) {}

  async ensure(project: OfficinaProject, checkpoint: (team: OfficinaTeam) => void, authorize: () => void,
    repair?: {role: OfficinaActor; thread: string}, observer = false) {
    const team: OfficinaTeam = structuredClone(project.team ?? {threads: {}});
    const persist = () => checkpoint(structuredClone(team));
    authorize();
    const cwd = project.folder ? await verifyOfficinaSource(project.folder, 'folder') : await this.managedFolder(project);
    if (team.cwd && normalizeTargetFolder(team.cwd) !== normalizeTargetFolder(cwd)) {
      throw Error('La carpeta de este proyecto cambió.');
    }
    team.cwd = cwd;
    authorize();
    const rpc = await this.connect();
    try {
      const identity = {zenOfficina: project.id};
      authorize();
      if (project.folder) {
        await verifyOfficinaSource(project.folder, 'folder');
        authorize();
      }
      const response = team.projectId
        ? await rpc.request('project/read', {projectId: team.projectId})
        : await rpc.request('project/create', {name: project.name, roots: [{path: cwd}], idempotencyKey: project.id, metadata: identity});
      const saved = SavedProject.parse(response.project);
      if (saved.metadata.zenOfficina !== project.id || saved.roots.length !== 1 ||
        normalizeTargetFolder(saved.roots[0].path) !== normalizeTargetFolder(cwd)) {
        throw Error('Codex devolvió un proyecto distinto al solicitado.');
      }
      team.projectId = saved.id;
      team.issue = undefined;
      if (repair && team.threads[repair.role] === repair.thread) {
        authorize();
        try {
          await rpc.request('thread/read', {threadId: repair.thread, includeTurns: false});
        } catch (error) {
          if (!(error instanceof CodexMissingThread)) throw error;
          authorize();
          delete team.threads[repair.role];
        }
        if (team.threads[repair.role]) throw Error('El chat reapareció en Codex. Revisa el vínculo antes de reactivar la cola.');
      }
      persist();
      const requested = observer ? ['observer' as const] : OfficinaParticipant.options;
      const roles = new Set(team.pending ? [team.pending.role, ...requested] : requested);
      for (const role of roles) {
        if (team.threads[role]) continue;
        authorize();
        const previous = team.pending;
        if (previous && previous.role !== role) throw Error('Hay un chat pendiente de identificar en Codex.');
        let thread = previous?.thread;
        if (previous && !thread) {
          const known = new Set(Object.values(team.threads));
          const ids = z.array(OfficinaId).parse(await this.persistedThreads(saved.id, cwd, officinaActorName(role)));
          const unregistered = ids.filter(id => !known.has(id));
          if (unregistered.length > 1) throw Error('Revisa los chats del proyecto antes de continuar.');
          thread = unregistered[0];
        }
        if (!thread) {
          if (project.folder) await verifyOfficinaSource(project.folder, 'folder');
          authorize();
          team.pending = {role};
          persist();
          const started = await rpc.request('thread/start', {projectId: saved.id, cwd, ephemeral: false,
            approvalsReviewer: 'user', approvalPolicy: role === 'observer' ? 'never' : 'on-request', sandbox: 'read-only',
            ...(project.folder ? {runtimeWorkspaceRoots: [cwd]} : {}),
            developerInstructions: officinaRoleInstructions(role)});
          const created = SavedThread.parse(started.thread);
          assertThread(created, saved.id, cwd);
          thread = created.id;
        }
        authorize();
        await rpc.request('thread/name/set', {threadId: thread, name: officinaActorName(role)});
        // Naming materializes an otherwise empty Codex chat before saving its ID.
        team.pending = {role, thread};
        persist();
        const read = SavedThread.parse((await rpc.request('thread/read', {threadId: thread, includeTurns: false})).thread);
        assertThread(read, saved.id, cwd);
        if (read.id !== thread || read.name !== officinaActorName(role)) throw Error('Codex no confirmó el chat del puesto.');
        team.threads[role] = thread;
        team.pending = undefined;
        persist();
      }
    } finally {
      rpc.close();
    }
  }

  private async managedFolder(project: OfficinaProject) {
    await mkdir(this.directory, {recursive: true});
    const root = await realpath(this.directory);
    const label = project.name.replace(/[^\p{L}\p{N} -]/gu, '-').slice(0, 40).trim() || 'Proyecto';
    const folder = join(root, label + '-' + project.id);
    await mkdir(folder, {recursive: true});
    if ((await lstat(folder)).isSymbolicLink()) throw Error('La carpeta del proyecto apunta fuera de Officina.');
    const cwd = await realpath(folder);
    if (normalizeTargetFolder(dirname(cwd)) !== normalizeTargetFolder(root)) throw Error('La carpeta de este proyecto cambió.');
    return cwd;
  }
}

function assertThread(thread: z.infer<typeof SavedThread>, projectId: string, cwd: string) {
  if (thread.projectId !== projectId || normalizeTargetFolder(thread.cwd) !== normalizeTargetFolder(cwd)) {
    throw Error('El chat de Codex pertenece a otro proyecto o carpeta.');
  }
}
