import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';
import {emptyBrowserState,type BrowserCommand,type BrowserState} from '../shared/browser';

export function BrowserPanel({active}:{active:boolean}) {
  const [state,setState]=useState<BrowserState>(emptyBrowserState),[address,setAddress]=useState(''),[error,setError]=useState('');
  const slot=useRef<HTMLDivElement>(null);
  useEffect(()=>{const off=window.zen.onBrowserState(setState);void window.zen.browserState().then(r=>{if(r.ok)setState(r.value);});return off;},[]);
  useEffect(()=>setAddress(state.url),[state.url]);
  useLayoutEffect(()=>{
    if(!active){void window.zen.browserViewport({visible:false});return;}
    const update=()=>{const bounds=slot.current?.getBoundingClientRect();if(bounds)void window.zen.browserViewport({visible:true,bounds:{x:Math.round(bounds.x),y:Math.round(bounds.y),width:Math.floor(bounds.width),height:Math.floor(bounds.height)}});};
    const observer=new ResizeObserver(update);if(slot.current)observer.observe(slot.current);window.addEventListener('resize',update);update();
    return()=>{observer.disconnect();window.removeEventListener('resize',update);void window.zen.browserViewport({visible:false});};
  },[active,!!state.url,!!state.error,!!error]);
  const command=async(value:BrowserCommand)=>{setError('');const result=await window.zen.browserCommand(value);if(result.ok)setState(result.value);else setError(result.error);};
  return <section className="browser-page" hidden={!active} aria-label="Navegador integrado">
    <form className="browser-toolbar" onSubmit={event=>{event.preventDefault();void command({action:'navigate',url:address});}}>
      <button type="button" aria-label="Atrás" disabled={!state.canBack} onClick={()=>void command({action:'back'})}>←</button>
      <button type="button" aria-label="Adelante" disabled={!state.canForward} onClick={()=>void command({action:'forward'})}>→</button>
      <button type="button" aria-label={state.loading?'Detener carga':'Recargar página'} disabled={!state.url} onClick={()=>void command({action:state.loading?'stop':'reload'})}>{state.loading?'×':'↻'}</button>
      <input aria-label="Dirección web" placeholder="Escribe una dirección web" value={address} onChange={event=>setAddress(event.target.value)} spellCheck={false}/>
      <button type="submit">Ir</button>
      <button type="button" className="browser-external" title="La sesión del navegador habitual es independiente" disabled={!state.url&&!state.externalUrl} onClick={()=>void command({action:'external'})}>Abrir fuera ↗</button>
    </form>
    <div className="browser-shortcuts"><button onClick={()=>void command({action:'navigate',url:'https://chatgpt.com/'})}>ChatGPT</button><button onClick={()=>void command({action:'navigate',url:'https://www.google.com/'})}>Google</button><span>{state.loading?'Cargando…':'Sesión guardada en este equipo'}</span></div>
    {(error||state.error)&&<div className="browser-error" role="status">{error||state.error}{state.externalUrl&&<button onClick={()=>void command({action:'external'})}>Continuar fuera de ZEN ↗</button>}</div>}
    <div className="browser-slot" ref={slot} aria-label={state.url?`Página web: ${state.title}`:'Inicio del navegador'}>
      {!state.url&&<div className="browser-welcome"><span className="home-eyebrow">TU ESPACIO WEB</span><h1>Una ventana a lo que necesitas</h1><p>Abre ChatGPT con tu cuenta o busca en Google. Las cookies y la sesión de este navegador se conservan al cerrar ZEN.</p><div><button className="primary" onClick={()=>void command({action:'navigate',url:'https://chatgpt.com/'})}>Abrir ChatGPT</button><button onClick={()=>void command({action:'navigate',url:'https://www.google.com/'})}>Buscar con Google</button></div><small>Los mensajes que escribas en ChatGPT usan tu cuenta y sus límites. Google puede requerir el navegador habitual para iniciar sesión; las sesiones de ambos navegadores son independientes.</small></div>}
      {state.url&&window.zenDemo&&<div className="browser-demo">Vista de diseño · {state.url}<br/>La página real se abre dentro de la aplicación ZEN.</div>}
    </div>
  </section>;
}
