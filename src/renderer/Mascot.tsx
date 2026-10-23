import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {MascotModel} from './useMascot';
import {tones,toneLabels,wardrobes,wardrobeLabels,type Wardrobe} from '../shared/mascot';
import {MascotRig} from './MascotArtwork';
import {MascotWelcome} from './MascotWelcome';
import './mascot.css';
const labels={idle:'Disponible',listening:'Escuchando',thinking:'Pensando',speaking:'Hablando',executing:'Ejecutando',error:'Necesita atención'};
function ThinkingBubble(){return <span className="mascot-thought" aria-hidden="true"><i/><i/><i/></span>;}
/** One mounted renderer, anchored in CSS/DIP coordinates. No window or pointer movement. */
export function MascotHost({model,visible,reduced,placementKey,level}:{model:MascotModel;visible:boolean;reduced:boolean;placementKey:string;level:()=>number}){
 const [anchor,setAnchor]=useState<{x:number;y:number;width:number;height:number;full:boolean;welcome?:HTMLElement}>(),[documentVisible,setDocumentVisible]=useState(!document.hidden);
 useEffect(()=>{const changed=()=>setDocumentVisible(!document.hidden);document.addEventListener('visibilitychange',changed);return()=>document.removeEventListener('visibilitychange',changed);},[]);
 useLayoutEffect(()=>{
  const anchors=Array.from(document.querySelectorAll<HTMLElement>('[data-mascot-anchor]'));
  const update=()=>{const candidates=anchors.filter(el=>!!el.getClientRects().length&&el.getBoundingClientRect().width>0),el=candidates.find(el=>el.dataset.mascotAnchor==='welcome')??candidates.find(el=>el.dataset.mascotAnchor==='full')??candidates.find(el=>el.dataset.mascotAnchor==='pet')??candidates.find(el=>el.dataset.mascotAnchor==='head');if(!el){setAnchor(undefined);return;}const r=el.getBoundingClientRect(),next={x:r.x,y:r.y,width:r.width,height:r.height,full:['full','pet'].includes(el.dataset.mascotAnchor??''),welcome:el.dataset.mascotAnchor==='welcome'?el:undefined};setAnchor(old=>old&&old.x===next.x&&old.y===next.y&&old.width===next.width&&old.height===next.height&&old.full===next.full&&old.welcome===next.welcome?old:next);};
  // Activity/context bars can move an anchor without resizing it. Observe its
  // layout ancestors too so the fixed artwork follows the actual reserved slot.
  const geometry=new Set<Element>(anchors);
  for(const el of anchors)for(let parent=el.parentElement;parent&&parent!==document.body;parent=parent.parentElement)geometry.add(parent);
  const observer=new ResizeObserver(update);geometry.forEach(el=>observer.observe(el));window.addEventListener('resize',update);update();
  return()=>{observer.disconnect();window.removeEventListener('resize',update);};
 },[placementKey]);
 useEffect(()=>{if(!anchor?.full)model.stopMovement();},[anchor?.full]);
 useEffect(()=>{if(!documentVisible)model.stopMovement();},[documentVisible]);
 if(!anchor||!visible)return null;
 const active=visible&&documentVisible&&!reduced;
 const geometryKey=[anchor.x,anchor.y,anchor.width,anchor.height].join(':');
 if(anchor.welcome)return createPortal(<div className="mascot-host mascot-welcome" data-presentation="welcome" data-activity={model.activity} data-animated={active} data-locomotion="still" aria-hidden="true"><MascotWelcome animated={active} geometryKey={geometryKey}/>{model.activity==='thinking'&&<ThinkingBubble/>}</div>,anchor.welcome);
 return <div className="mascot-host" style={{left:anchor.x,top:anchor.y,width:anchor.width,height:anchor.height}} data-presentation={anchor.full?'full':model.activity==='idle'&&!model.hands?'compact':'hands'} data-activity={model.activity} data-animated={active} data-tone={model.tone.value} data-wardrobe={model.wardrobe} data-locomotion={model.walking?'walking':'still'} data-preview={model.preview}>
  <MascotRig model={model} full={anchor.full} animated={active} level={level} geometryKey={geometryKey}/>
  {model.activity==='thinking'&&<ThinkingBubble/>}
 </div>;
}

export function MascotStage({model,reduced,walks}:{model:MascotModel;reduced:boolean;walks:boolean}){return <aside className="mascot-stage" aria-label="Escenario de ZEN"><div className="mascot-stage-anchor" data-mascot-anchor="full"/><span className="mascot-stage-status">{model.preview?'Vista previa · '+toneLabels[model.tone.value]:labels[model.activity]}</span><button onClick={()=>model.setControls(!model.controls)} aria-expanded={model.controls}>Apariencia</button><button disabled={reduced||!walks||model.activity!=='idle'} onClick={model.walking?model.stopMovement:model.walk}>{model.walking?'Detener movimiento':'Dar un paseo'}</button></aside>;}

export function MascotControls({model,fixed,walks,change,close,capsuleOnly=false}:{model:MascotModel;fixed:'auto'|Wardrobe;walks:boolean;change:(patch:{mascotWardrobe?:'auto'|Wardrobe;mascotWalks?:boolean})=>void;close:()=>void;capsuleOnly?:boolean}){
 const ref=useRef<HTMLDivElement>(null);
 const trigger=useRef(document.activeElement as HTMLElement|null);
 const dismiss=()=>{close();if(trigger.current?.isConnected&&trigger.current.getClientRects().length)trigger.current.focus({preventScroll:true});};
 useEffect(()=>{ref.current?.querySelector<HTMLButtonElement>('button')?.focus();},[]);
 return <div ref={ref} className="mascot-controls" role="region" aria-label="Apariencia de ZEN" onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();dismiss();}}}>
  <header><strong>Apariencia de ZEN</strong><button onClick={dismiss} aria-label="Cerrar apariencia">×</button></header>

  <p>{capsuleOnly?'El personaje aparece solo en la cápsula. Los cambios de vestuario se aplican allí al instante.':'Vista previa local · no envía mensajes'}</p>
  {!capsuleOnly&&<><div className="mascot-tones" role="group" aria-label="Tono de prueba">{tones.map(t=><button key={t} aria-pressed={model.tone.value===t} disabled={model.activity!=='idle'} onClick={()=>model.previewTone(t)}>{toneLabels[t]}</button>)}</div>
  <label>Intensidad <input aria-label="Intensidad del gesto" type="range" min="0" max="1" step=".05" value={model.tone.intensity} disabled={model.activity!=='idle'} onChange={e=>model.previewTone(model.tone.value,+e.target.value)}/></label></>}
  <label>Vestuario <select aria-label="Vestuario" value={fixed} onChange={e=>change({mascotWardrobe:e.target.value as 'auto'|Wardrobe})}><option value="auto">Automático</option>{wardrobes.map(w=><option key={w} value={w}>Fijar conjunto · {wardrobeLabels[w]}</option>)}</select></label>
  {!capsuleOnly&&<><label className="check"><input type="checkbox" checked={walks} onChange={e=>change({mascotWalks:e.target.checked})}/>Permitir caminatas</label>
  {model.face!==model.tone.value&&<p>Se conserva el conjunto con la cara disponible: {toneLabels[model.face]}.</p>}
  <button onClick={()=>model.previewTone('neutral',.35)} disabled={model.activity!=='idle'}>Restablecer neutral</button> <button onClick={model.reset}>Volver al estado real</button></>}
 </div>;
}
