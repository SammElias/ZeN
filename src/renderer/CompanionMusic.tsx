import React,{useEffect,useRef,useState} from 'react';
import type {CompanionStatus} from '../shared/codex-companion';
import type {MediaTrack,MediaSession,MediaCommand,MediaNowPlaying} from '../shared/companion-media';

function MusicIcon({name}:{name:string}){const p:Record<string,string>={refresh:'M20 4v6h-6M4 20v-6h6M6 7a8 8 0 0 1 13-1l1 4M4 14l1 4a8 8 0 0 0 13-1',play:'m9 5 11 7-11 7z',pause:'M8 5v14M16 5v14',previous:'M5 5v14m14-14L8 12l11 7z',next:'M19 5v14M5 5l11 7L5 19z',shuffle:'M3 5h3c5 0 7 14 12 14h3m-4-4 4 4-4 4M3 19h3c2 0 4-3 5-6m2-4c2-3 3-4 5-4h3m-4-4 4 4-4 4',repeat:'m17 2 4 4-4 4M3 11V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4m14-1v3a2 2 0 0 1-2 2H3',music:'M9 18V5l12-2v13M9 9l12-2M9 18a3 3 0 1 1-3-3c2 0 3 1 3 3m12-2a3 3 0 1 1-3-3c2 0 3 1 3 3'};return <svg viewBox="0 0 24 24" fill={name==='play'?'currentColor':'none'} stroke="currentColor" strokeWidth={name==='pause'?4:1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={p[name]??p.music}/></svg>;}
const time=(ms:number)=>{const n=Math.max(0,Math.floor(ms/1000));return Math.floor(n/60)+':'+String(n%60).padStart(2,'0');};

/** Mounted by the common header, independently of the currently open integration. */
export function useNowPlaying(status:CompanionStatus){
 const [track,setTrack]=useState<MediaNowPlaying|null>(null),generation=useRef(0);
 const blocked=status.settings.presentation||status.settings.paused;
 useEffect(()=>{
  let active=true,reading=false,timer:ReturnType<typeof setInterval>|undefined;
  const read=async(g:number)=>{
   if(!active||blocked||document.hidden||reading)return;reading=true;
   try{const result=await window.companion.mediaNowPlaying();if(active&&g===generation.current&&!blocked&&!document.hidden)setTrack(result.ok?result.value:null);}
   catch{if(active&&g===generation.current)setTrack(null);}
   finally{reading=false;}
  };
  const visibility=()=>{
   const g=++generation.current;setTrack(null);if(timer)clearInterval(timer);timer=undefined;
   if(blocked||document.hidden){void window.companion.mediaObservationClose();return;}
   void read(g);timer=setInterval(()=>void read(g),2000);
  };
  document.addEventListener('visibilitychange',visibility);visibility();
  return()=>{active=false;generation.current++;if(timer)clearInterval(timer);document.removeEventListener('visibilitychange',visibility);void window.companion.mediaObservationClose();};
 },[blocked]);
 // A policy render clears details immediately, before an effect or an in-flight IPC can finish.
 return{track:blocked?null:track};
}

/** No observed token or playback controls are exposed by the automatic header. */
export function CompanionNowPlaying({track}:{track:MediaNowPlaying}){
 const title=track.title||'Multimedia en reproducción',detail=track.artist?track.artist+' · '+track.source:track.source;
 return <div className="capsule-mini-music capsule-now-playing" aria-label="Multimedia en reproducción" data-source={track.source}>
  <button className="mini-track" title={title+' · '+detail} onClick={()=>void window.companion.navigate('spotify')}>
   {track.artwork?<img src={track.artwork} alt=""/>:<MusicIcon name="music"/>}<span><strong>{title}</strong><small>{detail}</small></span>
  </button>
 </div>;
}

function useMediaPlayer(status:CompanionStatus,surface:'workspace'|'compact'){
 const [sessions,setSessions]=useState<MediaSession[]>([]),[track,setTrack]=useState<MediaTrack>(),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[loaded,setLoaded]=useState(false);
 const generation=useRef(0),inFlight=useRef(false),mounted=useRef(true),refreshing=useRef(false);const blocked=status.settings.presentation||status.settings.paused;
 const list=async(message='')=>{const g=++generation.current;setTrack(undefined);setSessions([]);setBusy(true);setNotice('');const r=await window.companion.mediaList();if(!mounted.current||g!==generation.current)return;if(r.ok){setSessions(r.value);setNotice(message);}else setNotice(r.error);setLoaded(true);setBusy(false);};
 const restore=async()=>{const g=++generation.current;setBusy(true);setNotice('');const r=await window.companion.mediaCurrent();if(!mounted.current||g!==generation.current)return;if(r.ok&&r.value){setTrack(r.value);setLoaded(true);setBusy(false);}else void list();};
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;generation.current++;void window.companion.mediaClose(surface);};},[]);
 useEffect(()=>{
  generation.current++;setTrack(undefined);setSessions([]);setNotice('');setLoaded(false);setBusy(false);
  if(blocked){void window.companion.mediaClose(surface);return;}
  const visibility=()=>{if(document.hidden){generation.current++;setTrack(undefined);setSessions([]);setBusy(false);void window.companion.mediaClose(surface);}else void restore();};
  document.addEventListener('visibilitychange',visibility);if(!document.hidden)void restore();return()=>document.removeEventListener('visibilitychange',visibility);
 },[blocked]);
 const select=async(id:string)=>{const g=++generation.current;setBusy(true);setTrack(undefined);setNotice('');const r=await window.companion.mediaSelect(id);if(!mounted.current||g!==generation.current)return;if(r.ok)setTrack(r.value);else setNotice(r.error);setBusy(false);};
 useEffect(()=>{
  if(!track||blocked)return;let active=true;const id=track.session,g=generation.current;
  const read=async()=>{if(!active||document.hidden||inFlight.current||refreshing.current)return;inFlight.current=true;try{const r=await window.companion.mediaRead(id);if(!active||!mounted.current||g!==generation.current)return;if(r.ok)setTrack(r.value);else{setTrack(undefined);setNotice(r.error);}}finally{inFlight.current=false;}};
  const timer=setInterval(()=>void read(),2000);return()=>{active=false;clearInterval(timer);};
 },[track?.session,blocked]);
 const command=async(action:MediaCommand['action'],value?:MediaCommand['value'])=>{if(!track||busy)return;const g=generation.current;setBusy(true);setNotice('');const r=await window.companion.mediaCommand({id:crypto.randomUUID(),session:track.session,action,...(value?{value}:{})});if(!mounted.current||g!==generation.current)return;setNotice(r.ok?(r.value.accepted?'':'El reproductor no ha aceptado el control.'):r.error);if(r.ok){const next=await window.companion.mediaRead(track.session);if(mounted.current&&g===generation.current){if(next.ok)setTrack(next.value);else{setTrack(undefined);setNotice(next.error);}}}setBusy(false);};
 const refresh=async()=>{if(blocked||busy||refreshing.current)return;const g=generation.current,id=track?.session;refreshing.current=true;setBusy(true);setNotice('');try{const r=id?await window.companion.mediaRead(id):await window.companion.mediaCurrent();if(!mounted.current||g!==generation.current)return;if(r.ok&&r.value){setTrack(r.value);setLoaded(true);}else await list(id?'La sesión cambió. Selecciona de nuevo el reproductor para ver la canción actual.':'');}finally{refreshing.current=false;if(mounted.current&&g===generation.current)setBusy(false);}};
 const showMusic=async()=>{const r=await window.companion.presentation(false);if(mounted.current&&!r.ok)setNotice(r.error);};
 const open=async()=>{const r=await window.companion.openIntegrationWeb('spotify');if(!r.ok)setNotice(r.error);};
 return{sessions,track,busy,notice,loaded,blocked,list,refresh,showMusic,select,command,open};
}
export function CompanionMusic({status}:{status:CompanionStatus}){
 const {sessions,track,busy,notice,loaded,blocked,list,refresh,showMusic,select,command,open}=useMediaPlayer(status,'workspace');
 return <section className="music-workspace" aria-busy={busy}>
  <div className="music-heading"><div><span className="eyebrow">TU MÚSICA · EN ESTE PC</span><h2>Un momento para ti.</h2></div><div className="actions"><button className="music-refresh" aria-label="Actualizar contenido" title={blocked?'Sal de presentación o reanuda ZEN para consultar la música':'Consultar de nuevo la canción y su estado, sin cambiar la reproducción'} disabled={busy||blocked} onClick={()=>void refresh()}><MusicIcon name="refresh"/>{busy?'Actualizando…':'Actualizar contenido'}</button><button disabled={blocked} onClick={()=>void window.companion.compact('spotify')}>Ver en cápsula</button><button disabled={blocked} onClick={()=>void open()}>Abrir Spotify ↗</button></div></div>
  {blocked?<div className="companion-card music-blocked"><h2>{status.settings.presentation?'Presentación activa':'ZEN está en pausa'}</h2><p>{status.settings.presentation?'ZEN está ocultando la canción, la carátula y los controles. Reanudar una canción en Spotify no cambia este ajuste.':'La información musical está oculta mientras ZEN está en pausa.'}</p>{status.settings.presentation&&<button className="primary" aria-label="Salir de presentación y mostrar música" onClick={()=>void showMusic()}>Salir de presentación y mostrar música</button>}{status.settings.paused&&<button onClick={()=>void window.companion.navigate('settings')}>Abrir preferencias para reanudar ZEN</button>}<small>Al volver, elige el reproductor para recuperar su contenido.</small></div>:<>
   <div className="media-source-row"><span className="media-local-indicator">Sesión multimedia de Windows</span></div>
   <div className="media-sources" aria-label="Elige un reproductor">{sessions.map((s,i)=><button key={s.id} aria-pressed={track?.session===s.id} disabled={busy} onClick={()=>void select(s.id)}><MusicIcon name="music"/>{s.name}{sessions.filter(v=>v.name===s.name).length>1?' · '+(i+1):''}{s.browser&&<small>Navegador</small>}</button>)}</div>
   {track?<article className="music-player" data-source={track.source}>
    <div className="music-artwork">{track.artwork?<img src={track.artwork} alt="Carátula compartida por el reproductor"/>:<MusicIcon name="music"/>}</div>
    <div className="music-track"><span className="eyebrow">{track.playing?'REPRODUCIENDO':'EN ESPERA'} · {track.source}</span><h3 title={track.title}>{track.title||'Reproducción sin título'}</h3><p title={track.artist}>{track.artist||'Artista no informado'}</p>{track.album&&<small title={track.album}>{track.album}</small>}</div>
    <div className="music-controls" role="group" aria-label="Controles del reproductor">
     <button aria-label="Aleatorio" aria-pressed={track.shuffle===true} title={track.controls.shuffle&&track.shuffle!==null?'Cambiar aleatorio':'El reproductor no expone aleatorio'} disabled={busy||!track.controls.shuffle||track.shuffle===null} onClick={()=>void command('shuffle',track.shuffle?'off':'on')}><MusicIcon name="shuffle"/></button>
     <button aria-label="Anterior" disabled={busy||!track.controls.previous} onClick={()=>void command('previous')}><MusicIcon name="previous"/></button>
     <button className="music-play" aria-label={track.playing?'Pausar':'Reproducir'} disabled={busy||!(track.playing?track.controls.pause:track.controls.play)} onClick={()=>void command(track.playing?'pause':'play')}><MusicIcon name={track.playing?'pause':'play'}/></button>
     <button aria-label="Siguiente" disabled={busy||!track.controls.next} onClick={()=>void command('next')}><MusicIcon name="next"/></button>
     <button aria-label="Repetir" aria-pressed={track.repeat==='list'||track.repeat==='track'} title={track.controls.repeat&&track.repeat!==null?'Cambiar repetición':'El reproductor no expone repetición'} disabled={busy||!track.controls.repeat||track.repeat===null} onClick={()=>void command('repeat',track.repeat==='none'?'all':track.repeat==='list'?'one':'off')}><MusicIcon name="repeat"/>{track.repeat==='track'&&<b>1</b>}</button>
    </div>
    {track.durationMs>0&&<div className="music-timeline"><progress aria-label="Posición informada por el reproductor" value={Math.min(track.positionMs,track.durationMs)} max={track.durationMs}/><span>{time(track.positionMs)}</span><span>{time(track.durationMs)}</span></div>}
    {track.browser&&<p className="music-browser-note">Esta sesión pertenece a {track.source}. Windows no identifica la web: comprueba que sea la pestaña que quieres controlar.</p>}
   </article>:<div className="music-empty"><MusicIcon name="music"/><h3>{busy?'Buscando reproducción…':sessions.length?'Elige dónde estás escuchando.':'Todo listo para tu próxima canción.'}</h3><p>{loaded&&sessions.length===0?'Abre Spotify o reproduce audio en tu navegador y pulsa Actualizar contenido. Windows solo muestra reproductores que publiquen una sesión multimedia.':'Selecciona una fuente para ver su canción y sus controles.'}</p></div>}
   <div className="music-connection-note"><span>Local · sin API de Spotify ni llamadas al modelo</span><small>Solo se activan controles que el reproductor admite. El volumen se ajusta en Windows o en Spotify.</small></div>
  </>}
  {notice&&<p role="status" className="music-notice">{blocked?'Detalles ocultos.':notice}</p>}
  <details className="music-api-info"><summary>Biblioteca, búsquedas y otros dispositivos</summary><p>Estas funciones necesitan una conexión propia con Spotify Web API mediante OAuth. Requiere registrar una aplicación y su Client ID; no necesitas compartir tu contraseña ni una clave de OpenAI. Tu conexión de Spotify en Codex sigue disponible para consultas desde ese chat.</p></details>
 </section>;
}

export function CompanionMiniMusic({status}:{status:CompanionStatus}){
 const {sessions,track,busy,notice,blocked,select,refresh,command}=useMediaPlayer(status,'compact');
 return <div className="capsule-mini-music" aria-label="Spotify compacto">
  {blocked?<span>Música oculta</span>:track?<><button className="mini-track" title={track.title+' · '+track.artist} onClick={()=>void window.companion.navigate('spotify')}>{track.artwork?<img src={track.artwork} alt=""/>:<MusicIcon name="music"/>}<span><strong>{track.title||'Sin título'}</strong><small>{track.artist||track.source}</small></span></button><button className="mini-play" aria-label={track.playing?'Pausar':'Reproducir'} disabled={busy||!(track.playing?track.controls.pause:track.controls.play)} onClick={()=>void command(track.playing?'pause':'play')}><MusicIcon name={track.playing?'pause':'play'}/></button></>:<><select aria-label="Elegir reproductor compacto" value="" disabled={busy} onChange={e=>void select(e.target.value)}><option value="">{busy?'Buscando…':sessions.length?'Elige reproductor':'Sin reproductor'}</option>{sessions.map((s,i)=><option key={s.id} value={s.id}>{s.name}{s.browser?' · navegador':''}{sessions.filter(v=>v.name===s.name).length>1?' · '+(i+1):''}</option>)}</select></>}
  <button className="mini-refresh" aria-label="Actualizar contenido" title="Actualizar canción y reproductores" disabled={busy||blocked} onClick={()=>void refresh()}><MusicIcon name="refresh"/></button>
  {notice&&<span className="mini-music-notice" role="status" aria-label={notice} title={notice}>!</span>}<button className="mini-dismiss" aria-label="Volver al estado" title="Volver al estado de Codex" onClick={()=>void window.companion.compact('status')}>×</button>
 </div>;
}
