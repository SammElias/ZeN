import React, { memo, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { MessageSources, MessageText } from './message-text';
import type { MessageStore } from './message-store';
import {RobotDock} from './RobotDock';
import type {RobotPresentation} from '../shared/companion';

export const StreamingMessage = memo(function StreamingMessage({ store, notify, copyReady, visible, measured, animated=true, robot, author = 'ZEN', regionLabel = 'Último mensaje' }: {
  store: MessageStore; notify: (text: string) => void; copyReady: boolean; visible: boolean; measured: (height: number) => void; animated?:boolean; robot?:RobotPresentation; author?: string; regionLabel?: string;
}) {
  const latest = useSyncExternalStore(store.subscribe, store.snapshot);
  const metadata = useSyncExternalStore(store.subscribeMetadata, store.metadata);
  const active = JSON.parse(metadata)[2] as boolean;
  const message = latest.message;
  const region = useRef<HTMLDivElement>(null), content = useRef<HTMLDivElement>(null);
  const following = useRef(true), previous = useRef('');
  const [away, setAway] = useState(false), [copied, setCopied] = useState(false);
  useLayoutEffect(() => {
    if (!region.current) return;
    const key = `${message?.key}/${message?.speaker}`;
    if (previous.current !== key) { previous.current = key; following.current = true; setAway(false); setCopied(false); region.current.scrollTop = 0; }
    else if (following.current) region.current.scrollTop = region.current.scrollHeight;
  }, [latest, active, visible, measured]);
  useLayoutEffect(() => {
    if (!visible || active || !content.current || !region.current) return;
    const measure = () => {
      const padding = getComputedStyle(region.current!);
      measured(Math.ceil(content.current!.getBoundingClientRect().height + parseFloat(padding.paddingTop) + parseFloat(padding.paddingBottom)));
    };
    // Measure settled content, including spacing, after the native window widens.
    // Never resize the window for streaming deltas.
    const observer = new ResizeObserver(measure);
    observer.observe(content.current); measure();
    return () => observer.disconnect();
  }, [active, visible, measured]);
  const tail = () => { following.current = true; setAway(false); if (region.current) region.current.scrollTop = region.current.scrollHeight; };
  return <div className={`message-stage ${robot?'with-robot':''}`}>
    <div className="workspace-body latest-message" ref={region} role="region" aria-label={regionLabel} onScroll={() => {
      const el = region.current!; following.current = el.scrollHeight - el.clientHeight - el.scrollTop < 28; setAway(!following.current);
    }}>
      <div ref={content} className="message-content">
        {message ? <article className={`live-message ${message.speaker}`} aria-live={active ? 'off' : 'polite'} aria-atomic="true">
          <div className="message-speaker">{robot&&message.speaker==='zen'&&<RobotDock presentation={robot} animated={visible&&animated}/>}<span>{message.speaker === 'user' ? 'Tú' : author}</span>{message.provisional && active && <small>En directo</small>}</div>
          {message.endMs !== undefined || active ? <p className="result-text">{message.text || 'Preparando…'}</p> : <MessageText text={message.text || 'Preparando…'} notify={notify} />}
          {message.speaker === 'zen' && latest.sourceText && latest.sourceText !== message.text && <MessageSources text={latest.sourceText} notify={notify} />}
          {message.speaker === 'zen' && latest.artifacts?.map(item => <div className="result-actions" key={item.id}>{item.kind!=='file'&&<button onClick={()=>void window.zen.openArtifact(item.id).then(r=>{if(!r.ok)notify(r.error);})}>Ver {item.title}</button>}<button onClick={()=>void window.zen.saveResult({artifactId:item.id}).then(r=>notify(r.ok?r.value.saved?'Resultado guardado.':'Guardado cancelado.':r.error))}>Guardar {item.title}</button><button onClick={()=>void window.zen.revealResult(item.id).then(r=>{if(!r.ok)notify(r.error);})}>Abrir ubicación</button></div>)}
          {message.speaker === 'zen' && !active && copyReady && !!message.text && <button className="copy-response" aria-label="Copiar respuesta" onClick={() => void navigator.clipboard.writeText(message.text).then(() => setCopied(true), () => notify('No se pudo copiar. Selecciona el texto y usa Ctrl+C.'))}>{copied ? 'Copiado' : 'Copiar'}</button>}
          {message.speaker==='zen'&&!active&&copyReady&&latest.taskId===message.key&&<div className="result-actions"><button onClick={()=>void window.zen.saveResult({taskId:message.key}).then(r=>notify(r.ok?r.value.saved?'Resultado guardado.':'Guardado cancelado.':r.error))}>Guardar texto</button><button onClick={()=>void window.zen.revealResult(message.key).then(r=>{if(!r.ok)notify(r.error);})}>Abrir ubicación</button><button onClick={()=>void window.zen.run({text:'Léeme el resultado',requestId:crypto.randomUUID(),priority:2,contextMode:'none'}).then(r=>{if(!r.ok)notify(r.error);})}>Leer en voz local</button></div>}
        </article> : <div className="live-empty">{robot&&<RobotDock presentation={robot} animated={visible&&animated}/>}<div className="welcome-copy"><strong>¿En qué te ayudo?</strong><span>Cuéntame qué necesitas. Lo hacemos paso a paso.</span></div></div>}
      </div>
    </div>
    {away && <button className="follow-response" onClick={tail}>Ir al final ↓</button>}
  </div>;
});
