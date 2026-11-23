import React,{useEffect,useState} from 'react';
import {metricResources,ouraClientId,ouraDuration,ouraLatest,ouraRedirect,ouraWeek,type OuraAction,type OuraMetric,type OuraPoint,type OuraStatus} from '../shared/companion-oura';
import {CompanionIcon} from './CompanionActions';
import './companion-metrics.css';

const dayLabel=new Intl.DateTimeFormat('es',{day:'numeric',month:'short',timeZone:'UTC'});
const shortDay=new Intl.DateTimeFormat('es',{weekday:'short',day:'numeric',timeZone:'UTC'});
const checkTime=new Intl.DateTimeFormat('es',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
const integer=new Intl.NumberFormat('es');
const cards=[
 {id:'sleep',title:'Sueño',icon:'moon',pending:'Sueño de anoche pendiente de sincronizar'},
 {id:'readiness',title:'Disposición',icon:'pulse',pending:'Disposición de hoy pendiente de sincronizar'},
 {id:'activity',title:'Actividad',icon:'steps',pending:'Actividad de hoy pendiente de sincronizar'},
] as const;
const dateAtNoon=(day:string)=>new Date(day+'T12:00:00Z');
const scoreText=(score:number)=>`${score}/100`;

function measures(metric:OuraMetric){
 const score={title:'Puntuación',value:(point:OuraPoint)=>point.score,format:scoreText,minimumScale:100};
 if(metric==='sleep')return [{title:'Duración',value:(point:OuraPoint)=>point.seconds,format:ouraDuration,minimumScale:8*3600},score];
 if(metric==='activity')return [{title:'Pasos',value:(point:OuraPoint)=>point.steps,format:(value:number)=>integer.format(value),minimumScale:1},score];
 return [score];
}

function OuraHistory({metric,status}:{metric:OuraMetric;status:OuraStatus}){
 const days=ouraWeek(status.cache,metric,status.today).reverse(),series=measures(metric);
 const maxima=series.map(item=>Math.max(item.minimumScale,...days.map(day=>item.value(day)??0)));
 const title=cards.find(card=>card.id===metric)?.title;
 return <section className="oura-history" aria-labelledby="oura-history-title">
  <h2 id="oura-history-title">{title} · Últimos siete días</h2>
  <table className="oura-week" data-metric={metric}>
   <thead><tr><th scope="col">Día</th>{series.map(item=><th scope="col" key={item.title}>{item.title}</th>)}</tr></thead>
   <tbody>{days.map(point=><tr key={point.day} data-day={point.day}>
    <th scope="row"><time dateTime={point.day}>{shortDay.format(dateAtNoon(point.day))}</time></th>
    {series.map((item,index)=>{
     const value=item.value(point);
     return <td key={item.title}><div className="oura-series-cell" data-missing={value===undefined}>
      <span className="oura-bar" aria-hidden="true">{value!==undefined&&<i style={{width:`${value/maxima[index]*100}%`}}/>}</span>
      <span>{value===undefined?'Sin datos':item.format(value)}</span>
     </div></td>;
    })}
   </tr>)}</tbody>
  </table>
 </section>;
}

export function CompanionMetrics({status,simpleMode}:{status:OuraStatus;simpleMode:boolean}){
 const [metric,setMetric]=useState<OuraMetric>('sleep');
 const [historyOpen,setHistoryOpen]=useState(false);
 const [clientId,setClientId]=useState(status.clientId),[error,setError]=useState('');
 useEffect(()=>setClientId(status.clientId),[status.clientId]);
 const connected=status.state==='connected',connecting=status.state==='connecting',expired=status.state==='expired';
 async function run(action:OuraAction){
  setError('');
  try{const result=await window.companion.oura(action);if(!result.ok)setError(result.error);}
  catch{setError('No se pudo completar la acción de Oura.');}
 }
 const preferences=<footer className="oura-footer">
  <p>Para sincronizar el anillo, abre Oura en tu móvil. ZEN consulta los datos en la nube.</p>
  <div><label>En la cápsula <select value={status.capsule} onChange={event=>void run({type:'capsule',mode:event.target.value==='sleep'?'sleep':'icon'})}>
   <option value="icon">Solo icono</option><option value="sleep">Duración del sueño</option>
  </select></label>
  <button type="button" disabled={connecting} onClick={()=>void run({type:'disconnect'})}>Desconectar Oura</button></div>
 </footer>;
 const legal=<nav className="oura-footer" aria-label="Información legal de Métricas"><div>
  <button type="button" onClick={()=>void run({type:'legal',page:'privacy'})}>Política de privacidad</button>
  <button type="button" onClick={()=>void run({type:'legal',page:'terms'})}>Términos de servicio</button>
 </div></nav>;
 return <section className="oura-workspace" aria-labelledby="oura-title">
  <header className="oura-heading"><div><span>Oura Ring{status.demo?' · Datos de prueba':''}</span><h1 id="oura-title">Métricas</h1></div>
   {connected&&<button type="button" data-oura-refresh disabled={status.busy}
    title="Consulta Oura Cloud. Sincroniza el anillo desde la app Oura del móvil."
    onClick={()=>void run({type:'refresh'})}>{status.busy?'Consultando…':'Actualizar'}</button>}
  </header>
  {(error||status.error)&&<p className="oura-message" role="status">{error||status.error}</p>}
  {!connected&&<form className="oura-connection" onSubmit={event=>{
   event.preventDefault();const id=ouraClientId.safeParse(clientId);if(id.success)void run({type:'connect',clientId:id.data});
  }}>
   <h2>{expired?'Sesión de Oura caducada':'Conectar Oura'}</h2>
   <p>{connecting?'Termina la conexión en el navegador del sistema.':'Registra una aplicación en Oura y concede el permiso de métricas diarias.'}</p>
   {!connecting?<><label htmlFor="oura-client-id">Client ID de Oura</label>
    <div className="oura-connect-row"><input id="oura-client-id" value={clientId} onChange={event=>setClientId(event.target.value)} maxLength={160} spellCheck={false} autoComplete="off"/>
    <button className="primary" disabled={!ouraClientId.safeParse(clientId).success}>{expired?'Volver a conectar':'Conectar Oura'}</button>
    {expired&&<button type="button" onClick={()=>void run({type:'disconnect'})}>Desconectar Oura</button>}</div>
    <small>ZEN recuerda el Client ID en este equipo. URI de redirección <code>{ouraRedirect}</code></small></>:<button type="button" onClick={()=>void run({type:'cancel'})}>Cancelar</button>}
  </form>}
  {connected&&<>
   <div className="oura-today-heading"><h2>Hoy</h2><time dateTime={status.today}>{dayLabel.format(dateAtNoon(status.today))}</time></div>
   <div className="oura-cards">{cards.map(card=>{
    const point=ouraLatest(status.cache,card.id,status.today);
    const value=card.id==='sleep'?point?.seconds===undefined?'—':ouraDuration(point.seconds):
     card.id==='activity'?point?.steps===undefined?'—':`${integer.format(point.steps)} pasos`:
     point?.score===undefined?'—':scoreText(point.score);
    const checked=metricResources[card.id].map(resource=>status.cache.checked[resource]);
    const verified=checked.every(at=>at!==undefined)?Math.min(...checked as number[]):undefined;
    const pending=!point||point.day!==status.today||(card.id==='sleep'&&point.seconds===undefined)||(card.id==='activity'&&point.steps===undefined);
    return <button className="oura-card" type="button" key={card.id} aria-pressed={metric===card.id} data-oura-card={card.id}
     data-day={point?.day} onClick={()=>{setMetric(card.id);if(simpleMode)setHistoryOpen(true);}}>
     <span className="oura-card-title"><CompanionIcon name={card.icon}/>{card.title}</span>
     <strong>{value}</strong>
     {card.id!=='readiness'&&<span>{point?.score===undefined?'Puntuación pendiente':`Puntuación ${scoreText(point.score)}`}</span>}
     {point&&<small>Medición · {dayLabel.format(dateAtNoon(point.day))}</small>}
     {pending&&<small className="oura-pending">{card.pending}</small>}
     <small className="oura-checked">{verified===undefined?'Sin consulta correcta registrada':`Última consulta correcta · ${checkTime.format(verified)}`}</small>
    </button>;
   })}</div>
   {simpleMode?<details className="simple-disclosure oura-simple-history" open={historyOpen} onToggle={event=>setHistoryOpen(event.currentTarget.open)}>
    <summary>Últimos siete días</summary><OuraHistory metric={metric} status={status}/>
   </details>:<OuraHistory metric={metric} status={status}/>}
   {!simpleMode&&preferences}
  </>}
  {simpleMode?<details className="simple-disclosure oura-simple-settings"><summary>{connected?'Configuración de Oura':'Privacidad y términos'}</summary>
   {connected&&preferences}{legal}
  </details>:legal}
 </section>;
}
