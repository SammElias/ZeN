import React, {useEffect, useState} from 'react';
import type {CompanionStatus} from '../shared/codex-companion';
import {connectionLabel, isSilenced, lastSignalLabel} from '../shared/companion-presentation';

function useClock(){
 const [now,setNow]=useState(Date.now());
 useEffect(()=>{let timer:ReturnType<typeof setInterval>|undefined;const sync=()=>{clearInterval(timer);if(!document.hidden){setNow(Date.now());timer=setInterval(()=>setNow(Date.now()),1000);}};sync();document.addEventListener('visibilitychange',sync);return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',sync);};},[]);
 return now;
}

const iconPaths = {
  music: 'M9 18V5l12-2v13M9 9l12-2M9 18a3 3 0 1 1-3-3c2 0 3 1 3 3m12-2a3 3 0 1 1-3-3c2 0 3 1 3 3',
  code: 'm8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 16',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',
  settings: 'M4 7h16M4 17h16M8 4v6M16 14v6',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  close: 'm6 6 12 12M6 18 18 6',
  check: 'm5 12 4 4 10-10',
  sound: 'M11 4 6 8H3v8h3l5 4V4m4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14',
  mute: 'M11 4 6 8H3v8h3l5 4V4m5 5 6 6m-6 0 6-6',
  presentation: 'M3 4h18v12H3zM8 21l4-5 4 5M12 4V2',
  return: 'M9 5 3 11l6 6M3 11h11a6 6 0 0 1 6 6v2',
  mail: 'M3 5h18v14H3zM3 6l9 7 9-7',
  calendar: 'M4 5h16v16H4zM4 10h16M8 3v4m8-4v4M8 14h2m4 0h2m-8 3h2',
  notebook: 'M6 3h13a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM8 3v18m4-13h5m-5 4h5',
  folder: 'M3 6h7l2 2h9v11H3z',
  plus: 'M12 5v14M5 12h14',
  copy: 'M8 8h12v12H8zM16 4H4v12',
  edit: 'm4 20 5-1 11-11-4-4L5 15zM14 6l4 4',
};

export function CompanionIcon({name}: {name: keyof typeof iconPaths}) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={iconPaths[name]}/></svg>;
}

export function OpenCodex({id,children}:{id?:string;children?:React.ReactNode}){
 const [error,setError]=useState('');
 return <><button className="primary" onClick={async()=>{const r=await window.companion.openCodex(id);if(!r.ok)setError(r.error);}}>{children??(id?'Volver al chat':'Abrir Codex')}<CompanionIcon name="arrow"/></button>{error&&<small role="alert">{error}</small>}</>;
}
export function Connection({status}:{status:CompanionStatus}){
 return <span className={'connection-status connection-'+(status.settings.paused?'paused':status.connection?.state??'unchecked')} title={status.connection?.checkedAt?'Comprobado a las '+new Date(status.connection.checkedAt).toLocaleTimeString('es'):undefined}><i/>{connectionLabel(status)}</span>;
}
export function Signal({status}:{status:CompanionStatus}){const now=useClock();return <small className="last-signal" title={status.lastEventAt?new Date(status.lastEventAt).toLocaleString('es'):undefined}>{lastSignalLabel(status.lastEventAt,now)}</small>;}
export function Quiet({status}:{status:CompanionStatus}){
 const now=useClock(),quiet=isSilenced(status.settings,now),[error,setError]=useState('');
 return <div className="quiet-control"><button data-quiet={quiet} aria-pressed={quiet} title="Silencia sonido y notificaciones; sigue recibiendo actividad y permisos" onClick={async()=>{const r=await window.companion.silence(quiet?0:30);setError(r.ok?'':r.error);}}><CompanionIcon name={quiet?'bell':'mute'}/>{quiet?'Reactivar avisos · '+Math.ceil((status.settings.silencedUntil-now)/60000)+' min':'Silenciar avisos 30 min'}</button>{error&&<small role="alert">{error}</small>}</div>;
}
