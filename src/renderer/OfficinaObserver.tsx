import React, {useRef, useState} from 'react';
import {ArrowRight, Eye, Settings2} from 'lucide-react';
import {officinaActorName, officinaRunLabels, type OfficinaAction, type OfficinaProject,
  type OfficinaObserverReview, type OfficinaRun, type OfficinaRunActivity} from '../shared/companion-officina';
import {officinaRoleProfile} from '../shared/officina-instructions';
import {officinaApprovedImprovement, officinaObservationTaskLimit, officinaObservationTasks, officinaPendingProposals} from '../shared/officina-observer';
import {officinaFollowupTracking, officinaTrackingLabels} from '../shared/officina-tracking';
import {OfficinaMarkdown} from './OfficinaReference';

type Act = (action: OfficinaAction) => Promise<boolean>;

function scopeName(project: OfficinaProject, review: OfficinaObserverReview) {
  return project.tasks.find(task => task.id === review.scope)?.title ?? 'Actividad reciente del proyecto';
}

export function OfficinaMonitorNotice({project, review, open}: {
  project: OfficinaProject; review: OfficinaObserverReview; open: () => void;
}) {
  return <section className="officina-next" data-kind="monitor" aria-label="Propuesta automática de ZEN" role="status">
    <strong><Eye aria-hidden="true"/>ZEN detectó una incidencia</strong>
    <small title={scopeName(project, review)}>{scopeName(project, review)}</small>
    <button className="officina-next-action" onClick={open}>Ver propuesta <ArrowRight aria-hidden="true"/></button>
  </section>;
}

export function OfficinaFollowupNotice({project, run, activity, open}: {
  project: OfficinaProject; run: OfficinaRun; activity?: OfficinaRunActivity; open: () => void;
}) {
  const proposal = run.followup && officinaApprovedImprovement(project, run.followup)?.proposal;
  if (!proposal) return null;
  const tracking = officinaFollowupTracking(run, activity);
  return <section className="officina-next" data-kind="followup" aria-label="Seguimiento de ZEN" role="status">
    <strong><Eye aria-hidden="true"/>ZEN · {tracking.label ?? officinaTrackingLabels[tracking.state]}</strong>
    <small title={proposal.title}>{proposal.title}</small>
    <button className="officina-next-action" onClick={open}>Ver seguimiento <ArrowRight aria-hidden="true"/></button>
  </section>;
}

export function OfficinaObserverDesk({project, queued, act, open, settings}: {
  project?: OfficinaProject; queued?: string[]; act: Act; open: () => void; settings: () => void;
}) {
  const [scope, setScope] = useState('');
  const id = useRef(crypto.randomUUID());
  const last = project?.reviews?.filter(review => !review.source).at(-1);
  const run = project?.runs.find(item => item.id === last?.id && item.role === 'observer');
  const restart = run?.state === 'waiting' || run?.state === 'review' && run.sentAt === undefined;
  const waiting = !!run && queued?.includes(run.id);
  const active = run && ['sending', 'sent', 'uncertain'].includes(run.state);
  const tasks = project ? officinaObservationTasks(project) : [];
  const pending = (project?.reviews ?? []).reduce((total, review) => total + officinaPendingProposals(review), 0);
  return <section className="officina-desk-activity officina-observer-desk" aria-label="Puesto de ZEN">
    <header>
      <div><span className="officina-role-icon"><Eye aria-hidden="true"/></span><h2>ZEN</h2></div>
      <button onClick={settings}><Settings2 aria-hidden="true"/>Instrucciones</button>
    </header>
    <p>Revisa cómo trabajó el equipo y te propone mejoras para sus prompts, funciones y coordinación.</p>
    {!project?.team ? <p>Envía un encargo desde Chat global para vincular un proyecto de Codex.</p> :
      !tasks.length ? <p>Todavía no hay resultados ni incidencias para revisar.</p> : <form className="officina-observer-scope"
        onSubmit={async event => {
          event.preventDefault();
          if (await act({type: 'observe-team', project: project.id, id: restart && last ? last.id : id.current,
            task: restart ? last?.scope : scope || undefined})) id.current = crypto.randomUUID();
        }}>
        {!active && !restart && <select aria-label="Ámbito de la revisión de ZEN" value={scope} onChange={event => setScope(event.target.value)}>
          <option value="">Actividad reciente · hasta {officinaObservationTaskLimit} tareas</option>
          {tasks.map(task => <option key={task.id} value={task.id}>{task.title}</option>)}
        </select>}
        {!active && <button type="submit" className="officina-accent" disabled={waiting}>
          {waiting ? 'Revisión en cola' : restart ? 'Retomar revisión' : 'Revisar actividad'}
        </button>}
      </form>}
    {run && (active || restart || run.issue) && <p role="status">{run.issue ?? officinaRunLabels[run.state]}</p>}
    {!!project?.reviews?.length && <button onClick={open}>
      {pending ? `Ver propuestas (${pending})` : 'Ver revisiones'} <ArrowRight aria-hidden="true"/>
    </button>}
  </section>;
}

export function OfficinaObserverPanel({project, act, initialReview, activity, queued}: {
  project: OfficinaProject; act: Act; initialReview?: string; activity?: OfficinaRunActivity; queued?: string[];
}) {
  const reviews = project.reviews ?? [];
  const [selected, setSelected] = useState(() =>
    initialReview ?? reviews.filter(item => officinaPendingProposals(item) > 0).at(-1)?.id ?? reviews.at(-1)?.id ?? '');
  const review = reviews.find(item => item.id === selected);
  const run = review && project.runs.find(item => item.id === review.id);
  if (!review) return <p>Todavía no hay revisiones de ZEN en este proyecto.</p>;
  return <div className="officina-observer-reviews">
    {reviews.length > 1 ? <label>Revisión <select value={selected} onChange={event => setSelected(event.target.value)}>
      {reviews.slice().reverse().map(item => <option key={item.id} value={item.id}>
        {item.source === 'monitor' ? 'Detección automática · ' : ''}{scopeName(project, item)} · {new Date(item.at).toLocaleString('es-ES')}
      </option>)}
    </select></label> : <p>{scopeName(project, review)}</p>}
    {review.source === 'monitor' && <small>Detección automática · {scopeName(project, review)}</small>}
    {review.report ? <>
      <OfficinaMarkdown text={review.report.markdown ?? review.report.text} project={project.id} task={review.scope} act={act}/>
      {review.report.proposals.length ? <section aria-label="Propuestas de ZEN" className="officina-observer-proposals" key={review.id}>
        {review.report.proposals.map((proposal, index) => {
          const decision = review.decisions?.find(item => item.index === index)?.status;
          const prompt = proposal.kind === 'prompt';
          const current = prompt ? officinaRoleProfile(proposal.role, project).prompt : undefined;
          const changed = prompt && current !== review.baseline?.[proposal.role];
          const followup = project.runs.find(item => item.role === 'observer' &&
            item.followup?.review === review.id && item.followup.index === index);
          const tracking = followup && officinaFollowupTracking(followup, activity);
          const resume = followup?.state === 'waiting' && !queued?.includes(followup.id) ||
            followup?.state === 'review' && followup.sentAt === undefined;
          const decide = (decision: 'approved' | 'rejected') => void act({type: 'decide-observation',
            project: project.id, id: review.id, index, decision});
          return <article key={index} className="officina-observer-proposal">
            <h3>{proposal.title}</h3>
            <small>{prompt ? `Prompt · ${officinaActorName(proposal.role, project)}` : 'Gestión del equipo'}</small>
            <p><strong>Evidencia</strong> · {proposal.evidence}</p>
            <p><strong>Cómo comprobarlo</strong> · {proposal.validation}</p>
            {!prompt && <p>{proposal.recommendation}</p>}
            {decision && <p role="status" className="officina-proposal-decision">
              {decision === 'rejected' ? 'Descartada' : prompt ? 'Prompt aplicado' : 'Recomendación aprobada'}
            </p>}
            {!prompt && decision === 'approved' && <div className="officina-followup">
              {tracking && <p role="status">ZEN · {tracking.label ?? officinaTrackingLabels[tracking.state]}</p>}
              {followup?.issue && <p>{followup.issue}</p>}
              {(!followup || resume) && <button className="officina-accent" onClick={() =>
                void act({type: 'follow-observation', project: project.id, id: review.id, index})}>
                {followup ? 'Retomar seguimiento' : 'Iniciar seguimiento'}
              </button>}
              {followup?.followup?.result && <details><summary>Ver resultado de ZEN</summary>
                <OfficinaMarkdown text={followup.followup.result.markdown ?? followup.followup.result.text}
                  project={project.id} task={review.scope} act={act}/>
              </details>}
              {followup?.destination && <button onClick={() =>
                void act({type: 'open-run-chat', project: project.id, task: followup.task, run: followup.id})}>
                Abrir seguimiento en Codex <ArrowRight aria-hidden="true"/>
              </button>}
              {followup?.state === 'uncertain' && <button onClick={() =>
                void act({type: 'release', project: project.id, run: followup.id})}>Liberar seguimiento tras revisar Codex</button>}
            </div>}
            {prompt && <details>
              <summary>Comparar prompts</summary>
              <div className="officina-prompt-comparison">
                <section><h4>Prompt en la revisión</h4><p>{review.baseline?.[proposal.role]}</p></section>
                <section><h4>Prompt propuesto</h4><p>{proposal.prompt}</p></section>
              </div>
              {!decision && (changed ? <p>El prompt vigente cambió. Solicita otra revisión para aplicar una mejora.</p> :
                <button className="officina-accent" onClick={() => decide('approved')}>Aplicar prompt</button>)}
            </details>}
            {!decision && <div className="officina-observer-actions">
              {!prompt && <button className="officina-accent" onClick={() => decide('approved')}>Aprobar e iniciar seguimiento</button>}
              <button onClick={() => decide('rejected')}>Descartar</button>
            </div>}
          </article>;
        })}
      </section> : <p>ZEN no propuso cambios en esta revisión.</p>}
    </> : run && <p role="status">{run.issue ?? officinaRunLabels[run.state]}</p>}
    {run?.destination && <div className="officina-observer-actions">
      <button onClick={() => void act({type: 'open-run-chat', project: project.id, task: run.task, run: run.id})}>
        {review.source === 'monitor' ? 'Abrir turno en Codex' : 'Abrir revisión en Codex'} <ArrowRight aria-hidden="true"/>
      </button>
      {run.state === 'uncertain' && <button onClick={() => void act({type: 'release', project: project.id, run: run.id})}>
        Liberar revisión tras revisar Codex
      </button>}
    </div>}
  </div>;
}
