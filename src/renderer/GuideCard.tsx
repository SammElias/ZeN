import React,{useEffect,useState} from 'react';
import {advanceGuide,guideStale,type Guide} from '../shared/interactions';
export function GuideCard({guide,change,exit,refresh,reword}:{guide:Guide;change:(guide:Guide)=>void;exit:()=>void;refresh:()=>void;reword:(text:string)=>void}){
  const [lost,setLost]=useState(false),[now,setNow]=useState(Date.now());
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
  const stale=guideStale(guide,now);
  return <section className="guide-card" aria-label="Guíame paso a paso"><div className="context-heading"><strong>Guíame</strong><button onClick={exit}>Salir</button></div><h2>{guide.goal}</h2><p className="guide-counter">Paso {guide.index+1} de {guide.steps.length} · {guide.status==='paused'?'En pausa':guide.status==='completed'?'Pasos completados por el usuario':'Avance manual'}</p><p className="guide-instruction">{guide.steps[guide.index]}</p>
    {stale&&<p className="context-error">La pantalla de referencia ha caducado. Comparte una captura nueva para revisar los pasos.<button onClick={refresh}>Actualizar referencia</button></p>}
    {guide.status==='completed'&&<p>El resultado no se ha verificado automáticamente.</p>}
    <div className="context-actions"><button disabled={guide.index===0} onClick={()=>change(advanceGuide(guide,'previous'))}>Anterior</button><button disabled={guide.status!=='active'||stale} onClick={()=>{setLost(false);change(advanceGuide(guide,'next'));}}>{guide.index===guide.steps.length-1?'Completar pasos':'Siguiente'}</button><button onClick={()=>setLost(value=>!value)}>No lo encuentro</button>{guide.status!=='completed'&&<button onClick={()=>change(advanceGuide(guide,guide.status==='paused'?'resume':'pause'))}>{guide.status==='paused'?'Reanudar':'Pausar'}</button>}</div>
    {lost&&<aside><p>Puedes pedir otra explicación o compartir lo que ves ahora.</p><button onClick={()=>reword(`Reformula este paso con más claridad para mi objetivo «${guide.goal}»: ${guide.steps[guide.index]}`)}>Preparar reformulación</button><button onClick={refresh}>Compartir nueva captura</button></aside>}
  </section>;
}
