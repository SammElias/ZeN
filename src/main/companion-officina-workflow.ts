import {randomUUID} from 'node:crypto';
import {isOfficinaTabReview, officinaActiveTabRequested, officinaGoalBrowser, officinaGoalRequest} from '../shared/officina-browser';
import {
  officinaActorName, officinaDeliveryQa, officinaOpenItems, type OfficinaActor, type OfficinaCoordinatorResult,
  type OfficinaContribution, type OfficinaEvent, type OfficinaGoal, type OfficinaGoalMessage, type OfficinaProject, type OfficinaRun, type OfficinaTask,
} from '../shared/companion-officina';

export const goalFor = (project: OfficinaProject, task: string) => project.goals?.find(goal => goal.task === task);

export function createOfficinaRun(project: OfficinaProject, task: string, role: OfficinaActor,
  options: Pick<OfficinaRun, 'event' | 'step'> & {depth?: number} = {}) {
  project.runs.push({id: randomUUID(), task, role, depth: 0, ...options, state: 'waiting'});
}

export function logOfficinaGoal(goal: OfficinaGoal, from: OfficinaGoalMessage['from'], text: string, markdown?: string,
  reply?: OfficinaGoalMessage['reply']) {
  goal.history = [...goal.history, {from, text, markdown, reply}].slice(-32);
}

export function pauseOfficinaGoal(goal: OfficinaGoal, text: string) {
  if (goal.phase === 'complete') return;
  if (goal.phase === 'work') goal.phase = 'verify';
  goal.question = text;
}

export function finishOfficinaGoal(project: OfficinaProject, task: OfficinaTask, goal: OfficinaGoal, text: string,
  source: 'codex' | 'zen', limited = false, markdown?: string, reply?: OfficinaGoalMessage['reply']) {
  if (goal.phase === 'complete') return;
  goal.phase = 'complete';
  goal.outcome = limited ? 'limited' : undefined;
  goal.question = undefined;
  task.status = 'done';
  for (const run of project.runs) if (run.task === task.id && run.state === 'waiting') run.state = 'skipped';
  logOfficinaGoal(goal, source, text, markdown, reply);
}

export function settleSavedOfficinaGoals(project: OfficinaProject) {
  if (!project.goals?.some(goal => goal.phase === 'work')) return;
  const limitations = officinaOpenItems(project.events).filter(event => event.source === 'codex' && event.data.kind === 'blocker');
  for (const goal of project.goals) {
    if (goal.phase !== 'work' || goal.question) continue;
    const runs = project.runs.filter(run => run.task === goal.task), last = runs.at(-1);
    if (last?.state !== 'completed' || runs.some(run => ['waiting', 'sending', 'sent', 'uncertain'].includes(run.state))) continue;
    const task = project.tasks.find(item => item.id === goal.task);
    const limitation = limitations.find(event => event.task === goal.task && event.id === last.id);
    if (task && limitation) finishOfficinaGoal(project, task, goal, limitation.data.text, 'zen', true, limitation.data.markdown);
  }
}

export function plannedTesterHandoff(project: OfficinaProject, task: string, run: string, from: OfficinaActor,
  data: OfficinaContribution, source: OfficinaEvent['source']) {
  if (source !== 'codex' || from !== 'developer' || data.kind !== 'handoff' || data.to !== 'tester' || !data.act) return false;
  const goal = goalFor(project, task);
  return goal?.phase === 'work' && goal.steps[goal.cursor + 1]?.role === 'tester' &&
    project.runs.some(item => item.id === run && item.task === task && item.step === goal.cursor && item.state === 'completed');
}

export function continueOfficinaGoal(project: OfficinaProject, task: OfficinaTask, goal: OfficinaGoal) {
  if (goal.phase !== 'work' || goal.question || task.status === 'done') return;
  const runs = project.runs.filter(run => run.task === task.id);
  if (runs.some(run => ['waiting', 'sending', 'sent', 'uncertain'].includes(run.state))) return;
  if (['review', 'released'].includes(runs.at(-1)?.state ?? '')) {
    pauseOfficinaGoal(goal, 'Un encargo requiere revisión en Codex. Indica cómo continuar después de revisar el chat.');
    return;
  }
  const events = project.events.filter(event => event.task === task.id);
  const open = officinaOpenItems(events);
  if (open.some(event => event.data.kind === 'blocker')) return;
  const previous = runs.filter(run => run.step === goal.cursor);
  const last = previous.at(-1), result = events.find(event => event.id === last?.id)?.data;
  if (open.some(event => event.id === last?.id && event.data.kind === 'question' && event.data.act)) {
    finishOfficinaGoal(project, task, goal, 'El equipo cerró el encargo con una consulta interna sin resolver. El historial conserva el trabajo disponible.', 'zen', true);
    return;
  }
  if (previous.length && result?.kind !== 'blocker' && result?.kind !== 'question') goal.cursor++;
  if (previous.length >= 3 && (result?.kind === 'blocker' || result?.kind === 'question')) {
    finishOfficinaGoal(project, task, goal, 'El puesto agotó los intentos y dejó constancia de lo que pudo comprobar.', 'zen', true);
    return;
  }
  const step = goal.steps[goal.cursor];
  const qa = officinaDeliveryQa(events, task.id);
  if (step && !(step.role === 'alm' && qa && qa.passed !== true)) {
    task.owner = step.role;
    const delivery = step.role === 'tester' && last?.role === 'developer' && result?.kind === 'handoff' &&
      result.to === 'tester' && result.act && last.step === goal.cursor - 1 ? last : undefined;
    createOfficinaRun(project, task.id, step.role, {
      step: goal.cursor, ...(delivery && {event: delivery.id, depth: delivery.depth + 1}),
    });
  } else if (goal.recipient) {
    const limited = !!qa && qa.passed !== true;
    finishOfficinaGoal(project, task, goal, limited ? 'El objetivo se cerró con comprobaciones de QA pendientes.' :
      `Resultado registrado por ${officinaActorName(goal.recipient, project)}.`, 'zen', limited);
  } else {
    goal.cursor = goal.steps.length;
    goal.phase = 'verify';
    createOfficinaRun(project, task.id, 'coordinator');
  }
}

export function applyOfficinaCoordination(project: OfficinaProject, task: OfficinaTask, goal: OfficinaGoal,
  result: OfficinaCoordinatorResult['result'], run?: string) {
  if (goal.phase === 'complete' || task.status === 'done') return;
  const source = run ? 'codex' : 'zen';
  const reply = run ? {run, kind: result.kind} : undefined;
  if (result.kind === 'question') {
    if (goal.phase === 'plan') {
      logOfficinaGoal(goal, source, result.text, result.markdown, reply);
      pauseOfficinaGoal(goal, result.text);
    } else finishOfficinaGoal(project, task, goal, result.text, source, true, result.markdown, reply);
    return;
  }
  if (result.kind === 'limited') {
    finishOfficinaGoal(project, task, goal, result.text, source, true, result.markdown, reply);
    return;
  }
  if (result.kind === 'complete') {
    const events = project.events.filter(event => event.task === task.id);
    const qa = officinaDeliveryQa(events, task.id);
    if (goal.phase !== 'verify' || qa && qa.passed !== true ||
      officinaOpenItems(events).some(event => event.data.kind === 'question' && event.data.act)) {
      logOfficinaGoal(goal, source, result.text, result.markdown, reply);
      finishOfficinaGoal(project, task, goal, 'El encargo se cerró con verificaciones pendientes. Consulta el historial y el resultado de QA.', 'zen', true);
      return;
    }
    finishOfficinaGoal(project, task, goal, result.text, source, false, result.markdown, reply);
    return;
  }
  if (goal.round >= 4 || goal.steps.length + result.steps.length > 20) {
    finishOfficinaGoal(project, task, goal, 'Se alcanzó el límite de coordinación. El historial conserva las conclusiones y el trabajo disponible.', 'zen', true);
    return;
  }
  logOfficinaGoal(goal, source, result.text, result.markdown, reply);
  goal.cursor = goal.steps.length;
  goal.steps.push(...result.steps);
  goal.round++;
  goal.phase = 'work';
  task.status = 'active';
  continueOfficinaGoal(project, task, goal);
}

export function planOfficinaTabReview(project: OfficinaProject, task: OfficinaTask, goal: OfficinaGoal) {
  const request = officinaGoalRequest(goal);
  if (goal.phase !== 'plan' || !isOfficinaTabReview(request, officinaGoalBrowser(project, goal))) return false;
  goal.question = undefined;
  const active = officinaActiveTabRequested(request);
  applyOfficinaCoordination(project, task, goal, {
    kind: 'plan', text: active ? 'El Analista revisará la pestaña activa por medio de la extensión de ChatGPT.' :
      'El Analista revisará las pestañas abiertas por medio de la extensión de ChatGPT.',
    steps: [{role: 'analyst', instruction: active ?
      'Identifica la pestaña activa mediante la extensión. Resume lo que el usuario está viendo y apóyalo con el título, el dominio y los elementos que hayas verificado. Si solo puedes leer la ficha de una emisión o un vídeo, indica qué parte pudiste comprobar.' :
      'En modo lectura, enumera las pestañas abiertas accesibles mediante la extensión. Indica título, dominio y un resumen breve cuando puedas leer la página. Distingue qué viste y qué quedó sin acceso. Conserva las pestañas y los datos tal como están.'}],
  });
  return true;
}
