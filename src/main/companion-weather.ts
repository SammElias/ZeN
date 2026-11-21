import {existsSync,readFileSync,renameSync,rmSync,writeFileSync} from 'node:fs';
import {z} from 'zod';
import {dublinWeather, WeatherKey, WeatherLocation, weatherRefreshMs, type WeatherAction, type WeatherForecast, type WeatherStatus} from '../shared/companion-weather';
import {findWeatherCity, OpenWeatherError, readOpenWeather} from './openweather-api';

const StoredWeather = z.object({version:z.literal(1),key:WeatherKey,location:WeatherLocation}).strict();
type StoredWeather = z.infer<typeof StoredWeather>;
type Protection = {isEncryptionAvailable():boolean;encryptString(data:string):Buffer;decryptString(data:Buffer):string};
type Options = {allowed:()=>boolean; read?:typeof readOpenWeather; find?:typeof findWeatherCity; now?:()=>number};
type Configure = Extract<WeatherAction,{type:'configure'}>;

export class CompanionWeather {
  private settings?: StoredWeather;
  private forecast?: WeatherForecast;
  private error?: string;
  private retryAt = 0;
  private lastAttempt = 0;
  private pending?: {controller:AbortController; task:Promise<WeatherStatus>};
  private readonly now:()=>number;

  constructor(private readonly path:string, private readonly protection:Protection, private readonly options:Options) {
    this.now = options.now??Date.now;
    if (existsSync(path)) try {
      this.settings = StoredWeather.parse(JSON.parse(protection.decryptString(readFileSync(path))));
    } catch {
      this.error = 'No se pudo abrir la clave guardada. Puedes configurarla de nuevo.';
    }
  }

  status(): WeatherStatus {
    return {location:this.settings?.location??dublinWeather,configured:!!this.settings,forecast:this.forecast,error:this.error};
  }

  private save(settings:StoredWeather) {
    if (!this.protection.isEncryptionAvailable()) throw new OpenWeatherError(0,'El almacenamiento seguro de Windows no está disponible.');
    const temporary = `${this.path}.tmp`;
    try {
      writeFileSync(temporary,this.protection.encryptString(JSON.stringify(settings)),{mode:0o600});
      renameSync(temporary,this.path);
    } catch {
      throw new OpenWeatherError(0,'No se pudo guardar la configuración de Clima.');
    } finally {
      try { rmSync(temporary,{force:true}); } catch { /* The temporary file is encrypted. */ }
    }
    this.settings = settings;
  }

  private run(load: (signal:AbortSignal)=>Promise<{forecast:WeatherForecast; settings?:StoredWeather}>) {
    const controller = new AbortController();
    const task = (async () => {
      this.lastAttempt = this.now();
      try {
        const {forecast,settings} = await load(controller.signal);
        if (!controller.signal.aborted && this.options.allowed()) {
          if (settings) this.save(settings);
          this.forecast = forecast;
          this.error = undefined;
          this.retryAt = 0;
        }
      } catch (error) {
        if (!controller.signal.aborted && this.options.allowed()) {
          this.error = error instanceof OpenWeatherError ? error.message : 'No se pudo validar el pronóstico de OpenWeather.';
          this.retryAt = this.now()+(error instanceof OpenWeatherError&&error.status===429?weatherRefreshMs:2*60_000);
        }
      } finally {
        controller.abort();
        if (this.pending?.controller===controller) this.pending = undefined;
      }
      return this.status();
    })();
    this.pending = {controller,task};
    return task;
  }

  async refresh(force = false) {
    const settings = this.settings;
    if (!settings || !this.options.allowed()) return this.status();
    if (this.pending) return this.pending.task;
    const now = this.now();
    if (now<this.retryAt || now-this.lastAttempt<30_000 || (!force && this.forecast && now-this.forecast.updatedAt<weatherRefreshMs)) return this.status();
    return this.run(async signal => ({forecast:await (this.options.read??readOpenWeather)(settings.location,settings.key,signal,now)}));
  }

  async configure(action:Configure) {
    if (!this.options.allowed()) return this.status();
    if (this.pending) throw Error('Espera a que termine la actualización del clima.');
    const key = action.key??this.settings?.key;
    if (!key) throw Error('Introduce una clave de OpenWeather.');
    if (!action.key && !action.city) return this.status();
    const previous = this.settings?.location??dublinWeather;
    return this.run(async signal => {
      const location = action.city ? await (this.options.find??findWeatherCity)(action.city,key,signal) : previous;
      if (signal.aborted) throw new OpenWeatherError(0,'La vista de Clima se cerró.');
      const forecast = await (this.options.read??readOpenWeather)(location,key,signal,this.now());
      return {forecast,settings:{version:1,key,location}};
    });
  }

  cancel() {
    if (this.pending) {
      this.pending.controller.abort();
      this.pending = undefined;
      this.lastAttempt = 0;
    }
  }
}
