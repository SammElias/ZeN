import React, {lazy, Suspense, useEffect, useRef, useState} from 'react';
import {CompanionSettingsSchema, type CompanionStatus} from '../shared/codex-companion';
import {activeSession, connectionLabel, isSilenced, phaseNames as names} from '../shared/companion-presentation';
import {defaultAppearance, type AppearanceState} from '../shared/companion-appearance';
import type {LauncherPage, WorkspacePage} from '../shared/companion-workspace';
import {CAPSULE_HEIGHT} from '../shared/island';
import {setLanguage} from '../coucou/i18n/i18n';
import {Sound} from '../coucou/core/sound';
import {AppearanceSettings, appearanceVars} from './AppearanceSettings';
import {CapsuleMenu, CapsuleNavigation, launcherName} from './CapsuleNavigation';
import {CapsuleMove} from './CapsuleMove';
import {CodexWorkspace} from './CodexWorkspace';
import {CompanionIcon} from './CompanionActions';
import {CompanionHome} from './CompanionHome';
import {CompanionMiniMusic, CompanionMusic, CompanionNowPlaying, useNowPlaying} from './CompanionMusic';
import {CompanionNotices} from './CompanionNotices';
import {CompanionSettings} from './CompanionSettings';
import {OrbitalMark} from './OrbitalMark';

const NotesWorkspace = lazy(() => import('./NotesWorkspace').then(module => ({default:module.NotesWorkspace})));

setLanguage('es');
const initial: CompanionStatus = {
 settings: CompanionSettingsSchema.parse({}),
 account: 'unchecked',
 checking: false,
 integration: 'missing',
 sessions: [],
 approvals: [],
 notices: [],
};

function useCompanion() {
 const [status, setStatus] = useState(initial);
 const [ready, setReady] = useState(false);
 useEffect(() => {
  function update(value: CompanionStatus) {
   setStatus(current => (current.revision ?? -1) > (value.revision ?? 0) ? current : value);
   setReady(true);
  }
  const unsubscribe = window.companion.onStatus(update);
  void window.companion.status().then(result => {if (result.ok) update(result.value);});
  return unsubscribe;
 }, []);
 return {status, ready};
}

function useNoticeSound(status: CompanionStatus, ready: boolean) {
 const {notices, settings} = status;
 const seen = useRef<Set<string>>(null);
 const enabled = settings.sounds && !settings.presentation && !settings.paused && !isSilenced(settings);
 useEffect(() => {
  Sound.setEnabled(enabled);
  Sound.setVolume(.1);
  if (ready && settings.sounds && !settings.presentation) void Sound.preload();
 }, [status, ready]);
 useEffect(() => {
  if (!ready) return;
  const previous = seen.current;
  seen.current = new Set(notices.map(notice => notice.id));
  if (!previous || !enabled || document.hidden) return;
  const next = notices.find(notice => !previous.has(notice.id) && !notice.read && notice.audible !== false);
  if (next) {
   Sound.resume();
   Sound.play(next.kind === 'permission' ? 'approval' : next.kind === 'error' ? 'error' : 'finish');
  }
 }, [enabled, notices, ready]);
}

function ReturnApp({status, onError}: {status: CompanionStatus; onError: (error: string) => void}) {
 const name = status.settings.presentation ? undefined : status.desktop?.name;
 const label = name ? 'Volver a ' + name : 'Volver a mi aplicación';
 return <button className="return-app" disabled={!status.desktop?.available}
   aria-label="Volver a mi aplicación" title={status.desktop?.available ? label : 'Activa primero una aplicación de trabajo'}
   onClick={async () => {
    const result = await window.companion.returnApp();
    onError(result.ok ? '' : result.error);
   }}>
   <CompanionIcon name="return"/><span>{name ?? 'Volver'}</span>
 </button>;
}

export function CodexCompanion(){
 const {status,ready}=useCompanion(),[error,setError]=useState(''),[reduced,setReduced]=useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
 const {track:nowPlaying}=useNowPlaying(status);
 const expanded=status.workspace?.expanded??false,page=status.workspace?.page??'home';
 const [themePreview,setThemePreview]=useState<AppearanceState>();
 const savedAppearance = status.appearance ?? defaultAppearance;
 const appearance: AppearanceState = status.settings.presentation
  ? {...savedAppearance, background: 'aurora', imageUrl: undefined, imageName: undefined}
  : (expanded && page === 'settings' ? themePreview : undefined) ?? savedAppearance;
 useNoticeSound(status,ready);
 useEffect(()=>{const q=matchMedia('(prefers-reduced-motion: reduce)'),fn=()=>setReduced(q.matches);q.addEventListener('change',fn);return()=>q.removeEventListener('change',fn);},[]);
 const active=activeSession(status),phase=status.approvals.length?'approval':active?.state??'idle',state=status.settings.paused?'sleeping':phase==='unknown'||phase==='interrupted'?'idle':phase;
 const unread=status.notices.filter(n=>!n.read).length,label=status.settings.paused?'Avisos en pausa':active?names[phase]:connectionLabel(status);
 const stateDetail=(status.settings.presentation&&error?'Revisa Codex':error)||status.desktop?.error||status.targetError||(status.settings.presentation?'Presentación · detalles ocultos':status.workspace?.compact==='codex'?(active?.steps.at(-1)?.preview?.split('\n')[0]?.slice(0,180)||active?.steps.at(-1)?.label||'Sin acciones recibidas'):status.target?'Fijado · '+status.target.title:active?.label)||'Tu escritorio, a mano';
 const toggle=()=>void window.companion.launcher(!expanded);
 const navigate=(v:WorkspacePage)=>void window.companion.navigate(v).then(r=>{if(!r.ok)setError(r.error);});
 const context=(v:LauncherPage)=>void window.companion.launcherContext(v).then(r=>{if(!r.ok)setError(r.error);});

 async function openStatus() {
  const hasApprovals = status.approvals.length > 0;
  const result = await window.companion.navigate(hasApprovals ? 'permissions' : 'codex');
  if (!result.ok) setError(result.error);
  else if (!hasApprovals) void window.companion.check();
 }

 useEffect(()=>{
  function handleEscape(event: KeyboardEvent) {
   if (event.key !== 'Escape' || event.defaultPrevented || !expanded) return;
   event.preventDefault();
   void window.companion.launcher(false);
  }
  window.addEventListener('keydown',handleEscape);
  return () => window.removeEventListener('keydown',handleEscape);
 },[expanded]);

 return <main className={'companion-capsule '+(expanded?'expanded companion-shell':'collapsed')} data-theme={appearance.theme} data-accent={appearance.accent} data-background={appearance.background} style={{...appearanceVars(appearance),'--capsule-header-height':`${CAPSULE_HEIGHT-2}px`} as React.CSSProperties} data-state={state} data-motion={status.settings.motion&&!reduced}>
  <header className="companion-bar capsule-single-row" data-has-media={!!nowPlaying||!expanded&&status.workspace?.compact==='spotify'&&status.approvals.length===0}>
   <div className="capsule-codex-block" data-capsule-block="codex">
   <button className="companion-brand" aria-label="Opciones de ZEN" title={expanded?'Recoger a cápsula':'Abrir última integración · '+launcherName[status.workspace?.last??'home']} aria-expanded={expanded} onClick={toggle}><OrbitalMark status={status} ready={ready}/></button>
   <button className="companion-state" data-compact={status.workspace?.compact==='codex'} title={label+' · '+stateDetail} onClick={()=>void openStatus()}><strong><i/><span className="capsule-state-label" title={label}>{label}</span></strong><small title={stateDetail}>{stateDetail}</small></button>
   </div>
   <CapsuleNavigation status={status} onError={setError}/>
   <div className="capsule-media-block" data-capsule-block="music">
    {!expanded&&status.workspace?.compact==='spotify'&&status.approvals.length===0?<CompanionMiniMusic status={status}/>:nowPlaying?<CompanionNowPlaying track={nowPlaying}/>:<button className="capsule-music-empty" title={status.settings.presentation||status.settings.paused?'Sonido oculto por privacidad':'Ver reproductores multimedia de Windows'} onClick={()=>navigate('spotify')}><CompanionIcon name="sound"/><span><strong>{status.settings.presentation||status.settings.paused?'Sonido oculto':'Sin reproducción'}</strong><small>Multimedia de Windows</small></span></button>}
   </div>
   <nav className="capsule-actions" data-capsule-block="controls" aria-label="Controles de la cápsula">
    <button className="capsule-notices" data-page="notices" aria-label="Avisos" title={'Avisos'+(unread?' · '+unread+' pendientes':'')} aria-expanded={expanded&&page==='notices'} aria-pressed={expanded&&page==='notices'} aria-controls="capsule-content" onClick={()=>void window.companion.togglePage('notices')} onContextMenu={e=>{e.preventDefault();context('notices');}}>
     <CompanionIcon name="bell"/>{unread>0&&<b className="badge">{unread>99?'99+':unread}</b>}
    </button>
    <ReturnApp status={status} onError={setError}/>
    <button className="capsule-options" aria-label="Opciones" title="Más opciones" aria-controls="capsule-content" aria-expanded={expanded&&page==='options'} onClick={()=>void window.companion.options()}>
     <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>
    </button>
    <button className="integration-launch-toggle" aria-label="Integraciones" title={expanded?'Volver a la cápsula':'Abrir panel'} aria-expanded={expanded} onClick={toggle}>
     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>
    </button>
    <CapsuleMove onError={setError}/>
    <button className="capsule-hide" aria-label="Ocultar ZEN" title="Ocultar ZEN" onClick={()=>void window.companion.hide()}><CompanionIcon name="close"/></button>
   </nav>
  </header>
  {expanded&&<>
   <section id="capsule-content" className="workspace-content" data-page={page}>
    {page==='home'?<CompanionHome status={status} nowPlaying={nowPlaying} onNavigate={navigate}/>:
    page==='spotify'?<CompanionMusic status={status}/>:
    page==='notes'?(status.settings.presentation || status.settings.paused
      ? <div className="companion-empty"><h2>Apuntes ocultos</h2><p role="status">Desactiva la pausa o Presentación para abrir el cuaderno.</p></div>
      : <Suspense fallback={<p role="status">Abriendo Apuntes…</p>}><NotesWorkspace appearance={appearance}/></Suspense>):
    page==='notices'?<><div className="workspace-section-heading"><h1>Avisos</h1></div><CompanionNotices status={status}/></>:
    page==='options'||page==='shortcuts'?<CapsuleMenu status={status} context={page==='shortcuts'?status.workspace?.context:undefined}/>:
    page==='settings'?<><div className="workspace-section-heading"><h1>Preferencias</h1><button onClick={()=>navigate('home')}>Volver a Home</button></div>{!status.settings.presentation&&<AppearanceSettings value={status.appearance} onPreview={setThemePreview}/>}<CompanionSettings status={status}/></>:
    <CodexWorkspace status={status} monochrome={appearance.theme==='monochrome'}/>}
   </section>
  </>}
 </main>;
}
