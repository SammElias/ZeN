import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {describe,expect,it,vi} from 'vitest';
import {CompanionWeather} from '../src/main/companion-weather';
import {OpenWeatherError,readOpenWeather} from '../src/main/openweather-api';
import {dublinWeather,isFreshWeather,weatherRefreshMs} from '../src/shared/companion-weather';

const key = 'f'.repeat(32);
const forecastRow = (time:string,temp:number,id=800,pop=0) => ({
  dt:Date.parse(time)/1000,main:{temp,temp_min:-40,temp_max:50},weather:[{id,description:'previsión',icon:'04d'}],pop,
});
const provider = (list:unknown[], timezone=0) => vi.fn(async (url:URL) =>
  Response.json(url.pathname.endsWith('/weather') ? {main:{temp:8.1},weather:[{id:804,description:'nubes',icon:'04d'}]}:
    {city:{timezone},list}));

describe('OpenWeather summary',()=>{
  it('uses future local forecast samples and the highest rain chance in the selected period',async()=>{
    const http=provider([
      forecastRow('2026-11-20T09:00:00Z',-10,501,1),forecastRow('2026-11-20T15:00:00Z',10,501,.74),
      forecastRow('2026-11-20T18:00:00Z',8,600,.9),forecastRow('2026-11-20T21:00:00Z',6,300,.37),
      forecastRow('2026-11-21T00:00:00Z',2,501,1),
    ]);
    const forecast=await readOpenWeather(dublinWeather,key,new AbortController().signal,Date.parse('2026-11-20T12:10:00Z'),http as unknown as typeof fetch);
    expect(forecast).toMatchObject({temperature:8,description:'nubes',period:'today',low:6,high:10,rain:true,rainChance:74});
    expect(http.mock.calls.map(([url])=>[url.hostname,url.pathname,url.searchParams.get('units')])).toEqual([
      ['api.openweathermap.org','/data/2.5/weather','metric'],['api.openweathermap.org','/data/2.5/forecast','metric'],
    ]);
  });

  it('switches to tomorrow using Dublin daylight saving and excludes snow from the rain probability',async()=>{
    const http=provider([
      forecastRow('2026-07-20T21:00:00Z',17,500,.5),forecastRow('2026-07-21T00:00:00Z',12,600,.8),
      forecastRow('2026-07-21T03:00:00Z',11),forecastRow('2026-07-21T12:00:00Z',19),
    ]);
    const result=await readOpenWeather(dublinWeather,key,new AbortController().signal,Date.parse('2026-07-20T22:40:00Z'),http as unknown as typeof fetch);
    expect(result).toMatchObject({period:'tomorrow',low:11,high:19,rain:false});
    expect(result.rainChance).toBeUndefined();
    expect(isFreshWeather(result,Date.parse('2026-07-20T23:00:00Z'))).toBe(false);
  });

  it('returns a sanitized authorization error and refuses redirects',async()=>{
    const http=vi.fn(async()=>new Response('private upstream body',{status:401}));
    await expect(readOpenWeather(dublinWeather,key,new AbortController().signal,Date.now(),http as typeof fetch))
      .rejects.toThrow('OpenWeather rechazó la clave.');
    expect(http.mock.calls).toHaveLength(2);
    expect(http).toHaveBeenCalledWith(expect.any(URL),expect.objectContaining({redirect:'error'}));
  });
});

describe('weather profile and privacy',()=>{
  it('stores the key only behind secure storage, reuses a fresh result and preserves it after a network error',async()=>{
    const folder=mkdtempSync(join(tmpdir(),'zen-weather-')),file=join(folder,'weather.bin');
    try {
      let now=Date.parse('2026-11-20T12:00:00Z');
      const protection={isEncryptionAvailable:()=>true,encryptString:(value:string)=>Buffer.from(Buffer.from(value).toString('base64')),
        decryptString:(value:Buffer)=>Buffer.from(value.toString(),'base64').toString()};
      const read=vi.fn(async()=>({temperature:10,description:'nubes',icon:'04d',low:5,high:12,rain:false,period:'today' as const,updatedAt:now}));
      const options={allowed:()=>true,read,now:()=>now};
      const weather=new CompanionWeather(file,protection,options);
      expect(await weather.refresh()).toMatchObject({configured:false,location:dublinWeather});
      const configured=await weather.configure({type:'configure',key});
      expect(JSON.stringify(configured)).not.toContain(key);
      expect(readFileSync(file).toString()).not.toContain(key);
      expect(await weather.refresh()).toEqual(configured);
      expect(read).toHaveBeenCalledTimes(1);
      now+=weatherRefreshMs+1;
      read.mockRejectedValueOnce(new OpenWeatherError(429,'Consultas limitadas'));
      const stale=await weather.refresh();
      expect(stale).toMatchObject({forecast:configured.forecast,error:'Consultas limitadas'});
      expect(await weather.refresh(true)).toEqual(stale);
      expect(read).toHaveBeenCalledTimes(2);
      expect(new CompanionWeather(file,protection,options).status()).toMatchObject({configured:true,location:dublinWeather,forecast:configured.forecast});
    } finally { rmSync(folder,{recursive:true,force:true}); }
  });

  it('cancels in-flight setup when Home is left and discards a late response',async()=>{
    const folder=mkdtempSync(join(tmpdir(),'zen-weather-cancel-'));
    try {
      let allowed=true, captured:AbortSignal|undefined;
      let resolve!:()=>void;
      const hold=new Promise<void>(done=>{resolve=done;});
      const encryptString=vi.fn(()=>Buffer.from('encrypted'));
      const weather=new CompanionWeather(join(folder,'weather.bin'),{isEncryptionAvailable:()=>true,encryptString,decryptString:()=>''},{
        allowed:()=>allowed,read:async(_location,_key,signal)=>{
          captured=signal;await hold;
          return {temperature:10,description:'nubes',icon:'04d',low:5,high:12,rain:false,period:'today',updatedAt:Date.now()};
        },
      });
      const pending=weather.configure({type:'configure',key});
      allowed=false;
      weather.cancel();
      resolve();
      expect(captured?.aborted).toBe(true);
      expect(await pending).toMatchObject({configured:false});
      expect(encryptString).not.toHaveBeenCalled();
    } finally { rmSync(folder,{recursive:true,force:true}); }
  });
});
