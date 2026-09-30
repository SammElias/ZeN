import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ZenBridge, PublicSettings, TaskState, TaskEvent } from '../shared/contracts';
import { VoiceClient, type VoiceStatus } from './voice';
import { SuccessTimer } from './auto-hide';
import { audible, controlIntent, type ResponseMode } from '../shared/personal';
import { DesktopPanel } from './DesktopPanel';
import { IconButton, Icon, VoiceIndicator, ApprovalCard, TaskCard } from './components';
import './capsule.css';
import './companion.css';
import { Companion } from './Companion';
import { useInterfaceSounds } from './interface-sounds';
declare global { interface Window { zen: ZenBridge; zenDemo?: boolean; demoState?: TaskEvent } }
const labels: Record<TaskState, string> = { idle: '¿Qué hacemos?', queued: 'En cola', listening: 'Te escucho', thinking: 'Preparando…', awaiting_approval: 'Necesito tu permiso', awaiting_input: 'Necesito contexto', executing: 'En marcha', completed: 'Listo', failed: 'Algo no ha salido bien', cancelled: 'Tarea detenida' };
export function App() {
  const [systemReducedMotion, setReducedMotion] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => { const query = matchMedia('(prefers-reduced-motion: reduce)'); const update = () => setReducedMotion(query.matches); query.addEventListener('change', update); return () => query.removeEventListener('change', update); }, []);
  const [config, setConfig] = useState<PublicSettings>(); const configRef = useRef(config); configRef.current = config;
  const [responseMode, setResponseMode] = useState<ResponseMode>({ response: 'auto', meeting: false });
  const [observationId, setObservationId] = useState<string>();
  const [records, setRecords] = useState<TaskEvent[]>([]); const [replyTaskId, setReplyTaskId] = useState<string>();
  const [text, setText] = useState(''); const [history, setHistory] = useState<string[]>([]);
  const [task, setTask] = useState<TaskEvent>(window.demoState ?? { id: 'idle', state: 'idle', message: '' });
  const [selectedTaskId, setSelectedTaskId] = useState<string>(); const [expandedResult, setExpandedResult] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceStatus>('disconnected'); const [microphone, setMicrophone] = useState(false); const [speaking, setSpeaking] = useState(false);
  const [pushToTalk, setPushToTalk] = useState(false); const pushToTalkRef = useRef(false); const held = useRef(false);
  const priority = 2 as const;
  const reducedMotion = systemReducedMotion || config?.settings.interfaceAnimations === false;
  const [visible, setVisible] = useState(true); const [panel, setPanel] = useState<'history' | 'tools' | null>(null); const [collapsed, setCollapsed] = useState(true); const [details, setDetails] = useState(false); const [interacting, setInteracting] = useState(false); const [notice, setNotice] = useState(''); const [submitting, setSubmitting] = useState(false);
  const playSound = useInterfaceSounds(!!config?.settings.interfaceSounds && audible(responseMode) && visible && voiceState === 'disconnected' && !microphone && !speaking, task);
  const root = useRef<HTMLElement>(null); const input = useRef<HTMLTextAreaElement>(null); const voice = useRef<VoiceClient | null>(null);
  const workspace = useRef<HTMLDivElement>(null); const followStream = useRef(true);
  const hideRef = useRef<() => void>(() => {}); const timer = useRef<SuccessTimer | null>(null);
  const add = (message: string) => setHistory(previous => [...previous.slice(-99), message]);
  const notify = (message: string) => { setCollapsed(false); setNotice(message); add(message); };
  const fail = (message: string) => { setTask({ id: 'local', state: 'failed', message }); add(message); };
  async function hide() { const hiding = window.zen.hide(); await voice.current?.stop(); const result = await hiding; if (!result.ok) fail(result.error); }
  hideRef.current = () => { void hide(); };
  const releaseTalk = () => { held.current = false; if (pushToTalkRef.current) voice.current?.setMicrophoneEnabled(false); };
  const holdTalk = () => { if (pushToTalkRef.current && voice.current?.active) { held.current = true; voice.current.setMicrophoneEnabled(true); } };
  useEffect(() => {
    voice.current = new VoiceClient(window.zen, (status, mic) => { setVoiceState(status); setMicrophone(mic); }, message => { add(message); if (!message.startsWith('Tú:') && !message.startsWith('ZEN (voz):')) fail(message); }, setSpeaking);
    const applyMode = (mode: ResponseMode) => { setResponseMode(mode); voice.current?.setAudible(audible(mode)); };
    void window.zen.mode().then(result => { if (result.ok) applyMode(result.value); });
    const offMode = window.zen.onMode(applyMode);
    void window.zen.tasks().then(result => { if (result.ok && result.value.length) { setRecords(result.value); setHistory(previous => [...result.value.map(row => row.message), ...previous].slice(-100)); } });
    void window.zen.settings().then(result => { if (result.ok) { setConfig(result.value); if (!result.value.shortcutRegistered) setNotice('Atajo ocupado. Puedes abrir ZEN desde la bandeja.'); } else fail(result.error); });
    const offTask = window.zen.onTask(event => { if (!['voice', 'storage', 'control'].includes(event.id)) setRecords(previous => previous.some(row => row.id === event.id) ? previous.map(row => row.id === event.id ? event : row) : [...previous, event].slice(-100)); setTask(previous => previous.id !== event.id && (previous.state === 'awaiting_approval' || (event.id === 'voice' && ['thinking', 'executing'].includes(previous.state))) ? previous : event); if (event.state === 'awaiting_approval') { setSelectedTaskId(undefined); setExpandedResult(false); setPanel(null); setCollapsed(false); } if (['completed', 'awaiting_input', 'failed', 'cancelled'].includes(event.state)) add(event.message); if (event.id === 'voice' && ['failed', 'cancelled'].includes(event.state)) void voice.current?.stop(); });
    const offInvoke = window.zen.onInvoke(mode => { setVisible(true); setCollapsed(false); setNotice(''); input.current?.focus(); const current = configRef.current; if (mode !== 'focus' && !voice.current?.active && current?.hasKey && current.settings.voiceConsent && (mode === 'voice' || current.settings.listenOnInvoke)) void voice.current?.start(); });
    const offVisibility = window.zen.onVisibility(value => { setVisible(value); if (!value) { setInteracting(false); void voice.current?.stop(); } });
    const keyboard = (event: KeyboardEvent) => { if (event.key === 'Escape') { releaseTalk(); event.preventDefault(); hideRef.current(); } if (event.code === 'Space' && event.ctrlKey && pushToTalkRef.current) { event.preventDefault(); holdTalk(); } };
    const releaseKey = (event: KeyboardEvent) => { if (event.code === 'Space' || event.key === 'Control') releaseTalk(); };
    const refreshSettings = () => { void window.zen.settings().then(result => { if (result.ok) setConfig(result.value); }); };
    document.addEventListener('keyup', releaseKey); window.addEventListener('blur', releaseTalk); window.addEventListener('focus', refreshSettings);
    document.addEventListener('keydown', keyboard); timer.current = new SuccessTimer(() => hideRef.current());
    return () => { offMode(); offTask(); offInvoke(); offVisibility(); document.removeEventListener('keydown', keyboard); document.removeEventListener('keyup', releaseKey); window.removeEventListener('blur', releaseTalk); window.removeEventListener('focus', refreshSettings); timer.current?.dispose(); void voice.current?.stop(); };
  }, []);
  const shownTask = records.find(row => row.id === selectedTaskId) ?? task;
  const busy = submitting || records.some(row => ['queued', 'thinking', 'executing', 'awaiting_approval'].includes(row.state)) || ['queued', 'thinking', 'executing', 'awaiting_approval'].includes(task.state);
  const mode = collapsed ? 'capsule' : panel ? 'panel' : 'card';
  const lines = Math.min(3, text.split('\n').length);
  const contentHeight = panel === 'tools' ? 400 : panel === 'history' ? 400 : shownTask.state === 'awaiting_approval' ? 400 : expandedResult ? 500 : shownTask.message ? 420 : 370;
  const desiredHeight = collapsed ? 48 : Math.min(contentHeight + (panel === null && records.length ? 40 : 0) + (lines - 1) * 20, Math.floor(window.screen.availHeight * .8));
  useLayoutEffect(() => { void window.zen.layout({ mode, height: Math.max(48, Math.min(1000, desiredHeight)), reducedMotion }); }, [mode, desiredHeight, reducedMotion]);
  useEffect(() => { if (!collapsed && panel === null && visible) input.current?.focus(); }, [collapsed, panel, visible]);
  useLayoutEffect(() => { if (shownTask.streamText && followStream.current && workspace.current) workspace.current.scrollTop = workspace.current.scrollHeight; }, [shownTask.streamText, collapsed]);
  useEffect(() => { timer.current?.update({ enabled: config?.settings.autoHideSuccess ?? false, visible, state: task.state, voiceActive: voiceState !== 'disconnected' || speaking, interacting, hasCopyableResult: task.state === 'completed' && !!task.message, panelOpen: !!panel }); }, [config, visible, task, voiceState, speaking, interacting, panel]);
  async function send(event?: React.FormEvent) {
    event?.preventDefault(); if (!text.trim() || submitting) return;
    if (controlIntent(text)) { const command = text; setText(''); const result = await window.zen.run({ text: command, requestId: crypto.randomUUID(), priority: 3 }); if (!result.ok) fail(result.error); else notify(result.value.message); return; }
    if (!config?.hasKey) { notify('Conexión pendiente. Abre Preferencias desde la bandeja de Windows.'); return; }
    if (voiceState !== 'disconnected') await voice.current?.stop();
    playSound('send');
    const value = text; const attached = observationId; const reply = replyTaskId; setSelectedTaskId(undefined); setExpandedResult(false); setObservationId(undefined); setReplyTaskId(undefined); setText(''); setNotice(''); setDetails(false); add(`Tú: ${value}`); setSubmitting(true);
    try { const pending = window.zen.run({ text: value, requestId: crypto.randomUUID(), priority, ...(attached ? { observationId: attached } : {}), ...(reply ? { replyTaskId: reply } : {}) }); setSubmitting(false); const result = await pending; if (!result.ok) fail(result.error); } finally { setSubmitting(false); }
  }
  async function stop() { const stopping = window.zen.stop(); await voice.current?.stop(); const result = await stopping; if (!result.ok) fail(result.error); else setTask(previous => ({ ...previous, state: 'cancelled', message: 'Tarea detenida. No se realizarán nuevas acciones.' })); }
  const toggleVoice = () => { pushToTalkRef.current = false; setPushToTalk(false); held.current = false; if (voiceState === 'connected') voice.current?.mute(); else if (!config?.hasKey || !config.settings.voiceConsent) { notify('Voz no disponible. Revisa la conexión y el permiso en Preferencias desde la bandeja.'); } else if (!window.zenDemo) void voice.current?.start(); };
  const connectPushToTalk = async () => { if (!config?.hasKey || !config.settings.voiceConsent) { notify('Voz no disponible. Revisa Preferencias desde la bandeja.'); return; } pushToTalkRef.current = true; setPushToTalk(true); held.current = false; voice.current?.setMicrophoneEnabled(false); if (!window.zenDemo) await voice.current?.start(true); };
  const changeMode = async (next: ResponseMode) => { voice.current?.setAudible(audible(next)); setResponseMode(next); const result = await window.zen.setMode(next); if (!result.ok) fail(result.error); };
  const activeTasks = records.filter(row => ['queued', 'thinking', 'executing'].includes(row.state)).length;
  const attention = records.some(row => ['awaiting_approval', 'awaiting_input', 'failed'].includes(row.state)) || ['awaiting_approval', 'awaiting_input', 'failed'].includes(task.state);
  const islandStatus = attention ? 'Te necesito' : voiceState === 'connecting' ? 'Conectando…' : activeTasks ? `${activeTasks} ${activeTasks === 1 ? 'tarea' : 'tareas'}` : busy ? 'En marcha' : speaking ? 'Respondiendo' : microphone ? 'Te escucho' : responseMode.meeting ? 'Reunión' : shownTask.state === 'completed' ? 'Listo' : 'Aquí contigo';
  const selectTask = (row: TaskEvent) => { followStream.current = true; setSelectedTaskId(row.id); setExpandedResult(false); setDetails(false); setPanel(null); setCollapsed(false); };
  const navigate = (next: typeof panel) => { playSound('open'); setPanel(next); setCollapsed(false); };
  const companionState = speaking ? 'speaking' : microphone ? 'listening' : attention ? (task.state === 'failed' ? 'failed' : 'awaiting_approval') : busy ? (task.state === 'executing' || records.some(row => row.state === 'executing') ? 'executing' : 'thinking') : shownTask.state;
  const fold = () => { playSound(collapsed ? 'open' : 'close'); setCollapsed(value => !value); };
  const suggest = (value: string) => { setText(value); input.current?.focus(); };
  return <main ref={root} style={{ height: desiredHeight }} className={`zen-overlay navigator island ${mode} ${attention ? 'attention' : busy ? 'working' : 'calm'} ${expandedResult ? 'reading' : ''} ${microphone || speaking ? 'glow' : ''} ${visible ? 'visible' : 'hidden'} ${reducedMotion ? 'motion-off' : ''}`} data-mood={companionState} onMouseEnter={() => setInteracting(true)} onMouseLeave={() => setInteracting(document.hasFocus() || !!getSelection()?.toString())} onFocusCapture={() => setInteracting(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setInteracting(false); }} aria-label="ZEN asistente">
    <header className="overlay-header">
      <button className="brand-home" onClick={() => navigate(null)} aria-label="Abrir actividad"><Companion state={companionState} animated={visible && !reducedMotion} /><span className="brand">ZEN</span></button>
      <span className={`header-status ${busy || speaking ? 'working' : ''}`} role="status"><i />{islandStatus}</span>
      <IconButton name={microphone ? 'mic' : 'mute'} label={microphone ? 'Micrófono activo · silenciar' : voiceState === 'connected' ? 'Micrófono silenciado · activar' : 'Micrófono apagado · comenzar voz'} className={`icon-button island-microphone ${microphone ? 'active' : ''}`} aria-pressed={microphone} disabled={voiceState === 'connecting'} onClick={toggleVoice} />
      <div className="header-actions"><button className="fold-button" onClick={fold} aria-expanded={!collapsed} aria-label={collapsed ? 'Desplegar panel' : 'Recoger panel'}><svg viewBox="0 0 24 24" aria-hidden="true" style={{ transform: collapsed ? undefined : 'rotate(180deg)' }}><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="1.7" /></svg></button>{collapsed && busy ? <IconButton name="stop" label="Detener todas las tareas" className="icon-button danger" onClick={() => void stop()} /> : <IconButton name="close" label="Ocultar ZEN (Esc)" onClick={() => void hide()} />}</div>
    </header>
    {!collapsed && <>
      <nav className="panel-navigation" aria-label="Navegación de ZEN">
        <button aria-current={panel === null ? 'page' : undefined} onClick={() => navigate(null)}><Icon name="details" />Actividad</button>
        <button aria-current={panel === 'history' ? 'page' : undefined} aria-label="Historial" onClick={() => navigate('history')}><Icon name="history" />Tareas{activeTasks > 0 && <span className="nav-count">{activeTasks}</span>}</button>
        <button aria-current={panel === 'tools' ? 'page' : undefined} onClick={() => navigate('tools')}><Icon name="details" />Contexto</button>
        
      </nav>
      {panel === null && records.length > 0 && <div className="task-pills" aria-label="Elegir tarea">{records.slice(-5).map(row => <button key={row.id} className={`task-pill ${row.state}`} aria-pressed={shownTask.id === row.id} onClick={() => selectTask(row)} title={row.request ?? row.message}><i /><span>{row.request || row.message || labels[row.state]}</span></button>)}</div>}
      {panel === null && shownTask.request && <details className="execution-context"><summary>{shownTask.request}</summary><p>{shownTask.request}</p></details>}
      <div className="workspace-body" ref={workspace} onScroll={event => { const element = event.currentTarget; followStream.current = element.scrollHeight - element.scrollTop - element.clientHeight < 30; }}>
        {window.zenDemo && <div className="demo-banner">VISTA DE PRUEBA · no ejecuta acciones reales</div>}
        {panel === 'tools' ? <section className="tools-panel"><h1>Contexto de tu petición</h1><DesktopPanel contextOnly notify={notify} attach={id => { playSound('attach'); setObservationId(id); setPanel(null); setCollapsed(false); notify('Ventana adjunta. Escribe qué quieres consultar antes de dos minutos.'); }} /></section>
        : panel === 'history' ? <section className="history-panel"><div className="section-heading"><div><div className="eyebrow">A TU RITMO</div><h1>Tus tareas</h1></div><span className="task-count">{activeTasks ? `${activeTasks} en marcha` : 'Todo a mano'}</span></div><div className="messages" role="log">{records.map((row, index) => <article key={row.id} className="task-record"><div className="task-record-heading"><strong>Tarea {index + 1}</strong><span className={`state-badge ${row.state}`}>{labels[row.state]}</span></div><p className="record-summary">{row.message}</p><div className="card-actions"><button onClick={() => selectTask(row)}>Ver tarea</button>{['queued', 'thinking', 'executing'].includes(row.state) && <button className="danger" onClick={async () => { const result = await window.zen.cancelTask(row.id); if (!result.ok) notify(result.error); }}>Cancelar esta tarea</button>}{row.sessionId && !['queued', 'thinking', 'executing'].includes(row.state) && <button onClick={() => { setReplyTaskId(row.id); navigate(null); notify('Escribe tu aclaración para continuar esta tarea.'); }}>Continuar esta tarea</button>}</div></article>)}{!records.length && history.map((message, index) => <p key={index} className={message.startsWith('Tú:') ? 'user-message' : ''}>{message}</p>)}{!records.length && !history.length && <div className="empty-state"><Icon name="history" /><h2>Tu próxima idea empieza aquí</h2><p>Cuando pidas algo, podrás seguir su progreso en esta sección.</p><button onClick={() => navigate(null)}>Empezar una conversación</button></div>}</div></section>
        : shownTask.state === 'awaiting_approval' ? <ApprovalCard key={shownTask.id} simulated={!!window.zenDemo} approval={shownTask.approval} notify={notify} />
        : shownTask.message ? <div className={`conversation-result ${!shownTask.streamText && shownTask.message.length > 180 && !expandedResult ? 'snippet' : ''}`}><TaskCard animated={visible && !reducedMotion} task={shownTask} details={details} setDetails={setDetails} notify={notify} label={labels[shownTask.state]} />{(shownTask.streamText ?? shownTask.message).length > 180 && <button className="read-result" aria-expanded={expandedResult} onClick={() => setExpandedResult(value => !value)}>{expandedResult ? 'Recoger resultado' : 'Leer resultado completo'}</button>}</div>
        : <section className="welcome-panel" aria-label="Accesos rápidos"><div className="companion-welcome"><Companion state={companionState} size="large" animated={visible && !reducedMotion} /><div><div className="eyebrow">AQUÍ CONTIGO</div><h1>Hola, soy ZeN.</h1><p>¿Qué tienes en mente?</p></div></div><div className="suggestion-grid"><button onClick={() => suggest('Busca información sobre ')}><Icon name="details" /><strong>Investigar</strong></button><button onClick={() => suggest('Ayúdame a preparar un borrador de ')}><Icon name="copy" /><strong>Borrador</strong></button><button onClick={() => navigate('tools')}><Icon name="details" /><strong>Adjuntar contexto</strong></button></div></section>}
      </div>
      {notice && <p className="notice" role="status">{notice}</p>}
      {observationId && <div className="attachment-note"><Icon name="check" />Ventana adjunta para tu próxima petición<button onClick={() => setObservationId(undefined)}>Quitar</button></div>}
      <form className="prompt" onSubmit={send}><div className="prompt-field"><label className="prompt-status" htmlFor="request">{replyTaskId ? 'Continuar tu tarea' : busy ? 'Puedes añadir otra petición' : 'Te leo'}<VoiceIndicator active={microphone} visible={visible} client={voice} /></label><textarea id="request" ref={input} rows={lines} maxLength={8000} value={text} onChange={event => setText(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }} placeholder="Cuéntame qué necesitas…" aria-label="Petición a Zen" /></div><IconButton name={microphone ? 'mic' : 'mute'} label={voiceState === 'connected' ? microphone ? 'Silenciar micrófono' : 'Activar micrófono' : 'Comenzar voz'} aria-pressed={microphone} disabled={voiceState === 'connecting'} onClick={toggleVoice} /><IconButton name="send" label="Enviar petición" className="icon-button primary" disabled={!text.trim() || submitting} onClick={() => void send()} /></form>
      <footer><span><i className={microphone ? 'mic-dot active' : 'mic-dot'} />{microphone ? 'Micrófono activo' : voiceState === 'connected' ? 'Micrófono silenciado' : 'Micrófono apagado'}</span><div>{!pushToTalk || voiceState === 'disconnected' ? <button onClick={() => void connectPushToTalk()}>Pulsar para hablar</button> : <button disabled={voiceState !== 'connected'} onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); holdTalk(); }} onPointerUp={releaseTalk} onPointerCancel={releaseTalk} onLostPointerCapture={releaseTalk}>Mantén · Ctrl+Espacio</button>}<button className={responseMode.meeting ? 'meeting-active' : ''} aria-pressed={responseMode.meeting} onClick={() => void changeMode({ response: responseMode.response, meeting: !responseMode.meeting })}>{responseMode.meeting ? 'En reunión' : 'Modo reunión'}</button>{speaking && <button onClick={() => void changeMode({ ...responseMode, response: 'text' })}>Silenciar respuesta</button>}{voiceState !== 'disconnected' && <button onClick={() => void voice.current?.stop()}>Desconectar</button>}{busy && <button className="danger" onClick={() => void stop()}><Icon name="stop" />Detener</button>}</div></footer>
    </>}
  </main>;
}
