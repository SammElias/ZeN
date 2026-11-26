import {officinaOpenItems, type OfficinaGoal, type OfficinaHumanRequest, type OfficinaProject, type OfficinaRun, type OfficinaRunActivity,
  type OfficinaTask} from './companion-officina';

export const officinaContextIssue = 'El contexto de decisiones y dependencias supera el límite del puente. Revisa el encargo en el tablero.';
export const legacyOfficinaContextQuestion = 'El objetivo supera el contexto del puente. Revisa la tarea antes de indicar cómo continuar.';
export const officinaReplyReviewQuestion = 'Revisa la respuesta de Codex e indica cómo retomar el objetivo.';

export function officinaUnsentContextIssue(run: OfficinaRun) {
  return run.state === 'review' && run.issue === officinaContextIssue &&
    run.sentAt === undefined && !run.destination && !run.turn;
}

export function officinaSendRetry(run: OfficinaRun) {
  return run.state === 'review' && !!run.retryAttempt && run.sentAt === undefined && !run.destination && !run.turn;
}

export function officinaClosureRetry(project: OfficinaProject, task: string) {
  const goal = project.goals?.find(item => item.task === task);
  if (goal?.phase !== 'verify' || goal.recipient || goal.question && goal.question !== legacyOfficinaContextQuestion ||
    !project.tasks.some(item => item.id === task && item.status !== 'done')) return;
  const runs = project.runs.filter(run => run.task === task);
  if (runs.some(run => ['waiting', 'sending', 'sent', 'uncertain'].includes(run.state))) return;
  const last = runs.at(-1);
  return last?.role === 'coordinator' && officinaUnsentContextIssue(last) ? last : undefined;
}

export function officinaAskedQuestion(goal: OfficinaGoal) {
  const last = goal.history.at(-1);
  return !!goal.question && last?.from === 'codex' && last.reply?.kind === 'question' && last.text === goal.question;
}

export function officinaConfirmApproval(request: OfficinaHumanRequest, nextRole?: string) {
  return request.sensitive === true || nextRole === 'alm' ||
    /\b(?:desplieg\w*|deploy\w*|producci[oó]n|production|elimin\w*|delet\w*|credencial\w*|credentials?|permisos?|permissions?|publica\w*|publish\w*|escritura|write)\b/i
      .test([request.text, request.impact, request.markdown].filter(Boolean).join(' '));
}

export function officinaWaitingRuns(project: OfficinaProject) {
  const open = new Set(project.tasks.filter(task => task.status !== 'done').map(task => task.id));
  for (const item of officinaOpenItems(project.events)) if (item.data.kind === 'blocker') open.delete(item.task);
  for (const goal of project.goals ?? []) if (goal.question || goal.humanRequest) open.delete(goal.task);
  return project.runs.filter(run => run.role !== 'observer' && run.state === 'waiting' && open.has(run.task));
}

export type OfficinaAttention = {task: OfficinaTask} & (
  {kind: 'permission'; run: OfficinaRun; turn?: string} |
  {kind: 'request'; run: OfficinaRun; request: NonNullable<OfficinaGoal['humanRequest']>} |
  {kind: 'closure' | 'dispatch'; run: OfficinaRun} |
  {kind: 'question'; question: string; run?: OfficinaRun}
);

export function officinaAttentionItems(project: OfficinaProject, activity?: OfficinaRunActivity, taskId?: string): OfficinaAttention[] {
  const tasks = project.tasks.filter(task => task.status !== 'done' && (!taskId || task.id === taskId)).reverse();
  const permission = activity?.state === 'permission' && project.runs.find(run => run.id === activity.run);
  const permissionTask = permission && tasks.find(task => task.id === permission.task);
  const items: OfficinaAttention[] = [];
  if (permission && permissionTask) items.push({kind: 'permission', task: permissionTask, run: permission, turn: activity?.turn});
  for (const task of tasks) {
    if (task === permissionTask) continue;
    const goal = project.goals?.find(item => item.task === task.id);
    const request = goal?.humanRequest;
    const run = project.runs.filter(item => item.task === task.id).at(-1);
    if (request && run?.id === request.run && run.state === 'completed' && !run.humanAnswer) {
      items.push({kind: 'request', task, request, run});
      continue;
    }
    const closure = officinaClosureRetry(project, task.id);
    if (closure) items.push({kind: 'closure', task, run: closure});
    else if (goal?.question && officinaAskedQuestion(goal)) items.push({kind: 'question', task, question: goal.question,
      run: project.runs.find(candidate => candidate.id === goal.history.at(-1)?.reply?.run && candidate.task === task.id)});
    else if (run?.issue && ['uncertain', 'review', 'waiting', 'released'].includes(run.state) && run.retryAt === undefined) {
      items.push({kind: 'dispatch', task, run});
    }
  }
  return items;
}

export function officinaAttention(project: OfficinaProject, activity?: OfficinaRunActivity, taskId?: string): OfficinaAttention | undefined {
  const items = officinaAttentionItems(project, activity, taskId);
  return items.find(item => item.kind === 'permission' || item.kind === 'request' || item.kind === 'question') ?? items[0];
}
