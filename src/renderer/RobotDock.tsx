import {CompanionContext} from './CompanionContext';
import React,{memo,useContext,useEffect,useRef,useState} from 'react';
import {Companion} from './Companion';
import type {RobotPresentation} from '../shared/companion';
export const RobotDock=memo(function RobotDock({presentation,animated}:{presentation:RobotPresentation;animated:boolean}){
  const shared=useContext(CompanionContext);if(shared)presentation=shared.presentation;
  const [greeting,setGreeting]=useState(false),timer=useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(()=>{setGreeting(false);clearTimeout(timer.current);return()=>clearTimeout(timer.current);},[presentation.pose,animated]);
  const greet=()=>{clearTimeout(timer.current);setGreeting(true);timer.current=setTimeout(()=>setGreeting(false),1600);};
  const attentive=['approval','concerned','paused'].includes(presentation.pose);
  return <aside className="robot-dock" aria-label="Compañero ZEN" data-pose={presentation.pose}>
    <button className="robot-greet" aria-label="Saludar a ZEN" onClick={shared?.greet??greet} title={`${greeting&&!attentive?'¡Hola!':presentation.label} · ${presentation.hint}`}><Companion size="large" pose={presentation.pose} wave={greeting&&!attentive} animated={animated}/></button>
  </aside>;
});
