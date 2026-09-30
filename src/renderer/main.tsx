import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { ZenBridge, PublicSettings, Settings, TaskState, TaskEvent } from '../shared/contracts';
import { VoiceClient, type VoiceStatus } from './voice';
import './style.css';
declare global { interface Window { zen: ZenBridge } }
const labels: Record<TaskState, string> = { idle: 'Disponible', listening: 'Escuchando', thinking: 'Pensando', awaiting_approval: 'Esperando aprobación', executing: 'Ejecutando', completed: 'Completada', failed: 'Fallida', cancelled: 'Detenida' };
function App() {
  const [config, setConfig] = useState<PublicSettings>();
  const [draft, setDraft] = useState<Settings>();
  const [key, setKey] = useState('');
  const [text, setText] = useState('');
  const [messages, setMessages] = useState<string[]>(['ZEN está disponible. Configura tu clave para empezar. Puedes pedirme «Abre el Bloc de notas».']);
  const [state, setState] = useState<TaskState>('idle');
  const [voiceState, setVoiceState] = useState<VoiceStatus>('disconnected');
  const [microphone, setMicrophone] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [evidence, setEvidence] = useState<TaskEvent['evidence']>();
  const voice = useRef<VoiceClient | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const add = (message: string) => setMessages(previous => [...previous.slice(-99), message]);
  useEffect(() => {
    voice.current = new VoiceClient(window.zen, (status, mic) => { setVoiceState(status); setMicrophone(mic); }, add);
    void window.zen.settings().then(result => { if (result.ok) { setConfig(result.value); setDraft(result.value.settings); if (!result.value.hasKey) setSettingsOpen(true); if (!result.value.shortcutRegistered) add('El atajo no está disponible. Configura otro en Ajustes.'); } else add(result.error); });
    const offTask = window.zen.onTask(event => {
      setState(event.state); setEvidence(event.evidence);
      if (['completed', 'failed', 'cancelled'].includes(event.state)) add(event.message);
      if (event.id === 'voice' && ['failed', 'cancelled'].includes(event.state)) void voice.current?.stop();
    });
    const offInvoke = window.zen.onInvoke(() => { if (voice.current?.active) input.current?.focus(); else void voice.current?.start(); });
    return () => { offTask(); offInvoke(); void voice.current?.stop(); };
  }, []);
  const busy = submitting || ['thinking', 'executing', 'awaiting_approval'].includes(state);
  async function send(event: React.FormEvent) {
    event.preventDefault(); if (!text.trim() || busy) return;
    const value = text; setText(''); add(`Tú: ${value}`); setSubmitting(true);
    try { const result = await window.zen.run({ text: value, requestId: crypto.randomUUID() }); if (!result.ok) add(result.error); }
    finally { setSubmitting(false); }
  }
  async function stop() { await voice.current?.stop(); const result = await window.zen.stop(); if (!result.ok) add(result.error); else setState('cancelled'); }
  async function save() {
    if (!draft) return;
    const result = await window.zen.saveSettings(draft);
    if (result.ok) { setConfig(result.value); setDraft(result.value.settings); add('Configuración guardada. Los modelos seleccionados se usarán sin sustituciones.'); } else add(result.error);
  }
  async function saveKey() { const result = await window.zen.saveKey(key); setKey(''); if (result.ok) { const refreshed = await window.zen.settings(); if (refreshed.ok) setConfig(refreshed.value); add('Clave guardada con protección de Windows.'); } else add(result.error); }
  return <main>
    <header><div><span className="wordmark">ZEN<span className="dot">●</span></span><p>Tu asistente, a una petición de distancia.</p></div><button onClick={() => setSettingsOpen(!settingsOpen)}>Configuración</button></header>
    <section className="status" aria-live="polite"><span>● Disponible en Windows</span><span>Micrófono: {microphone ? 'activo' : 'apagado'}</span><span>Voz: {{ disconnected: 'desconectada', connecting: 'conectando…', connected: 'conectada' }[voiceState]}</span></section>
    <div className="workspace"><section className="conversation"><div className="section-heading"><h1>Conversación</h1><span>{microphone && state === 'idle' ? 'Escuchando' : labels[state]}</span></div><div className="messages" role="log" aria-live="polite">{messages.map((message, i) => <p className={message.startsWith('Tú:') ? 'user' : 'zen'} key={i}>{message}</p>)}</div>
    {evidence && <p className="evidence">Ventana verificada · PID {evidence.pid} · {evidence.alreadyOpen ? 'ya estaba abierta' : 'abierta por ZEN'}</p>}
    <form onSubmit={send}><label className="sr-only" htmlFor="request">Petición</label><input ref={input} id="request" value={text} onChange={e => setText(e.target.value)} maxLength={8000} placeholder="Escribe: Abre el Bloc de notas" disabled={voiceState !== 'disconnected'} /><button disabled={busy || !config?.hasKey || voiceState !== 'disconnected'}>Enviar</button></form>
    <div className="actions"><button disabled={!config?.hasKey || busy || voiceState === 'connecting'} onClick={() => voiceState === 'connected' ? void stop() : void voice.current?.start()}>{voiceState === 'connected' ? 'Desconectar voz' : 'Conversar por voz'}</button><button className="stop" onClick={() => void stop()}>■ Detener</button></div>
    <p className="hint">{config?.settings.shortcut ?? 'Control+Alt+Z'} para invocar voz. Detener bloquea nuevas acciones; una aplicación ya abierta permanece abierta.</p></section>
    {settingsOpen && draft && <aside><h2>Configuración</h2><label>Clave OpenAI API <span>{config?.hasKey ? 'guardada' : 'sin configurar'}</span><input type="password" value={key} autoComplete="off" onChange={e => setKey(e.target.value)} placeholder="Solo se guarda con protección de Windows" /></label><button disabled={!key || busy || voiceState !== 'disconnected'} onClick={() => void saveKey()}>Guardar clave</button><button onClick={async () => { const r = await window.zen.deleteKey(); if (!r.ok) add(r.error); else { const c = await window.zen.settings(); if (c.ok) setConfig(c.value); add('Clave eliminada.'); } }}>Eliminar clave</button>
      <label>Razonamiento<input value={draft.reasoningModel} onChange={e => setDraft({ ...draft, reasoningModel: e.target.value })} /></label><label>Voz<input value={draft.voiceModel} onChange={e => setDraft({ ...draft, voiceModel: e.target.value })} /></label><p className="hint">Cambiar modelos es una decisión explícita. ZEN no aplica modelos alternativos si falta acceso.</p>
      <label>Atajo global<input value={draft.shortcut} onChange={e => setDraft({ ...draft, shortcut: e.target.value })} /></label><label>Llamadas máximas<input type="number" min={1} max={10} value={draft.maxToolCalls} onChange={e => setDraft({ ...draft, maxToolCalls: Number(e.target.value) })} /></label><label>Tiempo por tarea (segundos)<input type="number" min={5} max={90} value={draft.taskTimeoutMs / 1000} onChange={e => setDraft({ ...draft, taskTimeoutMs: Number(e.target.value) * 1000 })} /></label>
      <label className="check"><input type="checkbox" checked={draft.allowNotepad} onChange={e => setDraft({ ...draft, allowNotepad: e.target.checked })} />Permitir abrir Bloc de notas</label>
      <label className="check"><input type="checkbox" checked={draft.voiceConsent} onChange={e => setDraft({ ...draft, voiceConsent: e.target.checked })} />Acepto enviar audio a OpenAI durante las sesiones de voz. Puede consumir saldo API.</label>
      <button disabled={busy || voiceState !== 'disconnected'} onClick={() => void save()}>Guardar configuración</button><p className="hint">La voz se inicia por botón o atajo, se limita a cinco minutos y se desconecta al ocultar ZEN. No hay escucha permanente.</p>
      <button onClick={async () => { const result = await window.zen.clearLogs(); add(result.ok ? 'Registro local eliminado.' : result.error); }}>Borrar registro local</button><p className="hint">Solo metadatos, uso API y evidencia técnica. Retención: 7 días / 500 eventos. Coste estimado: no disponible sin tarifas verificadas. Voz, tokens y herramientas se registran por separado.</p>
    </aside>}</div><footer>Primera entrega · Solo Bloc de notas · {config?.protectedStorage ? 'Almacenamiento protegido disponible' : 'Protección de claves sin verificar'}</footer>
  </main>;
}
createRoot(document.getElementById('root')!).render(<App />);
