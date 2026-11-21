import {z} from 'zod';
import {addCalendarDays, calendarDateInZone} from '../shared/companion-calendar';
import {dublinWeather, WeatherLocation, type WeatherForecast} from '../shared/companion-weather';

const API = 'https://api.openweathermap.org';
const temperature = z.number().min(-100).max(80);
const condition = z.object({id:z.number().int().min(200).max(899),description:z.string().trim().min(1).max(100),icon:z.string().regex(/^\d{2}[dn]$/)});
const conditions = z.array(condition).min(1).max(10);
const current = z.object({main:z.object({temp:temperature}),weather:conditions});
const forecasts = z.object({
  city:z.object({timezone:z.number().int().min(-43200).max(50400)}),
  list:z.array(z.object({
    dt:z.number().int().min(0).max(4_102_444_800),
    main:z.object({temp:temperature}),weather:conditions,
    pop:z.number().min(0).max(1).optional(),rain:z.object({'3h':z.number().nonnegative().optional()}).optional(),
  })).min(1).max(40),
});
const cities = z.array(z.object({
  name:z.string(),country:z.string(),lat:z.number(),lon:z.number(),local_names:z.object({es:z.string().optional()}).optional(),
})).max(5);

export class OpenWeatherError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

async function query(path: '/data/2.5/weather' | '/data/2.5/forecast' | '/geo/1.0/direct',
  params: Record<string,string>, key: string, signal: AbortSignal, http: typeof fetch): Promise<unknown> {
  const url = new URL(path, API);
  url.search = new URLSearchParams({...params,appid:key}).toString();
  let response: Response;
  try {
    response = await http(url, {redirect:'error',signal:AbortSignal.any([signal,AbortSignal.timeout(8000)])});
  } catch {
    throw new OpenWeatherError(0,'No se pudo conectar con OpenWeather.');
  }
  if (!response.ok) {
    const message = response.status === 401 || response.status === 403 ? 'OpenWeather rechazó la clave. Comprueba que esté activa.' :
      response.status === 429 ? 'OpenWeather limitó las consultas. Inténtalo más tarde.' : 'OpenWeather no pudo devolver el clima.';
    throw new OpenWeatherError(response.status,message);
  }
  try { return await response.json(); }
  catch { throw new OpenWeatherError(0,'OpenWeather devolvió datos inválidos.'); }
}

export async function findWeatherCity(city: string, key: string, signal: AbortSignal, http = fetch): Promise<WeatherLocation> {
  if (/^(dubl[ií]n|dublin)(\s*,\s*ie)?$/i.test(city)) return dublinWeather;
  const [match] = cities.parse(await query('/geo/1.0/direct',{q:city,limit:'1'},key,signal,http));
  if (!match) throw new OpenWeatherError(404,'No se encontró esa ciudad. Prueba con el país, como «Madrid, ES».');
  return WeatherLocation.parse({name:match.local_names?.es??match.name,country:match.country,latitude:match.lat,longitude:match.lon});
}

export async function readOpenWeather(location: WeatherLocation, key: string, signal: AbortSignal, now = Date.now(), http = fetch): Promise<WeatherForecast> {
  const params = {lat:String(location.latitude),lon:String(location.longitude),units:'metric',lang:'es'};
  const [rawCurrent,rawForecast] = await Promise.all([
    query('/data/2.5/weather',params,key,signal,http),query('/data/2.5/forecast',params,key,signal,http),
  ]);
  const observed = current.parse(rawCurrent);
  const predicted = forecasts.parse(rawForecast);
  const isDublin = location.latitude === dublinWeather.latitude && location.longitude === dublinWeather.longitude;
  const day = (timestamp: number) => isDublin ? calendarDateInZone(new Date(timestamp),'Europe/Dublin') :
    new Date(timestamp + predicted.city.timezone * 1000).toISOString().slice(0,10);
  const today = day(now), tomorrow = addCalendarDays(today,1);
  const future = predicted.list.filter(item => item.dt * 1000 >= now);
  const todayRows = future.filter(item => day(item.dt * 1000) === today);
  const tomorrowRows = future.filter(item => day(item.dt * 1000) === tomorrow);
  const period = todayRows.length >= 2 || (todayRows.length && !tomorrowRows.length) ? 'today' : tomorrowRows.length ? 'tomorrow' : 'next24h';
  const window = period === 'today' ? todayRows : period === 'tomorrow' ? tomorrowRows : future.filter(item => item.dt * 1000 <= now + 86400_000);
  if (!window.length) throw new OpenWeatherError(0,'Todavía no hay tramos de previsión disponibles.');

  const values = window.map(item => item.main.temp);
  const rain = window.filter(item => (item.rain?.['3h']??0) > 0 || item.weather.some(({id}) => id < 600));
  const chances = rain.flatMap(item => item.pop === undefined ? [] : [item.pop]);
  const {description,icon} = observed.weather[0];
  return {temperature:Math.round(observed.main.temp),description,icon,
    low:Math.round(Math.min(...values)),high:Math.round(Math.max(...values)),rain:rain.length>0,
    rainChance:chances.length ? Math.round(Math.max(...chances)*100) : undefined,period,updatedAt:now};
}
