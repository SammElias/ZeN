import React from 'react';
import type {CompanionStatus} from '../shared/codex-companion';
import type {MediaNowPlaying} from '../shared/companion-media';
import type {WorkspacePage} from '../shared/companion-workspace';
import {activeSession, connectionLabel, phaseNames, toolActivity} from '../shared/companion-presentation';
import {CodexRequestForm} from './CodexRequestForm';
import {CompanionIcon, Quiet} from './CompanionActions';
import './CompanionHome.css';

export type CompanionHomeProps = {
  status: CompanionStatus;
  nowPlaying: MediaNowPlaying | null;
  onNavigate: (page: WorkspacePage) => void;
};

export function CompanionHome({status, nowPlaying, onNavigate}: CompanionHomeProps) {
  const hidden = status.settings.presentation || status.settings.paused;
  const track = hidden ? null : nowPlaying;
  const session = activeSession(status);
  const permission = status.approvals.length > 0;
  const phase = permission ? 'approval' : status.settings.paused ? 'paused' : session?.state ?? 'unknown';
  const workState = permission ? phaseNames.approval : status.settings.paused ? 'ZEN en pausa'
    : session ? phaseNames[session.state] : connectionLabel(status);
  const workDetail = permission
    ? hidden ? 'Revisa la solicitud en Permisos.' : status.approvals.length === 1 ? '1 solicitud para revisar' : `${status.approvals.length} solicitudes para revisar`
    : !hidden && session?.state === 'working' && session.tool ? toolActivity(session.tool).label : '';
  const unread = hidden ? 0 : status.notices.filter(notice => !notice.read).length;
  const latest = hidden ? undefined : status.notices.reduce<(typeof status.notices)[number] | undefined>(
    (last, notice) => !last || notice.at > last.at ? notice : last, undefined,
  );
  const noticeKind = latest ? {permission: 'Permiso solicitado', finished: 'Turno terminado', error: 'Error observado'}[latest.kind] : undefined;

  return <section className="home-status" aria-labelledby="home-title">
    <header className="home-status-heading">
      <h1 id="home-title">Inicio</h1>
      <div className="home-header-actions">
        {!hidden && <button className="home-open-requests" onClick={() => void window.companion.codexTab('summary')}>
          Peticiones y resultados<CompanionIcon name="arrow"/>
        </button>}
        <button className="home-status-settings" onClick={() => onNavigate('settings')}>
          <CompanionIcon name="settings"/>Preferencias
        </button>
      </div>
    </header>

    {!hidden && <CodexRequestForm fixedChat={status.target?.title}/>}
    {hidden && <p className="home-status-privacy" role="status">{status.settings.presentation ? 'Presentación activa' : 'ZEN está en pausa'}</p>}

    <div className="home-status-grid">
      <article className="home-status-card home-status-work" data-home-card="work" data-phase={phase}>
        <header className="home-status-card-heading">
          <span className="home-status-icon"><CompanionIcon name="code"/></span>
          <h2>Codex</h2>
          <span className="home-status-state-dot" aria-hidden="true"/>
        </header>
        <div className="home-status-card-body">
          <strong className="home-status-value home-work-state">{workState}</strong>
          {workDetail && <p className="home-status-detail">{workDetail}</p>}
        </div>
        <button className="home-status-action" onClick={() => onNavigate(permission ? 'permissions' : 'codex')}>
          {permission ? 'Revisar permisos' : 'Ver actividad'}<CompanionIcon name="arrow"/>
        </button>
      </article>

      <article className="home-status-card home-status-music" data-home-card="music">
        <header className="home-status-card-heading">
          <span className="home-status-icon"><CompanionIcon name="sound"/></span>
          <h2>Sonido</h2>
          {track?.artwork && <img className="home-status-artwork" src={track.artwork} alt=""/>}
        </header>
        <div className="home-status-card-body">
          <strong className="home-status-value home-song-title" title={track?.title || undefined}>
            {hidden ? 'Sonido oculto' : track ? track.title || 'Multimedia en reproducción' : 'Sin reproducción'}
          </strong>
          {track && <p className="home-status-detail">
            {track.artist ? `${track.artist} · ` : ''}{track.source}
          </p>}
        </div>
        <button className="home-status-action" onClick={() => onNavigate('spotify')}>
          Abrir Sonido<CompanionIcon name="arrow"/>
        </button>
      </article>

      <article className="home-status-card home-status-notices" data-home-card="notices">
        <header className="home-status-card-heading">
          <span className="home-status-icon"><CompanionIcon name="bell"/></span>
          <h2>Avisos</h2>
        </header>
        <div className="home-status-card-body">
          <strong className="home-status-value">
            {hidden ? 'Avisos ocultos' : unread === 0 ? 'Al día' : <><span className="home-notice-count">{unread}</span> {unread === 1 ? 'pendiente' : 'pendientes'}</>}
          </strong>
          {noticeKind && <p className="home-status-detail">{noticeKind}</p>}
        </div>
        <button className="home-status-action" onClick={() => onNavigate('notices')}>
          Ver avisos<CompanionIcon name="arrow"/>
        </button>
      </article>
    </div>

    <footer className="workspace-home-status"><Quiet status={status}/></footer>
  </section>;
}
