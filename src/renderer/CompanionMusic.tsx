import {CopyVisible} from './WorkspaceTools';
import React,{useEffect,useRef,useState} from 'react';
import type {CompanionStatus} from '../shared/codex-companion';
import type {MediaSnapshot,MediaCommand,MediaNowPlaying} from '../shared/companion-media';

function MusicIcon({name}:{name:string}){const p:Record<string,string>={play:'m9 5 11 7-11 7z',pause:'M8 5v14M16 5v14',previous:'M5 5v14m14-14L8 12l11 7z',next:'M19 5v14M5 5l11 7L5 19z',shuffle:'M3 5h3c5 0 7 14 12 14h3m-4-4 4 4-4 4M3 19h3c2 0 4-3 5-6m2-4c2-3 3-4 5-4h3m-4-4 4 4-4 4',repeat:'m17 2 4 4-4 4M3 11V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4m14-1v3a2 2 0 0 1-2 2H3',music:'M9 18V5l12-2v13M9 9l12-2M9 18a3 3 0 1 1-3-3c2 0 3 1 3 3m12-2a3 3 0 1 1-3-3c2 0 3 1 3 3'};return <svg viewBox="0 0 24 24" fill={name==='play'?'currentColor':'none'} stroke="currentColor" strokeWidth={name==='pause'?4:1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={p[name]??p.music}/></svg>;}
const time=(ms:number)=>{const n=Math.max(0,Math.floor(ms/1000));return Math.floor(n/60)+':'+String(n%60).padStart(2,'0');};

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

function useMediaPlayer(status: CompanionStatus, surface: 'workspace' | 'compact') {
 const [snapshot, setSnapshot] = useState<MediaSnapshot>();
 const [busy, setBusy] = useState(false);
 const [notice, setNotice] = useState('');
 const generation = useRef(0);
 const mounted = useRef(false);
 const operation = useRef<number | undefined>(undefined);
 const blocked = status.settings.presentation || status.settings.paused;
 const track = snapshot?.track;

 function isCurrent(attempt: number) {
  return mounted.current && attempt === generation.current && !document.hidden;
 }

 async function refresh(current: () => boolean, followSystem?: true) {
  const result = await window.companion.mediaSnapshot(followSystem);
  if (!current()) return;
  if (result.ok) setSnapshot(result.value);
  else {
   setSnapshot(undefined);
   throw Error(result.error);
  }
 }

 async function request(perform: (current: () => boolean) => Promise<void>) {
  if (blocked || document.hidden || operation.current !== undefined) return;
  const attempt = ++generation.current;
  operation.current = attempt;
  setBusy(true);
  setNotice('');
  try {
   await perform(() => isCurrent(attempt));
  } catch (error) {
   if (isCurrent(attempt)) setNotice(error instanceof Error ? error.message : 'No se pudo consultar el reproductor.');
  } finally {
   if (operation.current === attempt) {
    operation.current = undefined;
    if (isCurrent(attempt)) setBusy(false);
   }
  }
 }

 useEffect(() => {
  mounted.current = true;
  return () => {
   mounted.current = false;
   generation.current++;
   operation.current = undefined;
   void window.companion.mediaClose(surface);
  };
 }, [surface]);

 useEffect(() => {
  let active = true;
  let polling = false;
  let timer: ReturnType<typeof setInterval> | undefined;

  async function poll() {
   if (!active || blocked || document.hidden || polling || operation.current !== undefined) return;
   const attempt = generation.current;
   const current = () => active && isCurrent(attempt);
   polling = true;
   try {
    await refresh(current);
   } catch {
    if (current()) setSnapshot(undefined);
   } finally {
    polling = false;
   }
  }

  function syncVisibility() {
   generation.current++;
   operation.current = undefined;
   clearInterval(timer);
   setSnapshot(undefined);
   setNotice('');
   setBusy(false);
   if (blocked || document.hidden) {
    void window.companion.mediaClose(surface);
   } else {
    void poll();
    timer = setInterval(() => void poll(), 2000);
   }
  }

  syncVisibility();
  document.addEventListener('visibilitychange', syncVisibility);
  return () => {
   active = false;
   clearInterval(timer);
   document.removeEventListener('visibilitychange', syncVisibility);
  };
 }, [blocked, surface]);

 async function select(id: string) {
  await request(async current => {
   const result = await window.companion.mediaSelect(id);
   if (!current()) return;
   if (result.ok) await refresh(current);
   else setNotice(result.error);
  });
 }

 async function followSystem() {
  await request(current => refresh(current, true));
 }

 async function command(action: MediaCommand['action'], value?: MediaCommand['value']) {
  if (!track) return;
  await request(async current => {
   const result = await window.companion.mediaCommand({id: crypto.randomUUID(), session: track.session, action, ...(value ? {value} : {})});
   if (!current()) return;
   if (!result.ok) {
    setNotice(result.error);
    return;
   }
   setNotice(result.value.accepted ? '' : 'El reproductor no ha aceptado el control.');
   await refresh(current);
  });
 }

 return {sessions: snapshot?.sessions ?? [], track, manual: snapshot?.manual ?? false, busy, notice, blocked, select, followSystem, command, setNotice};
}

export function CompanionMusic({status}:{status:CompanionStatus}){
 const {sessions,track,manual,busy,notice,blocked,select,followSystem,command,setNotice}=useMediaPlayer(status,'workspace');
 async function showMusic() {
  const result = await window.companion.presentation(false);
  if (!result.ok) setNotice(result.error);
 }
 async function open() {
  const result = await window.companion.openSpotify();
  if (!result.ok) setNotice(result.error);
 }
 return <section className="music-workspace" aria-busy={busy}>
  <div className="music-heading"><h2>Sonido</h2><div className="actions">{!blocked&&<button onClick={()=>void window.companion.compact('spotify')}>Ver en cápsula</button>}{!blocked&&track?.source==='Spotify'&&<button onClick={()=>void open()}>Abrir Spotify ↗</button>}</div></div>
  {blocked?<div className="companion-card music-blocked"><h2>{status.settings.presentation?'Presentación activa':'ZEN está en pausa'}</h2>{status.settings.presentation&&<button className="primary" onClick={()=>void showMusic()}>Salir de presentación y mostrar sonido</button>}{status.settings.paused&&<button onClick={()=>void window.companion.navigate('settings')}>Abrir preferencias para reanudar ZEN</button>}</div>:<>
   {(sessions.length>1||manual||!track&&sessions.length>0)&&<div className="media-sources" role="group" aria-label="Reproductores de Windows">
    <button aria-pressed={!manual} disabled={busy} onClick={()=>void followSystem()}>Automático</button>
    {sessions.map((s,i)=><button key={s.id} data-session={s.id} aria-pressed={manual&&track?.session===s.id} disabled={busy} onClick={()=>void select(s.id)}><MusicIcon name="music"/>{s.name}{sessions.filter(v=>v.name===s.name).length>1?' · '+(i+1):''}{s.browser&&<small>Navegador</small>}</button>)}
   </div>}
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
    <div className="music-copy"><CopyVisible text={[track.title,track.artist,track.album].filter(Boolean).join(' — ')} label="Copiar información"/></div>
    {track.durationMs>0&&<div className="music-timeline"><progress aria-label="Posición informada por el reproductor" value={Math.min(track.positionMs,track.durationMs)} max={track.durationMs}/><span>{time(track.positionMs)}</span><span>{time(track.durationMs)}</span></div>}

   </article>:<div className="music-empty"><MusicIcon name="music"/><h3>{busy?'Buscando reproducción…':sessions.length?'Elige un reproductor':'Sin reproducción'}</h3></div>}

  </>}
  {notice&&<p role="status" className="music-notice">{blocked?'Detalles ocultos.':notice}</p>}

 </section>;
}

export function CompanionMiniMusic({status}:{status:CompanionStatus}){
 const {sessions,track,busy,notice,blocked,select,command}=useMediaPlayer(status,'compact');
 const playbackLabel=track?.playing?'Pausar':'Reproducir';
 return <div className="capsule-mini-music" aria-label="Sonido en cápsula">
  {blocked?<span className="mini-music-empty">Sonido oculto</span>:track?<>
   <button className="mini-track" title={[track.title,track.artist,track.source,'Abrir Sonido'].filter(Boolean).join(' · ')} onClick={()=>void window.companion.navigate('spotify')}>
    {track.artwork?<img src={track.artwork} alt=""/>:<MusicIcon name="music"/>}<span><strong>{track.title||'Sin título'}</strong><small>{track.artist||track.source}</small></span>
   </button>
   <div className="mini-transport" role="group" aria-label="Controles del reproductor compacto">
    <button className="mini-skip" aria-label="Anterior" title="Anterior" disabled={busy||!track.controls.previous} onClick={()=>void command('previous')}><MusicIcon name="previous"/></button>
    <button className="mini-play" aria-label={playbackLabel} title={playbackLabel} disabled={busy||!(track.playing?track.controls.pause:track.controls.play)} onClick={()=>void command(track.playing?'pause':'play')}><MusicIcon name={track.playing?'pause':'play'}/></button>
    <button className="mini-skip" aria-label="Siguiente" title="Siguiente" disabled={busy||!track.controls.next} onClick={()=>void command('next')}><MusicIcon name="next"/></button>
   </div>
  </>:sessions.length>0?<select aria-label="Elegir reproductor compacto" value="" disabled={busy} onChange={e=>void select(e.target.value)}><option value="">Elige reproductor</option>{sessions.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>:<span className="mini-music-empty">Sin reproducción</span>}
  {notice&&<span className="mini-music-notice" role="status" aria-label={notice} title={notice}>!</span>}<button className="mini-dismiss" aria-label="Volver al estado" title="Volver al estado de Codex" onClick={()=>void window.companion.compact('status')}>×</button>
 </div>;
}
