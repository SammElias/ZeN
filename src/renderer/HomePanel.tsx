import React from 'react';
import {Icon} from './components';
export function HomePanel({analyze,explain,guide,resume}:{analyze:()=>void;explain:()=>void;guide:()=>void;resume:React.ReactNode}){
  return <section className="home-page" aria-label="Inicio"><div className="home-greeting"><span className="home-eyebrow">TU ESPACIO</span><h1>¿Qué hacemos hoy?</h1><p>Escribe una idea o comparte contexto para empezar.</p></div><div className="home-shortcuts"><button onClick={analyze}><Icon name="screen"/>Pantalla</button><button onClick={explain}><Icon name="chat"/>Explicar</button><button onClick={guide}><Icon name="check"/>Guíame</button></div><div className="home-resume">{resume}</div></section>;
}
