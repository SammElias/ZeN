import {responseMarks,type VisualReference} from '../shared/interactions';
import React, { memo, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { MessageSources, MessageText } from './message-text';
import {MessageActions,type MessageAction} from './MessageActions';
import type { MessageStore } from './message-store';
import {RobotDock} from './RobotDock';
import type {RobotPresentation} from '../shared/companion';

export const StreamingMessage = memo(function StreamingMessage({ scrollParent,externalFollow=false,visualReference,store, notify, copyReady, visible, measured, animated=true, robot, author = 'ZEN', regionLabel = 'Último mensaje' }: {
  scrollParent?:React.RefObject<HTMLDivElement|null>;externalFollow?:boolean;visualReference?:VisualReference;store: MessageStore; notify: (text: string) => void; copyReady: boolean; visible: boolean; measured: (height: number) => void; animated?:boolean; robot?:RobotPresentation; author?: string; regionLabel?: string;
}) {
  const latest = useSyncExternalStore(store.subscribe, store.snapshot);
  const metadata = useSyncExternalStore(store.subscribeMetadata, store.metadata);
  const active = JSON.parse(metadata)[2] as boolean;
  const message = latest.message;
  const displayText=message?.text&&message.speaker==='zen'&&!active&&responseMarks(message.text,visualReference).length?message.text.replace(/```zen-visual[\s\S]*?```/g,'').trim():message?.text;
  const ownRegion = useRef<HTMLDivElement>(null), region=scrollParent??ownRegion, content = useRef<HTMLDivElement>(null);
  const following = useRef(true), previous = useRef('');
  const [away, setAway] = useState(false);
  useLayoutEffect(() => {
    if (!region.current||!visible) return;
    const key = `${message?.key}/${message?.speaker}`;
    if (previous.current !== key) {
      if (!scrollParent) { following.current = true; setAway(false); region.current.scrollTop = 0; }
      else { if (!previous.current) following.current = region.current.scrollHeight-region.current.clientHeight-region.current.scrollTop<60; setAway(!following.current); if(following.current)region.current.scrollTop=region.current.scrollHeight; }
      previous.current = key;
    } else if (following.current) region.current.scrollTop = region.current.scrollHeight;
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
  useLayoutEffect(()=>{if(!scrollParent?.current||!visible)return;const el=scrollParent.current;const update=()=>{following.current=el.scrollHeight-el.clientHeight-el.scrollTop<28;setAway(!following.current);};el.addEventListener('scroll',update);return()=>el.removeEventListener('scroll',update);},[scrollParent,visible]);
  const tail = () => { following.current = true; setAway(false); if (region.current) region.current.scrollTop = region.current.scrollHeight; };
  return <div className={`message-stage ${robot?'with-robot':''}`}>
    <div className="workspace-body latest-message" ref={scrollParent?undefined:ownRegion} role="region" aria-label={regionLabel} onScroll={() => {
      const el = region.current!; following.current = el.scrollHeight - el.clientHeight - el.scrollTop < 28; setAway(!following.current);
    }}>
      <div ref={content} className="message-content">
        {message ? <article className={`live-message ${message.speaker}`} aria-live={active ? 'off' : 'polite'} aria-atomic="true">
          <div className="message-speaker">{robot&&message.speaker==='zen'&&<RobotDock presentation={robot} animated={visible&&animated}/>}<span>{message.speaker === 'user' ? 'Tú' : author}</span>{message.provisional && active && <small>En directo</small>}</div>
          {message.endMs !== undefined || active ? <p className="result-text">{message.text || 'Preparando…'}</p> : <MessageText text={displayText || 'Preparando…'} notify={notify} />}
          {message.speaker === 'zen' && latest.sourceText && latest.sourceText !== message.text && <MessageSources text={latest.sourceText} notify={notify} />}
          {message.speaker==='zen'&&<div className="message-action-space">{!active&&copyReady&&!!message.text&&<MessageActions text={displayText??message.text} notify={notify} actions={[
            ...(latest.taskId===message.key?[{label:'Guardar texto',run:async()=>{const r=await window.zen.saveResult({taskId:message.key});notify(r.ok?r.value.saved?'Resultado guardado.':'Guardado cancelado.':r.error);}},{label:'Abrir ubicación',run:async()=>{const r=await window.zen.revealResult(message.key);if(!r.ok)notify(r.error);}},{label:'Leer en voz local',run:async()=>{const r=await window.zen.run({text:'Léeme el resultado',requestId:crypto.randomUUID(),priority:2,contextMode:'none'});if(!r.ok)notify(r.error);}}]:[]),
            ...(latest.artifacts??[]).flatMap(item=>[{label:'Guardar '+item.title,run:async()=>{const r=await window.zen.saveResult({artifactId:item.id});notify(r.ok?r.value.saved?'Resultado guardado.':'Guardado cancelado.':r.error);}},...(item.kind!=='file'?[{label:'Ver '+item.title,run:async()=>{const r=await window.zen.openArtifact(item.id);if(!r.ok)notify(r.error);}}]:[]),{label:'Abrir ubicación de '+item.title,run:async()=>{const r=await window.zen.revealResult(item.id);if(!r.ok)notify(r.error);}}])
          ] as MessageAction[]}/>}</div>}

        </article> : <div className="live-empty">{robot&&<RobotDock presentation={robot} animated={visible&&animated}/>}<div className="welcome-copy"><strong>¿En qué te ayudo?</strong><span>Cuéntame qué necesitas. Lo hacemos paso a paso.</span></div></div>}
      </div>
    </div>
    {away && !externalFollow && <button className="follow-response" onClick={tail}>Ir al final ↓</button>}
  </div>;
});
