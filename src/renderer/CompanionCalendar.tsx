import React,{useEffect,useMemo,useRef,useState} from 'react';
import {CalendarDraft,addCalendarDays,calendarDateInZone,calendarGrid,calendarOverlaps,nextCalendarEvent,sourceKey,eventKey,
 type CalendarEvent,type CalendarRange,type CalendarSnapshot} from '../shared/companion-calendar';
import {CompanionIcon} from './CompanionActions';
import './companion-calendar.css';

const systemZone=Intl.DateTimeFormat().resolvedOptions().timeZone;
const locale=navigator.language||'es';
const dayDate=(value:string)=>new Date(value+'T12:00:00Z');
const dateLabel=(value:string,options:Intl.DateTimeFormatOptions)=>new Intl.DateTimeFormat(locale,{...options,timeZone:'UTC'}).format(dayDate(value));
const empty:CalendarSnapshot={events:[],sources:[],coverage:[],operations:[],canRequest:false,confirmations:[]};
function initialDay(){
 try{const saved=localStorage.getItem('zen-calendar-selected');if(saved&&/^\d{4}-\d{2}-\d{2}$/.test(saved))return saved;}catch{}
 return calendarDateInZone(new Date(),systemZone);
}

export function CompanionCalendar({visible,revision,simpleMode}:{visible:boolean;revision?:number;simpleMode:boolean}){
 const [selected,setSelected]=useState(initialDay),[month,setMonth]=useState(()=>selected.slice(0,7)+'-01');
 const [now,setNow]=useState(Date.now);
 const [data,setData]=useState<CalendarSnapshot>(empty),[sources,setSources]=useState<string[]|null>(null);
 const [error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [draft,setDraft]=useState<CalendarDraft>(),[saving,setSaving]=useState(false),[feedback,setFeedback]=useState('');
 const [detail,setDetail]=useState<CalendarEvent>();
 const attempted=useRef(new Set<string>()),readVersion=useRef(0);
 const createDialog=useRef<HTMLDialogElement>(null),detailDialog=useRef<HTMLDialogElement>(null);
 const grid=useMemo(()=>calendarGrid(month),[month]);
 const range:CalendarRange=useMemo(()=>({start:grid[0],end:addCalendarDays(grid[41],1),timeZone:systemZone}),[grid]);
 const rangeKey=JSON.stringify(range);
 async function read(){
  const version=++readVersion.current;
  try{
   const result=await window.companion.calendar({type:'read'});
   if(version!==readVersion.current)return;
   if(result.ok&&'events' in result.value){setData(result.value);setError('');}
   else if(!result.ok)setError(result.error);
  }catch{if(version===readVersion.current)setError('No se pudo leer la copia local.');}
 }
 useEffect(()=>{if(visible)void read();return()=>{readVersion.current++;};},[visible,revision]);
 useEffect(()=>{
  if(!visible)return;
  const update=()=>setNow(Date.now());
  update();
  const timer=setInterval(update,30_000);
  return()=>clearInterval(timer);
 },[visible]);
 useEffect(()=>{try{localStorage.setItem('zen-calendar-selected',selected);}catch{}},[selected]);
 useEffect(()=>{if(draft&&visible)createDialog.current?.show();else createDialog.current?.close();},[!!draft,visible]);
 useEffect(()=>{if(detail&&visible)detailDialog.current?.show();else detailDialog.current?.close();},[!!detail,visible]);
 async function refresh(){
  if(busy)return;
  setBusy(true);setError('');
  try{
   const result=await window.companion.calendar({type:'refresh',range,sources:sources??[]});
   if(result.ok&&'events' in result.value)setData(result.value);
   else if(!result.ok)setError(result.error);
  }catch{setError('No se pudo solicitar la actualización a Codex.');}
  finally{setBusy(false);}
 }
 const coverage=data.coverage.filter(item=>JSON.stringify(item.range)===rangeKey&&(sources===null||sources.includes(item.source)));
 const operations=data.operations.filter(item=>item.range&&JSON.stringify(item.range)===rangeKey);
 const waiting=operations.some(item=>item.status==='waiting'||item.status==='uncertain');
 const failed=operations.find(item=>item.status==='error');
 useEffect(()=>{
  if(!visible||!data.canRequest||coverage.length||attempted.current.has(rangeKey))return;
  attempted.current.add(rangeKey);void refresh();
 },[visible,data.canRequest,rangeKey]);
 const remoteSources=sources??data.sources.map(sourceKey);
 const complete=coverage.length>0&&remoteSources.every(source=>coverage.some(item=>item.source===source&&item.complete));
 const sync=waiting?'Esperando resultado de Codex':failed?'No se pudo actualizar':complete?'Consulta completa':
  coverage.length?'Resultados parciales':data.sources.length?'Todavía no actualizado':'Calendario no conectado';
 const events=useMemo(()=>data.events.filter(event=>event.accountId==='zen-local'||sources===null||sources.includes(sourceKey({accountId:event.accountId,id:event.calendarId}))),[data.events,sources]);
 const agenda=useMemo(()=>events.filter(event=>calendarOverlaps(event,{start:selected,end:addCalendarDays(selected,1),timeZone:systemZone}))
  .sort((a,b)=>Number(b.allDay)-Number(a.allDay)||(a.allDay?a.start.localeCompare(b.start):Date.parse(a.start)-Date.parse(b.start))||a.title.localeCompare(b.title)),[events,selected]);
 const today=calendarDateInZone(new Date(now),systemZone);
 const upcoming=useMemo(()=>nextCalendarEvent(events,new Date(now),systemZone),[events,now]);
 const upcomingDay=upcoming&&(upcoming.allDay?upcoming.start:calendarDateInZone(new Date(upcoming.start),systemZone));
 const lastUpdate=coverage.length?Math.max(...coverage.map(item=>item.at)):undefined;
 function choose(value:string){setSelected(value);if(value.slice(0,7)!==month.slice(0,7))setMonth(value.slice(0,7)+'-01');}
 function moveMonth(offset:number){
  const next=dayDate(month);next.setUTCMonth(next.getUTCMonth()+offset);
  const first=next.toISOString().slice(0,10);setMonth(first);setSelected(first);
 }
 function newEvent(){
  setFeedback('');setDraft({id:crypto.randomUUID(),title:'',date:selected,endDate:selected,start:'09:00',end:'10:00',
   allDay:false,timeZone:systemZone,destination:'local',description:'',location:''});
 }
 async function save(event:React.FormEvent){
  event.preventDefault();if(!draft||saving)return;
  const parsed=CalendarDraft.safeParse(draft);
  if(!parsed.success){setFeedback('Revisa el título, las fechas y las horas.');return;}
  setSaving(true);setFeedback('');
  try{
   const result=await window.companion.calendar({type:'create',draft:parsed.data});
   if(!result.ok){setFeedback(result.error);return;}
   if('event' in result.value&&result.value.event){
    setFeedback('local' in result.value&&result.value.local?'Guardado solo en ZEN.':'Creado y confirmado por el calendario.');
    setDraft(undefined);await read();
   }else if('operation' in result.value&&result.value.operation){
    setFeedback(result.value.operation.message??'Solicitud enviada a Codex. Esperando confirmación del calendario.');
    await read();
   }
  }catch{setFeedback('Falta confirmación. Revisa Codex antes de repetir una creación externa.');}
  finally{setSaving(false);}
 }
 const operation=draft&&data.operations.find(item=>item.draftId===draft.id);
 useEffect(()=>{
  if(draft&&draft.destination!=='local'&&data.confirmations.some(item=>item.draftId===draft.id)){
   setDraft(undefined);setFeedback('Creado y confirmado por el calendario.');
  }
 },[data.confirmations,draft?.id]);
 useEffect(()=>{
  if(!draft||!operation)return;
  if(operation.message)setFeedback(operation.message);
 },[operation?.message]);
 const remotePending=!!operation&&draft?.destination!=='local';
 const times=(event:CalendarEvent)=>event.allDay?'Todo el día':new Intl.DateTimeFormat(locale,{timeZone:systemZone,hour:'2-digit',minute:'2-digit'})
  .format(new Date(event.start))+' – '+new Intl.DateTimeFormat(locale,{timeZone:systemZone,hour:'2-digit',minute:'2-digit'}).format(new Date(event.end));
 const sourceLabel=(event:CalendarEvent)=>event.accountId==='zen-local'?'Solo en ZEN':
  data.sources.find(source=>source.accountId===event.accountId&&source.id===event.calendarId)?.name??event.calendarId;
 const monthControls=<>
  <button aria-label="Mes anterior" onClick={()=>moveMonth(-1)}>‹</button>
  <h2>{dateLabel(month,{month:'long',year:'numeric'})}</h2>
  <button aria-label="Mes siguiente" onClick={()=>moveMonth(1)}>›</button>
 </>;
 const monthView=<section className="calendar-month" aria-label="Calendario mensual">
  {!simpleMode&&<div className="calendar-selected"><span>{dateLabel(selected,{weekday:'long'})}</span><strong>{Number(selected.slice(-2))}</strong>
   <small>{dateLabel(selected,{month:'long',year:'numeric'})}</small></div>}
  <div className="calendar-grid" role="group" aria-label={dateLabel(month,{month:'long',year:'numeric'})}>
   {Array.from({length:7},(_,index)=><span className="calendar-weekday" key={index}>{dateLabel(addCalendarDays('2024-01-01',index),{weekday:'short'})}</span>)}
   {grid.map(date=><button key={date} className="calendar-day" data-other-month={date.slice(0,7)!==month.slice(0,7)}
    aria-label={dateLabel(date,{dateStyle:'full'})} aria-pressed={selected===date} aria-current={today===date?'date':undefined} onClick={()=>choose(date)}>
    {Number(date.slice(-2))}{events.some(event=>calendarOverlaps(event,{start:date,end:addCalendarDays(date,1),timeZone:systemZone}))&&<i aria-label="Hay eventos"/>}
   </button>)}
  </div>
 </section>;
 const syncDetails=<>
  <p className="calendar-sync" role="status">{sync}{lastUpdate&&' · '+new Date(lastUpdate).toLocaleString(locale)}
   <small>{dateLabel(range.start,{day:'numeric',month:'short'})+' – '+dateLabel(addCalendarDays(range.end,-1),{day:'numeric',month:'short'})+' · '+systemZone}</small>
  </p>
  {!data.canRequest&&<p className="calendar-connect">Puedes crear eventos en «Solo en ZEN». Fija un chat de Codex en Ajustes para consultar tus calendarios.</p>}
  {data.canRequest&&!data.sources.length&&<p className="calendar-connect">Actualizar solicitará los datos al conector de calendario del chat fijado. La conexión se confirma al recibir un resultado válido.</p>}
  {data.sources.length>0&&<details className="calendar-sources"><summary>Calendarios · {sources?.length??data.sources.length}</summary>
   {data.sources.map(source=><label key={sourceKey(source)}><input type="checkbox" checked={sources===null||sources.includes(sourceKey(source))}
    onChange={event=>setSources(current=>{
     const active=current??data.sources.map(sourceKey);
     return event.target.checked?[...new Set([...active,sourceKey(source)])]:active.filter(value=>value!==sourceKey(source));
    })}/>{source.name}<small>{source.writable?'Lectura y escritura':'Solo lectura'}</small></label>)}
  </details>}
 </>;
 const pendingOperations=data.operations.filter(item=>item.type==='created').map(item=><p className="calendar-connect" key={item.id}>
  {item.status==='waiting'?'Creación pendiente de confirmación.':item.message??'Resultado de creación incierto.'}
  {' '}<button onClick={()=>void window.companion.openCodex()}>Comprobar en Codex</button>
 </p>);
 return <div className="calendar-workspace">
  <header className="calendar-heading">
   <h1>Calendario</h1><div className="calendar-controls">
    {!simpleMode&&monthControls}
    <button onClick={()=>choose(today)}>Hoy</button>
    <button disabled={busy||waiting||!data.canRequest||sources?.length===0} onClick={()=>void refresh()}><CompanionIcon name="calendar"/>{busy||waiting?'Actualizando…':'Actualizar'}</button>
   </div>
  </header>
  <div className="calendar-overview">
   <div className="calendar-summary">
    {!simpleMode&&syncDetails}
    {(error||failed?.message)&&<p role="alert">{error||failed?.message} La copia anterior sigue disponible.</p>}
    {!simpleMode&&pendingOperations}
   </div>
   <section className="calendar-next" aria-labelledby="calendar-next-title">
    <h2 id="calendar-next-title"><CompanionIcon name="calendar"/>Próximo evento</h2>
    {upcoming&&upcomingDay?<button type="button" className="calendar-next-link" onClick={()=>choose(upcomingDay)}
     aria-label={'Ir al día de '+upcoming.title}>
     <span><strong>{upcoming.title}</strong><small>{dateLabel(upcomingDay,{weekday:'short',day:'numeric',month:'short'})} · {times(upcoming)}</small></span>
     <CompanionIcon name="arrow"/>
    </button>:<p>Sin eventos próximos en la agenda disponible.</p>}
   </section>
  </div>
  {!simpleMode&&monthView}
  <section className="calendar-agenda" aria-label="Agenda del día seleccionado">
   <header><h2>{dateLabel(selected,{weekday:'long',day:'numeric',month:'long'})}</h2>
    {simpleMode&&<div className="calendar-controls" aria-label="Cambiar día" role="group">
     <button type="button" aria-label="Día anterior" onClick={()=>choose(addCalendarDays(selected,-1))}>‹</button>
     <button type="button" aria-label="Día siguiente" onClick={()=>choose(addCalendarDays(selected,1))}>›</button>
    </div>}
    <button disabled={!!draft} onClick={newEvent}>+ Crear evento</button>
   </header>
   {feedback&&!draft&&<p role="status">{feedback}</p>}
   <div className="calendar-events">{agenda.length?agenda.map(event=><button className="calendar-event" key={JSON.stringify([event.accountId,event.calendarId,event.id])} onClick={()=>setDetail(event)}>
    <time>{times(event)}</time><span><strong>{event.title}</strong><small>{sourceLabel(event)} · {event.accountId==='zen-local'?'Local':'Sincronizado'}</small></span>
   </button>):<p>{complete?'Sin eventos para esta fecha.':'Sin eventos locales. '+(waiting?'Esperando la consulta externa.':failed?'La consulta externa ha fallado.':'Todavía no se ha confirmado la agenda externa.')}</p>}</div>
  </section>
  {simpleMode&&<>
   {pendingOperations}
   <details className="simple-disclosure calendar-month-picker"><summary>Vista mensual</summary><div className="calendar-controls">{monthControls}</div>{monthView}</details>
   <details className="simple-disclosure calendar-summary"><summary>Calendarios y sincronización</summary>{syncDetails}</details>
  </>}
  <dialog ref={createDialog} className="calendar-dialog" onCancel={()=>setDraft(undefined)}
   onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();setDraft(undefined);}}}>
   {draft&&<form onSubmit={save}>
    <h2>Crear evento</h2>
    <fieldset disabled={saving||remotePending}>
    <label>Título<input autoFocus required maxLength={240} value={draft.title} onChange={event=>setDraft({...draft,title:event.target.value})}/></label>
    <label>Fecha<input type="date" required value={draft.date} onChange={event=>setDraft({...draft,date:event.target.value,endDate:draft.endDate<event.target.value?event.target.value:draft.endDate})}/></label>
    <label className="calendar-check"><input type="checkbox" checked={draft.allDay} onChange={event=>setDraft({...draft,allDay:event.target.checked})}/>Todo el día</label>
    {!draft.allDay&&<div className="calendar-time-fields"><label>Inicio<input type="time" required value={draft.start} onChange={event=>setDraft({...draft,start:event.target.value})}/></label>
     <label>Fin<input type="time" required value={draft.end} onChange={event=>setDraft({...draft,end:event.target.value})}/></label></div>}
    </fieldset>
    <label>Destino<select disabled={saving} value={draft.destination} onChange={event=>setDraft({...draft,destination:event.target.value})}>
     <option value="local">Solo en ZEN</option>{data.sources.filter(source=>source.writable).map(source=><option disabled={!!operation} value={sourceKey(source)} key={sourceKey(source)}>{source.name} · {source.accountId}</option>)}
    </select></label>
    <fieldset disabled={saving||remotePending}>
    <details><summary>Varios días y datos opcionales</summary>
     <label>Fecha final<input type="date" required min={draft.date} value={draft.endDate} onChange={event=>setDraft({...draft,endDate:event.target.value})}/></label>
     <label>Descripción<textarea value={draft.description} onChange={event=>setDraft({...draft,description:event.target.value})}/></label>
     <label>Ubicación<input value={draft.location} onChange={event=>setDraft({...draft,location:event.target.value})}/></label>
    </details>
    </fieldset>
    <small>Zona horaria · {draft.timeZone}</small>
    {feedback&&<p role="status">{feedback}</p>}
    {operation&&draft.destination==='local'&&<p role="status">El resultado externo sigue pendiente de confirmar. Guardar aquí crea una copia solo en ZEN. Comprueba la solicitud externa en Codex.</p>}
    {operation&&<button type="button" onClick={()=>void window.companion.openCodex()}>Comprobar en Codex</button>}
    <footer><button type="button" disabled={saving} onClick={()=>setDraft(undefined)}>Cerrar</button>
     <button type="submit" className="primary" disabled={saving||remotePending}>{saving?'Guardando…':remotePending?'Esperando confirmación':'Guardar'}</button></footer>
   </form>}
  </dialog>
  <dialog ref={detailDialog} className="calendar-dialog" onCancel={()=>setDetail(undefined)}
   onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();setDetail(undefined);}}}>
   {detail&&<><h2>{detail.title}</h2><p>{times(detail)} · {sourceLabel(detail)}</p>
    <p>{dateLabel(detail.allDay?detail.start:calendarDateInZone(new Date(detail.start),systemZone),{dateStyle:'long'})}</p>
    {detail.description&&<p className="calendar-description">{detail.description}</p>}{detail.location&&<p>{detail.location}</p>}
    <p>Fin · {detail.allDay?dateLabel(addCalendarDays(detail.end,-1),{dateStyle:'long'}):new Date(detail.end).toLocaleString(locale,{timeZone:systemZone})}</p>
    <small>{detail.timeZone}</small><footer><button onClick={()=>setDetail(undefined)}>Cerrar</button></footer></>}
  </dialog>
 </div>;
}
