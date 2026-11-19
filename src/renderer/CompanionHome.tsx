import React, {useEffect, useState} from 'react';
import type {CompanionSession, CompanionStatus} from '../shared/codex-companion';
import type {MediaNowPlaying} from '../shared/companion-media';
import type {WorkspacePage} from '../shared/companion-workspace';
import type {RecentHubNote} from '../shared/knowledge-hub';
import {activeSession, connectionLabel, phaseNames} from '../shared/companion-presentation';
import {hubName} from '../shared/companion-navigation';
import {CodexRequestForm} from './CodexRequestForm';
import {CompanionIcon, Quiet} from './CompanionActions';
import {ZenEmblem} from './ZenEmblem';
import type {HubDestination} from './NotesWorkspace';
import './CompanionHome.css';

type Props = {
  status: CompanionStatus;
  ready: boolean;
  visible: boolean;
  draft: string;
  setDraft: (value:string)=>void;
  nowPlaying: MediaNowPlaying | null;
  onNavigate: (page: WorkspacePage) => void;
  onOpenNotes: (destination: HubDestination) => void;
};

const dates = new Intl.DateTimeFormat('es', {day:'numeric', month:'short'});
const times = new Intl.DateTimeFormat('es', {hour:'2-digit', minute:'2-digit'});
const noticePriority = {permission:0, error:1, finished:2};

function RecentNotes({onOpen, visible}: {onOpen: Props['onOpenNotes']; visible:boolean}) {
  const [notes, setNotes] = useState<RecentHubNote[]>();
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if(!visible)return;
    let generation = 0;
    const refresh = async () => {
      const attempt = ++generation;
      setNotes(undefined);
      setError('');
      if (document.hidden) return;
      try {
        const result = await window.companion.notesRecent();
        if (attempt !== generation || document.hidden) return;
        if (result.ok) setNotes(result.value);
        else setError(result.error);
      } catch {
        if (attempt === generation) setError('No se pudieron cargar los apuntes recientes.');
      }
    };
    document.addEventListener('visibilitychange', refresh);
    void refresh();
    return () => {
      generation++;
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [retry, visible]);

  return <article className="home-panel" aria-labelledby="home-notes-title">
    <header className="home-panel-heading">
      <h3 id="home-notes-title">Apuntes recientes</h3>
      <button type="button" className="home-panel-link" aria-label="Ver todos los apuntes" onClick={()=>onOpen('all')}>
        Ver todos<CompanionIcon name="arrow"/>
      </button>
    </header>
    {error ? <div className="home-list-empty"><p role="alert">{error}</p>
      <button type="button" onClick={()=>setRetry(value=>value+1)}>Reintentar</button>
    </div> : !notes ? <p className="home-list-empty" role="status">Cargando apuntes…</p> :
      notes.length ? <ul className="home-items">{notes.map(note=><li key={note.id}>
        <button type="button" className="home-item" data-note-id={note.id} onClick={()=>onOpen({noteId:note.id})}>
          <span className="home-note-icon"><CompanionIcon name="notebook"/></span>
          <span className="home-item-copy">
            <strong title={note.title}>{note.title}</strong>
            {note.folder && <small title={note.folder}>{note.folder}</small>}
          </span>
          {note.favorite && <span className="home-favorite" role="img" aria-label="Favorito">★</span>}
          <time dateTime={new Date(note.updatedAt).toISOString()}>{dates.format(note.updatedAt)}</time>
        </button>
      </li>)}</ul> : <div className="home-list-empty"><p>Todavía no tienes apuntes.</p>
        <button type="button" onClick={()=>onOpen('new')}><CompanionIcon name="plus"/>Crear apunte</button>
      </div>}
  </article>;
}

function RecentCodex({status, session, open}: {
  status: CompanionStatus;
  session?: CompanionSession;
  open: (action: () => ReturnType<typeof window.companion.codexTab>) => void;
}) {
  const chats = new Map(status.sessions.map(chat=>[chat.id,chat]));
  const notices = new Map(status.notices.map(notice=>[notice.id,notice]));
  const steps = status.sessions.flatMap(chat=>[...chat.steps].reverse().map(step=>({chat,step})));
  const stepIds = new Set(steps.map(({step})=>step.id));
  const earlier = status.notices.flatMap(notice=>{
    const chat = chats.get(notice.session);
    if (!chat || notice.kind === 'permission' || stepIds.has(notice.id)) return [];
    return [{chat,step:{id:notice.id,label:notice.title,at:notice.at}}];
  });
  const events = [...steps,...earlier].sort((a,b)=>b.step.at-a.step.at).slice(0,4);

  return <article className="home-panel" aria-labelledby="home-activity-title">
    <header className="home-panel-heading">
      <h3 id="home-activity-title">Actividad de Codex</h3>
      <button type="button" className="home-panel-link" aria-label="Ver actividad" onClick={()=>open(()=>window.companion.codexTab('activity'))}>
        Ver actividad<CompanionIcon name="arrow"/>
      </button>
    </header>
    {events.length ? <ul className="home-items">{events.map(({chat,step})=>{
      const current = chat.id === session?.id && stepIds.has(step.id);
      const notice = notices.get(step.id);
      const failure = notice?.kind === 'error';
      const summary = current && Boolean(status.target) && chat.state === 'finished' && step.id === chat.steps.at(-1)?.id;
      const result = summary && !failure;
      const label = result ? 'Ver resumen' : current ? 'Ver actividad' : 'Abrir chat en Codex';
      const eventTitle = failure ? notice.title : step.label;
      return <li key={step.id}>
        <button type="button" className="home-item" title={label}
          aria-label={`${label} · ${eventTitle} · ${chat.label}`} onClick={()=>open(
            ()=>current ? window.companion.codexTab(result?'summary':'activity') : window.companion.openCodex(chat.id),
          )}>
          <span aria-hidden="true" className="home-event-dot" data-kind={failure ? 'error' : result ? 'finished' : undefined}/>
          <span className="home-item-copy"><strong title={eventTitle}>{eventTitle}</strong><small title={chat.label}>{chat.label}</small></span>
          <time dateTime={new Date(step.at).toISOString()} title={new Date(step.at).toLocaleString('es')}>
            {dates.format(step.at)} · {times.format(step.at)}
          </time>
        </button>
      </li>;
    })}</ul> : <p className="home-list-empty">Todavía no hay actividad observada.</p>}
  </article>;
}

export function CompanionHome({status, ready, visible, draft, setDraft, nowPlaying, onNavigate, onOpenNotes}: Props) {
  const [navigationError, setNavigationError] = useState('');
  const hidden = status.settings.presentation || status.settings.paused;
  const track = hidden ? null : nowPlaying;
  const session = activeSession(status);
  const permission = status.approvals.length > 0;
  const phase = status.settings.paused ? 'paused' : permission ? 'approval' : session?.state ?? 'unknown';
  const workState = !ready ? 'Cargando estado de Codex…' : status.settings.paused ? 'ZEN en pausa'
    : permission ? phaseNames.approval : session ? phaseNames[session.state] : connectionLabel(status);
  const workDetail = !hidden ? session?.label ?? status.target?.title : undefined;
  const pending = hidden ? [] : status.notices.filter(notice=>!notice.read);
  const latest = pending.sort((a,b)=>noticePriority[a.kind]-noticePriority[b.kind] || b.at-a.at)[0];
  const trackDetail = track && [track.artist, track.source].filter(Boolean).join(' · ');

  function open(action: () => ReturnType<typeof window.companion.codexTab>) {
    setNavigationError('');
    void action().then(result=>{if (!result.ok) setNavigationError(result.error);})
      .catch(()=>setNavigationError('No se pudo abrir la vista de Codex.'));
  }

  return <section className="home-status" aria-labelledby="home-title" data-phase={phase}>
    <header className="home-status-heading">
      <div className="home-wordmark">
        <span className="home-brand-mark"><ZenEmblem/></span>
        <h1 id="home-title">ZEN <span>Workspace</span></h1>
      </div>
      <div className="home-header-actions">
        {!hidden && <button type="button" className="home-open-requests" onClick={()=>open(()=>window.companion.codexTab('summary'))}>
          Peticiones y resultados<CompanionIcon name="arrow"/>
        </button>}
        <button type="button" onClick={()=>onNavigate('settings')}>
          <CompanionIcon name="settings"/>Preferencias
        </button>
      </div>
    </header>
    {navigationError && !hidden && <p className="home-navigation-error" role="alert">{navigationError}</p>}

    {hidden ? <p className="home-status-privacy" role="status">{status.settings.presentation?'Presentación activa':'ZEN está en pausa'}</p>
      : <CodexRequestForm fixedChat={status.target?.title} draft={draft} setDraft={setDraft}/>}

    <nav className="home-status-grid" aria-label="Módulos">
      <button type="button" className="home-module home-status-action" data-home-card="work" title={[workState,workDetail].filter(Boolean).join(' · ')} onClick={()=>{
        if (permission) onNavigate('permissions');
        else open(()=>window.companion.codexTab('activity'));
      }}>
        <span className="home-status-icon"><CompanionIcon name="code"/></span>
        <span className="home-module-copy">
          <strong>Codex</strong><small className="home-work-state home-current-state"><span aria-hidden="true" className="home-status-state-dot"/>{workState}</small>
        </span>
        <CompanionIcon name="arrow"/>
      </button>

      <button type="button" className="home-module home-status-action" data-home-card="notes" onClick={()=>onNavigate('notes')}>
        <span className="home-status-icon"><CompanionIcon name="notebook"/></span>
        <span className="home-module-copy"><strong>{hubName}</strong><small>{hidden?'Biblioteca oculta':'Biblioteca personal'}</small></span>
        <CompanionIcon name="arrow"/>
      </button>

      <button type="button" className="home-module home-status-action" data-home-card="music" title={track ? [track.title, trackDetail].filter(Boolean).join(' · ') : undefined} onClick={()=>onNavigate('spotify')}>
        {track?.artwork ? <img className="home-status-artwork" src={track.artwork} alt=""/>
          : <span className="home-status-icon"><CompanionIcon name="sound"/></span>}
        <span className="home-module-copy">
          <strong>Sonido{track && <span className="home-playback-state"> · {track.playing?'En reproducción':'En pausa'}</span>}</strong>
          <small className="home-song-title">
            {hidden?'Sonido oculto':track ? track.title || track.source : 'Sin reproducción'}
          </small>
        </span>
        {track?.playing ? <span aria-hidden="true" className="home-playing-bars" data-visible={visible}><i/><i/><i/><i/></span> : <CompanionIcon name="arrow"/>}
      </button>
    </nav>

    <div className={hidden ? 'home-private-tools' : 'home-continue'}>
      {!hidden && <h2 id="home-continue-title">Continúa donde lo dejaste</h2>}
      <div className={hidden ? undefined : 'home-continue-grid'}>
        {!hidden && <RecentNotes onOpen={onOpenNotes} visible={visible}/>}
        <div className="home-side">
          {!hidden && <RecentCodex status={status} session={session} open={open}/>}
          <section className="home-notices" data-home-card="notices" data-kind={latest?.kind} aria-label="Avisos">
            <button type="button" className="home-status-action home-notices-open" title="Ver avisos" onClick={()=>onNavigate('notices')}>
              <span className="home-status-icon"><CompanionIcon name="bell"/></span>
              <span className="home-notices-copy">
                <strong>Avisos</strong>
                <small>{hidden ? 'Avisos ocultos' : pending.length ? <><span className="home-notice-count">{pending.length}</span>
                  {' '}{pending.length===1?'pendiente':'pendientes'}</> : 'Todo al día'}</small>
                {latest && <span className="home-notice-detail">{latest.kind==='permission' && !permission ? 'Permiso solicitado' : latest.title}</span>}
              </span>
            </button>
            <Quiet status={status} compact/>
          </section>
        </div>
      </div>
    </div>
  </section>;
}
