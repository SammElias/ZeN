import React from 'react';
import {Companion} from './Companion';
import {Icon} from './components';
export function HomePanel({analyze,explain,guide,animated,resume}:{analyze:()=>void;explain:()=>void;guide:()=>void;animated:boolean;resume:React.ReactNode}){
  return <section className="home-page" aria-label="Inicio"><div className="home-greeting"><Companion state="idle" pose="curious" animated={animated}/><h1>¿Qué hacemos hoy?</h1></div><div className="home-shortcuts"><button onClick={analyze}><Icon name="screen"/>Pantalla</button><button onClick={explain}><Icon name="chat"/>Explicar</button><button onClick={guide}><Icon name="check"/>Guíame</button></div><div className="home-resume">{resume}</div></section>;
}
