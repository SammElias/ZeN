import React from 'react';
import type { ScreenContextStatus } from '../main/screen-context';
export function ScreenContextChip({ context, refresh, preview, remove }: { context?: ScreenContextStatus; refresh: () => Promise<boolean>; preview: () => Promise<void>; remove:()=>Promise<void> }) {
  if (!context || context.state === 'idle') return null;
  const ready = context.state === 'ready' || context.state === 'queued';
  const source = context.sourceTitle?.split(' - ').at(-1) ?? 'pantalla';
  const time=context.capturedAt?new Date(context.capturedAt).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}):'';
  const status=context.state==='removed'?'Sin captura compartida':context.state==='capturing'?'Preparando captura…':context.state==='expired'?'Captura caducada':context.state==='unavailable'?'Captura no disponible':`Captura de ${source}${time?` · ${time}`:''}`;
  return <div className={`screen-context-note ${ready?'ready':''}`}>
    <span className="screen-context-description" title={`${context.sourceTitle??status}${context.scope==='display'?' · Incluye la pantalla donde está ZEN':''}`}><span aria-hidden="true">▣</span><span className="screen-context-source">{status}{ready&&context.scope==='display'&&<small>Pantalla completa donde está ZEN</small>}</span></span>
    <div className="screen-context-actions">
      {ready&&<button aria-label="Ver captura de referencia" onClick={()=>void preview()}>Ver captura</button>}
      <button aria-label="Actualizar captura" disabled={context.state==='capturing'} onClick={()=>void refresh()}>Actualizar</button>
      {!['removed','expired','unavailable'].includes(context.state)&&<button aria-label="Quitar captura de referencia" onClick={()=>void remove()}>Quitar</button>}
    </div>
  </div>;
}
