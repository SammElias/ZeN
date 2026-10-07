import React,{useRef,useState} from 'react';
import {Companion} from './Companion';
import {Icon} from './components';
export function HomePanel({chat,analyze,send,notify,animated,text,change,context,needsReview}:{needsReview:boolean;chat:()=>void;analyze:()=>void;send:(text:string)=>Promise<void>;notify:(text:string)=>void;animated:boolean;text:string;change:(text:string)=>void;context:React.ReactNode}){
  const [sending,setSending]=useState(false),pending=useRef(false);
  const submit=async()=>{if(pending.current||!text.trim())return;pending.current=true;setSending(true);try{await send(text.trim());change('');chat();}catch(error){notify((error as Error).message);}finally{pending.current=false;setSending(false);}};
  return <section className="home-page" aria-label="Home">
    <div className="home-greeting"><Companion state="idle" pose="curious" animated={animated}/><div><span className="home-eyebrow">TU COMPAÑERO DE ESCRITORIO</span><h1>¿Qué hacemos hoy?</h1><p>Cuéntame tu idea. Empezamos aquí.</p></div></div>
    <form className="home-prompt" onSubmit={event=>{event.preventDefault();void submit();}}>
      <label htmlFor="home-input">¿Qué necesitas?</label>
      <div><textarea id="home-input" placeholder="Escribe tu petición…" rows={2} maxLength={8000} value={text} disabled={sending} onChange={event=>change(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();void submit();}}}/><button className="composer-send" type="submit" aria-label={needsReview?'Revisar petición en Chat':'Enviar petición'} disabled={sending||!text.trim()}><Icon name="send"/></button></div>
    </form>
    {needsReview?<p className="home-context-pending">Tienes adjuntos en Chat. Los revisarás allí antes de enviar.</p>:context}
    <div className="home-shortcuts"><button onClick={analyze}><Icon name="attach"/>Analizar pantalla</button><button onClick={chat}><Icon name="chat"/>Continuar conversación</button></div>
    <p className="home-footnote">Tu conversación sigue aquí cuando vuelvas.</p>
  </section>;
}
