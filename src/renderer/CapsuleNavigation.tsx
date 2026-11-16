import React, {useLayoutEffect, useRef, useState} from 'react';
import {motion} from '../shared/companion-motion';
import {canAnimate} from './companion-motion';
import type {CompanionStatus} from '../shared/codex-companion';
import {isLauncherPageSelected, launcherPages, type LauncherPage, type SectionPage} from '../shared/companion-navigation';
import {CompanionIcon} from './CompanionActions';

export const launcherName = {
  home: 'Home',
  codex: 'Codex',
  spotify: 'Sonido',
  notes: 'Apuntes',
  notices: 'Avisos',
} satisfies Record<LauncherPage, string>;

const launcherMime = 'application/x-zen-integration';
const launcherOrder = (status: CompanionStatus): readonly LauncherPage[] => status.workspace?.order ?? launcherPages;

function moveLauncherPage(order: readonly LauncherPage[], from: LauncherPage, to: LauncherPage) {
  const next = [...order];
  next.splice(next.indexOf(from), 1);
  next.splice(order.indexOf(to), 0, from);
  return next;
}

export type ActivateSection = (page: SectionPage, keyboard: boolean) => void;

export function CapsuleNavigation({status, ready, compact = false, onActivate, onError}: {
  status: CompanionStatus;
  ready: boolean;
  compact?: boolean;
  onActivate: ActivateSection;
  onError: (error: string) => void;
}) {
  const nav=useRef<HTMLElement>(null);
  const marker=useRef<HTMLSpanElement>(null);
  const [dragged, setDragged] = useState<LauncherPage>();
  const expanded = !compact && status.workspace?.expanded === true;
  const page = status.workspace?.page ?? 'home';
  const order = launcherOrder(status);
  const visiblePages = order.filter((value): value is Exclude<LauncherPage,'notices'> => value !== 'notices');
  const approvals = status.approvals.length;
  useLayoutEffect(()=>{
    const root=nav.current,indicator=marker.current;
    if(!root||!indicator)return;
    const setMarker=(animate:boolean)=>{
      const active=root.querySelector('button[aria-current=page]');
      indicator.hidden=!active;
      if(!active)return;
      const previous=indicator.getBoundingClientRect();
      const old=indicator.getAnimations();
      old.forEach(animation=>animation.cancel());
      const target=active.getBoundingClientRect(),bounds=root.getBoundingClientRect();
      const vertical=root.closest('[data-orientation=vertical]')!==null;
      const right=root.closest('[data-edge=right]')!==null;
      const x=vertical?(right?target.right-4:target.left+2):target.left+target.width*.25;
      const y=vertical?target.top+7:target.bottom-4;
      Object.assign(indicator.style,{left:`${x-bounds.left}px`,top:`${y-bounds.top}px`,
       width:`${vertical?2:target.width/2}px`,height:`${vertical?Math.max(2,target.height-14):2}px`});
      const next=indicator.getBoundingClientRect();
      if(animate&&previous.width&&previous.height&&canAnimate(root)){
        indicator.animate([{transformOrigin:'0 0',transform:`translate(${previous.x-next.x}px,${previous.y-next.y}px) scale(${previous.width/next.width},${previous.height/next.height})`},{transformOrigin:'0 0',transform:'none'}],
          {duration:motion.navigation,easing:motion.enterEase});
      }
    };
    setMarker(true);
    const resize=new ResizeObserver(()=>{if(!indicator.getAnimations().length)setMarker(false);});
    resize.observe(root);
    return ()=>resize.disconnect();
  },[expanded,page,order,status.workspace?.edge?.side]);
  useLayoutEffect(()=>{
    if(compact)return;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    const stop=()=>{if(reduced.matches||!status.settings.motion)marker.current?.getAnimations().forEach(animation=>animation.cancel());};
    stop();
    reduced.addEventListener('change',stop);
    return ()=>reduced.removeEventListener('change',stop);
  },[compact,status.settings.motion]);

  function reportFailure(result: {ok: boolean; error?: string}) {
    if (!result.ok && result.error) onError(result.error);
  }

  function reorder(from: LauncherPage, to: LauncherPage) {
    if (from !== to) void window.companion.launcherOrder(moveLauncherPage(order, from, to)).then(reportFailure);
  }

  function openContext(value: LauncherPage) {
    void window.companion.launcherContext(value).then(reportFailure);
  }

  return <nav ref={nav} className="capsule-launcher" aria-label="Navegación de ZEN" data-capsule-block="navigation">
    {!compact&&<span ref={marker} className="capsule-selection-marker" aria-hidden="true" hidden={!expanded}/>}
    {[...visiblePages, 'settings' as const].map((value, index) => {
      const settings = value === 'settings';
      const name = settings ? 'Configuración' : launcherName[value];
      const label = settings ? 'Ajustes' : name;
      const active = expanded && isLauncherPageSelected(page, value);
      const tooltip = (active ? 'Replegar ' : 'Abrir ') + label;
      return <button key={value} type="button" data-page={value} aria-label={name} aria-expanded={active} disabled={!ready}
        aria-controls="capsule-content"
        title={value === 'codex' && approvals ? `${tooltip} · ${approvals} permisos pendientes` : tooltip}
        aria-current={active ? 'page' : undefined} data-dragging={dragged === value}
        draggable={!compact&&!settings} onDragStart={compact||settings ? undefined : event => {
          setDragged(value);
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData(launcherMime, value);
        }} onDragEnd={() => setDragged(undefined)}
        onDragOver={settings ? undefined : event => {
          if (dragged) {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
          }
        }} onDrop={settings ? undefined : event => {
          event.preventDefault();
          if (dragged && event.dataTransfer.getData(launcherMime) === dragged) reorder(dragged, value);
          setDragged(undefined);
        }} onContextMenu={settings ? undefined : event => {
          event.preventDefault();
          openContext(value);
        }} onKeyDown={event => {
          if(event.key==='Enter'||event.key===' '){
            event.preventDefault();
            if(!event.repeat&&!event.nativeEvent.isComposing&&!dragged)onActivate(value,true);
            return;
          }
          if(settings)return;
          if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
            event.preventDefault();
            openContext(value);
          } else if (event.altKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
            event.preventDefault();
            const target = visiblePages[index + (event.key === 'ArrowLeft' ? -1 : 1)];
            if (target) reorder(value, target);
          }
        }} onClick={event=>{if(!dragged)onActivate(value,event.detail===0);}}>
        {value === 'home'
          ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9"/></svg>
          : <CompanionIcon name={settings ? 'settings' : value === 'spotify' ? 'sound' : value === 'notes' ? 'notebook' : 'code'}/>}
        <span>{label}</span>
        {value === 'codex' && approvals > 0 && <b className="integration-badge permission-badge">{approvals}</b>}
      </button>;
    })}
  </nav>;
}

export function CapsuleMenu({status,context}:{status:CompanionStatus;context?:LauncherPage}){
 const [error,setError]=useState(''),order=launcherOrder(status);
 const run=async(p:Promise<{ok:boolean;error?:string}>)=>{const r=await p;setError(r.ok?'':r.error??'No se pudo completar la acción.');};
 const layout=status.workspace?.layout;
 const move=(offset:number)=>{if(!context)return;const to=order[order.indexOf(context)+offset];if(to)void run(window.companion.launcherOrder(moveLauncherPage(order,context,to)));};
 return <section className="capsule-inline-menu" aria-label={context?'Acciones de '+launcherName[context]:'Distribución de ventana'}><h1>{context?launcherName[context]:'Ventana'}</h1>{context&&<div className="capsule-menu-grid">
  <button onClick={()=>void run(window.companion.navigate(context))}>Abrir {launcherName[context]}</button>
  {(context==='spotify'||context==='codex')&&<button onClick={()=>void run(window.companion.compact(context))}>Ver en cápsula</button>}
  {context==='codex'&&<><button onClick={()=>void run(window.companion.openCodex())}>Volver al chat fijado</button><button onClick={()=>void run(window.companion.navigate('permissions'))}>Revisar permisos</button></>}
  <button disabled={order.indexOf(context)===0} onClick={()=>move(-1)}>← Mover a la izquierda</button><button disabled={order.indexOf(context)===order.length-1} onClick={()=>move(1)}>Mover a la derecha →</button>
 </div>}
 {!context&&layout&&<details className="workspace-layout-menu">
  <summary>Distribución de ventana</summary>
  <div className="workspace-layout-actions">
   <button onClick={()=>void run(window.companion.workspaceLayout('left'))}>Mitad izquierda</button>
   <button onClick={()=>void run(window.companion.workspaceLayout('right'))}>Mitad derecha</button>
   <button onClick={()=>void run(window.companion.workspaceLayout('free'))}>Ventana libre</button>
   <button onClick={()=>void run(window.companion.workspaceLayout('maximize'))}>Maximizar</button>
   <button disabled={!status.workspace?.canRestorePosition} onClick={()=>void run(window.companion.workspaceLayout('restore'))}>Restaurar última posición</button>
  </div>
  <div className="workspace-layout-preferences">
   <label>Ubicación de ZEN
    <select value={status.workspace?.location??'left'} onChange={event=>{
     const next=event.target.value;
     if(next==='top'||next==='left'||next==='right'||next==='floating')void run(window.companion.capsuleLocation(next));
    }}>
     <option value="top">Arriba</option><option value="left">Izquierda</option><option value="right">Derecha</option><option value="floating">Flotante</option>
    </select>
   </label>
   <label><input type="checkbox" checked={layout.restoreOnLaunch} onChange={event=>void run(window.companion.workspaceLayoutPreferences({...layout,restoreOnLaunch:event.target.checked}))}/> Restaurar al iniciar ZEN</label>
  </div>
 </details>}
 {error&&<p role="alert">{error}</p>}</section>;
}
