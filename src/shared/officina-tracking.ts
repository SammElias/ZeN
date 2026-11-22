import {
  officinaOpenItems, officinaQa, type OfficinaActor, type OfficinaProject, type OfficinaRun, type OfficinaRunActivity,
} from './companion-officina';

export const officinaTrackingLabels = {
  working: 'Trabajando en Codex', permission: 'Aprobación pendiente', sending: 'Enviando a Codex',
  submitted: 'Enviado · inicio por confirmar', checking: 'Verificando la respuesta', review: 'Requiere revisión',
  interrupted: 'Turno interrumpido', blocked: 'Limitación registrada', information: 'Falta información', waiting: 'En cola de Officina',
  scheduled: 'Espera su turno', done: 'Terminó el encargo', limited: 'Cerrado con limitaciones',
  skipped: 'Omitido por cierre', assigned: 'Asignado', idle: 'Sin encargos',
} as const;
type TrackingState = keyof typeof officinaTrackingLabels;
type RoleStatus = {state: TrackingState; task?: string; title?: string; detail?: string};

export function officinaRunTracking(run: OfficinaRun, observed?: OfficinaRunActivity): TrackingState {
  if ((run.state === 'sent' || run.state === 'uncertain' && observed?.state !== 'working') && observed?.run === run.id) {
    return observed.state === 'finished' ? 'checking' : observed.state;
  }
  switch (run.state) {
    case 'waiting': return 'waiting';
    case 'sending': return 'sending';
    case 'sent': return 'submitted';
    case 'completed': return 'done';
    case 'skipped': return 'skipped';
    default: return 'review';
  }
}

export function officinaRoleTracking(project: OfficinaProject | undefined, role: OfficinaActor, observed?: OfficinaRunActivity): RoleStatus {
  if (!project) return {state: 'idle'};
  const runs = project.runs.filter(run => run.role === role && run.state !== 'skipped'), last = runs.at(-1);
  const closed = new Set(project.tasks.filter(task => task.status === 'done').map(task => task.id));
  const status = (state: TrackingState, task?: string, detail?: string): RoleStatus => ({
    state, task, title: project.tasks.find(item => item.id === task)?.title, detail,
  });
  const inFlight = runs.find(run => ['sending', 'sent', 'uncertain'].includes(run.state));
  if (inFlight) return status(officinaRunTracking(inFlight, observed), inFlight.task, inFlight.issue);
  const open = officinaOpenItems(project.events).filter(event => event.data.kind === 'blocker' && event.from === role && !closed.has(event.task)).at(-1);
  if (open) return status('blocked', open.task, open.data.text);
  const clarification = project.goals?.filter(goal => goal.question && !closed.has(goal.task) &&
    project.runs.filter(run => run.task === goal.task).at(-1)?.role === role).at(-1);
  if (clarification) return status(clarification.phase === 'plan' ? 'information' : 'review', clarification.task, clarification.question);
  const waiting = runs.find(run => run.state === 'waiting' && !closed.has(run.task));
  if (waiting) return status('waiting', waiting.task, waiting.issue);
  const scheduled = project.goals?.find(goal => goal.phase === 'work' && goal.steps.slice(goal.cursor + 1).some(step => step.role === role));
  if (scheduled) return status('scheduled', scheduled.task);
  if (last?.state === 'review' || last?.state === 'released') return status('review', last.task, last.issue);
  if (last) {
    const result = project.events.find(event => event.id === last.id)?.data;
    const goal = project.goals?.find(item => item.task === last.task);
    const limited = goal?.outcome === 'limited' && (result?.kind === 'blocker' || role === 'coordinator');
    return status(limited ? 'limited' : 'done', last.task, result?.text);
  }
  const event = project.events.filter(item => item.from === role || 'to' in item.data && item.data.to === role).at(-1);
  const assigned = project.tasks.filter(task => task.owner === role && task.status !== 'done' &&
    !project.goals?.some(goal => goal.task === task.id)).at(-1);
  const qa = role === 'alm' && project.tasks.length ? officinaQa(project.events, event?.task ?? project.tasks.at(-1)!.id) : undefined;
  return status(assigned ? 'assigned' : 'idle', assigned?.id ?? event?.task, qa ?? event?.data.text);
}
