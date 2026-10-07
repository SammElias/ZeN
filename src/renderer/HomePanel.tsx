import React from 'react';
import {Companion} from './Companion';
export function HomePanel({chat,browse,animated}:{chat:()=>void;browse:()=>void;animated:boolean}){
  return <section className="home-page" aria-label="Home"><div className="home-greeting"><Companion state="idle" pose="curious" animated={animated}/><div><span className="home-eyebrow">TU COMPAÑERO DE ESCRITORIO</span><h1>¿Qué hacemos hoy?</h1><p>Un lugar para tus ideas, tus tareas y tu web.</p></div></div><div className="home-cards"><button onClick={chat}><span aria-hidden="true">✧</span><strong>Hablemos</strong><small>Continúa tu conversación con ZEN y trabaja con tu contexto.</small><b>Abrir Chat →</b></button><button onClick={browse}><span aria-hidden="true">◎</span><strong>Tu espacio web</strong><small>ChatGPT, Google y tus páginas, con la sesión guardada.</small><b>Abrir Navegador →</b></button></div><p className="home-footnote">Puedes recoger ZEN en cualquier momento y continuar al volver.</p></section>;
}
