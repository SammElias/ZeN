import React, { useEffect, useLayoutEffect, useRef, useState, useMemo, useCallback, useSyncExternalStore } from 'react';
import type { ZenBridge, PublicSettings, TaskState, TaskEvent } from '../shared/contracts';
import type { VoiceStatus } from './voice';
import { LiveVoiceClient as VoiceClient } from './live-voice';
import { SuccessTimer } from './auto-hide';
import { audible, type ResponseMode } from '../shared/personal';
import { IconButton, Icon, VoiceIndicator, ApprovalCard } from './components';
import { latestTask, latestUtterance } from './latest-message';
import { MessageStore } from './message-store';
import { StreamingMessage } from './StreamingMessage';
import { ScreenContextChip } from './ScreenContextChip';
import { CAPSULE_HEIGHT } from '../shared/island';
import './capsule.css';
import './companion.css';
import { Companion } from './Companion';
import { useInterfaceSounds } from './interface-sounds';
import { ContextFlow, ProjectCard } from './ProjectCard';
import { projectCreationRequest } from '../policy/project';
import { Composer } from './Composer';
import type { ScreenSnapshot } from '../main/screen-context';
import type {FolderAttachment} from '../main/folder-context';
declare global { interface Window { zen: ZenBridge; zenDemo?: boolean; demoState?: TaskEvent } }
const labels: Record<TaskState, string> = { idle: '¿Qué hacemos?', queued: 'En cola', listening: 'Te escucho', thinking: 'Preparando…', awaiting_approval: 'Necesito tu permiso', awaiting_input: 'Necesito contexto', executing: 'En marcha', completed: 'Listo', failed: 'Algo no ha salido bien', cancelled: 'Tarea detenida' };
export function App() {
  const [systemReducedMotion, setReducedMotion] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => { const query = matchMedia('(prefers-reduced-motion: reduce)'); const update = () => setReducedMotion(query.matches); query.addEventListener('change', update); return () => query.removeEventListener('change', update); }, []);
  const [config, setConfig] = useState<PublicSettings>(); const configRef = useRef(config); configRef.current = config;
  const [responseMode, setResponseMode] = useState<ResponseMode>({ response: 'auto', meeting: false });
  const [observationId, setObservationId] = useState<string>();
  const [screenContext, setScreenContext] = useState<TaskEvent['screenContext']>();
  const [screenPreview,setScreenPreview]=useState<ScreenSnapshot>();
  const previewDialog=useRef<HTMLDialogElement>(null);
  const manualMode=useRef(false);
  const awaitingLiveInput=useRef(false);
  const sendGeneration=useRef(0);
  const [folder,setFolder]=useState<FolderAttachment>();const choosingFolder=useRef(false);
  const [projectTask,setProjectTask]=useState<TaskEvent>();
  const [projectFocus,setProjectFocus]=useState(false);
  const [liveRequest,setLiveRequest]=useState<{id:string;captionId:string;text:string}|null>(null);
  const [reviewRequest,setReviewRequest]=useState<typeof liveRequest>(null);
  const [records, setRecords] = useState<TaskEvent[]>([]);
  const messages = useMemo(() => new MessageStore(window.demoState ? latestTask({}, window.demoState) : {}), []);
  const projectMessages = useMemo(() => new MessageStore(), []);
  const messageMeta = useSyncExternalStore(messages.subscribeMetadata, messages.metadata);
  const streaming = JSON.parse(messageMeta)[2] as boolean;
  const [messageHeight, setMessageHeight] = useState(70);
  const measuredMessage = useCallback((height:number) => setMessageHeight(height), []);
  const [chromeHeight, setChromeHeight] = useState(150);
  const [voiceNotice,setVoiceNotice] = useState('');
  const [task, setTask] = useState<TaskEvent>(window.demoState ?? { id: 'idle', state: 'idle', message: '' });
  const [voiceState, setVoiceState] = useState<VoiceStatus>('disconnected'); const [microphone, setMicrophone] = useState(false); const [speaking, setSpeaking] = useState(false);
  const microphoneRef=useRef(microphone);microphoneRef.current=microphone;
  const talkRefresh=useRef(false);
  const [pushToTalk, setPushToTalk] = useState(false); const pushToTalkRef = useRef(false); const held = useRef(false);
  const reducedMotion = systemReducedMotion || config?.settings.interfaceAnimations === false;
  const [visible, setVisible] = useState(true); const [collapsed, setCollapsed] = useState(true); const [interacting, setInteracting] = useState(false); const [notice, setNotice] = useState('');
  const playSound = useInterfaceSounds(!!config?.settings.interfaceSounds && audible(responseMode) && visible && voiceState === 'disconnected' && !microphone && !speaking, task);
  const root = useRef<HTMLElement>(null); const voice = useRef<VoiceClient | null>(null);
  const workspace = useRef<HTMLDivElement>(null);
  const liveDialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{if(reviewRequest&&!liveDialog.current?.open)liveDialog.current?.showModal();},[reviewRequest]);
  const dragGesture = useRef<{ pointerId: number; x: number; y: number; capture: Element; moved: boolean } | undefined>(undefined);
  const suppressDragClick = useRef(false); const [dragging, setDragging] = useState(false);
  const beginDrag = (event: React.PointerEvent<HTMLElement>) => {
    const target = event.target as Element;
    suppressDragClick.current = false;
    if (event.button !== 0 || (target.closest('button') && !target.closest('.brand-home'))) return;
    setDragging(false);
    target.setPointerCapture(event.pointerId);
    dragGesture.current = { pointerId: event.pointerId, x: event.screenX, y: event.screenY, capture: target, moved: false };
    void window.zen.drag('start').then(result => { if (!result.ok) { dragGesture.current = undefined; setDragging(false); } });
  };
  const updateDrag = (event: React.PointerEvent<HTMLElement>) => {
    const gesture = dragGesture.current; if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (Math.hypot(event.screenX - gesture.x, event.screenY - gesture.y) >= 4) { gesture.moved = true; setDragging(true); }
  };
  const finishDrag = (event: React.PointerEvent<HTMLElement>) => {
    const gesture = dragGesture.current; if (!gesture || gesture.pointerId !== event.pointerId) return;
    dragGesture.current = undefined; suppressDragClick.current = gesture.moved; setDragging(false);
    if (gesture.capture.hasPointerCapture(event.pointerId)) gesture.capture.releasePointerCapture(event.pointerId);
    void window.zen.drag('end');
  };
  const hideRef = useRef<() => void>(() => {}); const timer = useRef<SuccessTimer | null>(null);
  const notify = useCallback((message: string) => { setCollapsed(false); setNotice(message); }, []);
  const fail = (message: string) => { setVoiceNotice(message); };
  async function hide() { ++sendGeneration.current;const hiding = window.zen.hide(); await voice.current?.stop(); const result = await hiding; if (!result.ok) fail(result.error); }
  hideRef.current = () => { void hide(); };
  const releaseTalk = () => { held.current = false; if (pushToTalkRef.current) voice.current?.setMicrophoneEnabled(false); };
  const refreshScreen=async()=>{const result=await window.zen.refreshScreen();if(!result.ok)notify(result.error);return result.ok&&result.value;};
  const resumeLiveInput=()=>{if(manualMode.current)awaitingLiveInput.current=true;manualMode.current=false;voice.current?.setMicrophoneEnabled(true);};
  const holdTalk = () => { if (pushToTalkRef.current && voice.current?.active) { held.current = true;if(talkRefresh.current)return;talkRefresh.current=true;void refreshScreen().finally(()=>{talkRefresh.current=false;if(held.current&&pushToTalkRef.current&&voice.current?.active)resumeLiveInput();}); } };
  useEffect(() => {
    const caption=(event:Parameters<typeof latestUtterance>[1])=>{if(manualMode.current||awaitingLiveInput.current&&event.speaker==='zen')return;if(event.speaker==='user')awaitingLiveInput.current=false;messages.utterance(event);};
    voice.current = new VoiceClient(window.zen, (status, mic) => { if(status==='connecting'){manualMode.current=false;awaitingLiveInput.current=false;setVoiceNotice('');messages.startLive();}setVoiceState(status); setMicrophone(mic); }, fail, setSpeaking, caption);
    const applyMode = (mode: ResponseMode) => { setResponseMode(mode); voice.current?.setAudible(audible(mode)); };
    void window.zen.mode().then(result => { if (result.ok) applyMode(result.value); });
    const offMode = window.zen.onMode(applyMode);
    void window.zen.tasks().then(result => { if (result.ok && result.value.length) { setRecords(result.value); const last = result.value.filter(row => !['voice', 'storage', 'control'].includes(row.id)).at(-1); if (last) { setTask(last); if(!messages.snapshot().message)messages.task(last); } } });
    void window.zen.settings().then(result => { if (result.ok) { setConfig(result.value); if (!result.value.shortcutRegistered) setNotice('Atajo ocupado. Puedes abrir ZEN desde la bandeja.'); } else fail(result.error); });
    const offTask = window.zen.onTask(event => {
      if(event.workContext){projectMessages.task(event);setProjectTask(previous=>event.streamText&&previous?.id===event.id&&previous.state===event.state&&previous.workContext?.phase===event.workContext?.phase?previous:event);if(event.workContext.phase==='review'&&!microphoneRef.current){setProjectFocus(true);setCollapsed(false);}}
      if(event.screenContext){setScreenContext(event.screenContext);setScreenPreview(previous=>previous?.id===event.screenContext?.snapshotId?previous:undefined);return;}
      if(event.liveRequest!==undefined)setLiveRequest(event.liveRequest);
      if (event.contextConsumed) { setObservationId(undefined); return; }
      if (event.utterance) { caption(event.utterance);if(manualMode.current)return; if (event.utterance.phase === 'start'&&event.utterance.speaker==='user')setProjectFocus(false); return; }
      if(event.id==='voice'){if(['failed','cancelled'].includes(event.state)){setVoiceNotice(event.message);void voice.current?.stop();}return;}
      if (!['storage', 'control'].includes(event.id)) setRecords(previous => {const old=previous.find(row=>row.id===event.id);if(event.streamText&&old?.state===event.state&&old.workContext?.phase===event.workContext?.phase)return previous;return old?previous.map(row=>row.id===event.id?event:row):[...previous,event].slice(-100);});
      messages.task(event);
      setTask(previous => event.streamText&&previous.id===event.id&&previous.state===event.state?previous:event);
      if (event.state === 'awaiting_approval') { setCollapsed(false); }
      if (event.id === 'voice' && ['failed', 'cancelled'].includes(event.state)) void voice.current?.stop();
    });
    const offInvoke = window.zen.onInvoke(mode => { setVisible(true); setCollapsed(false); setNotice(''); const current = configRef.current; if (mode !== 'focus' && !voice.current?.active && current?.hasKey && current.settings.voiceConsent && (mode === 'voice' || current.settings.listenOnInvoke)) void voice.current?.start(); });
    const offVisibility = window.zen.onVisibility(value => { setVisible(value); if (!value) { ++sendGeneration.current;setInteracting(false); void voice.current?.stop(); } });
    const keyboard = (event: KeyboardEvent) => { if (event.key === 'Escape' && (liveDialog.current?.open||previewDialog.current?.open)) return; if (event.key === 'Escape') { releaseTalk(); event.preventDefault(); hideRef.current(); } if (event.code === 'Space' && event.ctrlKey && pushToTalkRef.current) { event.preventDefault(); holdTalk(); } };
    const releaseKey = (event: KeyboardEvent) => { if (event.code === 'Space' || event.key === 'Control') releaseTalk(); };
    const refreshSettings = () => { void window.zen.settings().then(result => { if (result.ok) setConfig(result.value); }); };
    document.addEventListener('keyup', releaseKey); window.addEventListener('blur', releaseTalk); window.addEventListener('focus', refreshSettings);
    document.addEventListener('keydown', keyboard); timer.current = new SuccessTimer(() => hideRef.current());
    return () => { offMode(); offTask(); offInvoke(); offVisibility(); document.removeEventListener('keydown', keyboard); document.removeEventListener('keyup', releaseKey); window.removeEventListener('blur', releaseTalk); window.removeEventListener('focus', refreshSettings); timer.current?.dispose(); messages.dispose(); projectMessages.dispose(); void voice.current?.stop(); };
  }, []);
  const pendingApprovals = records.filter(row => row.state === 'awaiting_approval');
  const busy = records.some(row => ['queued', 'thinking', 'executing', 'awaiting_approval'].includes(row.state)) || ['queued', 'thinking', 'executing', 'awaiting_approval'].includes(task.state);
  const mode = collapsed ? 'capsule' : 'card';
  const desiredHeight = collapsed ? CAPSULE_HEIGHT : Math.round(Math.min(screenPreview?820:projectFocus&&projectTask?.workContext?.draft?520:pendingApprovals.length ? 500 : reviewRequest?430:(streaming||speaking||busy)?340:Math.max(220,Math.min(440,messageHeight+chromeHeight)), Math.floor(window.screen.availHeight * .8)));
  useLayoutEffect(()=>{if(collapsed)return;const rows=Array.from(root.current?.children??[]).filter(el=>!el.classList.contains('conversation-pane')&&!el.classList.contains('workspace-body')&&el.tagName!=='DIALOG');const update=()=>setChromeHeight(Math.ceil(rows.reduce((height,child)=>{const css=getComputedStyle(child);return height+child.getBoundingClientRect().height+parseFloat(css.marginTop||'0')+parseFloat(css.marginBottom||'0');},24)));const observer=new ResizeObserver(update);rows.forEach(el=>observer.observe(el));update();return()=>observer.disconnect();},[collapsed,!!screenContext,!!notice,!!voiceNotice,!!liveRequest,!!projectTask?.workContext,projectFocus,pendingApprovals.length]);
  useLayoutEffect(() => { void window.zen.layout({ mode, height: Math.max(CAPSULE_HEIGHT, Math.min(1000, desiredHeight)), reducedMotion }); }, [mode, desiredHeight, reducedMotion]);
  useEffect(() => { timer.current?.update({ enabled: config?.settings.autoHideSuccess ?? false, visible, state: task.state, voiceActive: voiceState !== 'disconnected' || speaking, interacting, hasCopyableResult: task.state === 'completed' && !!task.message, panelOpen: !!screenPreview || !!reviewRequest }); }, [config, visible, task, voiceState, speaking, interacting, screenPreview, reviewRequest]);
  async function stop() { setFolder(undefined);++sendGeneration.current;const stopping = window.zen.stop(); await voice.current?.stop(true); const result = await stopping; if (!result.ok) fail(result.error); else setTask(previous => ({ ...previous, state: 'cancelled', message: 'Tarea detenida. No se realizarán nuevas acciones.' })); }
  const toggleVoice = async () => { pushToTalkRef.current = false; setPushToTalk(false); held.current = false; if (voiceState === 'connected') {if(microphoneRef.current)voice.current?.setMicrophoneEnabled(false);else if(!talkRefresh.current){talkRefresh.current=true;try{await refreshScreen();if(voice.current?.active)resumeLiveInput();}finally{talkRefresh.current=false;}}} else if (!config?.hasKey || !config.settings.voiceConsent) { notify('Voz no disponible. Revisa la conexión y el permiso en Preferencias desde la bandeja.'); } else if (!window.zenDemo) void voice.current?.start(); };
  const connectPushToTalk = async () => { if (!config?.hasKey || !config.settings.voiceConsent) { notify('Voz no disponible. Revisa Preferencias desde la bandeja.'); return; } pushToTalkRef.current = true; setPushToTalk(true); held.current = false; voice.current?.setMicrophoneEnabled(false); if (!window.zenDemo) await voice.current?.start(true); };
  const changeMode = async (next: ResponseMode) => { voice.current?.setAudible(audible(next)); setResponseMode(next); const result = await window.zen.setMode(next); if (!result.ok) fail(result.error); };
  const attention = pendingApprovals.length > 0 || ['awaiting_approval', 'awaiting_input', 'failed'].includes(task.state);
  const rawStatus = voiceState === 'connecting' ? 'Conectando…' : voiceState==='closing'?'Finalizando voz…': attention ? 'Te necesito' : speaking ? 'Respondiendo' : busy ? 'Trabajando' : microphone ? 'Escuchando' : responseMode.meeting ? 'Reunión' : 'Listo';
  const [islandStatus,setIslandStatus]=useState(rawStatus);
  useEffect(()=>{if(attention||voiceState==='closing'){setIslandStatus(rawStatus);return;}const timer=setTimeout(()=>setIslandStatus(rawStatus),300);return()=>clearTimeout(timer);},[rawStatus,attention,voiceState]);
  const navigate = (_next?:null) => { playSound('open');if(collapsed)void refreshScreen(); setCollapsed(false); };
  const companionState:TaskState|'speaking' = islandStatus==='Respondiendo'?'speaking':islandStatus==='Escuchando'?'listening':attention?'awaiting_approval':islandStatus==='Trabajando'?'thinking':'idle';
  const fold = () => { playSound(collapsed ? 'open' : 'close');if(collapsed)void refreshScreen(); setCollapsed(value => !value); };
  const showScreenPreview=async()=>{const result=await window.zen.previewScreen();if(!result.ok)return notify(result.error);if(!result.value)return notify('La captura ya no está disponible. Actualiza la referencia.');setScreenPreview(result.value);};
  const chooseFolder=async()=>{if(choosingFolder.current)return;choosingFolder.current=true;voice.current?.setMicrophoneEnabled(false);try{const result=await window.zen.chooseContextFolder();if(!result.ok)return notify(result.error);if(result.value){setFolder(result.value);playSound('attach');}}finally{choosingFolder.current=false;}};
  const removeFolder=()=>{if(folder)void window.zen.removeContextFolder(folder.id).then(result=>{if(!result.ok)notify(result.error);});setFolder(undefined);};
  useEffect(()=>{if(screenPreview&&!previewDialog.current?.open)previewDialog.current?.showModal();},[screenPreview]);
  const sendText=async(text:string,image?:string)=>{
    const generation=++sendGeneration.current;
    manualMode.current=true;voice.current?.setMicrophoneEnabled(false);if(voice.current?.active)await voice.current.interrupt();
    const requestId=crypto.randomUUID();let contextId=observationId;
    if(image){const attached=await window.zen.attachImage(image);if(!attached.ok)throw new Error(attached.error);contextId=attached.value.observationId;}
    if(!image&&!contextId&&!folder)await refreshScreen();
    if(generation!==sendGeneration.current)throw new Error('Envío detenido antes de iniciar la tarea.');
    setProjectFocus(false);messages.newRequest({speaker:'user',id:requestId,text,phase:'done'});setTask({id:requestId,state:'thinking',message:'Preparando…',request:text});setObservationId(undefined);void window.zen.voiceContext(null);
    const result=await window.zen.run({text,requestId,priority:2,observationId:contextId,folderId:folder?.id});if(!result.ok){fail(result.error);throw new Error(result.error);}messages.task({...result.value,request:text});
  };

  return <main ref={root} style={{ height: desiredHeight }} className={`zen-overlay island live-only ${mode} ${attention ? 'attention' : busy ? 'working' : 'calm'} ${microphone || speaking ? 'glow' : ''} ${visible ? 'visible' : 'hidden'} ${reducedMotion ? 'motion-off' : ''}`} data-mood={companionState} onMouseEnter={() => setInteracting(true)} onMouseLeave={() => setInteracting(document.hasFocus() || !!getSelection()?.toString())} onFocusCapture={() => setInteracting(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setInteracting(false); }} aria-label="ZEN asistente">
    <header className={`overlay-header ${dragging ? 'dragging' : ''}`} title="Arrastra hacia los lados o a otra pantalla" onPointerDown={beginDrag} onPointerMove={updateDrag} onPointerUp={finishDrag} onPointerCancel={finishDrag} onLostPointerCapture={finishDrag} onClickCapture={event => { if (suppressDragClick.current) { event.preventDefault(); event.stopPropagation(); suppressDragClick.current = false; } }}>
      <button className="brand-home" onClick={() => navigate(null)} aria-label="Ver último mensaje"><Companion state={companionState} animated={visible && !reducedMotion} /><span className="brand">ZEN</span></button>
      <span className={`header-status ${busy || speaking ? 'working' : ''}`} role="status" title={voiceNotice||islandStatus}><i />{islandStatus}</span>
      {!collapsed&&projectTask?.workContext&&<button className={`codex-pill ${projectTask.workContext.phase}`} onClick={()=>{setProjectFocus(true);setCollapsed(false);}} aria-label="Ver trabajo de Codex"><span aria-hidden="true">✧</span>Codex{projectTask.workContext.phase==='preparing'&&<i/>}</button>}
      {!collapsed&&screenContext&&screenContext.state!=='idle'&&<button className="screen-context-indicator" aria-label="Actualizar contexto visual" disabled={screenContext.state==='capturing'} onClick={()=>void refreshScreen()} title={`Actualizar captura de la ventana detrás de ZEN${screenContext.sourceTitle?` · ${screenContext.sourceTitle}`:''}`}>{['ready','queued'].includes(screenContext.state)?'◉':'◌'}</button>}
      {<IconButton name={microphone ? 'mic' : 'mute'} label={microphone ? 'Micrófono activo · silenciar' : voiceState==='closing'?'Finalizando voz': voiceState === 'connected' ? 'Micrófono silenciado · activar' : 'Micrófono apagado · comenzar voz'} className={`icon-button island-microphone ${microphone ? 'active' : ''}`} aria-pressed={microphone} disabled={voiceState === 'connecting'||voiceState==='closing'} onClick={toggleVoice} />}
      <div className="header-actions"><button className="fold-button" onClick={fold} aria-expanded={!collapsed} aria-label={collapsed ? 'Desplegar panel' : 'Recoger panel'}><svg viewBox="0 0 24 24" aria-hidden="true" style={{ transform: collapsed ? undefined : 'rotate(180deg)' }}><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="1.7" /></svg></button>{collapsed && busy ? <IconButton name="stop" label="Detener todas las tareas" className="icon-button danger" onClick={() => void stop()} /> : <IconButton name="close" label="Ocultar ZEN (Esc)" onClick={() => void hide()} />}</div>
    </header>
    {!collapsed && <>
      {projectTask?.workContext&&<ContextFlow context={projectTask.workContext} focused={projectFocus} toggle={()=>setProjectFocus(value=>!value)}/>}
      <div className={projectFocus?'conversation-pane hidden-pane':'conversation-pane'}>
        <StreamingMessage store={messages} notify={notify} copyReady={!busy&&!speaking} visible={!collapsed&&!projectFocus} measured={measuredMessage}/>
      </div>
      {projectFocus&&<div className="workspace-body latest-message" role="region" aria-label="Proyecto de Codex" ref={workspace}>{projectTask?.workContext?.phase==='review'&&projectTask.workContext.draft?<ProjectCard key={projectTask.workContext.draft.id} draft={projectTask.workContext.draft} notify={notify} changed={draft=>setProjectTask(previous=>previous?{...previous,workContext:{owner:'codex',phase:'review',draft}}:previous)}/>:<StreamingMessage store={projectMessages} author="Codex" regionLabel="Avance de Codex" notify={notify} copyReady={!busy} visible={!collapsed&&projectFocus} measured={measuredMessage}/>}</div>}
      {!!pendingApprovals.length&&<div className="approval-stack">{pendingApprovals.map(row=><ApprovalCard key={row.id} simulated={!!window.zenDemo} approval={row.approval} notify={notify}/>)}</div>}
      {reviewRequest&&<dialog ref={liveDialog} className="chat-context" aria-label="Revisar petición a las herramientas" onCancel={()=>setReviewRequest(null)}><div className="context-heading"><strong>{projectCreationRequest(reviewRequest.text)?'Pasemos tu idea a Codex':'Esta petición usará las herramientas de ZEN'}</strong><IconButton name="close" label="Cerrar revisión" onClick={()=>setReviewRequest(null)} /></div><p className="result-text">{reviewRequest.text}</p><button className="primary" disabled={reviewRequest.id!==liveRequest?.id} onClick={()=>{const id=reviewRequest.id;setReviewRequest(null);setLiveRequest(null);void window.zen.liveSubmit(id).then(result=>{if(!result.ok)notify(result.error);});}}>{projectCreationRequest(reviewRequest.text)?'Preparar mi proyecto':'Ejecutar esta petición'}</button>{reviewRequest.id!==liveRequest?.id&&<p>La transcripción ha cambiado. Cierra y revisa la petición actual.</p>}</dialog>}
      {liveRequest&&!microphone&&<button className="source-chip" onClick={()=>{voice.current?.setMicrophoneEnabled(false);setReviewRequest(liveRequest);}}>{projectCreationRequest(liveRequest.text)?'Preparar con Codex':'Revisar petición para las herramientas de ZEN'}</button>}
      {notice && <p className="notice" role="status">{notice}</p>}
      <ScreenContextChip context={screenContext} refresh={refreshScreen} preview={showScreenPreview}/>
      {screenPreview&&<dialog ref={previewDialog} className="screen-preview" aria-label="Captura usada como contexto" onCancel={()=>setScreenPreview(undefined)}><div className="context-heading"><strong>Esta es la captura de referencia</strong><IconButton name="close" label="Cerrar captura de referencia" onClick={()=>setScreenPreview(undefined)}/></div><p>{screenPreview.scope==='display'?'Pantalla donde está ZEN':'Referencia visual'} · {screenPreview.sourceTitle} · {new Date(screenPreview.capturedAt).toLocaleTimeString()}</p><img src={screenPreview.image} alt="Captura exacta preparada para SOL"/></dialog>}
      <Composer send={sendText} notify={notify} refresh={refreshScreen} chooseFolder={chooseFolder} folder={folder} removeFolder={removeFolder}/>
      {observationId && <div className="attachment-note"><Icon name="check" />Ventana adjunta para tu próxima petición<button onClick={() => { void window.zen.voiceContext(null); setObservationId(undefined); }}>Quitar</button></div>}
      <footer className="execution-controls"><div className="microphone-group"><span><i className={microphone ? 'mic-dot active' : 'mic-dot'} />{microphone && <VoiceIndicator active visible={visible} client={voice} />}{microphone ? 'Micrófono activo' : voiceState === 'connected' ? 'Micrófono silenciado' : 'Micrófono apagado'}</span>{voiceNotice&&<span className="voice-notice" role="status" title={voiceNotice}>{voiceNotice}<button aria-label="Cerrar aviso de voz" onClick={()=>setVoiceNotice('')}>×</button></span>}</div><div className="execution-actions">{!pushToTalk || voiceState === 'disconnected' ? <button onClick={() => void connectPushToTalk()}>Pulsar para hablar</button> : <button disabled={voiceState !== 'connected'} onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); holdTalk(); }} onPointerUp={releaseTalk} onPointerCancel={releaseTalk} onLostPointerCapture={releaseTalk}>Mantén · Ctrl+Espacio</button>}<button className={responseMode.meeting ? 'meeting-active' : ''} aria-pressed={responseMode.meeting} onClick={() => void changeMode({ response: responseMode.response, meeting: !responseMode.meeting })}>{responseMode.meeting ? 'En reunión' : 'Modo reunión'}</button>{speaking && <button onClick={() => void changeMode({ ...responseMode, response: 'text' })}>Silenciar respuesta</button>}{voiceState !== 'disconnected' && <button onClick={() => void voice.current?.stop()}>Desconectar</button>}{busy && <button className="danger" onClick={() => void stop()}><Icon name="stop" />Detener</button>}</div></footer>
    </>}
  </main>;
}
