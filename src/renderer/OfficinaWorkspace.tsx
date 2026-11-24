import React, {useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode} from 'react';
import {ArrowRight, Box, ChevronRight, ClipboardCheck, CodeXml, Copy, Eye, FileText, FlaskConical, FolderOpen, ImageIcon, Layers3, ListChecks, Maximize2, MessageSquare, Minimize2, Paperclip, Plus, Settings2, Trash2, Users, X} from 'lucide-react';
import {
  OfficinaActor, OfficinaParticipant, OfficinaRole, officinaActorName, officinaEventLabels, officinaOpenItems,
  officinaPasteTitle, officinaQa, officinaRunLabels, officinaTaskLabels,
  type OfficinaAction, type OfficinaDirectActivity, type OfficinaEvent, type OfficinaGoal, type OfficinaProject, type OfficinaRunActivity,
  type OfficinaTask, type OfficinaTaskStatus, type OfficinaView,
} from '../shared/companion-officina';
import {ZenEmblem} from './ZenEmblem';
import {isOfficinaTabReview, officinaGoalBrowser, officinaGoalRequest} from '../shared/officina-browser';
import {officinaFocusedTask, officinaObserverRun, officinaRoleTracking, officinaRunTracking, officinaTaskBoard, officinaTrackingLabels} from '../shared/officina-tracking';
import {officinaResults, type OfficinaResult} from '../shared/officina-results';
import {officinaChatEntries, type OfficinaChatEntry} from '../shared/officina-chat';
import {officinaAskedQuestion, officinaAttention, officinaAttentionItems, officinaClosureRetry, officinaWaitingRuns, type OfficinaAttention} from '../shared/officina-attention';
import type {CompanionApproval} from '../shared/codex-companion';
import {OfficinaAttentionCard} from './OfficinaAttentionCard';
import {OfficinaComposer} from './OfficinaComposer';
import {OfficinaRoleSettings} from './OfficinaRoleSettings';
import {OfficinaObserverDesk, OfficinaObserverPanel} from './OfficinaObserver';
import {OfficinaIdleScene, officinaCanRest, officinaIdleRoutines} from './OfficinaIdleScene';
import {OfficinaCafe} from './OfficinaCafe';
import {OfficinaScreens} from './OfficinaScreens';
import {OfficinaMarkdown, OfficinaReference} from './OfficinaReference';
import {formatNoteMarkdown} from './note-markdown';
import officeScene from './assets/officina-office-rooms.png';
import './OfficinaWorkspace.css';

const roleIcons = {coordinator: ListChecks, analyst: ClipboardCheck, architect: Layers3, developer: CodeXml, tester: FlaskConical, alm: Box, observer: Eye};
const roles = OfficinaRole.options;
const handoffTravelMs = 1900;
const desks = {
  analyst: {x: 32, y: 11, width: 20, height: 24, dot: [398, 321], path: 'M398 321 V374 Q398 386 412 386 H536 Q552 386 552 403 V420 Q552 436 569 436 H593', hit: [41, 38.6]},
  architect: {x: 78, y: 12, width: 23, height: 24, dot: [866, 347], path: 'M866 347 V390 Q866 406 849 406 H715 Q691 406 691 423 V436', hit: [68.5, 40.6]},
  developer: {x: 21, y: 35, width: 27, height: 27, dot: [363, 587], path: 'M363 587 V647 Q363 663 379 663 H463 Q478 663 478 647 V591 Q478 575 494 575 H542', hit: [44, 57.5]},
  tester: {x: 82, y: 43, width: 23, height: 25, dot: [945, 624], path: 'M945 624 V696 Q945 708 930 708 H803 Q786 708 786 692 V606 Q786 590 771 590 H742', hit: [66, 69.7]},
  alm: {x: 25, y: 63, width: 26, height: 24, dot: [497, 741], path: 'M497 741 V706 Q497 678 525 678 H600 Q633 678 633 648 V592', hit: [45, 68]},
};
type Panel = {type: 'project' | 'binding' | 'board'} | {type: 'role'; role: OfficinaParticipant} |
  {type: 'task'; id: string} | {type: 'new'; role?: OfficinaRole} | {type: 'event'; id: string} | {type: 'delete-project'; project: string} |
  {type: 'result'; project: string; task: string; role: OfficinaActor} | {type: 'settings'; role: OfficinaActor} |
  {type: 'chat-message'; project: string; task: string; entry: OfficinaChatEntry} | {type: 'observer'; project: string; review?: string};
type Act = (action: OfficinaAction) => Promise<boolean>;
const forTask = (project: OfficinaProject, task: OfficinaTask) => project.events.filter(event => event.task === task.id);
const transfer = (event: OfficinaEvent) => 'to' in event.data ? event.data.to : undefined;

type Tracking = ReturnType<typeof officinaRoleTracking>;
type Team = Record<OfficinaActor, Tracking>;

function RoleIcon({role}: {role: OfficinaActor}) {
  const Icon = roleIcons[role];
  return <span className="officina-role-icon"><Icon aria-hidden="true"/></span>;
}

type HumanRequest = Extract<OfficinaAttention, {kind: 'request' | 'question'}>;

function RequestBadge({items}: {items: HumanRequest[]}) {
  const first = items[0];
  if (!first) return null;
  const mode = first.kind === 'request' ? first.request.mode : 'question';
  return <span className="officina-request-badge">
    {items.length > 1 ? `! ${items.length} pendientes` :
      mode === 'question' ? '? Responder' : mode === 'review' ? '! Revisar' : '! Aprobar'}
  </span>;
}

function Scene({project, taskTitle, team, animate, open, selected, selectRole, requests}: {requests: (role: OfficinaActor) => HumanRequest[];
  project?: OfficinaProject; taskTitle?: string; team: Team; animate: boolean;
  open: (panel: Panel) => void; selected: OfficinaActor; selectRole: (role: OfficinaActor) => void}) {
  const events = project?.events ?? [];
  const working = roles.filter(role => team[role].state === 'working');
  const manuallyAssigned = new Set(project?.tasks.filter(task => task.status !== 'done' &&
    !project.goals?.some(goal => goal.task === task.id)).map(task => task.owner));
  const resting = roles.filter(role => officinaCanRest(team[role].state) && !manuallyAssigned.has(role));
  const latestHandoff = events.filter(event => event.data.kind === 'handoff').at(-1);
  const previous = useRef(latestHandoff?.id);
  const [pulse, setPulse] = useState<{id: string; path: string; to: OfficinaRole}>();
  const stage = useRef<HTMLDivElement>(null);
  const fullscreenButton = useRef<HTMLButtonElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState('');
  const flightMarker = useRef<SVGCircleElement>(null);
  const paths = useRef<Partial<Record<OfficinaRole, SVGPathElement | null>>>({});
  useEffect(() => {
    if (!animate) {
      previous.current = latestHandoff?.id;
      setPulse(undefined);
      return;
    }
    if (previous.current === latestHandoff?.id) return;
    previous.current = latestHandoff?.id;
    if (latestHandoff?.data.kind !== 'handoff') return;
    const sender = paths.current[latestHandoff.from], receiver = paths.current[latestHandoff.data.to];
    if (!sender || !receiver) return;
    const sample = (path: SVGPathElement, reverse: boolean) => {
      const length = path.getTotalLength();
      return Array.from({length: 25}, (_, index) => {
        const point = path.getPointAtLength(length * (reverse ? 24 - index : index) / 24);
        return `${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
      });
    };
    setPulse({id: latestHandoff.id, to: latestHandoff.data.to,
      path: 'M' + [...sample(sender, false), ...sample(receiver, true)].join(' L')});
  }, [latestHandoff, animate]);
  const flight = animate && pulse?.id === latestHandoff?.id ? pulse : undefined;
  useLayoutEffect(() => {
    // Start on receipt of the event, even if the SVG timeline is already running.
    const marker = flightMarker.current;
    if (!marker) return;
    const start = document.timeline.currentTime;
    marker.querySelectorAll<SVGAnimationElement>('animateMotion, animate').forEach(animation => animation.beginElement());
    const arrival = marker.closest('.officina-scene')?.querySelector('.officina-screen-arrival');
    const [highlight] = arrival?.getAnimations() ?? [];
    if (highlight && start !== null) highlight.startTime = start;
  }, [flight]);
  useEffect(() => {
    const element = stage.current;
    let wasFullscreen = false;
    const syncFullscreen = () => {
      const isFullscreen = document.fullscreenElement === element;
      setFullscreen(isFullscreen);
      if (wasFullscreen || isFullscreen) fullscreenButton.current?.focus({preventScroll: true});
      wasFullscreen = isFullscreen;
    };
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);
  async function toggleFullscreen() {
    const element = stage.current;
    if (!element) return;
    setFullscreenError('');
    try {
      if (document.fullscreenElement === element) await document.exitFullscreen();
      else await element.requestFullscreen({navigationUI: 'hide'});
    } catch {
      setFullscreenError('No se pudo cambiar a pantalla completa.');
    }
  }
  async function openDesk(role: OfficinaActor) {
    if (requests(role).length && document.fullscreenElement === stage.current) await toggleFullscreen();
    selectRole(role);
  }
  async function openConnection(id: string) {
    if (document.fullscreenElement === stage.current) await toggleFullscreen();
    if (!document.fullscreenElement) open({type: 'event', id});
  }
  return <div ref={stage} className="officina-stage" data-animate={animate} onKeyDown={event => {
    if (event.key !== 'Escape' || document.fullscreenElement !== stage.current) return;
    event.preventDefault();
    event.stopPropagation();
    void toggleFullscreen();
  }}><div className="officina-scene" data-animate={animate} aria-label="Plano de Officina">
    <img className="officina-photo" src={officeScene} alt="Siete salas de trabajo abiertas con mamparas de cristal, alrededor de la entrada y el salón común" draggable={false}/>
    <OfficinaCafe/>
    {animate && <OfficinaIdleScene resting={resting}/>}
    <OfficinaScreens team={team} animate={animate} arrival={flight && {id: flight.id, role: flight.to, delay: handoffTravelMs}}/>
    <svg className="officina-paths" viewBox="0 0 1200 1000" aria-hidden="true">
      {roles.map(role => <path key={role} data-state={team[role].state} ref={node => {paths.current[role] = node;}} d={desks[role].path}
        className={events.some(event => event.from === role || transfer(event) === role) ? 'has-event' : undefined}/>)}
      {animate && working.map(role => <path key={`signal-${role}`} className="officina-signal" pathLength="100" d={desks[role].path}/>)}
      {flight && <circle ref={flightMarker} key={flight.id} className="officina-pulse" r="6" opacity="0">
        <animateMotion path={flight.path} begin="indefinite" dur={`${handoffTravelMs}ms`} repeatCount="1"/>
        <animate attributeName="opacity" begin="indefinite" values="0;1;1;0" keyTimes="0;.1;.85;1" dur={`${handoffTravelMs}ms`} repeatCount="1"/>
      </circle>}
    </svg>
    {roles.map(role => {
      const desk = desks[role], activity = team[role];
      const name = officinaActorName(role, project);
      return <button type="button" key={role} className="officina-desk"
        data-role={role} data-state={activity.state}
        style={{'--x': desk.x + '%', '--y': desk.y + '%', width: desk.width + '%', height: desk.height + '%'} as CSSProperties}
        aria-label={name} aria-describedby={`officina-desk-${role}`} aria-pressed={selected === role}
        onClick={() => void openDesk(role)}>
        <span className="officina-desk-label"><RoleIcon role={role}/><span>{name}</span></span>
        <RequestBadge items={requests(role)}/>
        <span className="officina-desk-tooltip" id={`officina-desk-${role}`}>
          {name} · {activity.label ?? officinaTrackingLabels[activity.state]}
        </span>
      </button>;
    })}
    <button type="button" className="officina-table" data-role="coordinator" data-state={team.coordinator.state}
      aria-label={officinaActorName('coordinator', project)} aria-pressed={selected === 'coordinator'}
      aria-describedby={taskTitle ? 'officina-coordination-task' : undefined} title={taskTitle} onClick={() => void openDesk('coordinator')}>
      {taskTitle && <span className="officina-coordination-task" id="officina-coordination-task">{taskTitle}</span>}
      <span className="officina-desk-label"><RoleIcon role="coordinator"/><span>{officinaActorName('coordinator', project)}</span></span>
      <RequestBadge items={requests('coordinator')}/>
    </button>
    <button type="button" className="officina-observer-marker" data-role="observer" data-state={team.observer.state}
      aria-label="ZEN · Observador" aria-pressed={selected === 'observer'} onClick={() => selectRole('observer')}>
      <span className="officina-desk-label"><RoleIcon role="observer"/><span>ZEN</span></span>
    </button>
    {roles.map(role => {
      const desk = desks[role];
      const event = events.filter(({from, data}) => {
        if (data.kind === 'question' || data.kind === 'handoff') return from === role || data.to === role;
        if (data.kind === 'answer') return from === role || events.some(question => question.id === data.replyTo && question.from === role);
        return false;
      }).at(-1);
      return <React.Fragment key={role}>
        <span className="officina-node" data-state={team[role].state}
          style={{left: desk.dot[0] / 12 + '%', top: desk.dot[1] / 10 + '%'}} aria-hidden="true"/>
        {event && <button type="button" className="officina-wire"
          style={{left: desk.hit[0] + '%', top: desk.hit[1] + '%'}}
          title={officinaEventLabels[event.data.kind] + ' · ' + event.data.text}
          aria-label={`Ver ${officinaEventLabels[event.data.kind].toLowerCase()} en conexión de ${officinaActorName(role, project)}`}
          onClick={() => void openConnection(event.id)}/>}
      </React.Fragment>;
    })}
    <div className="officina-stage-actions">
      {fullscreenError && <span role="alert">{fullscreenError}</span>}
      <button ref={fullscreenButton} className="officina-fullscreen-button" type="button"
        title={fullscreen ? 'Salir de pantalla completa (Esc)' : 'Pantalla completa'}
        aria-label={fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
        onClick={() => void toggleFullscreen()}>
        {fullscreen ? <Minimize2 aria-hidden="true"/> : <Maximize2 aria-hidden="true"/>}
      </button>
    </div>
  </div></div>;
}

function Modal({children, title, close, wide}: {children: ReactNode; title: string; close: () => void; wide?: boolean}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const element = dialog.current;
    const origin = document.activeElement;
    element?.showModal();
    return () => {
      element?.close();
      if (origin instanceof HTMLElement && origin.isConnected) origin.focus({preventScroll: true});
    };
  }, []);
  return <dialog ref={dialog} className="officina-modal" data-wide={wide || undefined} aria-labelledby="officina-modal-title"
    onCancel={event => { event.preventDefault(); event.stopPropagation(); close(); }}
    onKeyDown={event => {if (event.key === 'Escape') event.stopPropagation();}}>
    <header><h2 id="officina-modal-title">{title}</h2><button aria-label="Cerrar ficha" onClick={close}><X/></button></header>
    {children}
  </dialog>;
}

function SelectRole({name, initial, project}: {name: string; initial?: OfficinaRole; project: OfficinaProject}) {
  return <select name={name} defaultValue={initial} data-hold-island-open>
    {roles.map(role => <option key={role} value={role}>{officinaActorName(role, project)}</option>)}
  </select>;
}

function TaskForm({project, task, role, act, done}: {project: OfficinaProject; task?: OfficinaTask; role?: OfficinaRole; act: Act; done: () => void}) {
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const fields = {title: String(form.get('title')), objective: String(form.get('objective')),
      criteria: String(form.get('criteria')), owner: form.get('owner') as OfficinaRole};
    const ok = await act(task ? {type: 'edit', project: project.id, task: task.id, fields, status: form.get('status') as OfficinaTaskStatus} :
      {type: 'task', project: project.id, fields, dispatch: form.has('dispatch')});
    if (ok) done();
  }
  return <form className="officina-form" onSubmit={save}>
    <label>Título<input name="title" required maxLength={120} defaultValue={task?.title} data-hold-island-open/></label>
    <label>Objetivo<textarea name="objective" required maxLength={800} defaultValue={task?.objective} data-hold-island-open/></label>
    <label>Criterios de aceptación<textarea name="criteria" required maxLength={800} defaultValue={task?.criteria} data-hold-island-open/></label>
    <label>Responsable<SelectRole name="owner" project={project} initial={task?.owner ?? role}/></label>
    {task ? <label>Estado<select name="status" defaultValue={task.status} data-hold-island-open>
      {Object.entries(officinaTaskLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
    </select></label> : <label className="officina-check"><input name="dispatch" type="checkbox"/> Poner el encargo en cola</label>}
    <button className="officina-accent" type="submit">{task ? 'Guardar cambios' : 'Crear tarea'}</button>
  </form>;
}

function OfficinaResponse({text, markdown, project, task, act}: {
  text: string; markdown?: string; project: string; task?: string; act: Act;
}) {
  const readable = markdown ?? formatNoteMarkdown(text.replace(/(^|(?<=[.!?]) )((?:Fortalezas?|Prioridad(?: \d+)?|Riesgos?|Limitaciones?):) /g,
    (_match, preceding, label) => `${preceding ? '\n\n' : ''}**${label}** `));
  const [copyStatus, setCopyStatus] = useState('');
  return <>
    <div className="officina-report-actions">
      <button type="button" onClick={async () => {
        const result = await window.companion.copy(markdown ?? text);
        setCopyStatus(result.ok ? 'Copiado' : result.error);
      }}><Copy aria-hidden="true"/>Copiar informe</button>
      {copyStatus && <small role="status">{copyStatus}</small>}
    </div>
    <OfficinaMarkdown text={readable} project={project} task={task} act={act}/>
  </>;
}

function EventDetail({event, events, project, act, showTitle = true}: {
  event: OfficinaEvent; events: OfficinaEvent[]; project: OfficinaProject; act: Act; showTitle?: boolean;
}) {
  const {data} = event;
  const related = 'replyTo' in data && events.find(item => item.id === data.replyTo);
  const to = transfer(event);
  return <article className="officina-event">
    {showTitle && <strong>{officinaEventLabels[data.kind]} · {officinaActorName(event.from, project)}
      {to ? ` → ${officinaActorName(to, project)}` : ''}</strong>}
    <small>{event.source === 'codex' ? 'Codex' : 'Registro manual'} · {new Date(event.at).toLocaleString('es-ES')}</small>
    {related && <small>{officinaEventLabels[related.data.kind]} · {related.data.text}</small>}
    {event.source === 'codex' ? <OfficinaResponse text={data.text} markdown={data.markdown} project={project.id}
      task={event.task} act={act}/> : <p>{data.text}</p>}
    {data.kind === 'handoff' && <dl><dt>Versión</dt><dd>{data.artifact.version}</dd><dt>Entregable</dt>
      <dd><OfficinaReference target={data.artifact.link} project={project.id} task={event.task} act={act}>
        {data.artifact.link}
      </OfficinaReference></dd>
      <dt>Siguiente paso</dt><dd>{data.artifact.next}</dd></dl>}
    {data.kind === 'qa' && <p><strong>{data.passed ? 'Validado' : 'Incidencia'}</strong> · {data.evidence}</p>}
  </article>;
}

function ResultButton({project, task, role, open}: {
  project: OfficinaProject; task: string; role: OfficinaActor; open: (panel: Panel) => void;
}) {
  const results = officinaResults(project, task, role);
  if (!results.length) return null;
  const available = results.some(item => item.event || item.message);
  const label = available ? 'Ver resultado' : 'Consultar resultado';
  return <button className={available ? 'officina-result-button officina-accent' : 'officina-result-button'}
    aria-label={`${label} de ${officinaActorName(role, project)}`}
    onClick={() => open({type: 'result', project: project.id, task, role})}>{label}<ArrowRight aria-hidden="true"/></button>;
}

function ResultDetail({project, task, role, act}: {project: OfficinaProject; task: string; role: OfficinaActor; act: Act}) {
  return <div className="officina-results">
    <p className="officina-result-context">{project.name} · {project.tasks.find(item => item.id === task)?.title}</p>
    <ResultList results={officinaResults(project, task, role).reverse()} events={project.events.filter(event => event.task === task)}
      project={project} task={task} act={act}/>
  </div>;
}

function ResultList({results, events, project, task, act}: {
  results: OfficinaResult[]; events: OfficinaEvent[]; project: OfficinaProject; task: string; act: Act;
}) {
  return results.map(({run, event, message}, index) => {
    const content = <div className="officina-result-entry">
      {event ? <EventDetail event={event} events={events} project={project} act={act} showTitle={false}/> : message ?
        <OfficinaResponse text={message.text} markdown={message.markdown} project={project.id} task={task} act={act}/> :
        <p>La respuesta de este encargo no está disponible en Officina.</p>}
      {run?.destination && run.sentAt !== undefined && <button onClick={() =>
        void act({type: 'open-run-chat', project: project.id, task, run: run.id})}>Abrir en Codex <ArrowRight aria-hidden="true"/></button>}
    </div>;
    const key = run?.id ?? event?.id ?? index;
    if (results.length === 1) return <React.Fragment key={key}>{content}</React.Fragment>;
    const label = event ? officinaEventLabels[event.data.kind] : message?.reply?.kind === 'plan' ? 'Asignación' :
      message?.reply?.kind === 'request' ? 'Solicitud de decisión' : message ? 'Respuesta' : 'Respuesta en Codex';
    return <details className="officina-result-fold" key={key}>
      <summary><strong>{label}</strong><span>{event?.data.text ?? message?.text}</span></summary>{content}
    </details>;
  });
}

function TaskDetail({project, task, activity, approvals, act}: {
  project: OfficinaProject; task: OfficinaTask; activity?: OfficinaRunActivity; approvals: CompanionApproval[]; act: Act;
}) {
  const events = forTask(project, task), runs = project.runs.filter(run => run.task === task.id);
  const open = task.status === 'done' ? [] : officinaOpenItems(events);
  const goal = project.goals?.find(item => item.task === task.id);
  const attention = officinaAttention(project, activity, task.id);
  const participants = new Set<OfficinaActor>([...runs.map(run => run.role), ...events.map(item => item.from),
    ...(goal?.steps.map(step => step.role) ?? [])]);
  const team = OfficinaParticipant.options.filter(role => participants.has(role) || !participants.size && task.owner === role);
  const qa = officinaQa(events, task.id);
  const conclusion = goal?.outcome === 'limited' && goal.history.at(-1);
  return <>
    {attention && <OfficinaAttentionCard item={attention} project={project} approvals={approvals} act={act}/>}
    {goal && task.status !== 'done' && <GoalContinuation project={project} goal={goal} act={act}/>}
    <section className="officina-agent-work" aria-label="Equipo del encargo">
      <h3>Equipo del encargo</h3>
      {team.map(role => {
        const results = officinaResults(project, task.id, role).reverse();
        const represented = new Set(results.flatMap(item => item.event ? [item.event.id] : []));
        const additional = events.filter(item => item.from === role && !represented.has(item.id)).reverse();
        const plans = role === 'coordinator' ? goal?.history.filter(item => item.reply?.kind === 'plan').slice().reverse() ?? [] : [];
        const contributions: OfficinaResult[] = [...results.filter(item => item.run || item.event || item.message),
          ...additional.map(event => ({event})), ...plans.map(message => ({message}))];
        const latest = contributions.find(item => item.event || item.message);
        const roleRuns = runs.filter(run => run.role === role);
        const run = roleRuns.at(-1);
        const state = run ? officinaRunTracking(run, activity) : latest ? 'done' : task.status === 'done' ? 'skipped' : 'scheduled';
        const summary = latest?.event?.data.text ?? latest?.message?.text;
        const runtimeIssues = roleRuns.filter(turn => turn.state === 'sent' || turn.state === 'uncertain' || turn.issue && turn.id !== run?.id);
        return <details key={role} className="officina-agent-group">
          <summary>
            <RoleIcon role={role}/>
            <span className="officina-agent-summary">
              <strong>{officinaActorName(role, project)}</strong>
              {summary && <span>{summary}</span>}
            </span>
            <span className="officina-agent-state" data-state={state}>{officinaTrackingLabels[state]}</span>
            <ChevronRight className="officina-agent-chevron" aria-hidden="true"/>
          </summary>
          <div className="officina-agent-contributions">
            {contributions.length ? <ResultList results={contributions} events={events} project={project} task={task.id} act={act}/> :
              <p>{state === 'done' || state === 'review' ? 'La respuesta de este encargo no está disponible en Officina.' :
                'Aún no hay aportaciones de este puesto.'}</p>}
            {run?.issue && <p>{run.issue}</p>}
            {runtimeIssues.map(turn => <details key={turn.id}>
              <summary>{officinaRunLabels[turn.state]}</summary>
              {turn.id !== run?.id && turn.issue && <p>{turn.issue}</p>}
              {(turn.state === 'sent' || turn.state === 'uncertain') && <>
                {turn.destination && <button type="button" onClick={() => void act({type: 'open-run-chat', project: project.id, task: task.id, run: turn.id})}>
                  Revisar en Codex <ArrowRight aria-hidden="true"/>
                </button>}
                <details><summary>Revisé el chat de Codex</summary>
                  <button type="button" onClick={() => void act({type: 'release', project: project.id, run: turn.id})}>
                    Liberar el turno y detener la cola
                  </button>
                </details>
              </>}
            </details>)}
          </div>
        </details>;
      })}
    </section>
    <details><summary>Detalles del encargo</summary>
      <div className="officina-task-fields">
        <p>{officinaTaskLabels[task.status]}</p>
        {task.objective !== task.title && <p>{task.objective}</p>}
        <h3>Criterios de aceptación</h3><p>{task.criteria}</p>
        {qa && <p>{qa}</p>}
        {conclusion && conclusion.from === 'zen' && !events.some(event => event.data.text === conclusion.text) && <p>{conclusion.text}</p>}
        {open.map(item => <p className="officina-attention" key={item.id}>{officinaEventLabels[item.data.kind]} · {item.data.text}</p>)}
      </div>
    </details>
    {!!goal?.steps.length && <details><summary>Pasos del encargo</summary>
      <ol className="officina-goal-steps">{goal.steps.map((step, index) => {
        const run = runs.filter(item => item.step === index).at(-1);
        return <li key={index}><strong>{officinaActorName(step.role, project)}</strong> {step.instruction}
          <small>{open.some(item => item.data.kind === 'blocker' && item.from === step.role) && goal.cursor === index ?
            officinaTrackingLabels.blocked : officinaTrackingLabels[run ? officinaRunTracking(run, activity) :
              task.status === 'done' ? 'skipped' : 'scheduled']}</small></li>;
      })}</ol>
    </details>}
    <details><summary>Editar tarea</summary><TaskForm key={JSON.stringify(task)} project={project} task={task} act={act}
      done={() => {}}/></details>
    {task.status !== 'done' && <details><summary>Asignar un encargo</summary><form className="officina-form" onSubmit={event => {
      event.preventDefault();
      void act({type: 'assign', project: project.id, task: task.id, role: new FormData(event.currentTarget).get('role') as OfficinaRole});
    }}><label>Puesto<SelectRole name="role" project={project} initial={task.owner}/></label><button type="submit">Poner en cola</button></form></details>}
  </>;
}

function PanelContent({panel, project, team, activity: observed, observerQueued, approvals, act, open, close}: {
  panel: Panel; project?: OfficinaProject; team: Team; activity?: OfficinaRunActivity; approvals: CompanionApproval[];
  observerQueued?: string[];
  act: Act; open: (panel: Panel) => void; close: () => void;
}) {
  if (panel.type === 'project') return <form className="officina-form" onSubmit={async event => {
    event.preventDefault();
    if (await act({type: 'project', name: String(new FormData(event.currentTarget).get('name'))})) close();
  }}><label>Nombre del proyecto<input name="name" required maxLength={120} data-hold-island-open/></label>
    <button type="submit" className="officina-accent">Crear proyecto</button></form>;
  if (panel.type === 'settings') return <OfficinaRoleSettings key={project?.id} project={project} initialRole={panel.role} act={act}/>;
  if (panel.type === 'delete-project') {
    if (project?.id !== panel.project) return <p>El proyecto visible cambió.</p>;
    return <>
      <p>Se eliminarán «{project.name}», sus tareas y sus resultados guardados en Officina.</p>
      <p>Se conservarán el proyecto y sus chats en Codex, la carpeta de trabajo y los archivos adjuntos.</p>
      {project.runs.some(run => ['sending', 'sent', 'uncertain'].includes(run.state)) &&
        <p>Los encargos que ya hayan llegado a Codex continuarán allí.</p>}
      <div className="officina-project-actions">
        <button type="button" onClick={close}>Cancelar</button>
        <button type="button" className="officina-danger" onClick={async () => {
          if (await act({type: 'delete-project', project: panel.project})) close();
        }}>Eliminar de Officina</button>
      </div>
    </>;
  }
  if (!project) return <button className="officina-accent" onClick={() => open({type: 'project'})}>Crear proyecto</button>;
  if (panel.type === 'observer') return panel.project === project.id ?
    <OfficinaObserverPanel project={project} act={act} initialReview={panel.review} activity={observed} queued={observerQueued}
      openTask={id => open({type: 'task', id})}/> : null;
  if (panel.type === 'result') return panel.project === project.id ?
    <ResultDetail project={project} task={panel.task} role={panel.role} act={act}/> : null;
  if (panel.type === 'chat-message') {
    if (panel.project !== project.id) return null;
    const {entry, task} = panel;
    const runId = 'event' in entry ? entry.event.id : entry.message.reply?.run;
    const run = project.runs.find(item => item.task === task && item.id === runId);
    return <div className="officina-results">
      <p className="officina-result-context">{project.tasks.find(item => item.id === task)?.title} · {chatEntryLabel(entry, project)}</p>
      {'event' in entry ? <EventDetail event={entry.event} events={project.events} project={project} act={act} showTitle={false}/> :
        <OfficinaResponse text={entry.message.text} markdown={entry.message.markdown} project={project.id} task={task} act={act}/>}
      {run?.destination && run.sentAt !== undefined && <button className="officina-message-source" onClick={() =>
        void act({type: 'open-run-chat', project: project.id, task, run: run.id})}>Abrir en Codex <ArrowRight aria-hidden="true"/></button>}
    </div>;
  }
  if (panel.type === 'binding') return <form className="officina-form" onSubmit={async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (await act({type: 'bind', project: project.id, binding: {
      thread: String(form.get('thread')), cwd: String(form.get('cwd')), environment: String(form.get('environment')),
    }})) close();
  }}>
    <p>Usa un chat de Codex dedicado a este proyecto. Codex aplicará sus permisos vigentes.</p>
    <label>ID del chat<input name="thread" required maxLength={36} defaultValue={project.binding?.thread} data-hold-island-open/></label>
    <label>Carpeta del proyecto<input name="cwd" required maxLength={1024} defaultValue={project.binding?.cwd} data-hold-island-open/></label>
    <label>Entorno o contexto<input name="environment" required maxLength={120} defaultValue={project.binding?.environment} data-hold-island-open/></label>
    <button type="submit" className="officina-accent">Vincular chat</button>
  </form>;
  if (panel.type === 'new') return <TaskForm project={project} role={panel.role} act={act} done={close}/>;
  if (panel.type === 'event') {
    const event = project.events.find(item => item.id === panel.id);
    if (!event) return null;
    return <><EventDetail event={event} events={project.events} project={project} act={act}/>
      <button onClick={() => open({type: 'task', id: event.task})}>Ver tarea <ArrowRight/></button></>;
  }
  if (panel.type === 'task') {
    const task = project.tasks.find(item => item.id === panel.id);
    return task ? <TaskDetail key={task.id} project={project} task={task} activity={observed} approvals={approvals} act={act}/> : null;
  }
  const role = panel.type === 'role' ? panel.role : undefined;
  const worker = role === 'coordinator' ? undefined : role;
  const activity = role ? team[role] : undefined;
  const routine = worker ? officinaIdleRoutines[worker] : undefined;
  const tasks = role ? project.tasks.filter(task => task.owner === role ||
    project.runs.some(run => run.task === task.id && run.role === role) ||
    project.events.some(event => event.task === task.id && (event.from === role || transfer(event) === role)) ||
    (role === 'alm' && project.events.some(event => event.task === task.id && (event.data.kind === 'qa' || event.data.kind === 'handoff')))) : project.tasks;
  return <>
    {activity && activity.state !== 'idle' && <div className="officina-role-detail" data-state={activity.state}>
      <TrackingLabel activity={activity}/>
      {activity.detail && <p>{activity.detail}</p>}
      {activity.task && <button onClick={() => open({type: 'task', id: activity.task!})}>Ver encargo <ArrowRight/></button>}
      {activity.task && role && <ResultButton project={project} task={activity.task} role={role} open={open}/>}
    </div>}
    {routine && <p className="officina-routine"><strong>{routine.personality}</strong> · {routine.action} cuando está libre.</p>}
    {role && project.team?.threads[role] && <button onClick={() => void act({type: 'open-team-chat', project: project.id, role})}>
      Abrir chat del puesto en Codex <ArrowRight/>
    </button>}
    {role !== 'coordinator' && <button className="officina-accent" onClick={() => open({type: 'new', role: worker})}><Plus/> Nueva tarea</button>}
    {worker && <details><summary>Asignar una tarea del proyecto</summary><form className="officina-form" onSubmit={event => {
      event.preventDefault();
      const task = String(new FormData(event.currentTarget).get('task'));
      void act({type: 'assign', project: project.id, task, role: worker});
    }}><label>Tarea<select required name="task" data-hold-island-open><option value="">Selecciona una tarea</option>
      {project.tasks.filter(task => task.status !== 'done').map(task => <option key={task.id} value={task.id}>{task.title}</option>)}
    </select></label><button type="submit">Poner en cola</button></form></details>}
    {tasks.length ? <div className="officina-task-list">{tasks.slice().reverse().map(task =>
      <button key={task.id} onClick={() => open({type: 'task', id: task.id})}><span>
        <strong>{task.title}</strong>
        <small>{role === 'alm' ? officinaQa(project.events, task.id) : `${officinaActorName(task.owner, project)} · ${officinaTaskLabels[task.status]}`}</small>
      </span><ArrowRight/></button>)}</div> : <p>Sin tareas asignadas.</p>}
  </>;
}

function TrackingLabel({activity}: {activity: Tracking}) {
  return <span className="officina-tracking-label"><i aria-hidden="true"/>{activity.label ?? officinaTrackingLabels[activity.state]}</span>;
}

function directTracking(activity: OfficinaDirectActivity): Tracking {
  if (activity.state === 'finished') return {state: 'done', label: 'Resultado en Codex'};
  return {state: activity.state};
}

function DirectChatButton({project, role, activity, act}: {
  project: string; role: OfficinaActor; activity: OfficinaDirectActivity; act: Act;
}) {
  return <button onClick={() => void act({type: 'open-team-chat', project, role})}>
    {activity.state === 'finished' ? 'Ver en Codex' : 'Abrir chat en Codex'} <ArrowRight aria-hidden="true"/>
  </button>;
}

function DeskActivity({project, task, role, activity, open, decision}: {project?: OfficinaProject; task?: OfficinaTask; role: OfficinaParticipant;
  activity: Tracking; open: (panel: Panel) => void; decision?: ReactNode}) {
  const name = officinaActorName(role, project);
  return <section className="officina-desk-activity" aria-label={`Actividad de ${name}`}>
    <header>
      <div><RoleIcon role={role}/><h2>{name}</h2></div>
      <div>
        <button onClick={() => open({type: 'settings', role})}><Settings2 aria-hidden="true"/>Editar puesto</button>
        {project && <button onClick={() => open(role === 'coordinator' ? {type: 'board'} : {type: 'role', role})}>
          {role === 'coordinator' ? 'Tablero del proyecto' : 'Ficha del puesto'}
        </button>}
      </div>
    </header>
    {decision}
    {project && task ? <>
      <div className="officina-desk-task">
        <TrackingLabel activity={activity}/>
        {role === 'coordinator' && <button onClick={() => open({type: 'task', id: task.id})}>Ver equipo</button>}
        {role !== 'coordinator' && activity.task === task.id && <>
          <button onClick={() => open({type: 'task', id: task.id})}>Ver tarea</button>
          <ResultButton project={project} task={task.id} role={role} open={open}/>
        </>}
      </div>
    </> : <p>{project ? 'Sin encargos para este puesto.' : 'Selecciona o crea un proyecto para empezar.'}</p>}
  </section>;
}

function ProjectFolder({project, act}: {project: OfficinaProject; act: Act}) {
  const [copied, setCopied] = useState(false);
  return <div className="officina-project-folder">
    <button onClick={() => void act({type: 'open-team-project', project: project.id})}>
      Abrir carpeta en Codex <ArrowRight aria-hidden="true"/>
    </button>
    <details>
      <summary>Añadir a Proyectos de Codex</summary>
      <p>En Codex, pulsa <strong>+</strong> junto a <strong>Proyectos</strong>, elige <strong>Local</strong> y añade la carpeta existente como carpeta de origen.</p>
      <button onClick={async () => setCopied(await act({type: 'copy-team-project-path', project: project.id}))}>
        Copiar ruta de la carpeta
      </button>
      {copied && <small role="status">Ruta copiada</small>}
    </details>
  </div>;
}

const chatEntryActor = (entry: OfficinaChatEntry) => 'event' in entry ? entry.event.from :
  entry.message.from === 'codex' ? entry.message.reply?.role ?? 'coordinator' : undefined;
function chatEntryAuthor(entry: OfficinaChatEntry, project: OfficinaProject) {
  const actor = chatEntryActor(entry);
  return actor ? officinaActorName(actor, project) : 'Officina';
}
function chatEntryLabel(entry: OfficinaChatEntry, project: OfficinaProject) {
  if ('event' in entry) {
    const {data} = entry.event;
    if (data.kind === 'handoff') return `Traspaso a ${officinaActorName(data.to, project)}`;
    if (data.kind === 'qa') return data.passed ? 'QA aprobada' : 'Incidencia de QA';
    return data.kind === 'decision' ? 'Decisión' : data.kind === 'progress' ? 'Resultado' : officinaEventLabels[data.kind];
  }
  if (entry.conclusion) return 'Conclusión';
  if (entry.message.reply?.kind === 'question') return 'Pregunta';
  if (entry.message.reply?.kind === 'request') return 'Solicitud de decisión';
  if (entry.message.reply?.kind === 'complete') return 'Resultado';
  return 'Asignación';
}

function ChatEntry({entry, goal, project, open, act}: {
  entry: OfficinaChatEntry; goal: OfficinaGoal; project: OfficinaProject; open: (panel: Panel) => void; act: Act;
}) {
  if ('message' in entry && entry.message.from === 'human') return <li className="officina-chat-row" data-from="human">
    <div className="officina-chat-author"><strong>Tú</strong>
      {entry.first && <small>Para {officinaActorName(goal.recipient ?? 'coordinator', project)}</small>}</div>
    <div className="officina-chat-message">
      <p>{entry.message.text}</p>
      {entry.first && !!goal.files?.length && <ul className="officina-goal-files" aria-label="Archivos adjuntos">
        {goal.files.map(file => <li key={file.id} title={file.path}><Paperclip aria-hidden="true"/>{file.name}</li>)}
      </ul>}
      {entry.first && !!goal.images?.length && <ul className="officina-goal-files" aria-label="Imágenes adjuntas">
        {goal.images.map(image => <li key={image.id}>
          <ImageIcon aria-hidden="true"/>
          <OfficinaReference project={project.id} task={goal.task} target={image.path} act={act}>{image.name}</OfficinaReference>
        </li>)}
      </ul>}
      {entry.first && goal.pastedText && <details className="officina-paste-history">
        <summary><FileText aria-hidden="true"/>Texto pegado · {officinaPasteTitle(goal.pastedText)}</summary>
        <pre tabIndex={0}>{goal.pastedText}</pre>
      </details>}
    </div>
  </li>;
  const actor = chatEntryActor(entry), author = chatEntryAuthor(entry, project), label = chatEntryLabel(entry, project);
  const text = ('event' in entry ? entry.event.data.text : entry.message.text).trim().replace(/\s+/gu, ' ');
  const boundary = text.lastIndexOf(' ', 250);
  const summary = text.length > 250 ? `${text.slice(0, boundary > 200 ? boundary : 250).replace(/[\uD800-\uDBFF]$/u, '')}…` : text;
  return <li className="officina-chat-row" data-role={actor}>
    {actor ? <RoleIcon role={actor}/> : <span className="officina-role-icon"><MessageSquare aria-hidden="true"/></span>}
    <div className="officina-chat-row-content">
      <div className="officina-chat-author"><strong>{author}</strong><small>{label}</small></div>
      <button className="officina-chat-message" data-conclusion={'message' in entry && entry.conclusion || undefined}
        aria-label={`Ver mensaje de ${author} · ${label}`} aria-description={summary}
        onClick={() => open({type: 'chat-message', project: project.id, task: goal.task, entry})}>
        <span>{summary}</span><ChevronRight aria-hidden="true"/>
      </button>
    </div>
  </li>;
}

function GoalContinuation({project, goal, act}: {project: OfficinaProject; goal: OfficinaGoal; act: Act}) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const request = goal.humanRequest;
  if (request) {
    const question = request.mode === 'question';
    const origin = project.runs.find(run => run.id === request.run);
    const next = origin?.role === 'coordinator' ? 'coordinator' : goal.steps[goal.cursor + 1]?.role ?? 'coordinator';
    const send = async (decision: 'approve' | 'request-changes' | 'respond', message?: string) => {
      setBusy(true);
      try {
        await act({type: 'resolve-request', project: project.id, task: goal.task, run: request.run, decision, message});
      } finally {
        setBusy(false);
      }
    };
    return <form key={request.run} className="officina-form officina-continuation" aria-label="Decisión de Officina" onSubmit={event => {
      event.preventDefault();
      const message = String(new FormData(event.currentTarget).get('answer')).trim();
      if (message) void send(question ? 'respond' : 'request-changes', message);
    }}>
      <p><strong>{request.text}</strong></p>
      <small>{question ? 'Tu respuesta vuelve al puesto solicitante.' :
        `Al aprobar, continúa ${officinaActorName(next, project)}. Si pides cambios, se retoma el paso actual.`}</small>
      {request.markdown && <details>
        <summary>Ver propuesta y evidencia</summary>
        <OfficinaMarkdown text={request.markdown} project={project.id} task={goal.task} act={act}/>
      </details>}
      {(question || editing) && <label>{question ? 'Tu respuesta' : 'Indica qué quieres cambiar'}
        <textarea name="answer" required maxLength={700} data-hold-island-open/>
      </label>}
      <div className="officina-next-actions">
        {!question && <button disabled={busy} type="button" className="officina-accent" onClick={() => void send('approve')}>Aprobar y continuar</button>}
        {question || editing ? <button disabled={busy} type="submit">{question ? 'Enviar respuesta' : 'Enviar cambios'}</button> :
          <button type="button" disabled={busy} onClick={() => setEditing(true)}>Pedir cambios</button>}
      </div>
    </form>;
  }
  if (!goal.question || officinaClosureRetry(project, goal.task)) return null;
  const browserReview = goal.phase === 'plan' && isOfficinaTabReview(officinaGoalRequest(goal), officinaGoalBrowser(project, goal));
  const asked = officinaAskedQuestion(goal);
  return <form className="officina-form officina-continuation" onSubmit={async event => {
    event.preventDefault();
    const form = event.currentTarget;
    if (await act({type: 'answer-goal', project: project.id, task: goal.task,
      message: String(new FormData(form).get('answer'))})) form.reset();
  }}>
    <p>{goal.question}</p>
    {browserReview && <button type="button" className="officina-accent"
      onClick={() => void act({type: 'resume-browser-review', project: project.id, task: goal.task})}>
      Asignar revisión al Analista
    </button>}
    <label>{asked ? 'Respuesta para Coordinación' : 'Indica cómo retomar el encargo'}
      <textarea name="answer" required maxLength={700} data-hold-island-open/>
    </label>
    <button type="submit">{asked ? 'Enviar respuesta' : 'Continuar objetivo'}</button>
  </form>;
}

function ProjectChat({view, task, act, open, attention, controls}: {
  view?: OfficinaView; task?: OfficinaTask;
  act: Act; open: (panel: Panel) => void; attention: ReactNode; controls: ReactNode;
}) {
  const project = view?.project;
  const goal = project?.goals?.find(goal => goal.task === task?.id && !goal.improvement);
  const teamSize = OfficinaParticipant.options.filter(role => project?.team?.threads[role]).length;
  const total = OfficinaParticipant.options.length;
  return <section className="officina-chat" aria-label="Chat global">
    <header className="officina-chat-toolbar">
      <div className="officina-chat-heading">
        <MessageSquare aria-hidden="true"/>
        <h2>{task ? 'Conversación' : 'Chat global'}</h2>
        {task && <button onClick={() => open({type: 'task', id: task.id})}>Ver tarea <ArrowRight aria-hidden="true"/></button>}
      </div>
      {attention && <div className="officina-chat-notice">{attention}</div>}
      {project && OfficinaParticipant.options.some(role => view?.directActivity?.[role]) &&
        <details className="officina-project-tools officina-direct-activity">
          <summary>Actividad directa en Codex</summary>
          {OfficinaParticipant.options.map(role => {
            const activity = view.directActivity?.[role];
            return activity && <div className="officina-project-actions" key={role}>
              <strong>{officinaActorName(role, project)}</strong>
              <span data-state={directTracking(activity).state}><TrackingLabel activity={directTracking(activity)}/></span>
              <DirectChatButton project={project.id} role={role} activity={activity} act={act}/>
            </div>;
          })}
        </details>}
    </header>
    <div className="officina-chat-scroll" key={`${project?.id}-${task?.id}`}>
      <div className="officina-chat-content">
        {project && goal ? <GoalConversation project={project} goal={goal} activity={view?.activity} act={act} open={open}/> :
          <p className="officina-empty-chat">{task ? 'Consulta los resultados de este encargo en Equipo.' : 'Aún no hay encargos en este proyecto.'}</p>}
        <footer className="officina-chat-tools">
          {project?.team && <details className="officina-project-tools">
            <summary>Chats en Codex <span>{teamSize === total ? `${teamSize} chats vinculados` : `${teamSize} de ${total} chats vinculados`}</span></summary>
            {project.team.projectId && project.team.cwd && <ProjectFolder project={project} act={act}/>}
            {project.team.projectId && <div className="officina-chat-team" aria-label="Chats del proyecto en Codex">
              {OfficinaParticipant.options.filter(role => project.team?.threads[role]).map(role =>
                <button key={role} data-role={role} onClick={() => void act({type: 'open-team-chat', project: project.id, role})}>
                  {officinaActorName(role, project)} <ArrowRight aria-hidden="true"/>
                </button>)}
            </div>}
          </details>}
          {controls}
        </footer>
      </div>
    </div>
  </section>;
}

function GoalConversation({project, goal, activity, act, open}: {
  project: OfficinaProject; goal: OfficinaGoal; activity?: OfficinaRunActivity; act: Act; open: (panel: Panel) => void;
}) {
  const task = project.tasks.find(item => item.id === goal.task);
  const closed = goal.phase === 'complete' || task?.status === 'done';
  const runs = project.runs.filter(run => run.task === goal.task);
  const active = closed ? undefined : runs.find(run => ['sending', 'sent', 'uncertain'].includes(run.state)) ??
    runs.find(run => run.state === 'waiting');
  const state = active && officinaRunTracking(active, activity);
  const blocker = officinaOpenItems(project.events.filter(event => event.task === goal.task))
    .filter(event => event.data.kind === 'blocker').at(-1);
  const browserReview = isOfficinaTabReview(officinaGoalRequest(goal), officinaGoalBrowser(project, goal));
  return <article className="officina-goal" aria-label="Conversación del encargo">
    {closed ? <p className="officina-current" data-state={goal.outcome === 'limited' ? 'limited' : 'done'}>
      <span>{goal.outcome === 'limited' ? 'Cerrado con limitaciones' : 'Objetivo completado'}</span>
    </p> : active && state && <p className="officina-current" data-state={state} role="status">
      <strong>{officinaActorName(active.role, project)}</strong><TrackingLabel activity={{state}}/>
    </p>}
    <ol className="officina-chat-thread" aria-label="Mensajes del encargo">
      {officinaChatEntries(project, goal).filter(entry => 'event' in entry || entry.message.from !== 'zen')
        .map(entry => <ChatEntry key={entry.key} entry={entry} goal={goal} project={project} open={open} act={act}/>)}
    </ol>
    {blocker?.source === 'user' && !closed && <p className="officina-attention">{officinaEventLabels.blocker} · {blocker.data.text}</p>}
    {browserReview && blocker?.from === 'analyst' && (goal.phase === 'work' || goal.outcome === 'limited') &&
      goal.steps[goal.cursor]?.role === 'analyst' && !active &&
      <button onClick={() => void act({type: 'resume-browser-review', project: project.id, task: goal.task})}>Reintentar con la extensión</button>}
    {!closed && <GoalContinuation project={project} goal={goal} act={act}/>}
  </article>;
}

export function OfficinaWorkspace({motion, approvals = [], glanceItems, openDecisionOnEntry}: {
  motion: boolean; approvals?: CompanionApproval[];
  glanceItems?: import('../shared/companion-officina').OfficinaGlanceItem[];
  openDecisionOnEntry?: boolean;
}) {
  const [view, setView] = useState<OfficinaView>();
  const [panel, setPanel] = useState<Panel>();
  const [error, setError] = useState('');
  const [hidden, setHidden] = useState(document.hidden);
  const [chat, setChat] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const mapToggle = useRef<HTMLButtonElement>(null);
  const [taskSelections, setTaskSelections] = useState<Record<string, string>>({});
  const [selection, setSelection] = useState<{project?: string; role: OfficinaActor}>();
  const [decisionStatus, setDecisionStatus] = useState('');
  const project = view?.project;
  const task = project && officinaFocusedTask(project, taskSelections[project.id]);
  const focusTask = (projectId: string, taskId: string) => {
    setTaskSelections(selections => selections[projectId] === taskId ? selections : {...selections, [projectId]: taskId});
    if (task?.id !== taskId) setDecisionStatus('');
  };
  const pending = useRef(false), generation = useRef(0);
  useEffect(() => {
    let mounted = true;
    async function refresh() {
      if (document.hidden || pending.current) return;
      const before = generation.current;
      try {
        const result = await window.companion.officina({type: 'read'});
        if (mounted && before === generation.current && result.ok) setView(result.value);
      } catch { /* A navigation in progress can close the IPC surface. */ }
    }
    function sync() { setHidden(document.hidden); void refresh(); }
    void refresh();
    const timer = setInterval(refresh, 1800);
    document.addEventListener('visibilitychange', sync);
    return () => {mounted = false; clearInterval(timer); document.removeEventListener('visibilitychange', sync);};
  }, []);
  const act: Act = async action => {
    if (pending.current) return false;
    pending.current = true;
    generation.current++;
    setError('');
    try {
      const result = await window.companion.officina(action);
      if (!result.ok) {setError(result.error); return false;}
      setView(result.value);
      if (action.type === 'resolve-request') {
        setDecisionStatus(action.decision === 'approve' ? 'Aprobación registrada.' :
          action.decision === 'request-changes' ? 'Cambios solicitados.' : 'Respuesta registrada.');
      }
      if (action.type === 'select-activity' && result.value.project?.id === action.project) {
        setSelection({project: action.project, role: action.role});
        const task = result.value.project.tasks.find(item => item.id === action.task && item.status !== 'done');
        if (task) focusTask(action.project, task.id);
        if (task && action.kind === 'question') {
          setDecisionStatus('');
          setChat(false);
        } else if (task) setPanel({type: 'task', id: task.id});
        else {
          setChat(false);
          if (action.kind === 'permission') await window.companion.navigate('permissions');
        }
      }
      if (action.type === 'chat' && result.value.project) {
        const project = result.value.project.id;
        focusTask(project, action.id);
        if (action.role) setSelection({project, role: action.role});
        setChat(true);
      }
      if (action.type === 'task' && result.value.project) {
        const created = result.value.project.tasks.at(-1);
        if (created) focusTask(result.value.project.id, created.id);
      }
      if (action.type === 'observe-team' && action.task) focusTask(action.project, action.task);
      if (action.type === 'select' || action.type === 'project' || action.type === 'delete-project') {
        setSelection(undefined);
        setDecisionStatus('');
      }
      if (action.type === 'delete-project') setTaskSelections(tasks => {
        const next = {...tasks};
        delete next[action.project];
        return next;
      });
      return true;
    } catch {
      setError('No se pudo completar la acción en Officina.');
      return false;
    } finally {
      pending.current = false;
    }
  };
  const open = (value: Panel) => {
    if (project && value.type === 'task') focusTask(project.id, value.id);
    setError('');
    setPanel(value);
  };
  const openedDecision = useRef(false);
  useEffect(() => {
    const item = glanceItems?.length === 1 ? glanceItems[0] : undefined;
    if (!openDecisionOnEntry || openedDecision.current || !item || item.kind === 'working') return;
    openedDecision.current = true;
    void act({type: 'select-activity', project: item.project, task: item.task, role: item.role, kind: item.kind});
  }, [openDecisionOnEntry, glanceItems]);
  const close = () => {setError(''); setPanel(undefined);};
  const selected = selection && selection.project === project?.id ? selection.role : 'coordinator';
  const recipient = selected === 'observer' ? 'coordinator' : selected;
  const selectRole = (role: OfficinaActor) => {
    setSelection({project: project?.id, role});
    setDecisionStatus('');
  };
  const team = Object.fromEntries(OfficinaActor.options.map(role => [role,
    officinaRoleTracking(task ? project : undefined, role, view?.activity, task?.id)])) as Team;
  const sceneProject = project && task ? officinaTaskBoard(project, task.id) : project;
  const attentionItems = project ? officinaAttentionItems(project, view?.activity) : [];
  const humanRequests = attentionItems.filter((item): item is HumanRequest => item.kind === 'request' || item.kind === 'question');
  const requestRole = (item: HumanRequest) => item.kind === 'request' ? item.run.role : 'coordinator';
  const requests = (role: OfficinaActor) => humanRequests.filter(item => item.task.id === task?.id && requestRole(item) === role);
  const activeRequest = requests(selected)[0];
  const decisionGoal = activeRequest && project?.goals?.find(goal => goal.task === activeRequest.task.id);
  const showRequest = (item: HumanRequest) => {
    if (!project) return;
    setSelection({project: project.id, role: requestRole(item)});
    focusTask(project.id, item.task.id);
    setDecisionStatus('');
    setChat(false);
  };
  const decision = project && decisionGoal && <section className="officina-desk-decisions" aria-label="Solicitudes del puesto">
    <GoalContinuation key={decisionGoal.humanRequest?.run ?? decisionGoal.task} project={project} goal={decisionGoal} act={act}/>
  </section>;
  const queued = project ? officinaWaitingRuns(project) : [];
  const waiting = queued.filter(run => !project?.goals?.some(goal => goal.task === run.task && goal.improvement)).length;
  const needsUser = (item: OfficinaAttention) => item.kind === 'permission' || item.kind === 'request' || item.kind === 'question';
  const attention = attentionItems.find(item => item.task.id === task?.id);
  const otherDecisions = attentionItems.filter(item => item.task.id !== task?.id && needsUser(item));
  const uncertain = project?.runs.find(run => run.role !== 'observer' && run.state === 'uncertain');
  const unreported = uncertain && (attention?.kind !== 'dispatch' || attention.run.id !== uncertain.id) ? uncertain : undefined;
  const queueStatus = project && (unreported || !uncertain && !view?.enabled && waiting > 0) && <div className="officina-compose-queue">
    <span role="status">{unreported ? 'Envío sin confirmar. Revísalo en Codex.' : 'Cola desactivada · Hay turnos en espera'}</span>
    {unreported?.destination && <button type="button" onClick={() =>
      void act({type: 'open-run-chat', project: project.id, task: unreported.task, run: unreported.id})}>Revisar en Codex</button>}
    {!unreported && (project.binding || project.team) && !view?.dispatchBlock &&
      <button type="button" onClick={() => void act({type: 'queue', project: project.id, enabled: true})}>Activar cola</button>}
  </div>;
  const followup = task && officinaObserverRun(project, task.id)?.followup;
  const attentionCard = project && <>
    {attention && <OfficinaAttentionCard item={attention} project={project} approvals={approvals}
      act={act} openTask={id => {
        const item = humanRequests.find(item => item.task.id === id);
        if (item && !chat) showRequest(item);
        else open({type: 'task', id});
      }}/>}
    {otherDecisions.length > 0 && <details className="officina-project-tools officina-queue-list officina-other-decisions">
      <summary>Decisiones de otros encargos <span>{otherDecisions.length}</span></summary>
      {otherDecisions.map(item => <button key={item.task.id} type="button" onClick={() => {
        if (item.kind === 'request' || item.kind === 'question') showRequest(item);
        else open({type: 'task', id: item.task.id});
      }}>
        {item.task.title}
      </button>)}
    </details>}
  </>;
  const controls = project && <div className="officina-dispatch">
    {project.team?.issue && <p role="status">{project.team.issue}</p>}
    {view?.dispatchBlock && <p role="status">{view.dispatchBlock}</p>}
    {queued.length > 0 && <details className="officina-project-tools officina-queue-list">
      <summary>Cola de Officina <span>{queued.length} en espera</span></summary>
      <ol>{queued.map(run => <li key={run.id}>
        <button type="button" onClick={() => open({type: 'task', id: run.task})}>
          <strong>{project.tasks.find(task => task.id === run.task)?.title}</strong>
          <small>{officinaActorName(run.role, project)} · {run.retryAt === undefined ? 'En espera' : 'Esperando a Codex'}</small>
        </button>
      </li>)}</ol>
    </details>}
    <details className="officina-project-tools">
      <summary>Opciones del proyecto</summary>
      <div className="officina-project-actions">
        {!project.team && <button onClick={() => open({type: 'binding'})}><Settings2 aria-hidden="true"/>{project.binding?.environment ?? 'Vincular Codex'}</button>}
        {(view?.enabled || project.autoImprovements?.enabled) && <button onClick={() => void act({type: 'queue', project: project.id, enabled: false})}>
          Detener cola
        </button>}
        <button className="officina-danger" onClick={() => open({type: 'delete-project', project: project.id})}>
          <Trash2 aria-hidden="true"/>Eliminar proyecto
        </button>
      </div>
    </details>
  </div>;
  const title = panel?.type === 'project' ? 'Nuevo proyecto' : panel?.type === 'delete-project' ? 'Eliminar proyecto de Officina' :
    panel?.type === 'binding' ? 'Vincular Codex' :
    panel?.type === 'settings' ? 'Configurar oficina' : panel?.type === 'observer' ? 'Revisiones de ZEN' :
    panel?.type === 'role' ? officinaActorName(panel.role, project) : panel?.type === 'task' ?
      project?.tasks.find(task => task.id === panel.id)?.title ?? 'Tarea' : panel?.type === 'new' ? 'Nueva tarea' :
      panel?.type === 'event' ? 'Actividad de la conexión' :
        panel?.type === 'chat-message' && project ? `Mensaje de ${chatEntryAuthor(panel.entry, project)}` :
          panel?.type === 'result' ? `Resultado de ${officinaActorName(panel.role, project)}` : project?.name ?? 'Tablero del proyecto';
  return <section className="officina" aria-label="Officina" data-view={chat ? 'chat' : 'team'}>
    <header className="officina-header">
      <div className="officina-brand"><ZenEmblem/><h1>Officina</h1></div>
      <div className="officina-view-switch" role="group" aria-label="Vista de Officina">
        <button aria-pressed={!chat} onClick={() => setChat(false)}><Users aria-hidden="true"/>Equipo</button>
        <button aria-pressed={chat} onClick={() => setChat(true)}><MessageSquare aria-hidden="true"/>Chat global</button>
      </div>
      <div className="officina-project-controls">
        <select aria-label="Proyecto de Officina" value={project?.id ?? ''} onChange={event => {
          if (event.target.value === 'new') open({type: 'project'});
          else void act({type: 'select', project: event.target.value});
        }}>
          {!project && <option value="" disabled>Selecciona un proyecto</option>}
          {view?.projects.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          <option value="new">+ Nuevo proyecto</option>
        </select>
        <button className="officina-new" aria-label={project ? 'Nueva tarea' : 'Nuevo proyecto'}
          onClick={() => open({type: project ? 'new' : 'project'})}><Plus aria-hidden="true"/><span>{project ? 'Nueva tarea' : 'Nuevo proyecto'}</span></button>
      </div>
      {project && task && <label className="officina-task-focus">
        <span>Encargo</span>
        <select aria-label="Encargo de Officina" title={task.title} value={task.id}
          onChange={event => focusTask(project.id, event.target.value)}>
          {project.tasks.slice().reverse().map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
      </label>}
      {decisionStatus && <p role="status">{decisionStatus}</p>}
      {!panel && error && <p role="alert" className="officina-error">{error}</p>}
      {!!glanceItems?.length && <details open className="officina-glance-list">
        <summary>{glanceItems[0].kind === 'working' ? 'Actividad actual' : 'Pendientes de ti'}</summary>
        {glanceItems.map((item, index) => <button key={`${item.project}:${item.role}:${item.task ?? index}`} type="button"
          onClick={() => void act({type: 'select-activity', project: item.project, task: item.task, role: item.role, kind: item.kind})}>
          {officinaActorName(item.role, item.project === project?.id ? project : undefined)} · {item.projectName} · {item.title ?? 'Chat del puesto'}
        </button>)}
      </details>}
    </header>
    {chat ? <ProjectChat view={view} task={task} act={act} open={open} attention={attentionCard} controls={controls}/> : <div className="officina-layout">
      <aside className="officina-side">
        {attentionCard}
        <div className="officina-side-content" key={project?.id}>
          <section className="officina-team" aria-label="Actividad del equipo">
            <div className="officina-team-list">
              {OfficinaActor.options.map(role => {
                const activity = team[role];
                return <div key={role} className="officina-team-member" data-state={activity.state} data-selected={selected === role}>
                  <button className="officina-team-select" data-role={role} aria-pressed={selected === role} onClick={() => selectRole(role)}>
                    <RoleIcon role={role}/><span><strong>{officinaActorName(role, project)}</strong><TrackingLabel activity={activity}/><RequestBadge items={requests(role)}/></span>
                  </button>
                  {role === 'observer' && task && project?.reviews?.some(review => review.scope === task.id && review.report) &&
                    <button className="officina-result-button" onClick={() => open({type: 'observer', project: project.id, review: followup?.review})}>
                      {followup ? 'Ver seguimiento' : 'Revisiones'}
                    </button>}
                  {project && activity.task && activity.state !== 'information' && (role === 'coordinator' ?
                    <button className="officina-result-button officina-accent" type="button" onClick={() => open({type: 'task', id: activity.task!})}>
                      Ver equipo <ArrowRight aria-hidden="true"/>
                    </button> : <ResultButton project={project} task={activity.task} role={role} open={open}/>)}
                  {!requests(role).length && activity.task && activity.state === 'information' && <button className="officina-result-button" type="button"
                    onClick={() => open({type: 'task', id: activity.task!})}>Ver decisión</button>}
                </div>;
              })}
            </div>
          </section>
          {controls}
        </div>
      </aside>
      <div className="officina-floor">
        <button ref={mapToggle} className="officina-map-toggle" type="button" aria-controls="officina-team-map"
          aria-expanded={mapOpen} onClick={() => setMapOpen(value => !value)}>{mapOpen ? 'Ocultar mapa' : 'Ver mapa'}</button>
        <div className="officina-team-map" id="officina-team-map" data-open={mapOpen}
          onKeyDown={event => {
            if (event.key !== 'Escape' || !mapToggle.current?.getClientRects().length) return;
            event.preventDefault();
            event.stopPropagation();
            setMapOpen(false);
            mapToggle.current.focus();
          }}>
          <Scene key={`${project?.id}-${task?.id}`} project={sceneProject} taskTitle={task?.title} team={team} animate={motion && !hidden}
            open={open} selected={selected} selectRole={selectRole} requests={requests}/>
        </div>
        {selected === 'observer' ? <OfficinaObserverDesk key={`${project?.id}-${task?.id}`} project={project} task={task?.id} queued={view?.observerQueued} act={act}
          settings={() => open({type: 'settings', role: 'observer'})}
          open={() => project && open({type: 'observer', project: project.id})}/> :
          <DeskActivity project={project} task={task} role={selected} activity={team[selected]} open={open} decision={decision}/>}
      </div>
    </div>}
    <OfficinaComposer key={project?.id} project={project} context={view?.context} act={act} ready={!!view} recipient={recipient}
      recipientIcon={<RoleIcon role={recipient}/>} selectRecipient={chat ? selectRole : undefined}
      queueStatus={queueStatus}/>
    {panel && <Modal title={title} close={close} wide={panel.type === 'chat-message' || panel.type === 'result' || panel.type === 'observer'}>
      {error && <p className="officina-error" role="alert">{error}</p>}
      <PanelContent key={panel.type === 'chat-message' ? panel.entry.key : JSON.stringify(panel)}
        panel={panel} project={project} team={team} activity={view?.activity} observerQueued={view?.observerQueued}
        approvals={approvals} act={act} open={open} close={close}/>
    </Modal>}
  </section>;
}
