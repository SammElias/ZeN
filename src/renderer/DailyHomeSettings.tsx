import React,{useEffect,useState} from 'react';
import {type DailyHomePreferences} from '../shared/companion-daily-home';
import {calendarDate} from '../shared/companion-calendar';
import {PreferenceSave,PreferenceSwitch,type PreferenceFeedback} from './PreferencesControls';

const days=[['Lun',1],['Mar',2],['Mié',3],['Jue',4],['Vie',5],['Sáb',6],['Dom',0]] as const;
const modes={office:'Oficina',remote:'Teletrabajo',unspecified:'Sin modalidad'} as const;

export function DailyHomeSettings({visible,allowed}:{visible:boolean;allowed:boolean}){
 const [saved,setSaved]=useState<DailyHomePreferences>();
 const [draft,setDraft]=useState<DailyHomePreferences>();
 const [feedback,setFeedback]=useState<PreferenceFeedback>();
 const [busy,setBusy]=useState(false);
 const [date,setDate]=useState('');
 const [mode,setMode]=useState<keyof typeof modes>('office');
 const [retry,setRetry]=useState(0);

 useEffect(()=>{
  if(!allowed){setSaved(undefined);setDraft(undefined);return;}
  if(!visible||saved)return;
  let active=true;
  void window.companion.dailyHome({type:'read'}).then(result=>{
   if(!active)return;
   if(result.ok){setSaved(result.value);setDraft(result.value);setFeedback(undefined);}
   else setFeedback({text:result.error,error:true});
  }).catch(()=>{if(active)setFeedback({text:'No se pudo leer el resumen diario.',error:true});});
  return()=>{active=false;};
 },[allowed,visible,!!saved,retry]);

 if(!allowed)return <p role="status">Desactiva Pausa o Presentación para configurar el resumen diario.</p>;
 if(!draft)return feedback?<><p role="alert">{feedback.text}</p><button type="button" onClick={()=>{setFeedback(undefined);setRetry(value=>value+1);}}>Volver a intentar</button></>:<p role="status">Cargando preferencias…</p>;
 const edit=(change:Partial<DailyHomePreferences>)=>{setDraft({...draft,...change});setFeedback(undefined);};
 const dirty=JSON.stringify(saved)!==JSON.stringify(draft);

 async function save(preferences:DailyHomePreferences){
  if(busy)return;
  setBusy(true);setFeedback(undefined);
  try{
   const result=await window.companion.dailyHome({type:'save',preferences});
   if(result.ok){setSaved(result.value);setDraft(result.value);setFeedback({text:'Preferencias del resumen guardadas.'});}
   else setFeedback({text:result.error,error:true});
  }catch{setFeedback({text:'No se pudieron guardar estas preferencias.',error:true});}
  finally{setBusy(false);}
 }

 return <div className="daily-home-settings">
  <p>ZEN prepara el mensaje en este equipo. Los datos de la agenda y del clima se quedan en ZEN, fuera de las peticiones a Codex.</p>
  <PreferenceSwitch title="Resumen diario personalizado" checked={draft.enabled} disabled={busy} onChange={enabled=>edit({enabled})}/>
  <PreferenceSwitch title="Usar calendario para personalizar" checked={draft.useCalendar} disabled={busy||!draft.enabled} onChange={useCalendar=>edit({useCalendar})}/>
  <PreferenceSwitch title="Animaciones del clima" checked={draft.animateWeather} disabled={busy} onChange={animateWeather=>edit({animateWeather})}/>
  {draft.enabled&&draft.useCalendar&&<fieldset className="preference-fieldset daily-office-settings" disabled={busy}>
   <legend>Días habituales de oficina</legend>
   <div className="daily-office-days">{days.map(([label,day])=><label key={day}><input type="checkbox" checked={draft.officeDays.includes(day)}
    onChange={event=>edit({officeDays:event.currentTarget.checked?[...draft.officeDays,day]:draft.officeDays.filter(value=>value!==day)})}/>{label}</label>)}</div>
   <p>Puedes marcar un evento con [oficina] o [teletrabajo].</p>
   <h3>Excepciones por fecha</h3>
   <div className="daily-office-exceptions">
    <input type="date" aria-label="Fecha de la excepción" value={date} onChange={event=>setDate(event.currentTarget.value)}/>
    <select aria-label="Modalidad de la excepción" value={mode} onChange={event=>{
     const value=event.currentTarget.value;if(value==='office'||value==='remote'||value==='unspecified')setMode(value);
    }}>{Object.entries(modes).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>
    <button type="button" disabled={!calendarDate.safeParse(date).success||(!draft.exceptions[date]&&Object.keys(draft.exceptions).length>=366)}
     onClick={()=>{edit({exceptions:{...draft.exceptions,[date]:mode}});setDate('');}}>Añadir o cambiar</button>
   </div>
   {!!Object.keys(draft.exceptions).length&&<ul>{Object.entries(draft.exceptions).sort(([a],[b])=>a.localeCompare(b)).map(([day,value])=><li key={day}>
    <span><time dateTime={day}>{new Intl.DateTimeFormat('es',{dateStyle:'medium',timeZone:'UTC'}).format(new Date(day+'T12:00:00Z'))}</time> · {modes[value]}</span>
    <button type="button" onClick={()=>{const exceptions={...draft.exceptions};delete exceptions[day];edit({exceptions});}}>Quitar</button>
   </li>)}</ul>}
  </fieldset>}
  <PreferenceSave dirty={dirty} busy={busy} feedback={feedback} onSave={()=>void save(draft)} onDiscard={()=>{setDraft(saved);setFeedback(undefined);}}/>
 </div>;
}
