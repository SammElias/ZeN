import {mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from 'node:http';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {emptyOuraCache,ouraLatest,ouraRedirect,ouraWeek,type OuraResource} from '../src/shared/companion-oura';
import {addCalendarDays} from '../src/shared/companion-calendar';
import {CompanionOura} from '../src/main/companion-oura';
import {mergeOuraRows,OuraHttpError} from '../src/main/oura-api';
import {authorizeOura} from '../src/main/oura-oauth';

const today='2026-11-20',prior='2026-11-19',root=()=>mkdtempSync(join(tmpdir(),'zen-oura-test-'));
const protection={isEncryptionAvailable:()=>true,encryptString:(value:string)=>Buffer.from(Buffer.from(value).toString('base64')),decryptString:(value:Buffer)=>Buffer.from(value.toString(),'base64').toString()};
const disposals:(()=>void)[]=[];
afterEach(()=>{for(const dispose of disposals.splice(0).reverse())dispose();vi.restoreAllMocks();vi.useRealTimers();});

function fixture(){
 const directory=root(),path=join(directory,'oura.bin');
 disposals.push(()=>rmSync(directory,{recursive:true,force:true}));
 const auth=vi.fn(approveTestOura);
 let synced=false,failure=0,allowed=true;
 const read=vi.fn(async(resource:OuraResource)=>{
  if(failure===503)throw Error('synthetic network failure');
  if(failure)throw new OuraHttpError(failure,Date.now()+900_000);
  return fixtureOuraRows(resource,today,prior,synced);
 });
 const create=()=>{
  const service=new CompanionOura(path,protection,{authorize:auth,read,zone:()=> 'Europe/Madrid',changed:()=>{},allowed:()=>allowed});
  disposals.push(()=>service.close());return service;
 };
 return {path,create,auth,read,sync:()=>{synced=true;},failure:(status:number)=>{failure=status;},allow:(mode:boolean)=>{allowed=mode;}};
}

describe('Oura morning metrics',()=>{
 it('remembers the submitted Client ID on a new launch after cancellation or failure',async()=>{
  const f=fixture(),service=f.create();
  f.auth.mockImplementationOnce((_id,signal)=>new Promise((_,reject)=>{
   signal.addEventListener('abort',()=>reject(new Error('cancelled')),{once:true});
  }));
  const pending=service.connect('fixture-client');
  expect(f.create().snapshot()).toMatchObject({state:'disconnected',clientId:'fixture-client'});
  service.cancel();await pending;
  const next=f.create();
  f.auth.mockRejectedValueOnce(new Error('no consent'));
  await next.connect('updated-client');next.close();
  expect(f.create().snapshot()).toMatchObject({state:'disconnected',clientId:'updated-client'});
  expect(f.read).not.toHaveBeenCalled();
 });
 it('recognizes a saved expired session from profiles without the explicit flag',()=>{
  const f=fixture();
  writeFileSync(f.path,protection.encryptString(JSON.stringify({version:1,clientId:'fixture-client',mode:'icon',cache:emptyOuraCache()})));
  expect(f.create().snapshot()).toMatchObject({state:'expired',clientId:'fixture-client'});
 });
 it('restores cached night at startup, retains a separate activity day and polls until the new main sleep arrives once',async()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date(today+'T07:30:00+01:00'));
  const f=fixture(),evening=f.create();await evening.connect('fixture-client');await evening.refresh();evening.setCapsule('sleep');evening.close();
  const morning=f.create();
  expect(morning.homeSleep()).toEqual({state:'connected',today,latest:{day:prior,seconds:25_200,score:81}});
  expect(ouraLatest(morning.snapshot().cache,'sleep',today)).toEqual({day:prior,seconds:25_200,score:81});
  expect(ouraLatest(morning.snapshot().cache,'activity',today)).toEqual({day:today,steps:920,score:76});
  expect(morning.glance()).toEqual({day:prior,seconds:25_200,current:false});
  expect(readFileSync(f.path,'utf8')).not.toContain('fixture-token');
  morning.wake();const joined=morning.refresh();expect(morning.refresh()).toBe(joined);await joined;
  f.read.mockClear();f.sync();await vi.advanceTimersByTimeAsync(300_000);
  const status=morning.snapshot();
  expect(f.read.mock.calls.map(([resource])=>resource)).toEqual(['daily_sleep','sleep']);
  expect(morning.glance()).toEqual({day:today,seconds:27_120,current:true});
  expect(morning.homeSleep()).toEqual({state:'connected',today,latest:{day:today,seconds:27_120,score:90}});
  const week=ouraWeek(status.cache,'sleep',today);
  expect(week).toHaveLength(7);expect(week.filter(row=>row.day===today)).toEqual([{day:today,seconds:27_120,score:90}]);
  expect(week[0].seconds).toBeUndefined();
  await vi.advanceTimersByTimeAsync(3600_000);expect(f.read).toHaveBeenCalledTimes(2);
 });
 it('retains dates and last correct check on temporary failures, respects rate limits and clears measurements on 401',async()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date(today+'T07:30:00+01:00'));
  const f=fixture(),service=f.create();await service.connect('fixture-client');await service.refresh();
  const cache=service.snapshot().cache;
  f.failure(503);await service.refresh();expect(service.snapshot()).toMatchObject({cache,error:expect.stringContaining('últimos datos')});
  f.failure(429);f.read.mockClear();await service.refresh();expect(f.read).toHaveBeenCalledTimes(1);
  await service.refresh();await vi.advanceTimersByTimeAsync(300_000);expect(f.read).toHaveBeenCalledTimes(1);
  f.failure(401);await vi.advanceTimersByTimeAsync(900_000);
  expect(service.snapshot()).toMatchObject({state:'expired',cache:emptyOuraCache()});
  expect(JSON.stringify(service.snapshot())).not.toContain('fixture-token');
  const stored=JSON.parse(protection.decryptString(readFileSync(f.path)));
  expect(stored.cache).toEqual(emptyOuraCache());expect(stored.token).toBeUndefined();
  service.disconnect();
  expect(f.create().snapshot()).toMatchObject({state:'disconnected',clientId:'fixture-client',cache:emptyOuraCache()});
  expect(service.homeSleep()).toEqual({state:'disconnected'});
  expect(JSON.parse(protection.decryptString(readFileSync(f.path))).token).toBeUndefined();
 });
 it('does not restore a revocable account cache after a different account connects',async()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date(today+'T07:30:00+01:00'));
  const f=fixture(),service=f.create();await service.connect('fixture-client');await service.refresh();
  expect(service.snapshot().cache.sleep[prior]).toBeDefined();
  f.failure(403);await service.refresh();expect(service.snapshot()).toMatchObject({state:'expired',cache:emptyOuraCache()});
  f.read.mockReset().mockResolvedValue([]);await service.connect('fixture-client');await service.refresh();
  expect(service.snapshot().cache.sleep).toEqual({});
  f.allow(false);service.policyChanged();f.read.mockClear();await vi.advanceTimersByTimeAsync(3600_000);expect(f.read).not.toHaveBeenCalled();
 });
 it('removes the saved token and capsule measurement when the session expires',async()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date(today+'T07:30:00+01:00'));
  const f=fixture(),service=f.create();
  f.auth.mockResolvedValueOnce({accessToken:'fixture-token',expiresAt:Date.now()+500});
  await service.connect('fixture-client');await service.refresh();service.setCapsule('sleep');
  expect(service.glance()?.seconds).toBe(25_200);
  await vi.advanceTimersByTimeAsync(500);
  expect(service.glance()).toBeUndefined();
  expect(service.homeSleep()).toEqual({state:'expired'});
  expect(f.create().snapshot()).toMatchObject({state:'expired',cache:emptyOuraCache()});
  expect(JSON.parse(protection.decryptString(readFileSync(f.path))).token).toBeUndefined();
 });
 it('ignores naps and merges partial same-day activity without losing a known score or zero steps',()=>{
  const cache=emptyOuraCache();
  mergeOuraRows(cache,'sleep',fixtureOuraRows('sleep',today,prior,true),prior,today);
  expect(cache.sleep).toEqual({[prior]:25_200,[today]:27_120});
  mergeOuraRows(cache,'daily_activity',[{day:today,steps:5,score:79},{day:today,steps:0,score:null}],prior,today);
  expect(cache.daily_activity[today]).toEqual({steps:0,score:79});
 });
});

function mockDailyCheck(status:number){
 const send=globalThis.fetch;
 let cancelled=false;
 const check=vi.fn(async(_url:URL,_init?:RequestInit)=>{
  const body=new ReadableStream({cancel(){cancelled=true;}});
  return new Response(body,{status});
 });
 vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{
  const url=new URL(input instanceof Request?input.url:input);
  if(url.origin==='https://api.ouraring.com')return check(url,init);
  if(url.origin===new URL(ouraRedirect).origin)return send(input,init);
  throw Error('Unexpected network destination');
 });
 return {check,cancelled:()=>cancelled};
}

it.each(['daily',undefined,'','unrecognized-scope-format'])('accepts a validated Daily callback on loopback with scope %s',async scope=>{
 const abort=new AbortController();disposals.push(()=>abort.abort());
 const provider=mockDailyCheck(200);
 const origin=new URL(ouraRedirect).origin;
 const open=async(href:string)=>{
  const query=new URL(href);
  expect(query.origin).toBe('https://cloud.ouraring.com');
  expect(query.searchParams.get('response_type')).toBe('token');
  expect(query.searchParams.get('scope')).toBe('daily');
  expect(query.searchParams.get('redirect_uri')).toBe(ouraRedirect);
  expect(query.searchParams.has('client_secret')).toBe(false);
  const page=await fetch(ouraRedirect);
  expect(page.headers.get('cache-control')).toBe('no-store');
  expect(await page.text()).toContain('history.replaceState');
  const post=(state:string,requestOrigin=origin)=>{
   const body=new URLSearchParams({state,access_token:'local-fixture-token',token_type:'bearer',expires_in:'1800'});
   if(scope!==undefined)body.set('scope',scope);
   return fetch(ouraRedirect,{method:'POST',headers:{Origin:requestOrigin},body});
  };
  const state=query.searchParams.get('state')!;
  expect((await post(state,'https://unrelated.example')).status).toBe(403);
  expect((await post('invalid')).status).toBe(400);
  expect((await post(state)).status).toBe(200);
 };
 const auth=vi.fn(open);
 await expect(authorizeOura('fixture-client',auth,abort.signal)).resolves.toMatchObject({accessToken:'local-fixture-token'});
 expect(provider.check).toHaveBeenCalledTimes(scope==='daily'?0:1);
 if(scope!=='daily'){
  const [[url,init]]=provider.check.mock.calls;
  expect(url.pathname).toBe('/v2/usercollection/daily_sleep');
  expect(url.searchParams.get('fields')).toBe('day');
  expect(url.searchParams.get('end_date')).toBe(addCalendarDays(url.searchParams.get('start_date')!,1));
  expect(init).toMatchObject({redirect:'error',headers:{Authorization:'Bearer local-fixture-token'}});
  expect(provider.cancelled()).toBe(true);
 }
 await expect(fetch(ouraRedirect)).rejects.toThrow();
});

it.each([
 [{error:'access_denied'},'Oura no concedió el acceso.'],
 [{error:'invalid_scope'},'Oura rechazó el permiso de métricas diarias solicitado.'],
 [{error:'unauthorized_client'},'Oura rechazó la aplicación.'],
 [{error:'unsupported_response_type'},'Oura no admite la conexión directa de ZEN'],
 [{access_token:'',code:'synthetic-private-code'},'Oura devolvió un código de autorización'],
 [{access_token:''},'Oura no devolvió un token de acceso válido.'],
 [{token_type:'unknown'},'Oura no indicó un tipo de token compatible'],
 [{expires_in:'0'},'Oura no indicó una duración válida'],
 [{error:'synthetic-private-error'},'Oura rechazó la solicitud de autorización.'],
])('shows a safe, specific error in the browser and to ZEN for %o',async (override,message)=>{
 const abort=new AbortController();disposals.push(()=>abort.abort());
 const provider=mockDailyCheck(200);
 let browserMessage:Promise<string>|undefined;
 const open=async(href:string)=>{
  const state=new URL(href).searchParams.get('state')!;
  const form=new URLSearchParams({state,access_token:'local-fixture-token',token_type:'bearer',scope:'daily',expires_in:'1800'});
  for(const [key,value] of Object.entries(override))form.set(key,value);
  form.set('error_description','synthetic-private-description');
  browserMessage=fetch(ouraRedirect,{method:'POST',headers:{Origin:new URL(ouraRedirect).origin},body:form}).then(response=>{
   expect(response.status).toBe(400);
   return response.text();
  });
 };
 const result=await authorizeOura('fixture-client',open,abort.signal).catch((error:Error)=>error);
 expect(result).toBeInstanceOf(Error);
 expect((result as Error).message).toContain(message);
 expect(await browserMessage).toBe((result as Error).message);
 expect((result as Error).message).not.toMatch(/synthetic-private|local-fixture-token/);
 expect(provider.check).not.toHaveBeenCalled();
});

it.each([
 [401,'Oura rechazó la sesión de acceso.'],
 [403,'La API de Oura denegó la lectura de métricas diarias.'],
 [429,'Oura limitó las consultas al comprobar el permiso diario.'],
 [503,'No se pudo confirmar el permiso diario con Oura.'],
])('fails closed and shows the reason when the access check returns %s',async(status,message)=>{
 const abort=new AbortController();disposals.push(()=>abort.abort());
 const provider=mockDailyCheck(status);
 let resultInBrowser:Promise<Response>|undefined;
 const open=async(href:string)=>{
  const state=new URL(href).searchParams.get('state')!;
  resultInBrowser=fetch(ouraRedirect,{method:'POST',headers:{Origin:new URL(ouraRedirect).origin},body:new URLSearchParams({
   state,access_token:'local-fixture-token',token_type:'bearer',scope:'',expires_in:'1800',
  })});
 };
 await expect(authorizeOura('fixture-client',open,abort.signal)).rejects.toThrow(message);
 const response=await resultInBrowser;
 expect(response?.status).toBe(400);
 expect(await response?.text()).toContain(message);
 expect(provider.check).toHaveBeenCalledOnce();
 expect(provider.cancelled()).toBe(true);
});

it('allows only one access check and aborts it when the attempt is cancelled',async()=>{
 const abort=new AbortController();disposals.push(()=>abort.abort());
 const provider=mockDailyCheck(200);
 let accessSignal:AbortSignal|null|undefined;
 let beginCheck!:()=>void;
 const checking=new Promise<void>(resolve=>{beginCheck=resolve;});
 provider.check.mockImplementationOnce(async(_url,init)=>{
  accessSignal=init?.signal;
  beginCheck();
  return new Promise((_resolve,reject)=>accessSignal?.addEventListener('abort',()=>reject(accessSignal?.reason),{once:true}));
 });
 const browser=new AbortController();disposals.push(()=>browser.abort());
 let duplicate:Promise<Response>|undefined;
 const open=async(href:string)=>{
  const state=new URL(href).searchParams.get('state')!;
  const post=()=>fetch(ouraRedirect,{method:'POST',signal:browser.signal,headers:{Origin:new URL(ouraRedirect).origin},body:new URLSearchParams({
   state,access_token:'local-fixture-token',token_type:'bearer',scope:'',expires_in:'1800',
  })});
  void post().catch(()=>{});
  await checking;
  duplicate=post();
  expect((await duplicate).status).toBe(409);
  abort.abort();browser.abort();
 };
 await expect(authorizeOura('fixture-client',open,abort.signal)).rejects.toThrow('cancelada');
 expect(provider.check).toHaveBeenCalledOnce();
 expect(accessSignal?.aborted).toBe(true);
});

it('never releases an authorization URL if another process owns the IPv6 callback',async()=>{
 const browser=vi.fn(async()=>{}),occupied=createServer();
 try{
  await new Promise<void>((resolve,reject)=>{
   occupied.once('error',reject);
   occupied.listen({host:'::1',port:Number(new URL(ouraRedirect).port)},resolve);
  });
  await expect(authorizeOura('fixture-client',browser,new AbortController().signal)).rejects.toThrow('puerto local');
  expect(browser).not.toHaveBeenCalled();
 }finally{occupied.close();}
});

async function approveTestOura(_clientId:string,_signal:AbortSignal){return {accessToken:'fixture-token',expiresAt:Date.now()+86400_000};}

function fixtureOuraRows(resource:OuraResource,today:string,prior:string,synced:boolean){
 const night=(day:string,total_sleep_duration:number,type:string)=>({day,total_sleep_duration,type,bedtime_end:day+'T07:30:00+01:00'});
 if(resource==='sleep')return [night(prior,25_200,'long_sleep'),night(today,1600,'late_nap'),...(synced?[night(today,27_120,'long_sleep'),night(today,24000,'long_sleep')]:[])];
 if(resource==='daily_sleep')return [{day:prior,score:81},...(synced?[{day:today,score:90}]:[])];
 if(resource==='daily_readiness')return [{day:today,score:84}];
 return [{day:today,steps:920,score:76}];
}
