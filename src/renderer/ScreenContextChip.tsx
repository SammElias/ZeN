import React,{useRef,useState} from 'react';
import type { ScreenContextStatus } from '../main/screen-context';
export function ScreenContextChip({ context={state:'idle'}, refresh, preview, remove, compact=false, disabledReason }: { context?: ScreenContextStatus; refresh: () => Promise<boolean>; preview: () => Promise<void>; remove:()=>Promise<void>;compact?:boolean;disabledReason?:string }) {
  const pending=useRef(false),[refreshing,setRefreshing]=useState(false);
  const ready = !disabledReason && (context.state === 'ready' || context.state === 'queued');
  const busy=refreshing||context.state==='capturing';
  const update=async()=>{if(pending.current||busy||disabledReason)return;pending.current=true;setRefreshing(true);try{await refresh();}finally{pending.current=false;setRefreshing(false);}};
  const source = context.sourceTitle ?? 'la pantalla de ZEN';
  const time=context.capturedAt?new Date(context.capturedAt).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}):'';
  const status=disabledReason?'Contexto adjunto seleccionado':busy?'Preparando captura…':context.state==='removed'?'Sin captura compartida':context.state==='expired'?'Captura caducada':context.state==='unavailable'?'Captura no disponible':context.state==='idle'?'Sin captura preparada':`${compact&&context.scope==='display'?'Pantalla':compact?source:'Captura de '+source}${time?` · ${time}`:''}`;
  return <div className={`screen-context-note ${compact?'screen-context-bar':''} ${ready?'ready':''}`} aria-label="Contexto de pantalla">
    <span className="screen-context-description" title={disabledReason??`${status}${context.scope==='display'?` · Monitor donde está ZEN. Título detectado detrás: ${source}`:''}`}><span aria-hidden="true">▣</span><span className="screen-context-source">{status}{!compact&&ready&&context.scope==='display'&&<small>Pantalla completa donde está ZEN</small>}</span></span>
    <div className="screen-context-actions">
      {ready&&<button aria-label="Ver captura de referencia" title="Ver la captura exacta" onClick={()=>void preview()}>{compact?'Ver':'Ver captura'}</button>}
      <button aria-label="Actualizar captura" title={disabledReason??'Renovar la captura del monitor donde está ZEN para tu próxima petición'} disabled={busy||!!disabledReason} onClick={()=>void update()}>Actualizar captura</button>
      {ready&&<button aria-label="Quitar captura de referencia" title="Quitar esta captura" onClick={()=>void remove()}>Quitar</button>}
    </div>
  </div>;
}
