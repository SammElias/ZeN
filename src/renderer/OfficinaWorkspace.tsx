import React, {useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode} from 'react';
import {ArrowRight, Box, ChevronRight, ClipboardCheck, CodeXml, Copy, Eye, FileText, FlaskConical, FolderOpen, ImageIcon, Layers3, ListChecks, Maximize2, MessageSquare, Minimize2, Paperclip, Plus, Settings2, Trash2, Users, X} from 'lucide-react';
import {
  OfficinaActor, OfficinaParticipant, OfficinaRole, officinaActorName, officinaEventLabels, officinaOpenItems,
  officinaPasteTitle, officinaQa, officinaRunLabels, officinaTaskLabels,
  type OfficinaAction, type OfficinaContribution, type OfficinaDirectActivity, type OfficinaEvent, type OfficinaGoal, type OfficinaProject, type OfficinaRunActivity,
  type OfficinaTask, type OfficinaTaskStatus, type OfficinaView,
} from '../shared/companion-officina';
import {ZenEmblem} from './ZenEmblem';
import {isOfficinaTabReview, officinaGoalBrowser, officinaGoalRequest} from '../shared/officina-browser';
import {officinaObserverRun, officinaRoleTracking, officinaRunTracking, officinaTrackingLabels} from '../shared/officina-tracking';
import {officinaDelegatedRoles, officinaResults} from '../shared/officina-results';
import {officinaChatEntries, type OfficinaChatEntry} from '../shared/officina-chat';
import {officinaAskedQuestion, officinaAttention, officinaClosureRetry} from '../shared/officina-attention';
import type {CompanionApproval} from '../shared/codex-companion';
import {OfficinaAttentionCard} from './OfficinaAttentionCard';
import {OfficinaComposer} from './OfficinaComposer';
import {OfficinaRoleSettings} from './OfficinaRoleSettings';
import {OfficinaMonitorNotice, OfficinaObserverDesk, OfficinaObserverPanel} from './OfficinaObserver';
import {officinaPendingProposals} from '../shared/officina-observer';
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

function Scene({project, team, animate, open, selected, selectRole}: {project?: OfficinaProject; team: Team; animate: boolean;
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
        onClick={() => selectRole(role)}>
        <span className="officina-desk-label"><RoleIcon role={role}/><span>{name}</span></span>
        <span className="officina-desk-tooltip" id={`officina-desk-${role}`}>
          {[name, activity.label ?? officinaTrackingLabels[activity.state], activity.title].filter(Boolean).join(' · ')}
        </span>
      </button>;
    })}
    <button type="button" className="officina-table" data-role="coordinator" data-state={team.coordinator.state}
      aria-label={officinaActorName('coordinator', project)} aria-pressed={selected === 'coordinator'} onClick={() => selectRole('coordinator')}>
      <span className="officina-desk-label"><RoleIcon role="coordinator"/><span>{officinaActorName('coordinator', project)}</span></span>
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
  const results = officinaResults(project, task, role).reverse();
  const events = project.events.filter(event => event.task === task);
  return <div className="officina-results">
    <p className="officina-result-context">{project.name} · {project.tasks.find(item => item.id === task)?.title}</p>
    {results.map(({run, event, message}, index) => <div className="officina-result-entry" key={run?.id ?? event?.id ?? index}>
      {event ? <EventDetail event={event} events={events} project={project} act={act} showTitle={false}/> : message ?
        <OfficinaResponse text={message.text} markdown={message.markdown} project={project.id} task={task} act={act}/> :
        <p>La respuesta de este encargo no está disponible en Officina.</p>}
      {run?.destination && run.sentAt !== undefined && <button onClick={() =>
        void act({type: 'open-run-chat', project: project.id, task, run: run.id})}>Abrir en Codex <ArrowRight aria-hidden="true"/></button>}
    </div>)}
  </div>;
}

function EventForm({project, task, initialRole, act}: {project: OfficinaProject; task: OfficinaTask; initialRole?: OfficinaRole; act: Act}) {
  const [kind, setKind] = useState<OfficinaContribution['kind']>('progress');
  const nonce = useRef(crypto.randomUUID());
  const events = forTask(project, task), open = officinaOpenItems(events);
  const applicable = kind === 'qa' ? events.filter(event => event.data.kind === 'handoff' && event.from === 'developer' && event.data.to === 'tester') :
    open.filter(event => event.data.kind === (kind === 'answer' ? 'question' : 'blocker'));
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget, form = new FormData(element);
    const value = String(form.get('text')), replyTo = String(form.get('replyTo') ?? ''),
      to = form.get('to') as OfficinaRole, requiresAction = form.has('act');
    const data: OfficinaContribution = kind === 'handoff' ? {kind, text: value, to, act: requiresAction,
      artifact: {version: String(form.get('version')), link: String(form.get('link')), next: String(form.get('next'))}} :
      kind === 'qa' ? {kind, text: value, replyTo, passed: form.get('result') === 'pass', evidence: String(form.get('evidence'))} :
      kind === 'question' ? {kind, text: value, to, act: requiresAction} :
      kind === 'answer' ? {kind, text: value, replyTo} :
      kind === 'decision' ? {kind, text: value, replyTo: replyTo || undefined} : {kind, text: value};
    const role = kind === 'qa' ? 'tester' : form.get('from') as OfficinaRole;
    if (await act({type: 'contribute', project: project.id, task: task.id, role, nonce: nonce.current, data})) {
      nonce.current = crypto.randomUUID();
      element.reset();
      setKind('progress');
    }
  }
  return <form className="officina-form" onSubmit={submit}>
    <label>Tipo de registro<select value={kind} onChange={event => setKind(event.target.value as typeof kind)} data-hold-island-open>
      {Object.entries(officinaEventLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
    </select></label>
    {kind !== 'qa' && <label>Desde<SelectRole name="from" project={project} initial={initialRole ?? task.owner}/></label>}
    {(kind === 'question' || kind === 'handoff') && <>
      <label>Destinatario<SelectRole name="to" project={project} initial={kind === 'handoff' ? 'tester' : 'architect'}/></label>
      <label className="officina-check"><input type="checkbox" name="act"/> Requiere actuación</label>
    </>}
    {(kind === 'answer' || kind === 'decision' || kind === 'qa') && <label>{kind === 'qa' ? 'Versión entregada' : 'Relacionado con'}
      <select name="replyTo" required={kind !== 'decision'} data-hold-island-open>
        <option value="">{kind === 'decision' ? 'Nueva resolución' : 'Selecciona un registro'}</option>
        {applicable.map(event => <option key={event.id} value={event.id}>
          {event.data.kind === 'handoff' ? event.data.artifact.version + ' · ' : ''}{event.data.text}
        </option>)}
      </select>
    </label>}
    <label>{officinaEventLabels[kind]}<textarea name="text" required maxLength={700} data-hold-island-open/></label>
    {kind === 'handoff' && <>
      <label>Versión<input name="version" required maxLength={100} data-hold-island-open/></label>
      <label>Enlace o ruta del entregable<input name="link" required maxLength={360} data-hold-island-open/></label>
      <label>Siguiente paso<textarea name="next" required maxLength={360} data-hold-island-open/></label>
    </>}
    {kind === 'qa' && <>
      <label>Resultado<select name="result" data-hold-island-open><option value="pass">Validado</option><option value="fail">Incidencia</option></select></label>
      <label>Evidencia<input name="evidence" required maxLength={360} data-hold-island-open/></label>
    </>}
    <button className="officina-accent" type="submit">Registrar</button>
  </form>;
}

function TaskDetail({project, task, activity, approvals, act}: {
  project: OfficinaProject; task: OfficinaTask; activity?: OfficinaRunActivity; approvals: CompanionApproval[]; act: Act;
}) {
  const events = forTask(project, task), runs = project.runs.filter(run => run.task === task.id);
  const open = task.status === 'done' ? [] : officinaOpenItems(events);
  const goal = project.goals?.find(item => item.task === task.id);
  const attention = officinaAttention(project, activity, task.id);
  return <>
    {attention && <OfficinaAttentionCard item={attention} project={project} approvals={approvals} act={act}/>}
    {goal && task.status !== 'done' && <GoalContinuation project={project} goal={goal} act={act}/>}
    <div className="officina-task-fields">
      <p><strong>{officinaActorName(task.owner, project)} · {officinaTaskLabels[task.status]}</strong></p>
      <p>{task.objective}</p><h3>Criterios de aceptación</h3><p>{task.criteria}</p>
      <p role="status">{officinaQa(project.events, task.id)}</p>
      {open.map(item => <p className="officina-attention" key={item.id}>{officinaEventLabels[item.data.kind]} · {item.data.text}</p>)}
    </div>
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
    <details><summary>Registrar actividad</summary><EventForm project={project} task={task} act={act}/></details>
    {!!runs.length && <section className="officina-history"><h3>Encargos de Codex</h3>
      {runs.slice().reverse().map(run => <article key={run.id}>
        <strong>{officinaActorName(run.role, project)} · {attention?.kind === 'closure' && attention.run.id === run.id ?
          'Cierre pendiente de envío' : officinaRunLabels[run.state]}</strong>
        {run.issue && !(attention?.kind === 'closure' && attention.run.id === run.id) && <p>{run.issue}</p>}
        {(run.state === 'sent' || run.state === 'uncertain') && <details>
          <summary>Revisé el chat de Codex</summary>
          <button onClick={() => void act({type: 'release', project: project.id, run: run.id})}>Liberar el turno y detener la cola</button>
        </details>}
      </article>)}
    </section>}
    {!!events.length && <section className="officina-history"><h3>Historial de la tarea</h3>
      {events.slice().reverse().map(event => <EventDetail key={event.id} event={event} events={events} project={project} act={act}/>)}
    </section>}
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

function DeskActivity({project, role, activity, open}: {project?: OfficinaProject; role: OfficinaParticipant;
  activity: Tracking; open: (panel: Panel) => void}) {
  const [chosen, setChosen] = useState('');
  const tasks = project?.tasks.filter(task => role === 'coordinator' || task.owner === role ||
    project.runs.some(run => run.task === task.id && run.role === role) ||
    project.events.some(event => event.task === task.id && (event.from === role || transfer(event) === role))) ?? [];
  const last = role === 'coordinator' ? project?.events.filter(event => event.data.kind === 'handoff').at(-1) : undefined;
  const task = tasks.find(item => item.id === (chosen || activity.task || last?.task)) ?? tasks.at(-1);
  const goal = project?.goals?.find(item => item.task === task?.id);
  const result = project && task && officinaResults(project, task.id, role).filter(item => item.event || item.message).at(-1);
  const preview = result && (result.message?.text ?? result.event?.data.text);
  const delegated = project && task && role === 'coordinator' ? officinaDelegatedRoles(project, task.id) : [];
  const waiting = project && task && role === 'coordinator' && task.status !== 'done' ?
    officinaOpenItems(forTask(project, task)).filter(event => event.data.kind === 'question') : [];
  const active = role === 'coordinator' && task?.status !== 'done' ? project?.runs.find(run => run.task === task?.id &&
    ['sending', 'sent', 'uncertain', 'waiting'].includes(run.state)) : undefined;
  const matchingStatus = !chosen || chosen === activity.task;
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
    {project && task ? <>
      <div className="officina-desk-task">
        <strong>{task.title}</strong>
        <button onClick={() => open({type: 'task', id: task.id})}>Ver tarea</button>
        <ResultButton project={project} task={task.id} role={role} open={open}/>
      </div>
      {tasks.length > 1 && <select aria-label="Encargo del puesto" value={task.id} onChange={event => setChosen(event.target.value)}>
        {tasks.slice().reverse().map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
      </select>}
      {delegated.length > 0 && (delegated.length > 1 || !matchingStatus || !activity.label?.startsWith('Asignó')) &&
        <p>Asignación confirmada · {delegated.map(actor => officinaActorName(actor, project)).join(', ')}</p>}
      {last?.task === task.id && last.data.kind === 'handoff' && <p>
        Último traspaso · {officinaActorName(last.from, project)} → {officinaActorName(last.data.to, project)}
      </p>}
      {preview && <p className="officina-result-preview">{preview}</p>}
      {active && <p>{active.role !== 'coordinator' && active.role !== 'observer' && delegated.includes(active.role) ?
        `${name} espera el resultado de ${officinaActorName(active.role, project)}` : officinaActorName(active.role, project)}
        {' · '}{officinaRunLabels[active.state]}</p>}
      {waiting.map(event => event.data.kind === 'question' && <p key={event.id}>
        {officinaActorName(event.from, project)} espera respuesta de {officinaActorName(event.data.to, project)}
      </p>)}
      {goal?.phase === 'verify' && role === 'coordinator' && task.status !== 'done' &&
        project.events.some(event => event.task === task.id && event.data.kind === 'qa') && <p>{officinaQa(project.events, task.id)}</p>}
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
  entry.message.from === 'codex' ? 'coordinator' : undefined;
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

function ProjectChat({view, taskId, selectTask, act, open, attention, controls}: {
  view?: OfficinaView; taskId?: string; selectTask: (task: string) => void;
  act: Act; open: (panel: Panel) => void; attention: ReactNode; controls: ReactNode;
}) {
  const project = view?.project;
  const goals = project?.goals ?? [];
  const goal = goals.find(item => item.task === taskId) ?? goals.at(-1);
  const title = (item: OfficinaGoal) => project?.tasks.find(task => task.id === item.task)?.title ?? item.request;
  const teamSize = project?.team ? Object.keys(project.team.threads).length : 0;
  const total = project?.team?.threads.observer ? OfficinaActor.options.length : OfficinaParticipant.options.length;
  return <section className="officina-chat" aria-label="Chat global">
    <header className="officina-chat-toolbar">
      <div className="officina-chat-heading">
        <MessageSquare aria-hidden="true"/>
        {goals.length > 1 && goal ? <select aria-label="Encargo de Chat global" value={goal.task} onChange={event => selectTask(event.target.value)}>
          {goals.slice().reverse().map(item => <option key={item.task} value={item.task}>{title(item)}</option>)}
        </select> : <h2>{goal ? title(goal) : 'Chat global'}</h2>}
        {goal && <button onClick={() => open({type: 'task', id: goal.task})}>Ver tarea <ArrowRight aria-hidden="true"/></button>}
      </div>
      {attention && <div className="officina-chat-notice">{attention}</div>}
      {project && view?.directActivity && Object.keys(view.directActivity).length > 0 &&
        <details className="officina-project-tools officina-direct-activity">
          <summary>Actividad directa en Codex</summary>
          {OfficinaActor.options.map(role => {
            const activity = view.directActivity?.[role];
            return activity && <div className="officina-project-actions" key={role}>
              <strong>{officinaActorName(role, project)}</strong>
              <span data-state={directTracking(activity).state}><TrackingLabel activity={directTracking(activity)}/></span>
              <DirectChatButton project={project.id} role={role} activity={activity} act={act}/>
            </div>;
          })}
        </details>}
    </header>
    <div className="officina-chat-scroll" key={`${project?.id}-${goal?.task}`}>
      <div className="officina-chat-content">
        {project && goal ? <GoalConversation project={project} goal={goal} activity={view?.activity} act={act} open={open}/> :
          <p className="officina-empty-chat">Aún no hay mensajes en este proyecto.</p>}
        <footer className="officina-chat-tools">
          {project?.team && <details className="officina-project-tools">
            <summary>Chats en Codex <span>{teamSize === total ? `${teamSize} chats vinculados` : `${teamSize} de ${total} chats vinculados`}</span></summary>
            {project.team.projectId && project.team.cwd && <ProjectFolder project={project} act={act}/>}
            {project.team.projectId && <div className="officina-chat-team" aria-label="Chats del proyecto en Codex">
              {OfficinaActor.options.filter(role => project.team?.threads[role]).map(role =>
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
      {officinaChatEntries(project, goal).map(entry => <ChatEntry key={entry.key} entry={entry} goal={goal} project={project} open={open} act={act}/>)}
    </ol>
    {blocker?.source === 'user' && !closed && <p className="officina-attention">{officinaEventLabels.blocker} · {blocker.data.text}</p>}
    {browserReview && blocker?.from === 'analyst' && (goal.phase === 'work' || goal.outcome === 'limited') &&
      goal.steps[goal.cursor]?.role === 'analyst' && !active &&
      <button onClick={() => void act({type: 'resume-browser-review', project: project.id, task: goal.task})}>Reintentar con la extensión</button>}
    {!closed && <GoalContinuation project={project} goal={goal} act={act}/>}
  </article>;
}

export function OfficinaWorkspace({motion, approvals = []}: {motion: boolean; approvals?: CompanionApproval[]}) {
  const [view, setView] = useState<OfficinaView>();
  const [panel, setPanel] = useState<Panel>();
  const [error, setError] = useState('');
  const [hidden, setHidden] = useState(document.hidden);
  const [chat, setChat] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const mapToggle = useRef<HTMLButtonElement>(null);
  const [chatTasks, setChatTasks] = useState<Record<string, string>>({});
  const [selection, setSelection] = useState<{project?: string; role: OfficinaActor}>();
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
      if (action.type === 'chat' && result.value.project) {
        const project = result.value.project.id;
        setChatTasks(tasks => ({...tasks, [project]: action.id}));
        if (action.role) setSelection({project, role: action.role});
        setChat(true);
      }
      if (action.type === 'select' || action.type === 'project' || action.type === 'delete-project') setSelection(undefined);
      if (action.type === 'delete-project') setChatTasks(tasks => {
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
  const open = (value: Panel) => {setError(''); setPanel(value);};
  const close = () => {setError(''); setPanel(undefined);};
  const project = view?.project;
  const selected = selection && selection.project === project?.id ? selection.role : 'coordinator';
  const recipient = selected === 'observer' ? 'coordinator' : selected;
  const selectRole = (role: OfficinaActor) => setSelection({project: project?.id, role});
  const boardTeam = Object.fromEntries(OfficinaActor.options.map(role => [role, officinaRoleTracking(project, role, view?.activity)])) as Team;
  const observedRole = project?.runs.find(run => run.id === view?.activity?.run)?.role;
  const team = Object.fromEntries(OfficinaActor.options.map(role => {
    const direct = view?.directActivity?.[role];
    return [role, direct && role !== observedRole ? directTracking(direct) : boardTeam[role]];
  })) as Team;
  const blockedTasks = new Set(officinaOpenItems(project?.events ?? []).filter(event => event.data.kind === 'blocker').map(event => event.task));
  const waiting = project?.runs.filter(run => run.role !== 'observer' && run.state === 'waiting' && !blockedTasks.has(run.task) &&
    project.tasks.some(task => task.id === run.task && task.status !== 'done') &&
    !project.goals?.some(goal => goal.task === run.task && goal.improvement)).length ?? 0;
  const attention = project && officinaAttention(project, view?.activity);
  const uncertain = project?.runs.find(run => run.role !== 'observer' && run.state === 'uncertain');
  const unreported = uncertain && (attention?.kind !== 'dispatch' || attention.run.id !== uncertain.id) ? uncertain : undefined;
  const queueStatus = project && (unreported || !uncertain && !view?.enabled && waiting > 0) && <div className="officina-compose-queue">
    <span role="status">{unreported ? 'Envío sin confirmar. Revísalo en Codex.' : 'Cola desactivada · Hay turnos en espera'}</span>
    {unreported?.destination && <button type="button" onClick={() =>
      void act({type: 'open-run-chat', project: project.id, task: unreported.task, run: unreported.id})}>Revisar en Codex</button>}
    {!unreported && (project.binding || project.team) && !view?.dispatchBlock &&
      <button type="button" onClick={() => void act({type: 'queue', project: project.id, enabled: true})}>Activar cola</button>}
  </div>;
  const incident = project?.reviews?.filter(review => review.source === 'monitor' && officinaPendingProposals(review, project) > 0).at(-1);
  const improvement = project?.goals?.filter(goal => goal.improvement).at(-1);
  const followup = officinaObserverRun(project)?.followup;
  const attentionCard = project && <>
    {attention && <OfficinaAttentionCard item={attention} project={project} approvals={approvals}
      act={act} openTask={id => open({type: 'task', id})}/>}
    {incident && <OfficinaMonitorNotice project={project} review={incident}
      open={() => open({type: 'observer', project: project.id, review: incident.id})}/>}
    {improvement && !improvement.improvementNoticeDismissed && <section className="officina-next" data-kind="monitor" aria-label="Mejora automática de ZEN">
      <div className="officina-improvement-heading">
        <strong>{improvement.phase === 'complete' ?
          improvement.outcome === 'limited' ? 'ZEN · Mejora cerrada con limitaciones' : 'ZEN · Mejora completada' :
          project.autoImprovements?.enabled ? 'ZEN · Mejora enviada a Coordinación' : 'ZEN · Mejora pausada'}</strong>
        <button type="button" aria-label="Cerrar aviso de mejora" title="Cerrar aviso de mejora" onClick={() =>
          void act({type: 'dismiss-improvement', project: project.id, task: improvement.task})}><X aria-hidden="true"/></button>
      </div>
      <small>{project.tasks.find(task => task.id === improvement.task)?.title}</small>
      <button className="officina-next-action" onClick={() => open({type: 'task', id: improvement.task})}>Ver mejora <ArrowRight aria-hidden="true"/></button>
    </section>}
  </>;
  const controls = project && <div className="officina-dispatch">
    {project.team?.issue && <p role="status">{project.team.issue}</p>}
    {view?.dispatchBlock && <p role="status">{view.dispatchBlock}</p>}
    <details className="officina-project-tools">
      <summary>Opciones del proyecto {waiting > 0 && <span>{waiting} en espera</span>}</summary>
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
      {!panel && error && <p role="alert" className="officina-error">{error}</p>}
    </header>
    {chat ? <ProjectChat view={view} taskId={project && chatTasks[project.id]}
      selectTask={task => project && setChatTasks(tasks => ({...tasks, [project.id]: task}))}
      act={act} open={open} attention={attentionCard} controls={controls}/> : <div className="officina-layout">
      <aside className="officina-side">
        {attentionCard}
        <div className="officina-side-content" key={project?.id}>
          <section className="officina-team" aria-label="Actividad del equipo">
            <div className="officina-team-list">
              {OfficinaActor.options.map(role => {
                const activity = team[role];
                return <div key={role} className="officina-team-member" data-state={activity.state} data-selected={selected === role}>
                  <button className="officina-team-select" data-role={role} aria-pressed={selected === role} onClick={() => selectRole(role)}>
                    <RoleIcon role={role}/><span><strong>{officinaActorName(role, project)}</strong><TrackingLabel activity={activity}/></span>
                  </button>
                  {role === 'observer' && project?.reviews?.some(review => review.report) &&
                    <button className="officina-result-button" onClick={() => open({type: 'observer', project: project.id, review: followup?.review})}>
                      {followup ? 'Ver seguimiento' : 'Revisiones'}
                    </button>}
                  {project && view?.directActivity?.[role] &&
                    <DirectChatButton project={project.id} role={role} activity={view.directActivity[role]!} act={act}/>}
                  {project && activity.task && <ResultButton project={project} task={activity.task} role={role} open={open}/>}
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
          <Scene key={project?.id} project={project} team={team} animate={motion && !hidden}
            open={open} selected={selected} selectRole={selectRole}/>
        </div>
        {project && view?.directActivity?.[selected] && <div className="officina-desk-activity officina-direct-current">
          <strong>Actividad directa en Codex</strong>
          <span data-state={team[selected].state}><TrackingLabel activity={team[selected]}/></span>
          <DirectChatButton project={project.id} role={selected} activity={view.directActivity[selected]!} act={act}/>
        </div>}
        {selected === 'observer' ? <OfficinaObserverDesk key={project?.id} project={project} queued={view?.observerQueued} act={act}
          settings={() => open({type: 'settings', role: 'observer'})}
          open={() => project && open({type: 'observer', project: project.id})}/> :
          <DeskActivity key={`${project?.id}-${selected}`} project={project} role={selected} activity={boardTeam[selected]} open={open}/>}
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
