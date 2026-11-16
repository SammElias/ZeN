import React, {lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {CompanionSettingsSchema, type CompanionStatus} from '../shared/codex-companion';
import {activeSession, connectionLabel, phaseNames as names} from '../shared/companion-presentation';
import {defaultAppearance, type AppearanceState} from '../shared/companion-appearance';
import type {LauncherPage, WorkspacePage} from '../shared/companion-workspace';
import {CAPSULE_HEIGHT, CAPSULE_POSITION, EDGE_ISLAND, ISLAND_LAYOUT} from '../shared/island';
import {launcherPages} from '../shared/companion-navigation';
import {canAnimate,motionStyle} from './companion-motion';
import {motion} from '../shared/companion-motion';
import type {ContextDraft} from './CodexContext';
import {setLanguage} from '../coucou/i18n/i18n';
import {interfaceAudio} from './companion-interface-audio';
import {appearanceVars} from './AppearanceSettings';
import {CapsuleMenu, CapsuleNavigation, launcherName} from './CapsuleNavigation';
import {CapsuleDragGrip, CapsulePin} from './CapsuleMove';
import {CodexWorkspace} from './CodexWorkspace';
import {CompanionIcon} from './CompanionActions';
import {CompanionHome} from './CompanionHome';
import {CompanionMiniMusic, CompanionMusic, CompanionNowPlaying, useMediaPlayer, useNowPlaying} from './CompanionMusic';
import {CompanionNotices} from './CompanionNotices';
import {CompanionSettings} from './CompanionSettings';
import {ZenStatusMark} from './ZenStatusMark';
import type {HubDestination} from './NotesWorkspace';
import {DynamicIsland} from './DynamicIsland';
import {CapsulePosition} from './CapsulePosition';

const NotesWorkspace = lazy(() => import('./NotesWorkspace').then(module => ({default:module.NotesWorkspace})));
const narrowCapsule = window.matchMedia(`(max-width: ${CAPSULE_POSITION.narrowAt}px)`);

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

function useCompanionAudio(status: CompanionStatus, ready: boolean) {
 const {notices, settings} = status;
 const seen = useRef<Set<string>>(null);
 useLayoutEffect(() => {if (ready) interfaceAudio.configure(settings);}, [settings, ready]);
 useEffect(() => {
  if (!ready) return;
  const idle = requestIdleCallback(() => interfaceAudio.prepare());
  return () => cancelIdleCallback(idle);
 }, [ready, settings.interfaceSounds, settings.interfaceVolume, settings.sounds, settings.paused, settings.presentation, settings.silencedUntil]);
 useEffect(() => {
  const off = window.companion.onInterfaceEffect(effect => interfaceAudio.play(effect));
  const stopWhenHidden = () => {if (document.hidden) interfaceAudio.stop();};
  document.addEventListener('visibilitychange', stopWhenHidden);
  return () => {
   off();
   document.removeEventListener('visibilitychange', stopWhenHidden);
   interfaceAudio.dispose();
  };
 }, []);
 useEffect(() => {
  if (!ready) return;
  const previous = seen.current;
  seen.current = new Set(notices.map(notice => notice.id));
  if (!previous) return;
  const next = notices.find(notice => !previous.has(notice.id) && !notice.read && notice.audible !== false);
  if (next) interfaceAudio.notice(next.kind === 'permission' ? 'attention' : next.kind === 'error' ? 'error' : 'success');
 }, [notices, ready]);
}

function playClick(event: React.MouseEvent<HTMLElement>) {
 if (event.defaultPrevented || !(event.target instanceof Element)) return;
 const button = event.target.closest('button[data-ui-sound="press"]:enabled');
 if (button) {interfaceAudio.play('press');return;}
 const summary = event.target.closest('summary');
 const disclosure = summary?.parentElement;
 if (disclosure instanceof HTMLDetailsElement && disclosure.matches('.hub-menu,.workspace-layout-menu,.settings-connection,.companion-about')) {
  interfaceAudio.play(disclosure.open ? 'close' : 'open');
 }
}

const shortState:Record<string,string>={
 'Avisos en pausa':'En pausa','Pensando':'Trabajando','Usando herramientas':'Trabajando',
 'Necesita tu permiso':'Pide permiso','Turno terminado':'Terminado','Revisar error':'Revisar error',
 'Esperando eventos de Codex':'En espera','Sin actividad reciente':'En espera',
 'Codex no disponible':'Sin conexión','Integración sin preparar':'Sin enlace',
 'Revisión pendiente en Codex':'Por revisar','Hooks desactivados':'Desactivado',
 'Eventos recibidos':'Disponible','Comprobar conexión':'Sin verificar',
};

export function CodexCompanion(){
 const {status,ready}=useCompanion(),[error,setError]=useState(''),[reduced,setReduced]=useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
 const {track:nowPlaying}=useNowPlaying(status);
 const expanded=status.workspace?.expanded??false,page=status.workspace?.page??'home';
 const mediaPlayer=useMediaPlayer(status,'workspace',expanded&&page==='spotify');
 const [optionsOpen,setOptionsOpen]=useState(false);
 const optionsInFlight=useRef(false);
 const previousOptionsPage=useRef<WorkspacePage|undefined>(undefined);
 const island=status.workspace?.island!==false,showIsland=island||status.workspace?.islandSizing===true&&!status.workspace?.islandControls;
 const [visited,setVisited]=useState(false);
 const root=useRef<HTMLElement>(null),panel=useRef<HTMLElement>(null);
 const scroll=useRef<Partial<Record<WorkspacePage,number>>>({});
 const previousPage=useRef<WorkspacePage|undefined>(undefined);
 const previousSettingsPage=useRef<WorkspacePage>('home');
 const [settingsOpened,setSettingsOpened]=useState(false);
 const viewAnimation=useRef<Animation|undefined>(undefined);
 const [homeDraft,setHomeDraft]=useState('');
 const contextKey=JSON.stringify([status.target?.session,status.target?.cwd,status.targetError,status.settings.paused,status.settings.presentation]);
 const contextMemory=useMemo<{current?:ContextDraft}>(()=>({}),[contextKey]);
 const [notesOpened,setNotesOpened]=useState(false);
 const focusDestination=useRef<'island'|'rail'|undefined>(undefined);
 const menuOpener=useRef<HTMLElement|null>(null);
 const [themePreview,setThemePreview]=useState<AppearanceState>();
 const [notesDestination,setNotesDestination]=useState<HubDestination>();
 const notesVisible=page==='notes'&&!status.settings.presentation&&!status.settings.paused;
 const safeNotes=!status.settings.presentation&&!status.settings.paused;
 useEffect(()=>{if(notesVisible&&expanded)setNotesOpened(true);},[notesVisible,expanded]);
 useEffect(()=>{
  function clearWhenHidden(){if(document.hidden)contextMemory.current=undefined;}
  document.addEventListener('visibilitychange',clearWhenHidden);
  return ()=>document.removeEventListener('visibilitychange',clearWhenHidden);
 },[contextMemory]);
 useEffect(()=>{if(status.settings.presentation||status.settings.paused)setHomeDraft('');},[status.settings.presentation,status.settings.paused]);
 useEffect(()=>{
  if(notesVisible)return()=>setNotesDestination(undefined);
 },[notesVisible]);
 const savedAppearance = status.appearance ?? defaultAppearance;
 const appearance: AppearanceState = status.settings.presentation
  ? {...savedAppearance, background: 'aurora', imageUrl: undefined, imageName: undefined}
  : (expanded && page === 'settings' ? themePreview : undefined) ?? savedAppearance;
 useCompanionAudio(status,ready);
 useEffect(()=>{const q=matchMedia('(prefers-reduced-motion: reduce)'),fn=()=>setReduced(q.matches);q.addEventListener('change',fn);return()=>q.removeEventListener('change',fn);},[]);
 const active=activeSession(status),phase=status.approvals.length?'approval':active?.state??'idle',state=status.settings.paused?'sleeping':phase==='unknown'||phase==='interrupted'?'idle':phase;
 const unread=status.notices.filter(n=>!n.read).length,label=status.settings.paused?'Avisos en pausa':active?names[phase]:connectionLabel(status);
 const stateDetail=(status.settings.presentation&&error?'Revisa Codex':error)||status.desktop?.error||status.targetError||(status.settings.presentation?'Presentación · detalles ocultos':status.workspace?.compact==='codex'?(active?.steps.at(-1)?.preview?.split('\n')[0]?.slice(0,180)||active?.steps.at(-1)?.label||'Sin acciones recibidas'):status.target?'Fijado · '+status.target.title:active?.label)||'Tu escritorio, a mano';
 const toggle=()=>void window.companion.launcher(!expanded);
 const navigate=(v:WorkspacePage)=>void window.companion.navigate(v).then(r=>{if(!r.ok)setError(r.error);});
 const returnFromSettings=()=>navigate(previousSettingsPage.current);
 const navigateNotes=(destination:HubDestination)=>{
  setNotesDestination(destination);
  void window.companion.navigate('notes').then(result=>{
   if(!result.ok){setNotesDestination(undefined);setError(result.error);}
  });
 };
 const context=(v:LauncherPage)=>{
  menuOpener.current=root.current?.querySelector<HTMLElement>(`.companion-bar [data-page="${v}"]`)??null;
  void window.companion.launcherContext(v).then(r=>{if(!r.ok)setError(r.error);});
 };
 const changeIsland=(compact:boolean)=>{
  focusDestination.current=compact?'island':'rail';
  void window.companion.island(compact).then(r=>{if(!r.ok){focusDestination.current=undefined;setError(r.error);}});
 };
 async function openOptions(button:HTMLButtonElement){
  if(optionsInFlight.current)return;
  if(page!=='options')previousOptionsPage.current=expanded?page:undefined;
  optionsInFlight.current=true;
  setOptionsOpen(true);
  const rect=button.getBoundingClientRect();
  try{
   const result=await window.companion.capsuleLocationMenu({x:Math.max(0,Math.round(rect.left)),y:Math.max(0,Math.round(rect.bottom))});
   if(!result.ok)setError(result.error);
   else if(result.value&&button.isConnected&&!document.hidden)button.focus({preventScroll:true});
  }catch{
   setError('No se pudieron abrir las opciones de ZEN.');
  }finally{
   optionsInFlight.current=false;
   setOptionsOpen(false);
  }
 }

 useLayoutEffect(()=>{
  const element=panel.current;
  const before=previousPage.current;
  if(!expanded||!element){viewAnimation.current?.cancel();return;}
  setVisited(true);
  element.scrollTop=scroll.current[page]??0;
  previousPage.current=page;
  if(page==='settings'&&before!=='settings'){
   previousSettingsPage.current=before??'home';
   setSettingsOpened(true);
   element.querySelector<HTMLElement>('.preferences-back')?.focus({preventScroll:true});
  }else if(before==='settings'&&page!=='settings'){
   root.current?.querySelector<HTMLElement>('.capsule-launcher [aria-current=page],.capsule-options')?.focus({preventScroll:true});
  }
  if(!canAnimate(element)||before===page)return;
  const order=status.workspace?.order??launcherPages;
  const index=(value?:WorkspacePage)=>order.findIndex(item=>item===value);
  const direction=index(before)<0||index(page)<0||before==='notices'||page==='notices'?0:Math.sign(index(page)-index(before));
  const axis=status.workspace?.edge?.side==='left'||status.workspace?.edge?.side==='right'?'Y':'X';
  const computed=getComputedStyle(element);
  const running=viewAnimation.current?.playState==='running';
  const from=running?{opacity:computed.opacity,transform:computed.transform}:
   {opacity:.45,transform:direction?`translate${axis}(${direction*motion.shift}px)`:'none'};
  viewAnimation.current?.cancel();
  const animation=element.animate([from,{opacity:1,transform:'none'}],{duration:before?motion.navigation:motion.panel,easing:motion.enterEase});
  viewAnimation.current=animation;
 },[expanded,page]);
 useEffect(()=>()=>viewAnimation.current?.cancel(),[]);
 useEffect(()=>{if(reduced||!status.settings.motion)viewAnimation.current?.cancel();},[reduced,status.settings.motion]);
 const placement=status.workspace?.location;
 const [stacked,setStacked]=useState(narrowCapsule.matches);
 useEffect(()=>{
  const resize=()=>setStacked(narrowCapsule.matches);
  narrowCapsule.addEventListener('change',resize);
  resize();
  return ()=>narrowCapsule.removeEventListener('change',resize);
 },[]);
 useLayoutEffect(()=>{
  const controls=root.current?.querySelector('.capsule-single-row,.zen-island-shell');
  if(!placement||!controls||!canAnimate(controls))return;
  const animation=controls.animate([{opacity:.7},{opacity:1}],{duration:motion.hover,easing:motion.enterEase});
  return ()=>animation.cancel();
 },[placement,reduced,status.settings.motion]);

 useLayoutEffect(()=>{
  const destination=showIsland?'island':'rail';
  if(focusDestination.current!==destination)return;
  focusDestination.current=undefined;
  root.current?.querySelector<HTMLButtonElement>(showIsland?'.zen-island-trigger':'.capsule-launcher [aria-current=page],.companion-brand')?.focus({preventScroll:true});
 },[showIsland]);

 useEffect(()=>{
  if(!status.settings.collapseOnBlur)return;
  let previous:boolean|undefined;
  const sync=()=>{
   const active=document.activeElement;
   const blocked=Boolean(root.current?.querySelector('dialog[open]')||
    active?.matches('textarea:not([readonly]), input:not([type=checkbox],[type=radio],[type=button],[type=submit],[readonly]), select, [contenteditable=true]'));
   if(previous!==blocked){previous=blocked;void window.companion.islandFocusGuard(blocked);}
  };
  const afterFocus=()=>queueMicrotask(sync);
  const observer=new MutationObserver(sync);
  if(root.current)observer.observe(root.current,{subtree:true,childList:true,attributes:true,attributeFilter:['open']});
  document.addEventListener('focusin',sync);
  document.addEventListener('focusout',afterFocus);
  window.addEventListener('blur',sync);
  sync();
  return ()=>{
   observer.disconnect();
   document.removeEventListener('focusin',sync);
   document.removeEventListener('focusout',afterFocus);
   window.removeEventListener('blur',sync);
   void window.companion.islandFocusGuard(false);
  };
 },[status.settings.collapseOnBlur]);

 async function openStatus() {
  const hasApprovals = status.approvals.length > 0;
  const result = await window.companion.navigate(hasApprovals ? 'permissions' : 'codex');
  if (!result.ok) setError(result.error);
  else if (!hasApprovals) void window.companion.check();
 }

 useEffect(()=>{
  function handleEscape(event: KeyboardEvent) {
   if(event.key!=='Escape'||event.defaultPrevented||event.isComposing||island||optionsInFlight.current||root.current?.querySelector('dialog[open]'))return;
   event.preventDefault();
   const disclosure=root.current?.querySelector<HTMLDetailsElement>('.workspace-content:not([hidden]) :is(.hub-menu,.workspace-layout-menu,.settings-connection)[open]');
   if(disclosure&&(disclosure.contains(document.activeElement)||disclosure.classList.contains('workspace-layout-menu'))){
    disclosure.open=false;
    interfaceAudio.play('close');
    disclosure.querySelector('summary')?.focus();
    return;
   }
   if(expanded&&(page==='options'||page==='shortcuts')){
    const previous=page==='options'?previousOptionsPage.current:undefined;
    previousOptionsPage.current=undefined;
    void (previous?window.companion.navigate(previous):window.companion.launcher(false)).then(()=>{
     const opener=menuOpener.current??root.current?.querySelector<HTMLElement>(page==='options'?'.capsule-options':'.capsule-launcher [aria-current=page]');
     opener?.focus({preventScroll:true});
     menuOpener.current=null;
    });
    return;
   }
   if(expanded&&page==='settings'){
    returnFromSettings();
    return;
   }
   changeIsland(true);
  }
  window.addEventListener('keydown',handleEscape);
  return () => window.removeEventListener('keydown',handleEscape);
 },[expanded,island,page]);

 const edge=status.workspace?.edge;
 const vertical=edge?.side==='left'||edge?.side==='right';
 const track=mediaPlayer.track??nowPlaying;
 const compactPlayer=!expanded&&status.workspace?.compact==='spotify'&&status.approvals.length===0;
 const geometryStyle={
  '--capsule-base-height':`${(stacked?CAPSULE_POSITION.stackedHeight:CAPSULE_HEIGHT)-2}px`,
  '--edge-top':`${edge?.railTop??0}px`,
  '--edge-width':`${EDGE_ISLAND.railWidth}px`,
  '--edge-height':`${EDGE_ISLAND.railHeight}px`,
  '--caption-reserve':`${EDGE_ISLAND.captionReserve}px`,
  '--position-button':`${CAPSULE_POSITION.button}px`,
  '--position-gap':`${CAPSULE_POSITION.gap}px`,
  '--island-emblem':`${ISLAND_LAYOUT.emblem}px`,
  '--island-grip':`${ISLAND_LAYOUT.grip}px`,
  '--island-lock':`${ISLAND_LAYOUT.lock}px`,
  '--island-gap':`${ISLAND_LAYOUT.gap}px`,
  '--island-separator':`${ISLAND_LAYOUT.separator}px`,
 };
 return <main ref={root} onClick={playClick} className={'companion-capsule '+(expanded?'expanded companion-shell':'collapsed')} data-island={showIsland} data-sizing={status.workspace?.islandSizing===true} data-edge={edge?.side} data-orientation={vertical?'vertical':'horizontal'} data-position-stacked={stacked} data-native-caption={status.workspace?.nativeCaption===true} data-theme={appearance.theme} data-accent={appearance.accent} data-background={appearance.background} style={{...motionStyle,...appearanceVars(appearance),...geometryStyle} as React.CSSProperties} data-state={state} data-motion={status.settings.motion&&!reduced}>
  {showIsland?<DynamicIsland status={status} ready={ready} open={()=>changeIsland(!island)} onError={setError}/>:<header className="companion-bar capsule-single-row" data-has-media={!!track||compactPlayer}>
   <CapsuleDragGrip workspace={expanded} locked={status.settings.windowLocked}/>
   <div className="capsule-codex-block" data-capsule-block="codex">
   <button className="companion-brand" aria-label={expanded?'Recoger a cápsula':'Abrir panel de ZEN'} title={expanded?'Recoger a cápsula':'Abrir última integración · '+launcherName[status.workspace?.last??'home']} aria-expanded={expanded} onClick={toggle}><ZenStatusMark status={status} ready={ready}/></button>
   <button className="companion-state" data-compact={status.workspace?.compact==='codex'} title={label+' · '+stateDetail} aria-label={label+' · Abrir estado de Codex'} onClick={()=>void openStatus()}><strong><i/><span className="capsule-state-label">{shortState[label]??label}</span></strong><small title={stateDetail}>{stateDetail}</small></button>
   <button className="capsule-notices" data-page="notices" aria-label={unread?`Avisos · ${unread} pendientes`:'Avisos'} title={'Avisos'+(unread?' · '+unread+' pendientes':'')} aria-expanded={expanded&&page==='notices'} aria-pressed={expanded&&page==='notices'} aria-controls="capsule-content" onClick={()=>void window.companion.togglePage('notices')} onContextMenu={e=>{e.preventDefault();context('notices');}}>
    <CompanionIcon name="bell"/>{unread>0&&<b className="badge">{unread>99?'99+':unread}</b>}
   </button>
   </div>
   <CapsuleNavigation status={status} onError={setError}/>
   <div className="capsule-media-block" data-capsule-block="music">
    {compactPlayer?<CompanionMiniMusic status={status}/>:track?<CompanionNowPlaying track={track} player={mediaPlayer.track?{...mediaPlayer,track:mediaPlayer.track}:undefined}/>:<button className="capsule-music-empty" title={status.settings.presentation||status.settings.paused?'Sonido oculto por privacidad':'Abrir Sonido'} onClick={()=>navigate('spotify')}><CompanionIcon name="sound"/><span><strong>{status.settings.presentation||status.settings.paused?'Sonido oculto':'Sin reproducción'}</strong></span></button>}
   </div>
   <CapsulePosition location={placement} ready={ready}/>
   <nav className="capsule-actions" data-capsule-block="controls" aria-label="Controles de la cápsula">
    <CapsulePin locked={status.settings.windowLocked} ready={ready} onError={setError}/>
    <button className="capsule-options" aria-label="Más opciones" title="Más opciones" aria-haspopup="menu" aria-expanded={optionsOpen} onClick={event=>void openOptions(event.currentTarget)}>
     <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>
    </button>
    <button className="capsule-fold" type="button" aria-label="Contraer a isla" title="Contraer a isla" onClick={()=>changeIsland(true)}><CompanionIcon name="collapse"/></button>
   </nav>
  </header>}
  {vertical&&expanded&&<div className="edge-drag-strip" aria-hidden="true"/>}
  {(expanded||visited)&&<section ref={panel} id="capsule-content" className="workspace-content" data-page={page} hidden={!expanded}
    onScroll={event=>{if(expanded&&event.target===event.currentTarget)scroll.current[page]=event.currentTarget.scrollTop;}}>
    {page==='home'?<CompanionHome status={status} ready={ready} visible={expanded} draft={homeDraft} setDraft={setHomeDraft} nowPlaying={nowPlaying?.playing?nowPlaying:null} onNavigate={navigate} onOpenNotes={navigateNotes}/>:
    page==='spotify'?<CompanionMusic status={status} player={mediaPlayer}/>:
    page==='notes'?(safeNotes?null:<div className="companion-empty"><h2>Apuntes ocultos</h2><p role="status">Desactiva la pausa o Presentación para abrir el cuaderno.</p></div>):
    page==='notices'?<><div className="workspace-section-heading"><h1>Avisos</h1></div><CompanionNotices status={status}/></>:
    page==='options'||page==='shortcuts'?<CapsuleMenu status={status} context={page==='shortcuts'?status.workspace?.context:undefined}/>:
    page==='settings'?null:
    <CodexWorkspace status={status} visible={expanded} memory={contextMemory} monochrome={appearance.theme==='monochrome'}/>}
    {(settingsOpened||page==='settings')&&<div className="preferences-retained" hidden={!expanded||page!=='settings'} inert={!expanded||page!=='settings'}>
     <CompanionSettings status={status} visible={expanded&&page==='settings'} onBack={returnFromSettings} onLayout={()=>{
      previousOptionsPage.current='settings';navigate('options');
     }} onPreview={setThemePreview} onCategoryChange={()=>{
      scroll.current.settings=0;
      if(panel.current)panel.current.scrollTop=0;
     }}/>
    </div>}
    {safeNotes&&(notesOpened||notesVisible&&expanded)&&<div className="notes-retained" hidden={!notesVisible||!expanded} inert={!notesVisible||!expanded}>
     <Suspense fallback={<p role="status">Abriendo Apuntes…</p>}><NotesWorkspace appearance={appearance} destination={notesDestination} visible={notesVisible&&expanded} animate={status.settings.motion&&!reduced}/></Suspense>
    </div>}
   </section>}
 </main>;
}
