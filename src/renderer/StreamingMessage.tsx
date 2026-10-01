import React, { memo, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { MessageSources, MessageText } from './message-text';
import type { MessageStore } from './message-store';

export const StreamingMessage = memo(function StreamingMessage({ store, notify, copyReady, visible, measured, author = 'ZEN', regionLabel = 'Último mensaje' }: {
  store: MessageStore; notify: (text: string) => void; copyReady: boolean; visible: boolean; measured: (height: number) => void; author?: string; regionLabel?: string;
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
    if (visible && !active && content.current) measured(content.current.scrollHeight);
  }, [latest, active, visible, measured]);
  const tail = () => { following.current = true; setAway(false); if (region.current) region.current.scrollTop = region.current.scrollHeight; };
  return <div className="message-stage">
    <div className="workspace-body latest-message" ref={region} role="region" aria-label={regionLabel} onScroll={() => {
      const el = region.current!; following.current = el.scrollHeight - el.clientHeight - el.scrollTop < 28; setAway(!following.current);
    }}>
      <div ref={content}>
        {message ? <article className={`live-message ${message.speaker}`} aria-live={active ? 'off' : 'polite'} aria-atomic="true">
          <span className="message-speaker">{message.speaker === 'user' ? 'Tú' : author}{message.provisional && active && <small>En directo</small>}</span>
          {message.endMs !== undefined || active ? <p className="result-text">{message.text || 'Preparando…'}</p> : <MessageText text={message.text || 'Preparando…'} notify={notify} />}
          {message.speaker === 'zen' && latest.sourceText && latest.sourceText !== message.text && <MessageSources text={latest.sourceText} notify={notify} />}
          {message.speaker === 'zen' && latest.artifacts?.map(item => <button className="source-chip" key={item.id} onClick={() => void window.zen.openArtifact(item.id).then(result => { if (!result.ok) notify(result.error); })}>Ver {item.kind === 'image' ? 'imagen' : 'resultado'} · {item.title}</button>)}
          {message.speaker === 'zen' && !active && copyReady && !!message.text && <button className="copy-response" aria-label="Copiar respuesta" onClick={() => void navigator.clipboard.writeText(message.text).then(() => setCopied(true), () => notify('No se pudo copiar. Selecciona el texto y usa Ctrl+C.'))}>{copied ? 'Copiado' : 'Copiar'}</button>}
        </article> : <p className="live-empty">Escribe o habla con ZEN.</p>}
      </div>
    </div>
    {away && <button className="follow-response" onClick={tail}>Ir al final ↓</button>}
  </div>;
});
