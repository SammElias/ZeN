import {
  officinaActorName, officinaOpenItems, officinaQa, type OfficinaActor, type OfficinaProject, type OfficinaRun, type OfficinaRunActivity,
} from './companion-officina';
import {officinaDelegatedRoles, officinaResults} from './officina-results';
import {officinaAskedQuestion, officinaAttentionItems, officinaClosureRetry} from './officina-attention';
import {officinaImprovementGoal, officinaPendingProposals} from './officina-observer';

export const officinaTrackingLabels = {
  working: 'Trabajando en Codex', permission: 'Aprobación pendiente', sending: 'Enviando a Codex',
  submitted: 'Enviado · inicio por confirmar', queued: 'En cola de Codex', retrying: 'Esperando a Codex',
  checking: 'Verificando la respuesta', review: 'Requiere revisión',
  interrupted: 'Turno interrumpido', blocked: 'Limitación registrada', information: 'Falta información', waiting: 'En cola de Officina',
  scheduled: 'Espera su turno', done: 'Terminó el encargo', limited: 'Cerrado con limitaciones',
  skipped: 'Omitido por cierre', assigned: 'Asignado', idle: 'Sin encargos',
} as const;
type TrackingState = keyof typeof officinaTrackingLabels;
type RoleStatus = {state: TrackingState; task?: string; title?: string; detail?: string; label?: string};
const inFlightStates = ['sending', 'sent', 'uncertain'];

export function officinaFocusedTask(project: OfficinaProject, selected?: string) {
  const explicit = project.tasks.find(task => task.id === selected);
  if (explicit) return explicit;
  const automated = new Set(project.goals?.filter(goal => goal.improvement).map(goal => goal.task));
  const userTasks = project.tasks.filter(task => !automated.has(task.id));
  const tasks = userTasks.length ? userTasks : project.tasks;
  const inFlight = project.runs.find(run => inFlightStates.includes(run.state) &&
    tasks.some(task => task.id === run.task && task.status !== 'done'));
  return tasks.find(task => task.id === inFlight?.task) ?? tasks.filter(task => task.status !== 'done').at(-1) ?? tasks.at(-1);
}

export function officinaTaskBoard(project: OfficinaProject, task: string): OfficinaProject {
  return {...project, tasks: project.tasks.filter(item => item.id === task), runs: project.runs.filter(run => run.task === task),
    events: project.events.filter(event => event.task === task), goals: project.goals?.filter(goal => goal.task === task)};
}

export function officinaRunTracking(run: OfficinaRun, observed?: OfficinaRunActivity): TrackingState {
  if ((run.state === 'sent' || run.state === 'uncertain' && observed?.state !== 'working') && observed?.run === run.id) {
    return observed.state === 'finished' ? 'checking' : observed.state;
  }
  switch (run.state) {
    case 'waiting': return run.retryAt === undefined ? 'waiting' : 'retrying';
    case 'sending': return 'sending';
    case 'sent': return run.queuedAt === undefined ? 'submitted' : 'queued';
    case 'completed': return 'done';
    case 'skipped': return 'skipped';
    default: return 'review';
  }
}

export function officinaFollowupTracking(run: OfficinaRun, observed?: OfficinaRunActivity): RoleStatus {
  const result = run.followup?.result;
  if (result) return result.outcome === 'limited' ? {state: 'limited', label: 'Seguimiento con limitaciones'} :
    {state: 'done', label: 'Seguimiento listo'};
  const state = officinaRunTracking(run, observed);
  return {state, label: state === 'waiting' ? 'Seguimiento en cola' : undefined, detail: run.issue};
}

export function officinaObserverRun(project?: OfficinaProject, task?: string) {
  if (!project) return;
  const reviews = task === undefined ? undefined : new Set(project.reviews?.filter(review => review.scope === task).map(review => review.id));
  const runs = project.runs.filter(run => run.role === 'observer' &&
    (!reviews || reviews.has(run.followup?.review ?? run.id)) &&
    !(run.followup && run.state === 'completed' && officinaImprovementGoal(project, run.followup.review)));
  return runs.find(run => inFlightStates.includes(run.state)) ?? runs.at(-1);
}

export function officinaRoleTracking(project: OfficinaProject | undefined, role: OfficinaActor, observed?: OfficinaRunActivity,
  taskId?: string): RoleStatus {
  if (role === 'observer') {
    const reviews = project?.reviews?.filter(review => taskId === undefined || review.scope === taskId) ?? [];
    const pending = reviews.reduce((total, review) => total + officinaPendingProposals(review, project), 0);
    const last = officinaObserverRun(project, taskId);
    if (last?.followup) return officinaFollowupTracking(last, observed);
    if (last && last.state !== 'completed') return {state: officinaRunTracking(last, observed), detail: last.issue};
    return last || pending ? {state: 'done', label: pending ? `${pending} ${pending === 1 ? 'propuesta pendiente' : 'propuestas pendientes'}` : 'Revisión lista'} :
      {state: 'idle', label: 'Observador'};
  }
  if (!project) return {state: 'idle'};
  if (taskId !== undefined) project = officinaTaskBoard(project, taskId);
  const runs = project.runs.filter(run => run.role === role && run.state !== 'skipped'), last = runs.at(-1);
  const closed = new Set(project.tasks.filter(task => task.status === 'done').map(task => task.id));
  const status = (state: TrackingState, task?: string, detail?: string): RoleStatus => ({
    state, task, title: project.tasks.find(item => item.id === task)?.title, detail,
  });
  const inFlight = runs.find(run => inFlightStates.includes(run.state));
  if (inFlight) return status(officinaRunTracking(inFlight, observed), inFlight.task, inFlight.issue);
  const request = officinaAttentionItems(project).find(item => item.kind === 'request' && item.run.role === role);
  if (request?.kind === 'request') return {...status('information', request.task.id, request.request.text), label: 'Espera tu decisión'};
  const open = officinaOpenItems(project.events).filter(event => event.data.kind === 'blocker' && event.from === role && !closed.has(event.task)).at(-1);
  if (open) return status('blocked', open.task, open.data.text);
  if (last && role === 'coordinator' && officinaClosureRetry(project, last.task)?.id === last.id) {
    return {...status('review', last.task), label: 'Cierre pendiente'};
  }
  const clarification = project.goals?.filter(goal => goal.question && !closed.has(goal.task) &&
    project.runs.filter(run => run.task === goal.task).at(-1)?.role === role).at(-1);
  if (clarification) return status(officinaAskedQuestion(clarification) ? 'information' : 'review', clarification.task, clarification.question);
  const waiting = runs.find(run => run.state === 'waiting' && !closed.has(run.task));
  if (waiting) return status(officinaRunTracking(waiting, observed), waiting.task, waiting.issue);
  const scheduled = project.goals?.find(goal => goal.phase === 'work' && goal.steps.slice(goal.cursor + 1).some(step => step.role === role));
  if (scheduled) return status('scheduled', scheduled.task);
  if (last?.state === 'review' || last?.state === 'released') return status('review', last.task, last.issue);
  if (last) {
    const result = project.events.find(event => event.id === last.id)?.data;
    const goal = project.goals?.find(item => item.task === last.task);
    const limited = goal?.outcome === 'limited' && (result?.kind === 'blocker' || role === 'coordinator');
    const delegated = role === 'coordinator' ? officinaDelegatedRoles(project, last.task) : [];
    const delivery = officinaResults(project, last.task, role).at(-1);
    const assignedRole = delegated[0];
    const assignedName = assignedRole && officinaActorName(assignedRole, project);
    const label = delegated.length === 1 ?
      `Asignó ${assignedRole === 'alm' || assignedName !== officinaActorName(assignedRole) ? 'a' : 'al'} ${assignedName}` :
      delegated.length > 1 ? `Asignó a ${delegated.length} puestos` :
      limited ? undefined : delivery?.message ? 'Conclusión lista' :
        delivery?.event ? role === 'analyst' ? 'Análisis listo' : 'Resultado listo' :
          delivery ? 'Resultado no disponible' : undefined;
    return {...status(limited ? 'limited' : 'done', last.task, result?.text), label};
  }
  const event = project.events.filter(item => item.from === role || 'to' in item.data && item.data.to === role).at(-1);
  const assigned = project.tasks.filter(task => task.owner === role && task.status !== 'done' &&
    !project.goals?.some(goal => goal.task === task.id)).at(-1);
  const qa = role === 'alm' && project.tasks.length && (taskId === undefined || event?.from === role) ?
    officinaQa(project.events, event?.task ?? project.tasks.at(-1)!.id) : undefined;
  const completed = project.tasks.filter(task => task.status === 'done' && task.owner === role).at(-1);
  const task = assigned?.id ?? event?.task ?? completed?.id;
  const delivery = task && officinaResults(project, task, role).at(-1);
  if (!assigned && delivery && (taskId === undefined || delivery.event || delivery.run || delivery.message)) {
    return {...status('done', task, qa), label: delivery.event ? 'Entrega registrada' : 'Resultado no disponible'};
  }
  if (taskId !== undefined && !assigned) {
    const focused = project.tasks[0];
    return {state: 'idle', label: focused?.status === 'done' ? 'Sin participación' : 'En espera'};
  }
  return status(assigned ? 'assigned' : 'idle', task, qa ?? event?.data.text);
}
