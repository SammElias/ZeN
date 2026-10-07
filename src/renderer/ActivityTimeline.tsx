import React,{useLayoutEffect,useRef} from 'react';
import {activityLabels} from '../shared/activity';
import type {ActivityTrail} from './activity-store';
import './activity.css';

export function ActivityTimeline({trail,animated,expanded,toggle,paused}:{trail:ActivityTrail;animated:boolean;expanded:boolean;toggle:()=>void;paused?:boolean}) {
  const list=useRef<HTMLOListElement>(null);
  const following=useRef(true);
  const current=trail.steps.at(-1)!;
  const settled=['completed','failed','cancelled'].includes(trail.state);
  const external=current.activity==='codex_external';
  const waiting=!external&&['awaiting_input','awaiting_approval'].includes(trail.state);
  useLayoutEffect(()=>{following.current=true;},[trail.id]);
  useLayoutEffect(()=>{if(list.current&&following.current)list.current.scrollTop=list.current.scrollHeight;},[trail.id,current.sequence,expanded]);
  const meta=activityLabels[current.activity];
  return <section className={`activity-panel ${expanded?'expanded':''} ${settled?'settled':''} ${waiting?'waiting':''}`} style={{'--activity-rows':Math.min(3,trail.steps.length)} as React.CSSProperties} aria-label="Actividad de la tarea">
    <button className="activity-summary" aria-expanded={expanded} aria-controls="activity-steps" onClick={toggle}>
      <img width="24" height="24" src={`./activity/${meta.icon}.${animated&&!paused&&!settled&&!waiting&&!external?'gif':'svg'}`} alt=""/>
      <span role="status">{paused?'En pausa':meta.label}</span><span className="activity-toggle">{expanded?'Ocultar pasos':'Ver pasos'}<span aria-hidden="true">{expanded?'⌃':'⌄'}</span></span>
    </button>
    <ol id="activity-steps" hidden={!expanded} ref={list} className="activity-steps" aria-label="Pasos de la tarea" tabIndex={0} onScroll={()=>{const el=list.current!;following.current=el.scrollHeight-el.clientHeight-el.scrollTop<16;}}>
      {trail.steps.map((step,index)=>{
        const active=index===trail.steps.length-1,meta=activityLabels[step.activity];
        const moving=expanded&&active&&animated&&!paused&&!settled&&!waiting&&!external;
        return <li key={step.sequence} className={`activity-step ${active?'current':'previous'} activity-${step.activity}`} aria-current={active?'step':undefined}>
          <span className="activity-node" aria-hidden="true"><img width="24" height="24" src={`./activity/${meta.icon}.${moving?'gif':'svg'}`} alt=""/></span>
          <span className="activity-copy"><span>{meta.label}</span><small>{active?(external?'Fuera de ZEN':settled?step.activity==='completed'?'Finalizado':step.activity==='cancelled'?'Detenido':'Revisar':waiting?'Voz o chat':'Ahora'):'Anterior'}</small></span>
        </li>;
      })}
    </ol>
  </section>;
}
