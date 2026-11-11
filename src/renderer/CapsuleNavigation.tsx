import React, {useState} from 'react';
import type {CompanionStatus} from '../shared/codex-companion';
import {isSilenced} from '../shared/companion-presentation';
import {isLauncherPageSelected, launcherPages, type LauncherPage} from '../shared/companion-navigation';
import {CompanionIcon} from './CompanionActions';

export const launcherName = {
  home: 'Home',
  codex: 'Codex',
  spotify: 'Sonido',
  notes: 'Apuntes',
  notices: 'Avisos',
} satisfies Record<LauncherPage, string>;

const launcherMime = 'application/x-zen-integration';
const launcherOrder = (status: CompanionStatus) => status.workspace?.order ?? launcherPages;

function moveLauncherPage(order: readonly LauncherPage[], from: LauncherPage, to: LauncherPage) {
  const next = [...order];
  next.splice(next.indexOf(from), 1);
  next.splice(order.indexOf(to), 0, from);
  return next;
}

export function CapsuleNavigation({status, onError}: {status: CompanionStatus; onError: (error: string) => void}) {
  const [dragged, setDragged] = useState<LauncherPage>();
  const expanded = status.workspace?.expanded ?? false;
  const page = status.workspace?.page ?? 'home';
  const order = launcherOrder(status);
  const visiblePages = order.filter(value => value !== 'notices');
  const approvals = status.approvals.length;

  function reportFailure(result: {ok: boolean; error?: string}) {
    if (!result.ok && result.error) onError(result.error);
  }

  function reorder(from: LauncherPage, to: LauncherPage) {
    if (from !== to) void window.companion.launcherOrder(moveLauncherPage(order, from, to)).then(reportFailure);
  }

  function openContext(value: LauncherPage) {
    void window.companion.launcherContext(value).then(reportFailure);
  }

  return <nav className="capsule-launcher" aria-label="Integraciones" data-capsule-block="navigation">
    {visiblePages.map((value, index) => {
      const selected = isLauncherPageSelected(page, value);
      const name = launcherName[value];
      const active = expanded && selected;
      const description = value === 'codex' && approvals ? `Codex · ${approvals} permiso pendiente` : name;
      return <button key={value} data-page={value} aria-label={name} aria-expanded={active}
        aria-controls="capsule-content"
        title={(active ? 'Volver a la cápsula' : 'Abrir ' + name) + ' · ' + description + ' · clic derecho para acciones · Alt + flechas para ordenar'}
        aria-current={selected ? 'page' : undefined} aria-pressed={active} data-dragging={dragged === value}
        draggable onDragStart={event => {
          setDragged(value);
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData(launcherMime, value);
        }} onDragEnd={() => setDragged(undefined)}
        onDragOver={event => {
          if (dragged) {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
          }
        }} onDrop={event => {
          event.preventDefault();
          if (dragged && event.dataTransfer.getData(launcherMime) === dragged) reorder(dragged, value);
          setDragged(undefined);
        }} onContextMenu={event => {
          event.preventDefault();
          openContext(value);
        }} onKeyDown={event => {
          if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
            event.preventDefault();
            openContext(value);
          } else if (event.altKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
            event.preventDefault();
            const target = visiblePages[index + (event.key === 'ArrowLeft' ? -1 : 1)];
            if (target) reorder(value, target);
          }
        }} onClick={() => void window.companion.togglePage(value).then(reportFailure)}>
        {value === 'home'
          ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9"/></svg>
          : <CompanionIcon name={value === 'spotify' ? 'sound' : value === 'notes' ? 'notebook' : 'code'}/>}
        <span>{name}</span>
        {value === 'codex' && approvals > 0 && <b className="integration-badge permission-badge">{approvals}</b>}
      </button>;
    })}
  </nav>;
}

export function CapsuleMenu({status,context}:{status:CompanionStatus;context?:LauncherPage}){
 const [error,setError]=useState(''),order=launcherOrder(status);
 const run=async(p:Promise<{ok:boolean;error?:string}>)=>{const r=await p;setError(r.ok?'':r.error??'No se pudo completar la acción.');};
 const last=status.workspace?.last??'home';
 const move=(offset:number)=>{if(!context)return;const to=order[order.indexOf(context)+offset];if(to)void run(window.companion.launcherOrder(moveLauncherPage(order,context,to)));};
 return <section className="capsule-inline-menu" aria-label={context?'Acciones de '+launcherName[context]:'Más opciones'}><h1>{context?launcherName[context]:'Opciones'}</h1><div className="capsule-menu-grid">{context?<>
  <button onClick={()=>void run(window.companion.navigate(context))}>Abrir {launcherName[context]}</button>
  {(context==='spotify'||context==='codex')&&<button onClick={()=>void run(window.companion.compact(context))}>Ver en cápsula</button>}
  {context==='codex'&&<><button onClick={()=>void run(window.companion.openCodex())}>Volver al chat fijado</button><button onClick={()=>void run(window.companion.navigate('permissions'))}>Revisar permisos</button></>}
  <button disabled={order.indexOf(context)===0} onClick={()=>move(-1)}>← Mover a la izquierda</button><button disabled={order.indexOf(context)===order.length-1} onClick={()=>move(1)}>Mover a la derecha →</button>
 </>:<>
  <button onClick={()=>void run(window.companion.navigate(last))}>Continuar en {launcherName[last]}</button><button onClick={()=>void run(window.companion.openCodex())}>Volver al chat fijado</button>
  <button onClick={()=>void run(window.companion.navigate('notices'))}><CompanionIcon name="bell"/>Avisos</button>
  <button aria-pressed={status.settings.sounds} onClick={()=>void run(window.companion.sound(!status.settings.sounds))}><CompanionIcon name={status.settings.sounds?'sound':'mute'}/>{status.settings.sounds?'Silenciar sonidos':'Activar sonidos'}</button>
  <button onClick={()=>void run(window.companion.silence(isSilenced(status.settings)?0:30))}>{isSilenced(status.settings)?'Reactivar avisos':'Silenciar avisos 30 min'}</button>
  <button aria-pressed={status.settings.presentation} onClick={()=>void run(window.companion.presentation(!status.settings.presentation))}><CompanionIcon name="presentation"/>Presentación</button>
  <button onClick={()=>void run(window.companion.navigate('settings'))}><CompanionIcon name="settings"/>Preferencias</button>
 </>}</div>{error&&<p role="alert">{error}</p>}</section>;
}
