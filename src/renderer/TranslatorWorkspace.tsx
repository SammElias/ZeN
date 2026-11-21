import React, {useEffect, useRef, useState} from 'react';
import {ArrowLeftRight, Copy, Languages, Settings2} from 'lucide-react';
import {azureTranslatorKey, oppositeLanguage, translatorTextLimit, type TranslationLanguage, type TranslatorAction} from '../shared/companion-translator';
import './TranslatorWorkspace.css';

const directionPreference = 'zen-translator-source';
const languages = {es:'Español', en:'Inglés'};

function preferredSource(): TranslationLanguage {
  try { return localStorage.getItem(directionPreference)==='en'?'en':'es'; }
  catch { return 'es'; }
}

export function TranslatorWorkspace() {
  const [source,setSource] = useState(preferredSource);
  const [original,setOriginal] = useState('');
  const [translated,setTranslated] = useState('');
  const [configured,setConfigured] = useState<boolean>();
  const [showKey,setShowKey] = useState(false);
  const [key,setKey] = useState('');
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState<{text:string; error?:boolean}>();
  const active = useRef(false);
  const pending = useRef(false);
  const target = oppositeLanguage(source);

  useEffect(()=>{
    active.current = true;
    void window.companion.translator({type:'status'}).then(result=>{
      if (!active.current) return;
      if (!result.ok) setMessage({text:result.error,error:true});
      else if (result.value.type==='status') setConfigured(result.value.configured);
    }).catch(()=>{if(active.current)setMessage({text:'No se pudo abrir Traductor.',error:true});});
    return ()=>{
      active.current = false;
      void window.companion.translator({type:'leave'}).catch(()=>undefined);
    };
  },[]);

  async function perform(action: TranslatorAction) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setMessage(undefined);
    try {
      const result = await window.companion.translator(action);
      if (!active.current) return;
      if (!result.ok) {setMessage({text:result.error,error:true});return;}
      if (result.value.type==='translation') setTranslated(result.value.text);
      else {
        setConfigured(result.value.configured);
        setKey('');
        setShowKey(false);
        if (!result.value.configured) setTranslated('');
      }
    } catch {
      if (active.current) setMessage({text:'No se pudo completar la acción.',error:true});
    } finally {
      pending.current = false;
      if (active.current) setBusy(false);
    }
  }

  function switchLanguages() {
    setSource(target);
    try { localStorage.setItem(directionPreference,target); } catch { /* Keep the direction for the open view. */ }
    if (translated && translated.length<=translatorTextLimit) {
      setOriginal(translated);
      setTranslated(original);
    } else setTranslated('');
    setMessage(undefined);
  }

  const canTranslate = configured && !busy && Boolean(original.trim());
  function translate() {
    if (canTranslate) void perform({type:'translate',from:source,text:original});
  }

  async function copyTranslation() {
    try {
      const result=await window.companion.copy(translated);
      if (active.current) setMessage(result.ok?{text:'Traducción copiada.'}:{text:result.error,error:true});
    } catch {
      if (active.current) setMessage({text:'No se pudo copiar la traducción.',error:true});
    }
  }

  return <section className="hub-panel translator-workspace" aria-labelledby="notes-title">
    <div className="translator-service">
      <span><Languages size={16}/>Azure Translator</span>
      {configured && <button type="button" aria-label="Configurar Azure" title="Configurar Azure" aria-expanded={showKey} disabled={busy}
        onClick={()=>{setShowKey(!showKey);setKey('');setMessage(undefined);}}><Settings2 size={16}/></button>}
    </div>
    {(configured===false || showKey) && <form className="translator-key" onSubmit={event=>{
      event.preventDefault();
      if (azureTranslatorKey.safeParse(key).success) void perform({type:'configure',key});
    }}>
      <label htmlFor="translator-key">Clave de Azure</label>
      <div className="translator-key-controls">
        <input id="translator-key" type="password" autoComplete="off" spellCheck={false} maxLength={256} disabled={busy}
          placeholder={configured?'Nueva clave':'Pega la clave del recurso Translator'} value={key}
          onChange={event=>setKey(event.target.value)}/>
        <button type="submit" disabled={busy || !azureTranslatorKey.safeParse(key).success}>Guardar clave</button>
        {configured && <button type="button" disabled={busy} onClick={()=>void perform({type:'disconnect'})}>Quitar clave</button>}
      </div>
    </form>}
    <form className="translator-form" onSubmit={event=>{event.preventDefault();translate();}}>
      <div className="translator-direction">
        <span>{languages[source]}</span>
        <button type="button" title="Intercambiar idiomas" aria-label="Intercambiar idiomas" disabled={busy} onClick={switchLanguages}>
          <ArrowLeftRight size={17}/>
        </button>
        <span>{languages[target]}</span>
      </div>
      <div className="translator-editors">
        <label>Original
          <textarea id="translator-original" rows={5} lang={source} value={original} maxLength={translatorTextLimit} disabled={busy}
            placeholder="Escribe o pega el texto…" onChange={event=>{
              setOriginal(event.target.value);setTranslated('');setMessage(undefined);
            }} onKeyDown={event=>{
              if (event.key!=='Enter'||event.shiftKey||event.nativeEvent.isComposing) return;
              event.preventDefault();
              if (!event.repeat) translate();
            }}/>
        </label>
        <label>Traducción
          <textarea id="translator-result" rows={5} lang={target} value={translated} readOnly placeholder="Aquí aparecerá la traducción."/>
        </label>
      </div>
      <div className="translator-footer">
        <span className="hub-muted">El texto se envía a Azure al traducir.</span>
        <div className="hub-tools">
          <button type="button" disabled={!translated || busy} onClick={()=>void copyTranslation()}><Copy size={15}/>Copiar</button>
          <button type="submit" className="hub-primary" title="Enter para traducir · Mayús + Enter para una nueva línea"
            aria-keyshortcuts="Enter" disabled={!canTranslate}>{busy?'Espera…':'Traducir'}</button>
        </div>
      </div>
    </form>
    {message&&<div className="hub-feedback" role={message.error?'alert':'status'}>{message.text}</div>}
  </section>;
}
