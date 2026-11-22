import React, {useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode} from 'react';
import {ArrowRight, Box, ClipboardCheck, CodeXml, FlaskConical, Layers3, ListChecks, MessageSquare, Plus, Send, Settings2, Users, X} from 'lucide-react';
import {
  OfficinaActor, OfficinaRole, officinaActorName, officinaEventLabels, officinaOpenItems, officinaQa, officinaRoles, officinaRunLabels, officinaTaskLabels,
  type OfficinaAction, type OfficinaContribution, type OfficinaEvent, type OfficinaProject, type OfficinaRunActivity,
  type OfficinaTask, type OfficinaTaskStatus, type OfficinaView,
} from '../shared/companion-officina';
import {ZenEmblem} from './ZenEmblem';
import {isOfficinaTabReview, officinaGoalBrowser, officinaGoalRequest} from '../shared/officina-browser';
import {officinaRoleTracking, officinaRunTracking, officinaTrackingLabels} from '../shared/officina-tracking';
import {OfficinaIdleScene, officinaCanRest, officinaIdleRoutines} from './OfficinaIdleScene';
import {OfficinaScreens} from './OfficinaScreens';
import officeScene from './assets/officina-office.png';
import './OfficinaWorkspace.css';

const roleIcons = {coordinator: ListChecks, analyst: ClipboardCheck, architect: Layers3, developer: CodeXml, tester: FlaskConical, alm: Box};
const roles = OfficinaRole.options;
const handoffTravelMs = 1900;
const desks = {
  analyst: {x: 32, y: 11, dot: [398, 321], path: 'M398 321 V350 Q398 366 415 366 H555 Q593 366 593 400 V436', hit: [39, 36]},
  architect: {x: 78, y: 12, dot: [793, 330], path: 'M793 330 V361 Q793 375 778 375 H714 Q680 375 680 404 V436', hit: [66, 37.5]},
  developer: {x: 21, y: 35, dot: [404, 535], path: 'M404 535 Q404 574 445 574 H459 Q484 574 500 594 T536 618 H573 Q605 618 605 590', hit: [40, 57.5]},
  tester: {x: 82, y: 43, dot: [860, 608], path: 'M860 608 Q858 648 819 648 H694 Q663 648 663 617 V592', hit: [68, 65]},
  alm: {x: 25, y: 63, dot: [497, 741], path: 'M497 741 V706 Q497 678 525 678 H600 Q633 678 633 648 V592', hit: [45, 68]},
};
type Panel = {type: 'project' | 'binding' | 'board'} | {type: 'role'; role: OfficinaActor} |
  {type: 'task'; id: string} | {type: 'new'; role?: OfficinaRole} | {type: 'event'; id: string};
type Act = (action: OfficinaAction) => Promise<boolean>;
const forTask = (project: OfficinaProject, task: OfficinaTask) => project.events.filter(event => event.task === task.id);
const transfer = (event: OfficinaEvent) => 'to' in event.data ? event.data.to : undefined;

type Tracking = ReturnType<typeof officinaRoleTracking>;
type Team = Record<OfficinaActor, Tracking>;

function RoleIcon({role}: {role: OfficinaActor}) {
  const Icon = roleIcons[role];
  return <span className="officina-role-icon"><Icon aria-hidden="true"/></span>;
}

function Scene({project, team, animate, open}: {project?: OfficinaProject; team: Team; animate: boolean; open: (panel: Panel) => void}) {
  const events = project?.events ?? [];
  const working = roles.filter(role => team[role].state === 'working');
  const manuallyAssigned = new Set(project?.tasks.filter(task => task.status !== 'done' &&
    !project.goals?.some(goal => goal.task === task.id)).map(task => task.owner));
  const resting = roles.filter(role => officinaCanRest(team[role].state) && !manuallyAssigned.has(role));
  const latestHandoff = events.filter(event => event.data.kind === 'handoff').at(-1);
  const previous = useRef(latestHandoff?.id);
  const [pulse, setPulse] = useState<{id: string; path: string; to: OfficinaRole}>();
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
    flightMarker.current?.querySelectorAll<SVGAnimationElement>('animateMotion, animate')
      .forEach(animation => animation.beginElement());
  }, [flight]);
  return <div className="officina-stage" data-animate={animate}><div className="officina-scene" data-animate={animate} aria-label="Plano de Officina">
    <img className="officina-photo" src={officeScene} alt="Cinco puestos alrededor de la mesa central de una oficina en miniatura" draggable={false}/>
    {animate && <OfficinaIdleScene resting={resting}/>}
    <OfficinaScreens team={team} animate={animate} arrival={flight && {id: flight.id, role: flight.to, delay: handoffTravelMs}}/>
    {animate && working.length > 0 && <div className="officina-gestures" aria-hidden="true">{working.map(role =>
      <span key={role} data-role={role}/>)}</div>}
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
      return <button type="button" key={role} className="officina-desk"
        data-state={activity.state} style={{'--x': desk.x + '%', '--y': desk.y + '%'} as CSSProperties}
        aria-label={officinaRoles[role].name} aria-describedby={`officina-desk-${role}`}
        onClick={() => open({type: 'role', role})}>
        <span className="officina-desk-label"><RoleIcon role={role}/>{officinaRoles[role].name}</span>
        <span className="officina-desk-tooltip" id={`officina-desk-${role}`}>
          {[officinaTrackingLabels[activity.state], activity.title, activity.detail].filter(Boolean).join(' · ')}
        </span>
      </button>;
    })}
    <button type="button" className="officina-table" aria-label="Abrir tablero del proyecto" onClick={() => open({type: 'board'})}>
      <span>Tablero del proyecto</span>
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
          aria-label={`Ver ${officinaEventLabels[event.data.kind].toLowerCase()} en conexión de ${officinaRoles[role].name}`}
          onClick={() => open({type: 'event', id: event.id})}/>}
      </React.Fragment>;
    })}
  </div></div>;
}

function Modal({children, title, close}: {children: ReactNode; title: string; close: () => void}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
    const element = dialog.current;
    return () => { element?.close(); };
  }, []);
  return <dialog ref={dialog} className="officina-modal" aria-labelledby="officina-modal-title"
    onCancel={event => { event.preventDefault(); event.stopPropagation(); close(); }}
    onKeyDown={event => {if (event.key === 'Escape') event.stopPropagation();}}>
    <header><h2 id="officina-modal-title">{title}</h2><button aria-label="Cerrar ficha" onClick={close}><X/></button></header>
    {children}
  </dialog>;
}

function SelectRole({name, initial}: {name: string; initial?: OfficinaRole}) {
  return <select name={name} defaultValue={initial} data-hold-island-open>
    {roles.map(role => <option key={role} value={role}>{officinaRoles[role].name}</option>)}
  </select>;
}

function TaskForm({project, task, role, act, done}: {project: string; task?: OfficinaTask; role?: OfficinaRole; act: Act; done: () => void}) {
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const fields = {title: String(form.get('title')), objective: String(form.get('objective')),
      criteria: String(form.get('criteria')), owner: form.get('owner') as OfficinaRole};
    const ok = await act(task ? {type: 'edit', project, task: task.id, fields, status: form.get('status') as OfficinaTaskStatus} :
      {type: 'task', project, fields, dispatch: form.has('dispatch')});
    if (ok) done();
  }
  return <form className="officina-form" onSubmit={save}>
    <label>Título<input name="title" required maxLength={120} defaultValue={task?.title} data-hold-island-open/></label>
    <label>Objetivo<textarea name="objective" required maxLength={800} defaultValue={task?.objective} data-hold-island-open/></label>
    <label>Criterios de aceptación<textarea name="criteria" required maxLength={800} defaultValue={task?.criteria} data-hold-island-open/></label>
    <label>Responsable<SelectRole name="owner" initial={task?.owner ?? role}/></label>
    {task ? <label>Estado<select name="status" defaultValue={task.status} data-hold-island-open>
      {Object.entries(officinaTaskLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
    </select></label> : <label className="officina-check"><input name="dispatch" type="checkbox"/> Poner el encargo en cola</label>}
    <button className="officina-accent" type="submit">{task ? 'Guardar cambios' : 'Crear tarea'}</button>
  </form>;
}

function EventDetail({event, events}: {event: OfficinaEvent; events: OfficinaEvent[]}) {
  const {data} = event;
  const related = 'replyTo' in data && events.find(item => item.id === data.replyTo);
  const to = transfer(event);
  return <article className="officina-event">
    <strong>{officinaEventLabels[data.kind]} · {officinaRoles[event.from].name}{to ? ` → ${officinaRoles[to].name}` : ''}</strong>
    <small>{event.source === 'codex' ? 'Codex' : 'Registro manual'} · {new Date(event.at).toLocaleString('es-ES')}</small>
    {related && <small>{officinaEventLabels[related.data.kind]} · {related.data.text}</small>}
    <p>{data.text}</p>
    {data.kind === 'handoff' && <dl><dt>Versión</dt><dd>{data.artifact.version}</dd><dt>Entregable</dt><dd>{data.artifact.link}</dd>
      <dt>Siguiente paso</dt><dd>{data.artifact.next}</dd></dl>}
    {data.kind === 'qa' && <p><strong>{data.passed ? 'Validado' : 'Incidencia'}</strong> · {data.evidence}</p>}
  </article>;
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
    {kind !== 'qa' && <label>Desde<SelectRole name="from" initial={initialRole ?? task.owner}/></label>}
    {(kind === 'question' || kind === 'handoff') && <>
      <label>Destinatario<SelectRole name="to" initial={kind === 'handoff' ? 'tester' : 'architect'}/></label>
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

function TaskDetail({project, task, act}: {project: OfficinaProject; task: OfficinaTask; act: Act}) {
  const events = forTask(project, task), runs = project.runs.filter(run => run.task === task.id);
  const open = task.status === 'done' ? [] : officinaOpenItems(events);
  return <>
    <div className="officina-task-fields">
      <p><strong>{officinaRoles[task.owner].name} · {officinaTaskLabels[task.status]}</strong></p>
      <p>{task.objective}</p><h3>Criterios de aceptación</h3><p>{task.criteria}</p>
      <p role="status">{officinaQa(project.events, task.id)}</p>
      {open.map(item => <p className="officina-attention" key={item.id}>{officinaEventLabels[item.data.kind]} · {item.data.text}</p>)}
    </div>
    <details><summary>Editar tarea</summary><TaskForm key={JSON.stringify(task)} project={project.id} task={task} act={act}
      done={() => {}}/></details>
    {task.status !== 'done' && <details><summary>Asignar un encargo</summary><form className="officina-form" onSubmit={event => {
      event.preventDefault();
      void act({type: 'assign', project: project.id, task: task.id, role: new FormData(event.currentTarget).get('role') as OfficinaRole});
    }}><label>Puesto<SelectRole name="role" initial={task.owner}/></label><button type="submit">Poner en cola</button></form></details>}
    <details><summary>Registrar actividad</summary><EventForm project={project} task={task} act={act}/></details>
    {!!runs.length && <section className="officina-history"><h3>Encargos de Codex</h3>
      {runs.slice().reverse().map(run => <article key={run.id}>
        <strong>{officinaActorName(run.role)} · {officinaRunLabels[run.state]}</strong>
        {run.issue && <p>{run.issue}</p>}
        {(run.state === 'sent' || run.state === 'uncertain') && <details>
          <summary>Revisé el chat de Codex</summary>
          <button onClick={() => void act({type: 'release', project: project.id, run: run.id})}>Liberar el turno y detener la cola</button>
        </details>}
      </article>)}
    </section>}
    {!!events.length && <section className="officina-history"><h3>Historial de la tarea</h3>
      {events.slice().reverse().map(event => <EventDetail key={event.id} event={event} events={events}/>)}
    </section>}
  </>;
}

function PanelContent({panel, project, team, act, open, close}: {
  panel: Panel; project?: OfficinaProject; team: Team; act: Act; open: (panel: Panel) => void; close: () => void;
}) {
  if (panel.type === 'project') return <form className="officina-form" onSubmit={async event => {
    event.preventDefault();
    if (await act({type: 'project', name: String(new FormData(event.currentTarget).get('name'))})) close();
  }}><label>Nombre del proyecto<input name="name" required maxLength={120} data-hold-island-open/></label>
    <button type="submit" className="officina-accent">Crear proyecto</button></form>;
  if (!project) return <button className="officina-accent" onClick={() => open({type: 'project'})}>Crear proyecto</button>;
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
  if (panel.type === 'new') return <TaskForm project={project.id} role={panel.role} act={act} done={close}/>;
  if (panel.type === 'event') {
    const event = project.events.find(item => item.id === panel.id);
    if (!event) return null;
    return <><EventDetail event={event} events={project.events}/>
      <button onClick={() => open({type: 'task', id: event.task})}>Ver tarea <ArrowRight/></button></>;
  }
  if (panel.type === 'task') {
    const task = project.tasks.find(item => item.id === panel.id);
    return task ? <TaskDetail key={task.id} project={project} task={task} act={act}/> : null;
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
        <small>{role === 'alm' ? officinaQa(project.events, task.id) : `${officinaRoles[task.owner].name} · ${officinaTaskLabels[task.status]}`}</small>
      </span><ArrowRight/></button>)}</div> : <p>Sin tareas asignadas.</p>}
  </>;
}

function TrackingLabel({activity}: {activity: Tracking}) {
  return <span className="officina-tracking-label"><i aria-hidden="true"/>{officinaTrackingLabels[activity.state]}</span>;
}

function ReviewPermission() {
  return <button onClick={() => void window.companion.navigate('permissions')}>Revisar en Permisos de Codex</button>;
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

function ProjectChat({view, act, open}: {view?: OfficinaView; act: Act; open: (panel: Panel) => void}) {
  const project = view?.project;
  const teamSize = project?.team ? Object.keys(project.team.threads).length : 0;
  return <section className="officina-chat" aria-label="Chat global">
    {project?.team && <details className="officina-project-tools">
      <summary>Chats en Codex <span>{teamSize === OfficinaActor.options.length ? '6 chats vinculados' : `${teamSize} de 6 chats vinculados`}</span></summary>
      {project.team.projectId && project.team.cwd && <ProjectFolder project={project} act={act}/>}
      {project.team.projectId && <div className="officina-chat-team" aria-label="Chats del proyecto en Codex">
        {OfficinaActor.options.filter(role => project.team?.threads[role]).map(role =>
          <button key={role} data-role={role} onClick={() => void act({type: 'open-team-chat', project: project.id, role})}>
            {officinaActorName(role)} <ArrowRight aria-hidden="true"/>
          </button>)}
      </div>}
    </details>}
    {!project?.goals?.length && <p className="officina-empty-chat">Aún no hay mensajes en este proyecto.</p>}
    {project?.goals?.slice().reverse().map(goal => {
      const task = project.tasks.find(item => item.id === goal.task);
      const closed = goal.phase === 'complete' || task?.status === 'done';
      const events = project.events.filter(event => event.task === goal.task);
      const blocker = officinaOpenItems(events).filter(event => event.data.kind === 'blocker').at(-1);
      const runs = project.runs.filter(run => run.task === goal.task);
      const active = closed ? undefined : runs.find(run => ['sending', 'sent', 'uncertain'].includes(run.state)) ??
        runs.find(run => run.state === 'waiting');
      const activeState = active && officinaRunTracking(active, view?.activity);
      const browserReview = isOfficinaTabReview(officinaGoalRequest(goal), officinaGoalBrowser(project, goal));
      return <article key={goal.task} className="officina-goal">
        {activeState && active && <p className="officina-current" data-state={activeState} role="status">
          <strong>{officinaActorName(active.role)}</strong><TrackingLabel activity={{state: activeState}}/>
          {activeState === 'permission' && <ReviewPermission/>}
        </p>}
        {closed && <p className="officina-current" data-state={goal.outcome === 'limited' ? 'limited' : 'done'}>
          <span>{goal.outcome === 'limited' ? 'Cerrado con limitaciones' : 'Objetivo completado'}</span>
        </p>}
        {goal.history.map((message, index) => <div key={index} className="officina-chat-message" data-from={message.from}>
          <strong>{message.from === 'human' ? 'Tú' : message.from === 'zen' ? 'Officina' : 'Coordinación'}</strong><p>{message.text}</p>
        </div>)}
        {goal.steps.length > 0 && <details className="officina-project-tools"><summary>Pasos del encargo</summary>
          <ol className="officina-goal-steps">{goal.steps.map((step, index) => {
          const run = runs.filter(item => item.step === index).at(-1);
          return <li key={index}><strong>{officinaActorName(step.role)}</strong> {step.instruction}
            <small>{!closed && blocker?.from === step.role && goal.cursor === index ? officinaTrackingLabels.blocked :
              run ? officinaTrackingLabels[officinaRunTracking(run, view?.activity)] :
                officinaTrackingLabels[closed ? 'skipped' : 'scheduled']}</small></li>;
        })}</ol></details>}
        {blocker && !closed && <p className="officina-attention">{officinaEventLabels.blocker} · {blocker.data.text}</p>}
        {browserReview && blocker?.from === 'analyst' && (goal.phase === 'work' || goal.outcome === 'limited') &&
          goal.steps[goal.cursor]?.role === 'analyst' && !active &&
          <button onClick={() => void act({type: 'resume-browser-review', project: project.id, task: goal.task})}>Reintentar con la extensión</button>}
        {goal.question && !closed && <form className="officina-form" onSubmit={async event => {
          event.preventDefault();
          const form = event.currentTarget;
          if (await act({type: 'answer-goal', project: project.id, task: goal.task,
            message: String(new FormData(form).get('answer'))})) form.reset();
        }}>
          <p className="officina-attention">{goal.question}</p>
          {goal.phase === 'plan' && browserReview && <button type="button" className="officina-accent"
            onClick={() => void act({type: 'resume-browser-review', project: project.id, task: goal.task})}>
            Asignar revisión al Analista
          </button>}
          <label>Información para continuar<textarea name="answer" required maxLength={700} data-hold-island-open/></label>
          <button type="submit">Continuar objetivo</button>
        </form>}
        <button onClick={() => open({type: 'task', id: goal.task})}>Ver tarea <ArrowRight/></button>
      </article>;
    })}
  </section>;
}

function ProjectComposer({project, act, showChat, ready}: {project?: OfficinaProject; act: Act; showChat: () => void; ready: boolean}) {
  const requestId = useRef(crypto.randomUUID());
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget, fields = new FormData(form);
    const name = project?.name ?? String(fields.get('projectName') ?? '');
    if (!await act({type: 'chat', id: requestId.current, name, message: String(fields.get('message'))})) return;
    requestId.current = crypto.randomUUID();
    form.reset();
    showChat();
  }
  return <form className="officina-chat-compose" aria-label="Escribir en Chat global" onSubmit={submit}>
    <MessageSquare className="officina-compose-icon" aria-hidden="true"/>
    {!project && ready && <input aria-label="Proyecto en Codex" required maxLength={120} name="projectName"
      placeholder="Nombre del proyecto" data-hold-island-open/>}
    <textarea aria-label="Objetivo" required maxLength={800} name="message" rows={1}
      placeholder="Describe lo que quieres" disabled={!ready} data-hold-island-open/>
    <button className="officina-accent" aria-label="Enviar a coordinación" type="submit" disabled={!ready}>
      <Send aria-hidden="true"/><span>Enviar</span>
    </button>
  </form>;
}

export function OfficinaWorkspace({motion}: {motion: boolean}) {
  const [view, setView] = useState<OfficinaView>();
  const [panel, setPanel] = useState<Panel>();
  const [error, setError] = useState('');
  const [hidden, setHidden] = useState(document.hidden);
  const [chat, setChat] = useState(false);
  const sideContent = useRef<HTMLDivElement>(null);
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
  const team = Object.fromEntries(OfficinaActor.options.map(role => [role, officinaRoleTracking(project, role, view?.activity)])) as Team;
  const last = project?.events.filter(event => event.data.kind === 'handoff').at(-1);
  const waiting = project?.runs.filter(run => run.state === 'waiting').length ?? 0;
  const stuck = project?.runs.find(run => (run.state === 'uncertain' || run.state === 'review' || run.state === 'waiting') && run.issue);
  const approval = view?.activity?.state === 'permission' ? project?.runs.find(run => run.id === view.activity?.run) : undefined;
  const controls = project && <div className="officina-dispatch">
    {project.team?.issue && <p role="status">{project.team.issue}</p>}
    {view?.dispatchBlock && <p role="status">{view.dispatchBlock}</p>}
    {stuck && <button className="officina-attention" onClick={() => open({type: 'task', id: stuck.task})}>{stuck.issue ?? 'Revisar encargo'}</button>}
    <details className="officina-project-tools">
      <summary>Opciones del proyecto {waiting > 0 && <span>{waiting} en espera</span>}</summary>
      <div className="officina-project-actions">
        {!project.team && <button onClick={() => open({type: 'binding'})}><Settings2 aria-hidden="true"/>{project.binding?.environment ?? 'Vincular Codex'}</button>}
        {(project.binding || project.team) && <button aria-pressed={view?.enabled} onClick={() => void act({type: 'queue', project: project.id, enabled: !view?.enabled})}>
          {view?.enabled ? 'Detener cola' : 'Activar cola'}
        </button>}
      </div>
    </details>
  </div>;
  const title = panel?.type === 'project' ? 'Nuevo proyecto' : panel?.type === 'binding' ? 'Vincular Codex' :
    panel?.type === 'role' ? officinaActorName(panel.role) : panel?.type === 'task' ?
      project?.tasks.find(task => task.id === panel.id)?.title ?? 'Tarea' : panel?.type === 'new' ? 'Nueva tarea' :
      panel?.type === 'event' ? 'Actividad de la conexión' : project?.name ?? 'Tablero del proyecto';
  return <section className="officina" aria-label="Officina">
    <header className="officina-header">
      <div className="officina-brand"><ZenEmblem/><h1>Officina</h1></div>
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
    <div className="officina-layout">
      <Scene key={project?.id} project={project} team={team} animate={motion && !hidden} open={open}/>
      <aside className="officina-side">
        <div className="officina-side-tabs" role="group" aria-label="Panel de Officina">
          <button aria-pressed={!chat} onClick={() => setChat(false)}><Users aria-hidden="true"/>Equipo</button>
          <button aria-pressed={chat} onClick={() => setChat(true)}><MessageSquare aria-hidden="true"/>Chat global</button>
        </div>
        <div className="officina-side-content" ref={sideContent} key={`${project?.id}-${chat}`}>
          {chat ? <ProjectChat view={view} act={act} open={open}/> : <section className="officina-team" aria-label="Actividad del equipo">
        <div className="officina-team-list">
          {(project?.team ? OfficinaActor.options : roles).map(role => {
            const activity = team[role];
            return <button key={role} data-role={role} data-state={activity.state} onClick={() => open({type: 'role', role})}>
              <RoleIcon role={role}/><span><strong>{officinaActorName(role)}</strong><TrackingLabel activity={activity}/>
                {activity.state !== 'idle' && activity.title && <small title={activity.detail ?? activity.title}>{activity.title}</small>}
              </span>
            </button>;
          })}
        </div>
        {last?.data.kind === 'handoff' && <div className="officina-last">
          <h3>Último traspaso</h3>
            <strong>{officinaRoles[last.from].name} <ArrowRight aria-label="a"/> {officinaRoles[last.data.to].name}</strong>
            <button onClick={() => open({type: 'task', id: last.task})}>Ver tarea <ArrowRight aria-hidden="true"/></button>
        </div>}
          </section>}
          {controls}
        </div>
        {approval && <div className="officina-approval" role="status"><strong>Aprobación pendiente</strong>
          <p>{officinaActorName(approval.role)} necesita tu permiso para continuar.</p><ReviewPermission/>
        </div>}
      </aside>
    </div>
    <ProjectComposer key={project?.id} project={project} act={act} ready={!!view} showChat={() => {
      setChat(true);
      sideContent.current?.scrollTo(0, 0);
    }}/>
    {panel && <Modal title={title} close={close}>
      {error && <p className="officina-error" role="alert">{error}</p>}
      <PanelContent key={JSON.stringify(panel)} panel={panel} project={project} team={team} act={act} open={open} close={close}/>
    </Modal>}
  </section>;
}
