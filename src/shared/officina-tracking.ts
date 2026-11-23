import {
  officinaActorName, officinaOpenItems, officinaQa, type OfficinaActor, type OfficinaProject, type OfficinaRun, type OfficinaRunActivity,
} from './companion-officina';
import {officinaDelegatedRoles, officinaResults} from './officina-results';
import {officinaAskedQuestion, officinaClosureRetry} from './officina-attention';
import {officinaPendingProposals} from './officina-observer';

export const officinaTrackingLabels = {
  working: 'Trabajando en Codex', permission: 'Aprobación pendiente', sending: 'Enviando a Codex',
  submitted: 'Enviado · inicio por confirmar', checking: 'Verificando la respuesta', review: 'Requiere revisión',
  interrupted: 'Turno interrumpido', blocked: 'Limitación registrada', information: 'Falta información', waiting: 'En cola de Officina',
  scheduled: 'Espera su turno', done: 'Terminó el encargo', limited: 'Cerrado con limitaciones',
  skipped: 'Omitido por cierre', assigned: 'Asignado', idle: 'Sin encargos',
} as const;
type TrackingState = keyof typeof officinaTrackingLabels;
type RoleStatus = {state: TrackingState; task?: string; title?: string; detail?: string; label?: string};

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

export function officinaFollowupTracking(run: OfficinaRun, observed?: OfficinaRunActivity): RoleStatus {
  const result = run.followup?.result;
  if (result) return result.outcome === 'limited' ? {state: 'limited', label: 'Seguimiento con limitaciones'} :
    {state: 'done', label: 'Seguimiento listo'};
  const state = officinaRunTracking(run, observed);
  return {state, label: state === 'waiting' ? 'Seguimiento en cola' : undefined, detail: run.issue};
}

export function officinaRoleTracking(project: OfficinaProject | undefined, role: OfficinaActor, observed?: OfficinaRunActivity): RoleStatus {
  if (role === 'observer') {
    const pending = (project?.reviews ?? []).reduce((total, review) => total + officinaPendingProposals(review), 0);
    const runs = project?.runs.filter(run => run.role === role);
    const last = runs?.find(run => ['sending', 'sent', 'uncertain'].includes(run.state)) ?? runs?.at(-1);
    if (last?.followup) return officinaFollowupTracking(last, observed);
    if (last && last.state !== 'completed') return {state: officinaRunTracking(last, observed), detail: last.issue};
    return last || pending ? {state: 'done', label: pending ? `${pending} ${pending === 1 ? 'propuesta pendiente' : 'propuestas pendientes'}` : 'Revisión lista'} :
      {state: 'idle', label: 'Observador'};
  }
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
  if (last && role === 'coordinator' && officinaClosureRetry(project, last.task)?.id === last.id) {
    return {...status('review', last.task), label: 'Cierre pendiente'};
  }
  const clarification = project.goals?.filter(goal => goal.question && !closed.has(goal.task) &&
    project.runs.filter(run => run.task === goal.task).at(-1)?.role === role).at(-1);
  if (clarification) return status(officinaAskedQuestion(clarification) ? 'information' : 'review', clarification.task, clarification.question);
  const waiting = runs.find(run => run.state === 'waiting' && !closed.has(run.task));
  if (waiting) return status('waiting', waiting.task, waiting.issue);
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
  const qa = role === 'alm' && project.tasks.length ? officinaQa(project.events, event?.task ?? project.tasks.at(-1)!.id) : undefined;
  const completed = project.tasks.filter(task => task.status === 'done' && task.owner === role).at(-1);
  const task = assigned?.id ?? event?.task ?? completed?.id;
  const delivery = task && officinaResults(project, task, role).at(-1);
  if (!assigned && delivery) return {...status('done', task, qa), label: delivery.event ? 'Entrega registrada' : 'Resultado no disponible'};
  return status(assigned ? 'assigned' : 'idle', task, qa ?? event?.data.text);
}
