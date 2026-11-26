import {officinaActorName, type OfficinaDecision, type OfficinaGlanceItem, type OfficinaProject} from './companion-officina';
import {officinaAttentionItems} from './officina-attention';

const priorities = {blocking: 0, high: 1, normal: 2};
export const officinaDecisionLabels = {
  pending: 'Pendiente', approve: 'Aprobada', 'request-changes': 'Cambios solicitados', reject: 'Rechazada', respond: 'Respondida',
} as const;

export function sortOfficinaDecisions(items: OfficinaDecision[]) {
  return items.sort((a, b) => {
    if (a.status !== 'pending' && b.status !== 'pending') return (b.at ?? 0) - (a.at ?? 0);
    return Number(b.status === 'pending') - Number(a.status === 'pending') ||
      priorities[a.priority] - priorities[b.priority] ||
      (a.at ?? Infinity) - (b.at ?? Infinity) || a.id.localeCompare(b.id);
  });
}

export function officinaProjectDecisions(project: OfficinaProject): OfficinaDecision[] {
  const pending = officinaAttentionItems(project).flatMap<OfficinaDecision>(item => {
    if (item.kind !== 'question' && item.kind !== 'request') return [];
    const request = item.kind === 'request' ? item.request : undefined;
    const role = item.run?.role ?? 'coordinator';
    return [{id: item.run?.id ?? item.task.id, project: project.id, projectName: project.name, task: item.task.id,
      title: item.task.title, role, roleName: officinaActorName(role, project), kind: 'question', status: 'pending',
      mode: request?.mode ?? 'question', priority: request?.priority ?? (request?.mode === 'approval' ? 'high' : 'normal'),
      summary: item.kind === 'request' ? item.request.text : item.question, at: item.run?.requestedAt ?? item.run?.sentAt}];
  });
  const resolved = project.runs.flatMap<OfficinaDecision>(run => {
    const answer = run.humanAnswer;
    const task = project.tasks.find(task => task.id === run.task);
    if (!answer || !task) return [];
    const history = project.goals?.find(goal => goal.task === task.id)?.history.find(item => item.reply?.run === run.id);
    const continuation = project.runs.find(item => item.id === answer.continuation);
    const delivery = continuation?.state === 'sent' || continuation?.state === 'completed' ? 'accepted' :
      continuation?.state === 'waiting' || continuation?.state === 'sending' ? 'waiting' :
        continuation ? 'uncertain' : undefined;
    return [{id: run.id, project: project.id, projectName: project.name, task: task.id, title: task.title,
      role: run.role, roleName: officinaActorName(run.role, project), kind: 'question', status: answer.action,
      mode: answer.request?.mode, summary: answer.request?.text ?? history?.text ?? 'Decisión registrada',
      priority: answer.request?.priority ?? 'normal', at: answer.at, feedback: answer.message, delivery}];
  });
  return [...pending, ...resolved];
}

export function officinaPermissionDecision(item: OfficinaGlanceItem, id: string): OfficinaDecision {
  return {...item, id, kind: 'permission', status: 'pending', priority: 'blocking', summary: 'Autorización de herramienta pendiente en Codex.'};
}
