import React,{useEffect,useRef,useState} from 'react';
import {ArrowDown,ArrowUp,Cloud,CloudDrizzle,CloudFog,CloudLightning,CloudRain,CloudSun,Droplet,Moon,RefreshCw,Settings2,Snowflake,Sun} from 'lucide-react';
import {dublinWeather,type WeatherAction,type WeatherForecast,type WeatherStatus} from '../shared/companion-weather';
import './HomeWeather.css';

const periods: Record<WeatherForecast['period'],string> = {today:'Resto de hoy',tomorrow:'Mañana',next24h:'Próximas 24 h'};
const conditionIcons: Partial<Record<string,typeof Cloud>> = { '01d':Sun, '01n':Moon, '02':CloudSun, '09':CloudDrizzle, '10':CloudRain, '11':CloudLightning, '13':Snowflake, '50':CloudFog };
const updatedDate = new Intl.DateTimeFormat('es',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});

export function HomeWeather() {
  const [status,setStatus] = useState<WeatherStatus>();
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [editing,setEditing] = useState(false);
  const [city,setCity] = useState('');
  const [key,setKey] = useState('');
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
    const refresh=()=>void update({type:'refresh'});
    refresh();
    const timer=setInterval(refresh,60_000);
    document.addEventListener('visibilitychange',refresh);
    return ()=>{
      active.current=false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange',refresh);
    };
  },[]);

  const location=status?.location??dublinWeather,forecast=status?.forecast;
  const keyNeeded=!status?.configured;
  const hasError=error||status?.error;
  const icon=forecast?.icon??'';
  const Condition=conditionIcons[icon]??conditionIcons[icon.slice(0,2)]??Cloud;

  return <section className="home-panel home-weather" aria-labelledby="home-weather-title" data-home-card="weather">
    <header className="home-weather-header">
      <div className="home-weather-heading">
        <span className="home-status-icon"><Condition aria-hidden="true"/></span>
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
        <p>{periods[forecast.period]}</p>
        <div className="home-weather-range">
          <span><ArrowUp aria-hidden="true"/>Máx. <b>{forecast.high}°</b></span>
          <span><ArrowDown aria-hidden="true"/>Mín. <b>{forecast.low}°</b></span>
        </div>
        <p className="home-weather-rain"><Droplet aria-hidden="true"/>{forecast.rain ?
          forecast.rainChance===undefined?'Lluvia prevista':`Lluvia prevista · hasta ${forecast.rainChance} %`:'Sin lluvia prevista'}</p>
      </div>
    </div>}
    {!status&&!hasError&&<p role="status">Consultando el clima…</p>}
    {status?.configured&&!forecast&&!hasError&&<p role="status">Esperando el pronóstico…</p>}
    {status&&keyNeeded&&!editing&&<button className="home-panel-link" type="button" onClick={()=>setEditing(true)}>Conectar OpenWeather</button>}
    {hasError&&<p className="home-weather-error" role="status">{hasError}</p>}

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
