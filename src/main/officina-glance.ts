import {existsSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {
  OfficinaActor, OfficinaProject, type OfficinaDestination, type OfficinaGlance, type OfficinaGlanceItem,
  type OfficinaRun,
} from '../shared/companion-officina';
import type {CompanionTarget} from '../shared/codex-companion';
import {officinaAttentionItems} from '../shared/officina-attention';
import {officinaReply} from './companion-officina-turn';
import type {CodexReplyReader} from './companion-codex-reader';

type Reading = {items: Map<string, OfficinaGlanceItem>; completed: Set<string>; unknown: boolean};

export async function readOfficinaGlance(path: string,
  reader: Pick<CodexReplyReader, 'probeOfficinaTurn' | 'probeOfficinaDirectTurn' | 'readOfficinaTurnReply'>, disconnected: boolean,
  verify: (binding: OfficinaDestination) => Promise<boolean>, permission: (target: CompanionTarget, turn: string) => boolean,
  wasWorking: (key: string) => boolean = () => false): Promise<Reading> {
  const reading: Reading = {items: new Map(), completed: new Set(), unknown: false};
  if (!existsSync(path)) return reading;
  const db = new DatabaseSync(path, {readOnly: true});
  let projects: OfficinaProject[];
  try {
    projects = db.prepare('SELECT body FROM officina_projects').all()
      .map(row => OfficinaProject.parse(JSON.parse(String(row.body))));
  } finally { db.close(); }
  const probes: (() => Promise<void>)[] = [];
  for (const project of projects) {
    const destination = (role: OfficinaActor, run?: OfficinaRun) => ({
      project: project.id, projectName: project.name, role, task: run?.task,
      title: project.tasks.find(task => task.id === run?.task)?.title,
    });
    for (const item of officinaAttentionItems(project)) {
      if (item.kind !== 'question' && item.kind !== 'request') continue;
      reading.items.set(item.task.id, {...destination(item.kind === 'request' ? item.run.role : 'coordinator'),
        task: item.task.id, title: item.task.title, kind: 'question'});
    }
    for (const run of project.runs) {
      const binding = run.destination;
      if (!binding || run.sentAt === undefined || !['sent', 'uncertain', 'completed'].includes(run.state)) continue;
      if (run.state === 'completed') {
        const event = project.events.find(item => item.id === run.id && item.task === run.task);
        const response = project.goals?.find(goal => goal.task === run.task)?.history.find(item => item.reply?.run === run.id)?.reply;
        if ((event && event.data.kind !== 'blocker' && (event.data.kind !== 'qa' || event.data.passed)) ||
          (response && response.kind !== 'limited' && response.kind !== 'question' && response.kind !== 'request')) reading.completed.add(run.id);
        continue;
      }
      probes.push(async () => {
        const target = {session: binding.thread, cwd: binding.cwd, title: 'Officina'};
        if (disconnected || !await verify(binding)) { reading.unknown = true; return; }
        const observation = await reader.probeOfficinaTurn(target, {
          project: project.id, task: run.task, run: run.id, role: run.role,
        }, run.sentAt!);
        if (!observation) { reading.unknown = true; return; }
        const turn = observation.turn;
        if (!turn || run.turn && turn.turn !== run.turn) { if (run.state === 'uncertain') reading.unknown = true; return; }
        if (permission(target, turn.turn)) reading.items.set(run.id, {...destination(run.role, run), kind: 'permission'});
        else if (turn.state === 'working') reading.items.set(run.id, {...destination(run.role, run), kind: 'working'});
        else if (turn.state === 'finished' && wasWorking(run.id)) {
          const reply = officinaReply(await reader.readOfficinaTurnReply(target, turn.turn), project.id, {...run, turn: turn.turn});
          if (reply && reply.result.kind !== 'limited' && reply.result.kind !== 'blocker' && reply.result.kind !== 'question' && reply.result.kind !== 'request' &&
            (reply.result.kind !== 'qa' || reply.result.passed)) reading.completed.add(run.id);
        }
      });
    }
    const team = project.team;
    if (!team?.cwd || !team.projectId) continue;
    for (const [roleValue, thread] of Object.entries(team.threads)) {
      const role = OfficinaActor.parse(roleValue);
      const binding = {thread, cwd: team.cwd, projectId: team.projectId, environment: 'Proyecto local'};
      probes.push(async () => {
        if (disconnected || !await verify(binding)) { reading.unknown = true; return; }
        const target = {session: thread, cwd: binding.cwd, title: 'Chat del puesto'};
        const observation = await reader.probeOfficinaDirectTurn(target);
        if (!observation) { reading.unknown = true; return; }
        const turn = observation.turn;
        if (!turn) return;
        const key = thread + ':' + turn.turn;
        if (turn.state === 'finished' && wasWorking(key)) {
          const reply = await reader.readOfficinaTurnReply(target, turn.turn);
          if (reply && !reply.truncated) reading.completed.add(key);
        }
        if (turn.state !== 'working') return;
        if (!reading.items.has(key)) reading.items.set(key, {...destination(role),
          kind: permission(target, turn.turn) ? 'permission' : 'working'});
      });
    }
  }
  for (let i = 0; i < probes.length; i += 8) await Promise.all(probes.slice(i, i + 8).map(probe => probe()));
  return reading;
}

export class OfficinaGlanceState {
  private previous?: Map<string, OfficinaGlanceItem>;
  private previousRoles = new Set<OfficinaActor>();
  private finishedAt = 0;
  private pulse = 0;

  reset() { this.previous = undefined; this.finishedAt = 0; }
  wasWorking(key: string) { return this.previous?.has(key) ?? false; }

  update(reading: Reading, now: number): {badge?: OfficinaGlance; items: OfficinaGlanceItem[]} {
    const active = new Map([...reading.items].filter(([, item]) => item.kind === 'working'));
    const roles = new Set([...active.values()].map(item => item.role));
    if (this.previous && !reading.unknown && [...roles].some(role => !this.previousRoles.has(role))) this.pulse++;
    const decisions = [...reading.items.values()].filter(item => item.kind !== 'working');
    if (reading.unknown || active.size || decisions.length) this.finishedAt = 0;
    else if (this.previous?.size && [...this.previous.keys()].every(key => reading.completed.has(key))) this.finishedAt = now + 3000;
    this.previous = reading.unknown ? undefined : active;
    this.previousRoles = new Set([...reading.items.values()].filter(item => item.kind !== 'question').map(item => item.role));
    return decisions.length ? {badge: {kind: 'decision'}, items: decisions}
      : reading.unknown ? {badge: {kind: 'unknown'}, items: []}
      : roles.size ? {badge: {kind: 'working', count: roles.size, pulse: this.pulse}, items: [...active.values()]}
      : {badge: this.finishedAt > now ? {kind: 'finished'} : undefined, items: []};
  }
}
