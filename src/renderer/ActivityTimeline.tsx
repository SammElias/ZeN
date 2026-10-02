import React,{useLayoutEffect,useRef} from 'react';
import {activityLabels} from '../shared/activity';
import type {ActivityTrail} from './activity-store';
import './activity.css';

export function ActivityTimeline({trail,animated}:{trail:ActivityTrail;animated:boolean}) {
  const list=useRef<HTMLOListElement>(null);
  const following=useRef(true);
  const current=trail.steps.at(-1)!;
  const settled=['completed','failed','cancelled'].includes(trail.state);
  const waiting=['awaiting_input','awaiting_approval'].includes(trail.state);
  useLayoutEffect(()=>{following.current=true;},[trail.id]);
  useLayoutEffect(()=>{if(list.current&&following.current)list.current.scrollTop=list.current.scrollHeight;},[trail.id,current.sequence]);
  return <section className={`activity-panel ${settled?'settled':''} ${waiting?'waiting':''}`} style={{'--activity-rows':Math.min(3,trail.steps.length)} as React.CSSProperties} aria-label="Actividad de la tarea">
    <div className="activity-heading"><span>Actividad</span><span>{settled?'Recorrido de esta tarea':waiting?'Tu turno':'En curso'}<i aria-hidden="true"/></span></div>
    <ol ref={list} className="activity-steps" aria-label="Pasos de la tarea" tabIndex={0} onScroll={()=>{const el=list.current!;following.current=el.scrollHeight-el.clientHeight-el.scrollTop<16;}}>
      {trail.steps.map((step,index)=>{
        const active=index===trail.steps.length-1,meta=activityLabels[step.activity];
        const moving=active&&animated&&!settled&&!waiting;
        return <li key={step.sequence} className={`activity-step ${active?'current':'previous'} activity-${step.activity}`} aria-current={active?'step':undefined}>
          <span className="activity-node" aria-hidden="true"><img width="24" height="24" src={`./activity/${meta.icon}.${moving?'gif':'svg'}`} alt=""/></span>
          <span className="activity-copy"><span>{meta.label}</span><small>{active?(settled?step.activity==='completed'?'Finalizado':step.activity==='cancelled'?'Detenido':'Revisar':waiting?'Voz o chat':'Ahora'):'Anterior'}</small></span>
        </li>;
      })}
    </ol>
  </section>;
}
