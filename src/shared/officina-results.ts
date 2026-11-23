import type {OfficinaActor, OfficinaEvent, OfficinaGoalMessage, OfficinaProject, OfficinaRun} from './companion-officina';

export type OfficinaResult = {run?: OfficinaRun; event?: OfficinaEvent; message?: OfficinaGoalMessage};

export function officinaDelegatedRoles(project: OfficinaProject, task: string) {
  const goal = project.goals?.find(item => item.task === task);
  if (!goal || goal.recipient) return [];
  const runs = project.runs.filter(run => run.task === task);
  const plan = goal.history.find(message => message.from === 'codex' && message.reply?.kind === 'plan');
  const legacy = goal.history.find(message => message.from !== 'human');
  const firstPlan = runs.findIndex(run => run.role === 'coordinator' && run.state === 'completed' && run.turn &&
    (plan ? run.id === plan.reply?.run : legacy?.from === 'codex' && !legacy.reply));
  if (firstPlan === -1) return [];
  return [...new Set(runs.slice(firstPlan + 1).flatMap(run => {
    const role = run.step === undefined ? undefined : goal.steps[run.step]?.role;
    return role === run.role && run.state !== 'skipped' ? [role] : [];
  }))];
}

export function officinaResults(project: OfficinaProject, task: string, role: OfficinaActor): OfficinaResult[] {
  const runs = project.runs.filter(run => run.task === task && run.role === role);
  if (role !== 'coordinator') {
    const events = project.events.filter(event => event.task === task && event.from === role &&
      (event.source === 'codex' || event.data.kind === 'handoff' || event.data.kind === 'qa'));
    const results: OfficinaResult[] = [
      ...runs.filter(run => run.state === 'completed' || run.state === 'review' && run.destination).map(run =>
        ({run, event: events.find(event => event.source === 'codex' && event.id === run.id)})),
      ...events.filter(event => event.source === 'user').map(event => ({event})),
    ];
    if (!results.length && project.tasks.some(item => item.id === task && item.status === 'done' && item.owner === role)) return [{}];
    return results.sort((a, b) => (a.event?.at ?? a.run?.sentAt ?? 0) - (b.event?.at ?? b.run?.sentAt ?? 0));
  }
  const goal = project.goals?.find(item => item.task === task);
  const messages = goal?.history.filter(message => message.from === 'codex') ?? [];
  const last = goal?.history.at(-1), lastRun = runs.at(-1);
  // Older boards kept the conclusion in goal history and the verified turn in a separate record.
  const delegated = officinaDelegatedRoles(project, task).length > 0;
  const legacyConclusion = goal?.phase === 'complete' && last?.from === 'codex' && !last.reply &&
    lastRun?.state === 'completed' && lastRun.turn &&
    (!goal.steps.length || !delegated || messages.length >= 2) ? last : undefined;
  const plans = new Set(messages.flatMap(message => message.reply?.kind === 'plan' ? [message.reply.run] : []));
  const firstRun = runs[0];
  if (delegated && !messages.some(message => message.reply) && firstRun && !(legacyConclusion && firstRun === lastRun)) {
    plans.add(firstRun.id);
  }
  return runs.flatMap<OfficinaResult>(run => {
    const message = messages.find(message => message.reply?.run === run.id && message.reply.kind !== 'plan') ??
      (run === lastRun ? legacyConclusion : undefined);
    if (message) return [{run, message}];
    if (!plans.has(run.id) && (run.state === 'completed' || run.state === 'review' && run.destination)) return [{run}];
    return [];
  });
}
