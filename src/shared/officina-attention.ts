import type {OfficinaGoal, OfficinaProject, OfficinaRun, OfficinaRunActivity, OfficinaTask} from './companion-officina';

export const officinaContextIssue = 'El contexto de decisiones y dependencias supera el límite del puente. Revisa el encargo en el tablero.';
export const legacyOfficinaContextQuestion = 'El objetivo supera el contexto del puente. Revisa la tarea antes de indicar cómo continuar.';

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

export type OfficinaAttention = {task: OfficinaTask} & (
  {kind: 'permission'; run: OfficinaRun; turn?: string} |
  {kind: 'closure' | 'dispatch'; run: OfficinaRun} |
  {kind: 'question'; question: string}
);

export function officinaAttention(project: OfficinaProject, activity?: OfficinaRunActivity, taskId?: string): OfficinaAttention | undefined {
  const tasks = project.tasks.filter(task => task.status !== 'done' && (!taskId || task.id === taskId)).reverse();
  const permission = activity?.state === 'permission' && project.runs.find(run => run.id === activity.run);
  const permissionTask = permission && tasks.find(task => task.id === permission.task);
  if (permission && permissionTask) return {kind: 'permission', task: permissionTask, run: permission, turn: activity?.turn};
  for (const task of tasks) {
    const closure = officinaClosureRetry(project, task.id);
    if (closure) return {kind: 'closure', task, run: closure};
    const goal = project.goals?.find(item => item.task === task.id);
    if (goal?.question && officinaAskedQuestion(goal)) return {kind: 'question', task, question: goal.question};
    const run = project.runs.filter(item => item.task === task.id).at(-1);
    if (run?.issue && ['uncertain', 'review', 'waiting', 'released'].includes(run.state) && run.retryAt === undefined) {
      return {kind: 'dispatch', task, run};
    }
  }
}
