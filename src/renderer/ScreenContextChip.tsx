import React from 'react';
import type { ScreenContextStatus } from '../main/screen-context';
export function ScreenContextChip({ context, refresh, preview }: { context?: ScreenContextStatus; refresh: () => Promise<boolean>; preview: () => Promise<void> }) {
  if (!context || context.state === 'idle') return null;
  const ready = context.state === 'ready' || context.state === 'queued';
  const source = context.sourceTitle?.split(' - ').at(-1) ?? 'Contexto visual';
  const status = context.state === 'capturing' ? 'Preparando…' : context.state === 'expired' ? 'Caducada' : context.state === 'unavailable' ? 'No disponible' : 'Preparada';
  return <div className="screen-context-note" title={context.sourceTitle}>
    <button className={`screen-context-chip ${ready ? 'ready' : ''}`} aria-label="Ver captura de referencia" disabled={!ready} onClick={() => void preview()}>
      <span aria-hidden="true">▣</span> Pantalla · {source}<small>{status}{context.capturedAt && ` · ${new Date(context.capturedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`}</small>
    </button>
    <button aria-label="Actualizar captura" disabled={context.state === 'capturing'} onClick={() => void refresh()}>Actualizar</button>
  </div>;
}
