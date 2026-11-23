import type {OfficinaEvent, OfficinaGoal, OfficinaGoalMessage, OfficinaProject} from './companion-officina';

export type OfficinaChatEntry =
  | {key: string; event: OfficinaEvent}
  | {key: string; message: OfficinaGoalMessage; first: boolean; conclusion: boolean};

export function officinaChatEntries(project: OfficinaProject, goal: OfficinaGoal): OfficinaChatEntry[] {
  const runs = project.runs.filter(run => run.task === goal.task);
  const order = new Map(runs.map((run, index) => [run.id, index]));
  const linked = new Set(goal.history.flatMap(message => message.reply ? [message.reply.run] : []));
  const legacyRuns = runs.filter(run => run.role === 'coordinator' && run.state === 'completed' && !linked.has(run.id));
  const closed = goal.phase === 'complete' || project.tasks.some(task => task.id === goal.task && task.status === 'done');

  // Coordinator replies and specialist events use different collections but share run IDs.
  const history = goal.history.map((message, index) => {
    const first = index === 0 && message.from === 'human';
    const conclusion = closed && index === goal.history.length - 1 && message.from !== 'human';
    const run = message.reply?.run ?? (message.from === 'codex' && (conclusion ? legacyRuns.at(-1) : legacyRuns.shift())?.id);
    return {entry: {key: message.reply ? `reply-${message.reply.run}` : `history-${index}`, message, first, conclusion},
      position: first ? -1 : conclusion ? runs.length + 1 : typeof run === 'string' ? order.get(run) : undefined};
  });
  const events = project.events.filter(event => event.task === goal.task && event.source === 'codex').map(event => {
    const next = runs.findIndex(run => run.sentAt !== undefined && run.sentAt > event.at);
    return {entry: {key: `event-${event.id}`, event}, position: order.get(event.id) ?? (next < 0 ? runs.length : next - .25)};
  });

  return [
    ...history.map((item, index) => ({entry: item.entry, position: item.position ??
      (item.entry.message.from === 'zen' && index === 1 ? -.5 :
        (history.slice(index + 1).find(next => next.position !== undefined)?.position ?? runs.length + 1) - .5)})),
    ...events,
  ].sort((a, b) => a.position - b.position).map(item => item.entry);
}
