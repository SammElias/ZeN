import React,{useEffect,useRef,useState} from 'react';
import {ArrowDown,ArrowRight,ArrowUp,Droplet,RefreshCw,Settings2} from 'lucide-react';
import {dublinWeather,isFreshWeather,type WeatherAction,type WeatherForecast,type WeatherStatus} from '../shared/companion-weather';
import type {HomeBrief} from '../shared/companion-daily-home';
import {HomeWeatherIllustration} from './HomeWeatherIllustration';
import './HomeWeather.css';

const periods: Record<WeatherForecast['period'],string> = {today:'Resto de hoy',tomorrow:'Mañana',next24h:'Próximas 24 h'};
const updatedDate = new Intl.DateTimeFormat('es',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
const agendaDate = new Intl.DateTimeFormat('es',{weekday:'short',day:'numeric',month:'short',timeZone:'UTC'});

function BriefAgenda({summary,onOpen}:{summary:NonNullable<HomeBrief['summary']>;onOpen:()=>void}){
 const {next,work}=summary;
 if(!next&&!work)return null;
 const mode=work?.mode==='office'?'Oficina':'Teletrabajo';
 const workText=work?.mode==='ambiguous'?'Modalidad sin confirmar':work?.source==='hint'?`Posible ${mode.toLowerCase()} · comprueba la agenda`:
  work?.source==='routine'?'Oficina prevista según tu rutina':work?`${mode} hoy`:undefined;
 const event=next?.kind==='meeting'?'Reunión':'Evento';
 return <button type="button" className="home-brief-agenda" onClick={onOpen}>
  <span>{workText&&<strong>{workText}</strong>}{next&&<span>
   {next.ongoing?(next.time?`${event} en curso`:`${event} de día completo`):`Próximo ${event.toLowerCase()}`} · {agendaDate.format(new Date(next.day+'T12:00:00Z'))}
   {next.time&&` · ${next.time}`}
  </span>}</span>
  <ArrowRight aria-hidden="true"/><span className="home-brief-agenda-label">Ver calendario</span>
 </button>;
}

export function HomeWeather({brief,greetingSeen,onOpenCalendar}:{brief?:HomeBrief;greetingSeen:React.RefObject<boolean>;onOpenCalendar:()=>void}) {
  const [status,setStatus] = useState<WeatherStatus>();
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [editing,setEditing] = useState(false);
  const [city,setCity] = useState('');
  const [key,setKey] = useState('');
  const [documentVisible,setDocumentVisible] = useState(!document.hidden);
  const [animateGreeting] = useState(()=>!greetingSeen.current);
  const active = useRef(false);
  const pending = useRef(false);

  async function update(action:WeatherAction) {
    if (pending.current || document.hidden) return;
    pending.current=true;
    if (action.type==='configure' || action.type==='refresh' && action.force) setBusy(true);
    try {
      const response=await window.companion.weather(action);
      if (!active.current) return;
      if (!response.ok) {setError(response.error);return;}
      setError('');
      setStatus(response.value);
      if (action.type==='configure' && !response.value.error) {setCity('');setEditing(false);}
    } catch {
      if (active.current) setError('No se pudo actualizar Clima.');
    } finally {
      pending.current=false;
      if (active.current) setBusy(false);
    }
  }

  useEffect(() => {
    active.current=true;
    const refresh=()=>{setDocumentVisible(!document.hidden);void update({type:'refresh'});};
    refresh();
    const timer=setInterval(refresh,60_000);
    document.addEventListener('visibilitychange',refresh);
    window.addEventListener('focus',refresh);
    window.addEventListener('online',refresh);
    return ()=>{
      active.current=false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange',refresh);
      window.removeEventListener('focus',refresh);
      window.removeEventListener('online',refresh);
    };
  },[]);

  const location=status?.location??dublinWeather,forecast=status?.forecast;
  const summary=brief?.summary;
  useEffect(()=>{if(summary)greetingSeen.current=true;},[!!summary,greetingSeen]);
  const fresh=!!forecast&&isFreshWeather(forecast,Date.now());
  const keyNeeded=!status?.configured;
  const hasError=error||status?.error;

  return <section className="home-panel home-weather" aria-labelledby="home-weather-title" data-home-card="weather">
    {summary&&<div className="home-daily-greeting" data-enter={animateGreeting&&brief?.animateWeather!==false} data-visible={documentVisible}>
      <h2>{summary.greeting}</h2><p>{summary.message}</p>
    </div>}
    <header className="home-weather-header">
      <div className="home-weather-heading">
        <HomeWeatherIllustration forecast={forecast} animate={documentVisible&&fresh&&brief?.animateWeather!==false}/>
        <div><h2 id="home-weather-title">Clima</h2><p>{location.name}{location.country==='IE'&&location.name==='Dublín'?'':` · ${location.country}`}</p></div>
      </div>
      {status?.configured&&<div className="home-weather-actions">
        <button type="button" title="Actualizar clima" aria-label="Actualizar clima" disabled={busy} onClick={()=>void update({type:'refresh',force:true})}><RefreshCw aria-hidden="true"/></button>
        <button type="button" title="Configurar clima" aria-label="Configurar clima" aria-expanded={editing} aria-controls="home-weather-settings" onClick={()=>{
          setEditing(!editing);setCity('');setKey('');
        }}><Settings2 aria-hidden="true"/></button>
      </div>}
    </header>

    {forecast&&<div className="home-weather-forecast">
      <div className="home-weather-current"><strong>{forecast.temperature}°<small>C</small></strong><p>{forecast.description}</p></div>
      <div className="home-weather-outlook">
        <p>{fresh?periods[forecast.period]:'Pronóstico anterior'}</p>
        <div className="home-weather-range">
          <span><ArrowUp aria-hidden="true"/>Máx. <b>{forecast.high}°</b></span>
          <span><ArrowDown aria-hidden="true"/>Mín. <b>{forecast.low}°</b></span>
        </div>
        <p className="home-weather-rain"><Droplet aria-hidden="true"/>{forecast.rain ?
          forecast.rainChance===undefined?'Lluvia prevista':`Probabilidad de lluvia · hasta ${forecast.rainChance} %`:'Sin lluvia prevista'}</p>
      </div>
    </div>}
    {!status&&!hasError&&<p role="status">Consultando el clima…</p>}
    {status?.configured&&!forecast&&!hasError&&<p role="status">Esperando el pronóstico…</p>}
    {status&&keyNeeded&&!editing&&<button className="home-panel-link" type="button" onClick={()=>setEditing(true)}>Conectar OpenWeather</button>}
    {hasError&&<p className="home-weather-error" role="status">{hasError}</p>}
    {summary&&<BriefAgenda summary={summary} onOpen={onOpenCalendar}/>}

    {editing&&<form id="home-weather-settings" className="home-weather-settings" onSubmit={event=>{
      event.preventDefault();
      if (pending.current) return;
      const value=key.trim();
      setKey('');
      void update({type:'configure',...(value?{key:value}:{}),...(city.trim()?{city:city.trim()}:{})});
    }}>
      <label>Ciudad<input value={city} onChange={event=>setCity(event.target.value)} placeholder={`${location.name}, ${location.country}`} maxLength={100}/></label>
      <label>Clave de OpenWeather<input type="password" autoComplete="off" value={key} onChange={event=>setKey(event.target.value)}
        required={keyNeeded} pattern="[a-fA-F0-9]{32}" maxLength={32} placeholder={keyNeeded?'Clave de API':'Conservar la clave guardada'}/></label>
      <div className="home-weather-actions">
        <button type="button" onClick={()=>{setEditing(false);setCity('');setKey('');}}>Cancelar</button>
        <button className="primary" type="submit" disabled={busy||!(key||city.trim())}>{busy?'Guardando…':'Guardar'}</button>
      </div>
    </form>}

    <footer className="home-weather-footer">
      <a href="https://openweathermap.org/" onClick={event=>{event.preventDefault();void window.companion.weather({type:'provider'});}}>
        <img className="weather-brand-dark" src="./icons/openweather-dark.png" alt=""/>
        <img className="weather-brand-light" src="./icons/openweather-light.png" alt=""/>
        <span>Datos meteorológicos de OpenWeather</span>
      </a>
      {forecast&&<time dateTime={new Date(forecast.updatedAt).toISOString()}>Actualizado {updatedDate.format(forecast.updatedAt)}</time>}
    </footer>
  </section>;
}
