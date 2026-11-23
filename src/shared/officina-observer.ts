import type {OfficinaObserverReview, OfficinaProject, OfficinaRun} from './companion-officina';

export const officinaObservationTaskLimit = 6;

export function officinaObservationTasks(project: OfficinaProject) {
  const observed = new Set([
    ...project.events.map(event => event.task),
    ...project.runs.filter(run => run.role !== 'observer' && (run.turn || run.issue)).map(run => run.task),
    ...(project.goals ?? []).filter(goal => goal.history.some(message => message.from === 'codex')).map(goal => goal.task),
  ]);
  return project.tasks.filter(task => observed.has(task.id)).reverse();
}

export function officinaPendingProposals(review: OfficinaObserverReview) {
  return (review.report?.proposals.length ?? 0) - (review.decisions?.length ?? 0);
}

export function officinaApprovedImprovement(project: OfficinaProject, followup: NonNullable<OfficinaRun['followup']>) {
  const review = project.reviews?.find(item => item.id === followup.review);
  const proposal = review?.report?.proposals[followup.index];
  const approved = review?.decisions?.find(item => item.index === followup.index && item.status === 'approved');
  if (review && proposal?.kind === 'process' && approved) return {review, proposal, approved};
}
