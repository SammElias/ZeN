import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ZenBridge, PublicSettings, TaskState, TaskEvent } from '../shared/contracts';
import type { VoiceStatus } from './voice';
import { LiveVoiceClient as VoiceClient } from './live-voice';
import { SuccessTimer } from './auto-hide';
import { audible, type ResponseMode } from '../shared/personal';
import { DesktopPanel } from './DesktopPanel';
import { IconButton, Icon, VoiceIndicator, ApprovalCard } from './components';
import { latestTask, latestUtterance, type LatestState } from './latest-message';
import { MessageSources, MessageText } from './message-text';
import './capsule.css';
import './companion.css';
import { Companion } from './Companion';
import { useInterfaceSounds } from './interface-sounds';
import { ContextFlow, ProjectCard } from './ProjectCard';
import { projectCreationRequest } from '../policy/project';
declare global { interface Window { zen: ZenBridge; zenDemo?: boolean; demoState?: TaskEvent } }
const labels: Record<TaskState, string> = { idle: '¿Qué hacemos?', queued: 'En cola', listening: 'Te escucho', thinking: 'Preparando…', awaiting_approval: 'Necesito tu permiso', awaiting_input: 'Necesito contexto', executing: 'En marcha', completed: 'Listo', failed: 'Algo no ha salido bien', cancelled: 'Tarea detenida' };
export function App() {
  const [systemReducedMotion, setReducedMotion] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => { const query = matchMedia('(prefers-reduced-motion: reduce)'); const update = () => setReducedMotion(query.matches); query.addEventListener('change', update); return () => query.removeEventListener('change', update); }, []);
  const [config, setConfig] = useState<PublicSettings>(); const configRef = useRef(config); configRef.current = config;
  const [responseMode, setResponseMode] = useState<ResponseMode>({ response: 'auto', meeting: false });
  const [observationId, setObservationId] = useState<string>();
  const [screenContext, setScreenContext] = useState<TaskEvent['screenContext']>();
  const [projectTask,setProjectTask]=useState<TaskEvent>();
  const [projectFocus,setProjectFocus]=useState(false);
  const [liveRequest,setLiveRequest]=useState<{id:string;captionId:string;text:string}|null>(null);
  const [reviewRequest,setReviewRequest]=useState<typeof liveRequest>(null);
  const [records, setRecords] = useState<TaskEvent[]>([]);
  const [latest, setLatest] = useState<LatestState>(() => window.demoState ? latestTask({}, window.demoState) : {});
  const [task, setTask] = useState<TaskEvent>(window.demoState ?? { id: 'idle', state: 'idle', message: '' });
  const [voiceState, setVoiceState] = useState<VoiceStatus>('disconnected'); const [microphone, setMicrophone] = useState(false); const [speaking, setSpeaking] = useState(false);
  const microphoneRef=useRef(microphone);microphoneRef.current=microphone;
  const talkRefresh=useRef(false);
  const [pushToTalk, setPushToTalk] = useState(false); const pushToTalkRef = useRef(false); const held = useRef(false);
  const reducedMotion = systemReducedMotion || config?.settings.interfaceAnimations === false;
  const [visible, setVisible] = useState(true); const [panel, setPanel] = useState<'tools' | null>(null); const [collapsed, setCollapsed] = useState(true); const [interacting, setInteracting] = useState(false); const [notice, setNotice] = useState('');
  const playSound = useInterfaceSounds(!!config?.settings.interfaceSounds && audible(responseMode) && visible && voiceState === 'disconnected' && !microphone && !speaking, task);
  const root = useRef<HTMLElement>(null); const voice = useRef<VoiceClient | null>(null);
  const contextDialog = useRef<HTMLDialogElement>(null); const workspace = useRef<HTMLDivElement>(null);
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
  const notify = (message: string) => { setCollapsed(false); setNotice(message); };
  const fail = (message: string) => { const event: TaskEvent = { id: 'voice', state: 'failed', message }; setTask(event); setLatest(previous => latestTask(previous, event)); };
  async function hide() { const hiding = window.zen.hide(); await voice.current?.stop(); const result = await hiding; if (!result.ok) fail(result.error); }
  hideRef.current = () => { void hide(); };
  const releaseTalk = () => { held.current = false; if (pushToTalkRef.current) voice.current?.setMicrophoneEnabled(false); };
  const refreshScreen=async()=>{const result=await window.zen.refreshScreen();if(!result.ok)notify(result.error);return result.ok&&result.value;};
  const holdTalk = () => { if (pushToTalkRef.current && voice.current?.active) { held.current = true;if(talkRefresh.current)return;talkRefresh.current=true;void refreshScreen().finally(()=>{talkRefresh.current=false;if(held.current&&pushToTalkRef.current&&voice.current?.active)voice.current.setMicrophoneEnabled(true);}); } };
  useEffect(() => {
    voice.current = new VoiceClient(window.zen, (status, mic) => { setVoiceState(status); setMicrophone(mic); }, fail, setSpeaking, event => setLatest(previous => latestUtterance(previous, event)));
    const applyMode = (mode: ResponseMode) => { setResponseMode(mode); voice.current?.setAudible(audible(mode)); };
    void window.zen.mode().then(result => { if (result.ok) applyMode(result.value); });
    const offMode = window.zen.onMode(applyMode);
    void window.zen.tasks().then(result => { if (result.ok && result.value.length) { setRecords(result.value); const last = result.value.filter(row => !['voice', 'storage', 'control'].includes(row.id)).at(-1); if (last) { setTask(last); setLatest(previous => previous.message ? previous : latestTask({}, last)); } } });
    void window.zen.settings().then(result => { if (result.ok) { setConfig(result.value); if (!result.value.shortcutRegistered) setNotice('Atajo ocupado. Puedes abrir ZEN desde la bandeja.'); } else fail(result.error); });
    const offTask = window.zen.onTask(event => {
      if(event.workContext){setProjectTask(event);if(event.workContext.phase==='review'&&!microphoneRef.current){setProjectFocus(true);setCollapsed(false);}}
      if(event.screenContext){setScreenContext(event.screenContext);return;}
      if(event.liveRequest!==undefined)setLiveRequest(event.liveRequest);
      if (event.contextConsumed) { setObservationId(undefined); return; }
      if (event.utterance) { setLatest(previous => latestTask(previous, event)); if (event.utterance.phase === 'start') {setCollapsed(false);if(event.utterance.speaker==='user')setProjectFocus(false);} return; }
      if (!['voice', 'storage', 'control'].includes(event.id)) setRecords(previous => previous.some(row => row.id === event.id) ? previous.map(row => row.id === event.id ? event : row) : [...previous, event].slice(-100));
      setLatest(previous => latestTask(previous, event));
      setTask(previous => event.id === 'voice' && !['failed', 'cancelled'].includes(event.state) && ['thinking', 'executing'].includes(previous.state) ? previous : event);
      if (event.state === 'awaiting_approval') { setPanel(null); setCollapsed(false); }
      if (event.id === 'voice' && ['failed', 'cancelled'].includes(event.state)) void voice.current?.stop();
    });
    const offInvoke = window.zen.onInvoke(mode => { setVisible(true); setCollapsed(false); setNotice(''); const current = configRef.current; if (mode !== 'focus' && !voice.current?.active && current?.hasKey && current.settings.voiceConsent && (mode === 'voice' || current.settings.listenOnInvoke)) void voice.current?.start(); });
    const offVisibility = window.zen.onVisibility(value => { setVisible(value); if (!value) { setInteracting(false); void voice.current?.stop(); } });
    const keyboard = (event: KeyboardEvent) => { if (event.key === 'Escape' && (contextDialog.current?.open||liveDialog.current?.open)) return; if (event.key === 'Escape') { releaseTalk(); event.preventDefault(); hideRef.current(); } if (event.code === 'Space' && event.ctrlKey && pushToTalkRef.current) { event.preventDefault(); holdTalk(); } };
    const releaseKey = (event: KeyboardEvent) => { if (event.code === 'Space' || event.key === 'Control') releaseTalk(); };
    const refreshSettings = () => { void window.zen.settings().then(result => { if (result.ok) setConfig(result.value); }); };
    document.addEventListener('keyup', releaseKey); window.addEventListener('blur', releaseTalk); window.addEventListener('focus', refreshSettings);
    document.addEventListener('keydown', keyboard); timer.current = new SuccessTimer(() => hideRef.current());
    return () => { offMode(); offTask(); offInvoke(); offVisibility(); document.removeEventListener('keydown', keyboard); document.removeEventListener('keyup', releaseKey); window.removeEventListener('blur', releaseTalk); window.removeEventListener('focus', refreshSettings); timer.current?.dispose(); void voice.current?.stop(); };
  }, []);
  const shownTask = task;
  const pendingApprovals = records.filter(row => row.state === 'awaiting_approval');
  const busy = records.some(row => ['queued', 'thinking', 'executing', 'awaiting_approval'].includes(row.state)) || ['queued', 'thinking', 'executing', 'awaiting_approval'].includes(task.state);
  const mode = collapsed ? 'capsule' : 'card';
  const desiredHeight = collapsed ? 48 : Math.min(projectFocus&&projectTask?.workContext?.draft?460:pendingApprovals.length ? 440 : reviewRequest?360:projectTask?.workContext?260:210, Math.floor(window.screen.availHeight * .8));
  useLayoutEffect(() => { void window.zen.layout({ mode, height: Math.max(48, Math.min(1000, desiredHeight)), reducedMotion }); }, [mode, desiredHeight, reducedMotion]);
  useLayoutEffect(() => { if (workspace.current) workspace.current.scrollTop = 0; }, [latest.message?.key, latest.message?.speaker, collapsed]);
  useEffect(() => { timer.current?.update({ enabled: config?.settings.autoHideSuccess ?? false, visible, state: task.state, voiceActive: voiceState !== 'disconnected' || speaking, interacting, hasCopyableResult: task.state === 'completed' && !!task.message, panelOpen: !!panel }); }, [config, visible, task, voiceState, speaking, interacting, panel]);
  async function stop() { const stopping = window.zen.stop(); await voice.current?.stop(true); const result = await stopping; if (!result.ok) fail(result.error); else setTask(previous => ({ ...previous, state: 'cancelled', message: 'Tarea detenida. No se realizarán nuevas acciones.' })); }
  const toggleVoice = async () => { pushToTalkRef.current = false; setPushToTalk(false); held.current = false; if (voiceState === 'connected') {if(microphoneRef.current)voice.current?.setMicrophoneEnabled(false);else if(!talkRefresh.current){talkRefresh.current=true;try{await refreshScreen();if(voice.current?.active)voice.current.setMicrophoneEnabled(true);}finally{talkRefresh.current=false;}}} else if (!config?.hasKey || !config.settings.voiceConsent) { notify('Voz no disponible. Revisa la conexión y el permiso en Preferencias desde la bandeja.'); } else if (!window.zenDemo) void voice.current?.start(); };
  const connectPushToTalk = async () => { if (!config?.hasKey || !config.settings.voiceConsent) { notify('Voz no disponible. Revisa Preferencias desde la bandeja.'); return; } pushToTalkRef.current = true; setPushToTalk(true); held.current = false; voice.current?.setMicrophoneEnabled(false); if (!window.zenDemo) await voice.current?.start(true); };
  const changeMode = async (next: ResponseMode) => { voice.current?.setAudible(audible(next)); setResponseMode(next); const result = await window.zen.setMode(next); if (!result.ok) fail(result.error); };
  const activeTasks = records.filter(row => ['queued', 'thinking', 'executing'].includes(row.state)).length;
  const attention = pendingApprovals.length > 0 || ['awaiting_approval', 'awaiting_input', 'failed'].includes(task.state);
  const islandStatus = voiceState === 'connecting' ? 'Conectando…' : speaking ? 'Respondiendo' : attention ? 'Te necesito' : activeTasks ? `${activeTasks} ${activeTasks === 1 ? 'tarea' : 'tareas'}` : busy ? 'En marcha' : microphone ? 'Te escucho' : responseMode.meeting ? 'Reunión' : voiceState==='connected'?'Aquí contigo':shownTask.state === 'completed' ? 'Listo' : 'Aquí contigo';
  const navigate = (next: typeof panel) => { playSound('open');if(collapsed)void refreshScreen(); setPanel(next); setCollapsed(false); };
  const companionState = speaking ? 'speaking' : microphone ? 'listening' : attention ? (task.state === 'failed' ? 'failed' : 'awaiting_approval') : busy ? (task.state === 'executing' || records.some(row => row.state === 'executing') ? 'executing' : 'thinking') : voiceState==='connected'?'idle':shownTask.state;
  const fold = () => { playSound(collapsed ? 'open' : 'close');if(collapsed)void refreshScreen(); setCollapsed(value => !value); };
  useEffect(() => { if (panel === 'tools') contextDialog.current?.showModal(); }, [panel]);
  return <main ref={root} style={{ height: desiredHeight }} className={`zen-overlay island live-only ${mode} ${attention ? 'attention' : busy ? 'working' : 'calm'} ${microphone || speaking ? 'glow' : ''} ${visible ? 'visible' : 'hidden'} ${reducedMotion ? 'motion-off' : ''}`} data-mood={companionState} onMouseEnter={() => setInteracting(true)} onMouseLeave={() => setInteracting(document.hasFocus() || !!getSelection()?.toString())} onFocusCapture={() => setInteracting(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setInteracting(false); }} aria-label="ZEN asistente">
    <header className={`overlay-header ${dragging ? 'dragging' : ''}`} title="Arrastra hacia los lados o a otra pantalla" onPointerDown={beginDrag} onPointerMove={updateDrag} onPointerUp={finishDrag} onPointerCancel={finishDrag} onLostPointerCapture={finishDrag} onClickCapture={event => { if (suppressDragClick.current) { event.preventDefault(); event.stopPropagation(); suppressDragClick.current = false; } }}>
      <button className="brand-home" onClick={() => navigate(null)} aria-label="Ver último mensaje"><Companion state={companionState} animated={visible && !reducedMotion} /><span className="brand">ZEN</span></button>
      <span className={`header-status ${busy || speaking ? 'working' : ''}`} role="status"><i />{islandStatus}</span>
      {projectTask?.workContext&&<button className={`codex-pill ${projectTask.workContext.phase}`} onClick={()=>{setProjectFocus(true);setCollapsed(false);}} aria-label="Ver trabajo de Codex"><span aria-hidden="true">✧</span>Codex{projectTask.workContext.phase==='preparing'&&<i/>}</button>}
      {screenContext&&screenContext.state!=='idle'&&<button className="screen-context-indicator" aria-label="Actualizar contexto visual" disabled={screenContext.state==='capturing'} onClick={()=>void refreshScreen()} title={`Actualizar captura de la ventana detrás de ZEN${screenContext.sourceTitle?` · ${screenContext.sourceTitle}`:''}`}>{['ready','queued'].includes(screenContext.state)?'◉':'◌'}</button>}
      {<IconButton name={microphone ? 'mic' : 'mute'} label={microphone ? 'Micrófono activo · silenciar' : voiceState==='closing'?'Finalizando voz': voiceState === 'connected' ? 'Micrófono silenciado · activar' : 'Micrófono apagado · comenzar voz'} className={`icon-button island-microphone ${microphone ? 'active' : ''}`} aria-pressed={microphone} disabled={voiceState === 'connecting'||voiceState==='closing'} onClick={toggleVoice} />}
      <div className="header-actions"><button className="fold-button" onClick={fold} aria-expanded={!collapsed} aria-label={collapsed ? 'Desplegar panel' : 'Recoger panel'}><svg viewBox="0 0 24 24" aria-hidden="true" style={{ transform: collapsed ? undefined : 'rotate(180deg)' }}><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="1.7" /></svg></button>{collapsed && busy ? <IconButton name="stop" label="Detener todas las tareas" className="icon-button danger" onClick={() => void stop()} /> : <IconButton name="close" label="Ocultar ZEN (Esc)" onClick={() => void hide()} />}</div>
    </header>
    {!collapsed && <>
      {projectTask?.workContext&&<ContextFlow context={projectTask.workContext} focused={projectFocus} toggle={()=>setProjectFocus(value=>!value)}/>}
      <div className="workspace-body latest-message" role="region" aria-label="Último mensaje" ref={workspace}>
        {projectFocus&&projectTask?.workContext?.phase==='review'&&projectTask.workContext.draft?<ProjectCard key={projectTask.workContext.draft.id} draft={projectTask.workContext.draft} notify={notify} changed={draft=>setProjectTask(previous=>previous?{...previous,workContext:{owner:'codex',phase:'review',draft}}:previous)}/>:projectFocus&&projectTask?.workContext?<article className="live-message zen" aria-live="polite"><span className="message-speaker">Codex</span><p className="result-text">{projectTask.streamText??projectTask.message}</p></article>:latest.message ? <article className={`live-message ${latest.message.speaker}`} aria-live="polite" aria-atomic="true">
          <span className="message-speaker">{latest.message.speaker === 'user' ? 'Tú' : 'ZEN'}{latest.message.provisional && <small>En directo</small>}</span>
          {latest.message.endMs!==undefined?<p className="result-text">{latest.message.text}</p>:<MessageText text={latest.message.text || (latest.message.speaker === 'user' ? 'Te escucho…' : 'Preparando…')} notify={notify} />}
          {latest.message.speaker === 'zen' && latest.sourceText && latest.sourceText !== latest.message.text && <MessageSources text={latest.sourceText} notify={notify} />}
          {latest.message.speaker === 'zen' && latest.artifacts?.map(item=><button className="source-chip" key={item.id} onClick={()=>void window.zen.openArtifact(item.id).then(result=>{if(!result.ok)notify(result.error);})}>Ver {item.kind==='image'?'imagen':'resultado'} · {item.title}</button>)}
        </article> : <p className="live-empty">Habla con ZEN. Aquí aparecerá el último mensaje.</p>}
        {pendingApprovals.map(row => <ApprovalCard key={row.id} simulated={!!window.zenDemo} approval={row.approval} notify={notify} />)}
      </div>
      {panel === 'tools' && <dialog ref={contextDialog} className="chat-context" aria-label="Adjuntar contexto" onCancel={() => setPanel(null)}><div className="context-heading"><strong>Adjuntar contexto</strong><IconButton name="close" label="Cerrar adjuntos" onClick={() => setPanel(null)} /></div><DesktopPanel contextOnly notify={notify} attach={id => { void window.zen.voiceContext(id).then(result => { if (!result.ok) return fail(result.error); playSound('attach'); setObservationId(id); setPanel(null); notify('Ventana adjunta. Di qué quieres consultar antes de dos minutos.'); }); }} /></dialog>}
      {reviewRequest&&<dialog ref={liveDialog} className="chat-context" aria-label="Revisar petición a las herramientas" onCancel={()=>setReviewRequest(null)}><div className="context-heading"><strong>{projectCreationRequest(reviewRequest.text)?'Pasemos tu idea a Codex':'Esta petición usará las herramientas de ZEN'}</strong><IconButton name="close" label="Cerrar revisión" onClick={()=>setReviewRequest(null)} /></div><p className="result-text">{reviewRequest.text}</p><button className="primary" disabled={reviewRequest.id!==liveRequest?.id} onClick={()=>{const id=reviewRequest.id;setReviewRequest(null);setLiveRequest(null);void window.zen.liveSubmit(id).then(result=>{if(!result.ok)notify(result.error);});}}>{projectCreationRequest(reviewRequest.text)?'Preparar mi proyecto':'Ejecutar esta petición'}</button>{reviewRequest.id!==liveRequest?.id&&<p>La transcripción ha cambiado. Cierra y revisa la petición actual.</p>}</dialog>}
      {liveRequest&&!microphone&&<button className="source-chip" onClick={()=>{voice.current?.setMicrophoneEnabled(false);setReviewRequest(liveRequest);}}>{projectCreationRequest(liveRequest.text)?'Preparar con Codex':'Revisar petición para las herramientas de ZEN'}</button>}
      {notice && <p className="notice" role="status">{notice}</p>}
      {screenContext && screenContext.state !== 'idle' && <p className="screen-context-note" role="status" title={screenContext.sourceTitle??'Una instantánea de la ventana detrás de ZEN; pulsa el indicador para actualizar.'}>{({capturing:'Tomando contexto de la ventana…',ready:'Contexto visual preparado',queued:'Contexto visual enviado a SOL',unavailable:'Sin captura disponible',expired:'Contexto visual caducado · actualiza la referencia',idle:''})[screenContext.state]}{screenContext.sourceTitle&&<span> · {screenContext.sourceTitle}</span>}</p>}
      {observationId && <div className="attachment-note"><Icon name="check" />Ventana adjunta para tu próxima petición<button onClick={() => { void window.zen.voiceContext(null); setObservationId(undefined); }}>Quitar</button></div>}
      <footer><IconButton name="attach" label="Adjuntar contexto" onClick={() => setPanel('tools')} /><span><i className={microphone ? 'mic-dot active' : 'mic-dot'} />{microphone && <VoiceIndicator active visible={visible} client={voice} />}{microphone ? 'Micrófono activo' : voiceState === 'connected' ? 'Micrófono silenciado' : 'Micrófono apagado'}</span><div>{!pushToTalk || voiceState === 'disconnected' ? <button onClick={() => void connectPushToTalk()}>Pulsar para hablar</button> : <button disabled={voiceState !== 'connected'} onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); holdTalk(); }} onPointerUp={releaseTalk} onPointerCancel={releaseTalk} onLostPointerCapture={releaseTalk}>Mantén · Ctrl+Espacio</button>}<button className={responseMode.meeting ? 'meeting-active' : ''} aria-pressed={responseMode.meeting} onClick={() => void changeMode({ response: responseMode.response, meeting: !responseMode.meeting })}>{responseMode.meeting ? 'En reunión' : 'Modo reunión'}</button>{speaking && <button onClick={() => void changeMode({ ...responseMode, response: 'text' })}>Silenciar respuesta</button>}{voiceState !== 'disconnected' && <button onClick={() => void voice.current?.stop()}>Desconectar</button>}{busy && <button className="danger" onClick={() => void stop()}><Icon name="stop" />Detener</button>}</div></footer>
    </>}
  </main>;
}
