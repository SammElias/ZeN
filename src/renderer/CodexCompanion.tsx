import React, {lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {CompanionSettingsSchema, type CompanionStatus} from '../shared/codex-companion';
import {activeSession} from '../shared/companion-presentation';
import {defaultAppearance, type AppearanceState} from '../shared/companion-appearance';
import type {LauncherPage, SectionActivation, SectionPage, WorkspacePage} from '../shared/companion-workspace';
import {CAPSULE_POSITION, EDGE_ISLAND, ISLAND_LAYOUT} from '../shared/island';
import {appCubeDirection, capsulePages, hubName} from '../shared/companion-navigation';
import {concealVaultView} from './PasswordVault';
import {canAnimate,motionStyle,startCubeTurn} from './companion-motion';
import {motion} from '../shared/companion-motion';
import type {ContextDraft} from './CodexContext';
import {setLanguage} from '../coucou/i18n/i18n';
import {interfaceAudio} from './companion-interface-audio';
import {appearanceVars} from './AppearanceSettings';
import {CapsuleMenu} from './CapsuleNavigation';
import {CodexWorkspace} from './CodexWorkspace';
import {CompanionIcon} from './CompanionActions';
import {CompanionHome} from './CompanionHome';
import {CompanionMusic, useMediaPlayer, useNowPlaying} from './CompanionMusic';
import {CompanionNotices} from './CompanionNotices';
import {CompanionSettings} from './CompanionSettings';
import {CodexRequest} from '../shared/companion-request';
import {CompanionCalendar} from './CompanionCalendar';
import {OfficinaWorkspace} from './OfficinaWorkspace';
import {CompanionMetrics} from './CompanionMetrics';
import {DynamicIsland} from './DynamicIsland';
import {defaultNeon} from '../shared/companion-neon';
import {NeonBorder} from './NeonBorder';
import {WorkspaceNeonBorder} from './WorkspaceNeonBorder';
import {useNeonAnimation} from './useNeonAnimation';
import {useCapsuleHover} from './useCapsuleHover';
import './companion-simple.css';

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

function useCompanion(panel: React.RefObject<HTMLElement|null>) {
 const [status, setStatus] = useState(initial);
 const [ready, setReady] = useState(false);
 useEffect(() => {
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let latest=initial,shown=initial;
  let cube:{page:WorkspacePage;turn?:ReturnType<typeof startCubeTurn>;committed:boolean}|undefined;
  function commit() {
   shown=latest;
   setStatus(latest);
   setReady(true);
  }
  function stopCube() {
   const previous=cube;
   cube=undefined;
   previous?.turn?.cancel();
  }
  function update(value: CompanionStatus) {
   if((latest.revision??-1)>(value.revision??0))return;
   latest=value;
   if(shown.workspace?.page!==value.workspace?.page||!value.workspace?.expanded||value.workspace?.hoverClosing||
     !value.workspace?.surfaceVisible||value.settings.paused||value.settings.presentation)concealVaultView();
   const element=panel.current;
   const next=value.workspace;
   const canTurn=element&&!element.hidden&&next?.expanded&&next.surfaceVisible&&next.panelPaint===undefined&&
    !next.hoverClosing&&!next.panelOpening&&value.settings.motion&&!reduced.matches&&!document.hidden&&
    shown.settings.paused===value.settings.paused&&shown.settings.presentation===value.settings.presentation&&
    shown.target?.session===value.target?.session&&shown.target?.cwd===value.target?.cwd&&shown.targetError===value.targetError;
   if(canTurn&&cube?.page===next.page){
    if(cube.committed)commit();
    return;
   }
   stopCube();
   if(canTurn&&next.fromApps){
    const before=element.dataset.page as WorkspacePage|undefined;
    const order=capsulePages(shown.workspace?.order);
    const direction=before&&appCubeDirection(order,before,next.page);
    if(direction){
     const pending:NonNullable<typeof cube>={page:next.page,committed:false};
     cube=pending;
     const turn=startCubeTurn(element,direction,()=>{
      if(cube!==pending)return;
      pending.committed=true;
      flushSync(commit);
     });
     if(turn){
      pending.turn=turn;
      const clean=()=>{if(cube===pending)cube=undefined;};
      void turn.view.finished.then(clean,clean);
      return;
     }
     cube=undefined;
    }
   }
   commit();
  }
  const reduceMotion=()=>{if(reduced.matches&&cube){stopCube();commit();}};
  reduced.addEventListener('change',reduceMotion);
  const unsubscribe = window.companion.onStatus(update);
  void window.companion.status().then(result => {if (result.ok) update(result.value);});
  return()=>{unsubscribe();reduced.removeEventListener('change',reduceMotion);stopCube();};
 }, [panel]);
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

export function CodexCompanion(){
 const root=useRef<HTMLElement>(null),panel=useRef<HTMLElement>(null);
 const {status,ready}=useCompanion(panel),[error,setError]=useState(''),[reduced,setReduced]=useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
 const {track:nowPlaying}=useNowPlaying(status);
 const expanded=status.workspace?.expanded??false,page=status.workspace?.page??'home';
 const simpleMode=status.workspace?.simpleMode===true&&page!=='notes'&&page!=='officina';
 const mediaPlayer=useMediaPlayer(status,'workspace',expanded&&page==='spotify');
 const [openedPages,setOpenedPages]=useState<WorkspacePage[]>([]);
 const previousOptionsPage=useRef<WorkspacePage|undefined>(undefined);

 const [visited,setVisited]=useState(false);
 useCapsuleHover(root,ready&&status.workspace?.nativeCaption===true);
 const scroll=useRef<Partial<Record<WorkspacePage,number>>>({});
 const previousPage=useRef<WorkspacePage|undefined>(undefined);
 const panelWasOpen=useRef(false);
 const previousSettingsPage=useRef<WorkspacePage>('home');
 const [settingsOpened,setSettingsOpened]=useState(false);
 const viewAnimation=useRef<Animation|undefined>(undefined);
 const hoverClosing=status.workspace?.hoverClosing===true;
 const panelOpening=status.workspace?.panelOpening===true;
 const panelPaint=status.workspace?.panelPaint;
 const actions=useRef<Promise<unknown>>(Promise.resolve());
 const [homeDraft,setHomeDraft]=useState('');
 const [assessmentDraft,setAssessmentDraft]=useState<string>();
 const contextKey=JSON.stringify([status.target?.session,status.target?.cwd,status.targetError,status.settings.paused,status.settings.presentation]);
 const contextMemory=useMemo<{current?:ContextDraft}>(()=>({}),[contextKey]);
 const [notesOpened,setNotesOpened]=useState(false);
 const [notesRevision,setNotesRevision]=useState(0);
 const focusDestination=useRef(false);
 const activationAttempt=useRef(0);
 const [openOfficinaDecision,setOpenOfficinaDecision]=useState(false);
 useEffect(()=>{
  if(!expanded||page!=='officina')setOpenOfficinaDecision(false);
 },[expanded,page]);
 const [sectionFocus,setSectionFocus]=useState<(SectionActivation&{section:SectionPage})>();
 const menuOpener=useRef<HTMLElement|null>(null);
 const [themePreview,setThemePreview]=useState<AppearanceState>();
 const notesVisible=page==='notes'&&!status.settings.presentation&&!status.settings.paused;
 const safeNotes=!status.settings.presentation&&!status.settings.paused;
 useEffect(()=>{if(notesVisible&&expanded)setNotesOpened(true);},[notesVisible,expanded]);
 useEffect(()=>{
  function clearWhenHidden(){if(document.hidden)contextMemory.current=undefined;}
  document.addEventListener('visibilitychange',clearWhenHidden);
  return ()=>document.removeEventListener('visibilitychange',clearWhenHidden);
 },[contextMemory]);
 useEffect(()=>{if(status.settings.presentation||status.settings.paused)setHomeDraft('');},[status.settings.presentation,status.settings.paused]);
 useEffect(()=>{if(!safeNotes&&assessmentDraft!==undefined)setAssessmentDraft(undefined);},[safeNotes,assessmentDraft]);
 const savedAppearance = status.appearance ?? defaultAppearance;
 const appearance: AppearanceState = status.settings.presentation
  ? {...savedAppearance, background: 'aurora', imageUrl: undefined, imageName: undefined}
  : (expanded && page === 'settings' ? themePreview : undefined) ?? savedAppearance;
 const neon=appearance.neon??defaultNeon;
 const surfaceVisible=status.workspace?.surfaceVisible===true;
 const neonAnimation=useNeonAnimation(neon,surfaceVisible,status.settings.motion);
 useCompanionAudio(status,ready);
 useEffect(()=>{const q=matchMedia('(prefers-reduced-motion: reduce)'),fn=()=>setReduced(q.matches);q.addEventListener('change',fn);return()=>q.removeEventListener('change',fn);},[]);
 const navigate=(v:WorkspacePage)=>void window.companion.navigate(v).then(r=>{if(!r.ok)setError(r.error);});
 async function prepareAssessment(text:string) {
  if(!safeNotes||!CodexRequest.safeParse(text).success)throw Error('No se puede preparar esta valoración para Codex.');
  if(assessmentDraft&&assessmentDraft!==text)throw Error('Ya hay una valoración pendiente en Inicio. Revísala o vuelve a la petición habitual antes de preparar otra.');
  const result=await window.companion.navigate('home');
  if(!result.ok)throw Error(result.error);
  setAssessmentDraft(text);
 }
 const returnFromSettings=()=>navigate(previousSettingsPage.current);
 function settlePanel(element:HTMLElement){
  const {opacity,translate}=getComputedStyle(element);
  viewAnimation.current?.cancel();
  return viewAnimation.current=element.animate([{opacity,translate},{opacity:.72,translate:'var(--panel-drift)'}],
   {duration:motion.panel,easing:motion.enterEase,fill:'forwards'});
 }
 function runPanelAction<T>(action:()=>Promise<T>,closing:boolean):Promise<T>{
  const next=actions.current.then(async()=>{
   const element=panel.current;
   const animation=closing&&element&&!element.hidden&&canAnimate(element)&&!hoverClosing?settlePanel(element):undefined;
   try{
    if(animation)await animation.finished.catch(()=>{});
    return await action();
   }finally{animation?.cancel();}
  });
  actions.current=next.catch(()=>{});
  return next;
 }
 const toggle=()=>{
  focusDestination.current=true;
  void runPanelAction(()=>window.companion.togglePanel(),expanded).then(result=>{if(!result.ok)setError(result.error);});
 };
 const reviewPermissions=()=>{
  focusDestination.current=true;
  void runPanelAction(()=>window.companion.navigate('permissions'),false).then(result=>{
   if(!result.ok){focusDestination.current=false;setError(result.error);}
  }).catch(()=>{focusDestination.current=false;setError('No se pudo abrir la revisión de permisos.');});
 };
 const activateSection=async(section:SectionPage,keyboard:boolean)=>{
  setOpenOfficinaDecision(section==='officina'&&!expanded&&status.officinaGlance?.kind==='decision');
  const attempt=++activationAttempt.current;
  focusDestination.current=false;
  setSectionFocus(undefined);
  try {
   const result=await window.companion.togglePage(section);
   if(attempt!==activationAttempt.current)return;
   if(!result.ok){setError(result.error);return;}
   setError('');
   if(keyboard||!result.value.expanded)setSectionFocus({...result.value,section});
  } catch {
   if(attempt===activationAttempt.current)setError('No se pudo cambiar de sección.');
  }
 };
 useLayoutEffect(()=>{
  const element=panel.current;
  const before=previousPage.current;
  const opening=!panelWasOpen.current;
  panelWasOpen.current=expanded;
  if(!expanded||!element){viewAnimation.current?.cancel();return;}
  setVisited(true);
  setOpenedPages(current=>current.includes(page)?current:[...current,page]);
  element.scrollTop=scroll.current[page]??0;
  previousPage.current=page;
  if(page==='settings'&&before!=='settings'){
   previousSettingsPage.current=before??'home';
   setSettingsOpened(true);
   if(document.hasFocus())element.querySelector<HTMLElement>('.preferences-back')?.focus({preventScroll:true});
  }else if(before==='settings'&&page!=='settings'&&document.hasFocus()){
   root.current?.querySelector<HTMLElement>('.capsule-launcher [aria-current=page],.zen-island-trigger')?.focus({preventScroll:true});
  }
  if(!canAnimate(element)||opening||before===page||panelPaint!==undefined||status.workspace?.fromApps)return;
  const order=capsulePages(status.workspace?.order);
  const fromIndex=order.findIndex(item=>item===before), toIndex=order.findIndex(item=>item===page);
  const direction=fromIndex<0||toIndex<0?0:Math.sign(toIndex-fromIndex);
  const axis=status.workspace?.edge?.side==='left'||status.workspace?.edge?.side==='right'?'Y':'X';
  const computed=getComputedStyle(element);
  const running=viewAnimation.current?.playState==='running';
  const from=running?{opacity:computed.opacity,transform:computed.transform}:
   {opacity:.78,transform:direction?`translate${axis}(${direction*motion.shift}px)`:'none'};
  viewAnimation.current?.cancel();
  const animation=element.animate([from,{opacity:1,transform:'none'}],{duration:motion.navigation,easing:motion.enterEase});
  viewAnimation.current=animation;
 },[expanded,page]);
 useLayoutEffect(()=>{
  if(!expanded||panelPaint===undefined)return;
  // The inner callback runs after the first opportunity to paint the prepared panel.
  let frame=requestAnimationFrame(()=>{frame=requestAnimationFrame(()=>{void window.companion.panelPainted(panelPaint);});});
  return()=>cancelAnimationFrame(frame);
 },[expanded,panelPaint]);
 useEffect(()=>()=>viewAnimation.current?.cancel(),[]);
 useEffect(()=>{if(reduced||!status.settings.motion)viewAnimation.current?.cancel();},[reduced,status.settings.motion]);
 useLayoutEffect(()=>{
  if(!focusDestination.current)return;
  focusDestination.current=false;
  const section=status.workspace?.recentSection;
  const target=expanded?panel.current:
   (section&&root.current?.querySelector<HTMLElement>(`.capsule-launcher [data-page="${section}"]`))||
   root.current?.querySelector<HTMLElement>('.zen-island-trigger');
  target?.focus({preventScroll:true});
 },[expanded,page]);
 useLayoutEffect(()=>{
  if(!sectionFocus||(status.revision??0)<sectionFocus.revision)return;
  if(page===sectionFocus.page&&expanded===sectionFocus.expanded){
   const target=expanded?panel.current:root.current?.querySelector<HTMLButtonElement>(`.zen-island-shell .capsule-launcher [data-page="${sectionFocus.section}"]`);
   target?.focus({preventScroll:true});
  }
  setSectionFocus(undefined);
 },[sectionFocus,status.revision,page,expanded]);

 useEffect(()=>{
  if(status.workspace?.nativeCaption||!status.settings.collapseOnBlur)return;
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
 },[status.settings.collapseOnBlur,status.workspace?.nativeCaption]);

 useEffect(()=>{
  function handleEscape(event: KeyboardEvent) {
   if(event.key!=='Escape'||event.defaultPrevented||event.isComposing||!expanded||document.fullscreenElement||root.current?.querySelector('dialog[open]'))return;
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
   toggle();
  }
  window.addEventListener('keydown',handleEscape);
  return () => window.removeEventListener('keydown',handleEscape);
 },[expanded,page]);

 const edge=status.workspace?.edge;
 const vertical=edge?.side==='left'||edge?.side==='right';
 const geometry=status.workspace?.geometry;
 const panelAbove=geometry?.panel&&geometry.panel.y<geometry.capsule.y&&!vertical;
 const geometryStyle={
  '--panel-top':`${geometry?.panel?.y??0}px`,
  '--panel-left':`${geometry?.panel?.x??0}px`,
  '--panel-width':`${geometry?.panel?.width??0}px`,
  '--panel-height':`${geometry?.panel?.height??0}px`,
  '--panel-drift':vertical?(edge?.side==='left'?'-8px 0':'8px 0'):(panelAbove?'0 8px':'0 -8px'),
  '--caption-reserve':`${EDGE_ISLAND.captionReserve}px`,
  '--position-button':`${CAPSULE_POSITION.button}px`,
  '--position-gap':`${CAPSULE_POSITION.gap}px`,
  '--island-emblem':`${ISLAND_LAYOUT.emblem}px`,
  '--island-grip':`${ISLAND_LAYOUT.grip}px`,
  '--island-lock':`${ISLAND_LAYOUT.lock}px`,
  '--island-gap':`${ISLAND_LAYOUT.gap}px`,
  '--island-separator':`${ISLAND_LAYOUT.separator}px`,
 };
 const rectStyle=(rect?:{x:number;y:number;width:number;height:number})=>rect?{left:rect.x,top:rect.y,width:rect.width,height:rect.height}:undefined;
 return <main ref={root} onClick={playClick} className={'companion-capsule fixed-capsule '+(expanded?'expanded companion-shell':'collapsed')} data-island={!expanded} data-edge={edge?.side} data-orientation={vertical?'vertical':'horizontal'} data-native-caption={status.workspace?.nativeCaption===true} data-theme={appearance.theme} data-accent={appearance.accent} data-background={appearance.background} style={{...motionStyle,...appearanceVars(appearance),...geometryStyle} as React.CSSProperties} data-motion={status.settings.motion&&!reduced}>
  <header className="compact-capsule" style={rectStyle(geometry?.capsule)}>
   <DynamicIsland status={status} ready={ready} open={toggle} onReview={reviewPermissions} onActivate={activateSection} onError={setError} error={status.settings.presentation&&error?'Revisa la configuración en Codex.':error}/>
   <NeonBorder options={neon} visible={surfaceVisible} animation={neonAnimation}
    shape={{side:edge?.side,compact:true,radius:18}}/>
  </header>
  {(expanded||visited)&&<div className="workspace-surface" data-review={page==='permissions'||undefined} style={rectStyle(geometry?.panel)} hidden={!expanded} inert={!expanded}
   data-panel-phase={panelPaint!==undefined?'preparing':hoverClosing?'closing':panelOpening?'opening':'visible'}>
   <section ref={panel} id="capsule-content" className="workspace-content" data-page={page} data-simple-mode={simpleMode || undefined} tabIndex={-1} hidden={!expanded} inert={!expanded}
    onScroll={event=>{if(expanded&&event.target===event.currentTarget)scroll.current[page]=event.currentTarget.scrollTop;}}>
    {(openedPages.includes('home')||page==='home')&&<div hidden={!expanded||page!=='home'} inert={!expanded||page!=='home'}>
     <CompanionHome status={status} ready={ready} visible={expanded&&page==='home'} weatherVisible={expanded&&page==='home'&&surfaceVisible&&!hoverClosing}
      draft={assessmentDraft??homeDraft} setDraft={assessmentDraft===undefined?setHomeDraft:setAssessmentDraft}
      onDismissAssessment={assessmentDraft===undefined?undefined:()=>setAssessmentDraft(undefined)}
      nowPlaying={nowPlaying} onNavigate={navigate}/>
    </div>}
    {safeNotes&&(openedPages.includes('calendar')||page==='calendar')&&<div hidden={!expanded||page!=='calendar'} inert={!expanded||page!=='calendar'}>
     <CompanionCalendar visible={expanded&&page==='calendar'} revision={status.revision} simpleMode={status.workspace?.simpleMode===true}/>
    </div>}
    {expanded&&page==='officina'&&(safeNotes
      ? surfaceVisible&&<OfficinaWorkspace motion={status.settings.motion&&!reduced&&!hoverClosing&&!panelOpening} approvals={status.approvals}
        glanceItems={status.officinaGlanceItems} openDecisionOnEntry={openOfficinaDecision}/>
      : <div className="companion-empty"><h2>Officina en pausa</h2><p>Desactiva Pausa o Presentación para abrir el tablero.</p></div>)}
    {status.oura&&expanded&&page==='metrics'&&<CompanionMetrics status={status.oura} simpleMode={simpleMode}/>}
    {!safeNotes&&expanded&&page==='metrics'&&<div className="companion-empty"><h2>Métricas ocultas</h2><p>Desactiva Pausa o Presentación para consultar Oura.</p></div>}
    {(openedPages.includes('spotify')||page==='spotify')&&<div hidden={!expanded||page!=='spotify'} inert={!expanded||page!=='spotify'}>
     <CompanionMusic status={status} player={mediaPlayer} volumeVisible={expanded&&page==='spotify'&&surfaceVisible&&!hoverClosing}/>
    </div>}
    {page==='notes'&&!safeNotes&&<div className="companion-empty"><h2>{hubName} oculto</h2><p role="status">Desactiva la pausa o Presentación para abrir la biblioteca.</p></div>}
    {page==='notices'&&<><div className="workspace-section-heading"><h1>Avisos</h1></div><CompanionNotices status={status}/></>}
    {(page==='options'||page==='shortcuts')&&<CapsuleMenu status={status} context={page==='shortcuts'?status.workspace?.context:undefined}/>}
    {(openedPages.some(value=>value==='codex'||value==='permissions')||page==='codex'||page==='permissions')&&
     <div hidden={!expanded||page!=='codex'&&page!=='permissions'} inert={!expanded||page!=='codex'&&page!=='permissions'}>
      <CodexWorkspace status={status} visible={expanded&&(page==='codex'||page==='permissions')} memory={contextMemory} onCloseReview={toggle}/>
     </div>}
    {(settingsOpened||page==='settings')&&<div className="preferences-retained" hidden={!expanded||page!=='settings'} inert={!expanded||page!=='settings'}>
     <CompanionSettings status={status} visible={expanded&&page==='settings'} onBack={returnFromSettings}
      onBackupImported={()=>setNotesRevision(value=>value+1)} onLayout={()=>{
      previousOptionsPage.current='settings';navigate('options');
     }} onPreview={setThemePreview} onCategoryChange={()=>{
      scroll.current.settings=0;
      if(panel.current)panel.current.scrollTop=0;
     }}/>
    </div>}
    {safeNotes&&(notesOpened||notesVisible&&expanded)&&<div className="notes-retained" hidden={!notesVisible||!expanded} inert={!notesVisible||!expanded}>
     <Suspense fallback={<p role="status">Abriendo {hubName}…</p>}><NotesWorkspace key={notesRevision} appearance={appearance} visible={notesVisible&&expanded}
      surfaceVisible={surfaceVisible} animate={status.settings.motion&&!reduced&&!hoverClosing&&!panelOpening}
      hoverEnabled={status.workspace?.nativeCaption===true&&!status.settings.windowLocked&&!hoverClosing&&!panelOpening} onAssess={prepareAssessment}/></Suspense>
    </div>}
   </section>
   <WorkspaceNeonBorder options={neon} visible={expanded&&surfaceVisible&&page!=='permissions'} animation={neonAnimation}/>
  </div>}
 </main>;
}
