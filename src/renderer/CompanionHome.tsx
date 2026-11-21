import React, {useEffect, useState} from 'react';
import type {CompanionStatus} from '../shared/codex-companion';
import type {MediaNowPlaying} from '../shared/companion-media';
import {calendarDateInZone} from '../shared/companion-calendar';
import {ouraDuration,type OuraHomeSleep} from '../shared/companion-oura';
import type {WorkspacePage} from '../shared/companion-workspace';
import {activeSession, connectionLabel, phaseNames} from '../shared/companion-presentation';
import {hubName} from '../shared/companion-navigation';
import {CodexRequestForm} from './CodexRequestForm';
import {CompanionIcon} from './CompanionActions';
import {ZenEmblem} from './ZenEmblem';
import {HomeWeather} from './HomeWeather';
import './CompanionHome.css';

type Props = {
  status: CompanionStatus;
  ready: boolean;
  visible: boolean;
  weatherVisible: boolean;
  draft: string;
  setDraft: (value:string)=>void;
  onDismissAssessment?:()=>void;
  nowPlaying: MediaNowPlaying | null;
  onNavigate: (page: WorkspacePage) => void;
};

const fullDate = new Intl.DateTimeFormat('es', {dateStyle:'full'});
const sleepDates = new Intl.DateTimeFormat('es', {day:'numeric', month:'short', timeZone:'UTC'});

function HomeDate({onOpen}:{onOpen:()=>void}) {
  const [today, setToday] = useState(() => new Date());
  useEffect(() => {
    let midnight: ReturnType<typeof setTimeout>;
    function refresh() {
      clearTimeout(midnight);
      const now = new Date();
      setToday(now);
      const tomorrow = new Date(now);
      tomorrow.setHours(24, 0, 0, 0);
      midnight = setTimeout(refresh, tomorrow.getTime() - now.getTime());
    }
    refresh();
    window.addEventListener('focus', refresh);
    return () => {
      clearTimeout(midnight);
      window.removeEventListener('focus', refresh);
    };
  }, []);
  const label = fullDate.format(today);
  const day = calendarDateInZone(today, fullDate.resolvedOptions().timeZone);

  return <button type="button" className="home-panel home-date" data-home-card="date" onClick={onOpen} aria-label={`Abrir Calendario. Hoy es ${label}`}>
    <span className="home-status-icon"><CompanionIcon name="calendar"/></span>
    <span className="home-date-copy"><span>Hoy</span><time dateTime={day}>{label}</time></span>
    <CompanionIcon name="arrow"/>
  </button>;
}

function HomeSleep({sleep,onOpen}:{sleep:OuraHomeSleep;onOpen:()=>void}) {
  const latest = sleep.state==='connected' ? sleep.latest : undefined;
  const pending = sleep.state==='connected' && (latest?.day!==sleep.today || latest.seconds===undefined);
  const connectionMessage = sleep.state==='expired' ? 'La sesión de Oura caducó' :
    sleep.state==='connecting' ? 'Conectando con Oura…' : 'Oura sin conectar';

  return <section className="home-panel home-sleep" aria-labelledby="home-sleep-title" data-home-card="sleep">
    <div className="home-sleep-summary">
      <span className="home-status-icon"><CompanionIcon name="moon"/></span>
      <div className="home-sleep-copy">
        <h2 id="home-sleep-title">Sueño</h2>
        {sleep.state!=='connected' && <p>{connectionMessage}</p>}
        {pending && <p>Anoche pendiente de sincronizar</p>}
        {latest && <p>{pending ? 'Última medición · ' : 'Anoche · '}
          <time dateTime={latest.day}>{sleepDates.format(new Date(`${latest.day}T12:00:00Z`))}</time>
        </p>}
      </div>
    </div>
    {latest && <dl className="home-sleep-values">
      {latest.seconds!==undefined && <div><dt>Duración</dt><dd>{ouraDuration(latest.seconds)}</dd></div>}
      {latest.score!==undefined && <div><dt>Puntuación</dt><dd>{latest.score}<span>/100</span></dd></div>}
    </dl>}
    <button type="button" className="home-panel-link" onClick={onOpen}>Ver métricas<CompanionIcon name="arrow"/></button>
  </section>;
}

export function CompanionHome({status, ready, visible, weatherVisible, draft, setDraft, onDismissAssessment, nowPlaying, onNavigate}: Props) {
  const [navigationError, setNavigationError] = useState('');
  const hidden = status.settings.presentation || status.settings.paused;
  const track = hidden ? null : nowPlaying;
  const session = activeSession(status);
  const permission = (status.approvalCount ?? status.approvals.length) > 0;
  const phase = status.settings.paused ? 'paused' : permission ? 'approval' : session?.state ?? 'unknown';
  const workState = !ready ? 'Cargando estado de Codex…' : status.settings.paused ? 'ZEN en pausa'
    : permission ? phaseNames.approval : session ? phaseNames[session.state] : connectionLabel(status);
  const workDetail = !hidden ? session?.label ?? status.target?.title : undefined;
  const trackDetail = track && [track.artist, track.source].filter(Boolean).join(' · ');

  function open(action: () => ReturnType<typeof window.companion.navigate>) {
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
        {!hidden && <button type="button" className="home-open-requests" onClick={()=>open(()=>window.companion.openCodex())}>
          Abrir chat en Codex<CompanionIcon name="arrow"/>
        </button>}
        <button type="button" onClick={()=>onNavigate('settings')}>
          <CompanionIcon name="settings"/>Preferencias
        </button>
      </div>
    </header>
    {navigationError && !hidden && <p className="home-navigation-error" role="alert">{navigationError}</p>}

    {hidden && <p className="home-status-privacy" role="status">{status.settings.presentation?'Presentación activa':'ZEN está en pausa'}</p>}

    {weatherVisible && !hidden && <HomeWeather/>}
    {visible && <div className="home-glance">
      <HomeDate onOpen={()=>onNavigate('calendar')}/>
      {!hidden && status.ouraHomeSleep && <HomeSleep sleep={status.ouraHomeSleep} onOpen={()=>onNavigate('metrics')}/>}
    </div>}

    <nav className="home-status-grid" aria-label="Módulos">
      <button type="button" className="home-module home-status-action" data-home-card="work" title={[workState,workDetail].filter(Boolean).join(' · ')} onClick={()=>{
        if (permission) onNavigate('permissions');
        else open(()=>window.companion.navigate('codex'));
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

    {!hidden && <CodexRequestForm fixedChat={status.target?.title} draft={draft} setDraft={setDraft} onDismissAssessment={onDismissAssessment}/>}
  </section>;
}
