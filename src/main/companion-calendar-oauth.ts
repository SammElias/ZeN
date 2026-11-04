import {createServer,type Server} from 'node:http';
import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {readFileSync,writeFileSync,renameSync,unlinkSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {z} from 'zod';
import {GmailClientId} from '../shared/companion-gmail';
import {CALENDAR_SCOPES,type CalendarState} from '../shared/companion-calendar';
import {calendarNetworkFetch} from './companion-calendar-network';
import {googleNetworkFailure,type GoogleFetch} from './companion-google-network';

export type GoogleCipher={isEncryptionAvailable():boolean;encryptString(v:string):Buffer;decryptString(v:Buffer):string};
const Client=z.object({clientId:GmailClientId,clientSecret:z.string().min(8).max(1024).optional()}).strict();
type Client=z.infer<typeof Client>;
const Tokens=z.object({clientId:GmailClientId,access_token:z.string().min(1).max(8192),refresh_token:z.string().min(1).max(8192).optional(),expires:z.number().finite(),scopes:z.array(z.enum(CALENDAR_SCOPES)).length(2)}).strict();
type Tokens=z.infer<typeof Tokens>;
export type CalendarOAuthDeps={profile:string;cipher:GoogleCipher;allowed:()=>boolean;authAllowed:()=>boolean;open:(url:string)=>Promise<void>;fetch?:GoogleFetch;credentials?:()=>Client|undefined};
function desktopClient(profile:string,cipher:GoogleCipher):Client|undefined{
 try{
  const raw=readFileSync(join(profile,'gmail-client.json'));if(raw.length>16384)return;const clientId=GmailClientId.parse(JSON.parse(raw.toString('utf8')).clientId);
  const path=join(profile,'gmail-client-secret.bin');if(!existsSync(path))return{clientId};
  if(!cipher.isEncryptionAvailable())return{clientId};const encrypted=readFileSync(path);if(encrypted.length>65536)return{clientId};
  const saved=Client.parse(JSON.parse(cipher.decryptString(encrypted)));return saved.clientId===clientId?saved:{clientId};
 }catch{return;}
}
/** Error text is selected locally. Provider messages, bodies and URLs never escape this boundary. */
export class CalendarHttpError extends Error{constructor(message:string,readonly code:string){super(message);}}
const knownOAuth:Record<string,string>={invalid_grant:'La autorización caducó. Conecta de nuevo Calendar.',invalid_client:'Revisa las credenciales de Google en Gmail.',unauthorized_client:'El cliente de Google debe ser de tipo escritorio.',invalid_request:'Google rechazó la conexión. Revisa el JSON de escritorio en Gmail.',redirect_uri_mismatch:'Revisa el cliente de escritorio de Google.',access_denied:'Google no concedió acceso al calendario.',temporarily_unavailable:'Google no está disponible. Puedes intentarlo más tarde.'};
export async function calendarJson(response:Response,limit:number){
 if(!response.body)throw new CalendarHttpError('Google devolvió una respuesta vacía.','EMPTY_RESPONSE');
 const reader=response.body.getReader(),parts:Uint8Array[]=[];let bytes=0;
 try{for(;;){const {value,done}=await reader.read();if(done)break;bytes+=value.length;if(bytes>limit)throw new CalendarHttpError('La respuesta de Calendar es demasiado grande.','RESPONSE_TOO_LARGE');parts.push(value);}try{return JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{throw new CalendarHttpError('Google devolvió una respuesta no válida.','INVALID_RESPONSE');}}
 finally{await reader.cancel().catch(()=>{});}
}
/** Calendar owns its tokens. Gmail contributes only the existing Desktop client, never account tokens. */
export class CalendarOAuth{
 private accountRevision=0;private client?:Client;private tokens?:Tokens;private error?:string;private authEpoch=0;private readEpoch=0;private exchanging=false;private closed=false;
 private requests=new Map<AbortController,'auth'|'read'>();private refresh?:{epoch:number;promise:Promise<string>};
 private pending?:{server:Server;state:string;verifier:string;redirect:string;expires:number;timer:ReturnType<typeof setTimeout>;epoch:number};
 private receipt?:{server:Server;host:string;state:string;result:'working'|'success'|'error';timer:ReturnType<typeof setTimeout>};
 private fetcher:GoogleFetch;private path:string;
 constructor(private deps:CalendarOAuthDeps){
  this.path=join(deps.profile,'calendar-oauth.bin');this.fetcher=calendarNetworkFetch({fetch:deps.fetch??fetch});this.client=this.credentials();
  if(existsSync(this.path))try{if(!deps.cipher.isEncryptionAvailable())throw Error();const bytes=readFileSync(this.path);if(bytes.length>65536)throw Error();const tokens=Tokens.parse(JSON.parse(deps.cipher.decryptString(bytes)));if(tokens.clientId===this.client?.clientId&&CALENDAR_SCOPES.every(s=>tokens.scopes.includes(s)))this.tokens=tokens;}catch{this.error='Vuelve a conectar Calendar en este usuario de Windows.';}
 }
 private credentials(){try{return Client.parse(this.deps.credentials?this.deps.credentials():desktopClient(this.deps.profile,this.deps.cipher));}catch{return;}}
 private current(){const client=this.credentials();if(this.client?.clientId!==client?.clientId){this.suspend();this.tokens=undefined;this.accountRevision++;this.error=undefined;}this.client=client;return client;}
 identityRevision(){this.current();return this.accountRevision;}
 status():CalendarState{const client=this.current();return{configured:!!client,credentialsReady:!!client?.clientSecret,connected:!!this.tokens,authorizing:!!this.pending||this.exchanging,error:this.error};}
 private auth(){if(this.closed||!this.deps.authAllowed())throw Error('Conexión cancelada por pausa o presentación.');}
 private read(){this.current();if(this.closed||!this.deps.allowed())throw Error('Abre Calendario y desactiva la pausa o Presentación.');}
 private async http(url:string,init:RequestInit,limit:number,scope:'read'|'auth'){
  const abort=new AbortController(),signal=AbortSignal.any([abort.signal,AbortSignal.timeout(15000)]);this.requests.set(abort,scope);
  try{
   const response=await this.fetcher(url,{...init,signal});
   if(!response.ok){const body=await calendarJson(response,8192).catch(()=>undefined),oauth=typeof body?.error==='string'?body.error:undefined;
    if(oauth&&Object.hasOwn(knownOAuth,oauth)){if(scope==='read'&&oauth!=='temporarily_unavailable')this.error=knownOAuth[oauth];throw new CalendarHttpError(knownOAuth[oauth],oauth);}
    const reasons=[...(Array.isArray(body?.error?.errors)?body.error.errors.slice(0,5).map((e:any)=>e?.reason):[]),...(Array.isArray(body?.error?.details)?body.error.details.slice(0,5).map((e:any)=>e?.reason):[])];
    if(response.status===403&&reasons.some(r=>r==='accessNotConfigured'||r==='SERVICE_DISABLED'))throw new CalendarHttpError('Activa Google Calendar API en el proyecto de tu cliente de Google.','API_DISABLED');
    if(response.status===401)this.error='La sesión caducó. Vuelve a conectar Calendar.';
    throw new CalendarHttpError(response.status===401?'La sesión caducó. Vuelve a conectar Calendar.':response.status===403?'Google no concedió los permisos de lectura. Vuelve a conectar Calendar.':response.status===429?'Google ha limitado las consultas. Espera antes de actualizar.':'No se pudo consultar Calendar. Puedes volver a intentarlo.','HTTP_'+response.status);
   }
   return await calendarJson(response,limit);
  }catch(e){if(e instanceof CalendarHttpError)throw e;const diagnosis=googleNetworkFailure(e,signal);throw new CalendarHttpError(diagnosis.message,diagnosis.code);}
  finally{this.requests.delete(abort);}
 }
 suspendReads(){this.readEpoch++;for(const [abort,scope]of this.requests)if(scope==='read')abort.abort();}
 cancel(){this.authEpoch++;this.exchanging=false;const old=[this.pending,this.receipt];this.pending=undefined;this.receipt=undefined;for(const item of old)if(item){clearTimeout(item.timer);item.server.close();item.server.closeIdleConnections();}for(const [abort,scope]of this.requests)if(scope==='auth')abort.abort();}
 suspend(){this.suspendReads();this.cancel();}
 disconnect(){this.read();this.suspend();this.tokens=undefined;this.accountRevision++;this.error=undefined;try{unlinkSync(this.path);}catch{if(existsSync(this.path))throw Error('No se pudo retirar la conexión de Calendar de este PC.');}return this.status();}
 private save(tokens:Tokens){if(!this.deps.cipher.isEncryptionAvailable())throw Error();const bytes=this.deps.cipher.encryptString(JSON.stringify(tokens));writeFileSync(this.path+'.tmp',bytes);renameSync(this.path+'.tmp',this.path);}
 private granted(raw:unknown){const values=typeof raw==='string'?raw.split(' '):[...CALENDAR_SCOPES];if(!CALENDAR_SCOPES.every(s=>values.includes(s)))throw new CalendarHttpError('Google no concedió todos los permisos de lectura de Calendar.','SCOPES_MISSING');return[...CALENDAR_SCOPES];}
 async connect(){
  this.read();this.auth();const client=this.current();if(!client)throw Error('Configura primero el cliente de Google en Gmail.');if(!this.deps.cipher.isEncryptionAvailable())throw Error('Windows no ofrece almacenamiento seguro para esta conexión.');
  this.suspend();this.error=undefined;const epoch=this.authEpoch,state=randomBytes(32).toString('base64url'),verifier=randomBytes(48).toString('base64url');
  const page=(res:import('node:http').ServerResponse,result:'working'|'success'|'error',status=200)=>{res.writeHead(status,{'Content-Type':'text/html; charset=utf-8'});res.end('<!doctype html><html lang="es"><meta charset="utf-8"><title>ZEN · Calendar</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#101116;color:#eee9f8;font:16px system-ui}main{padding:30px;max-width:460px}p{color:#b5aec3}</style><main><h1>'+(result==='success'?'Calendario conectado':result==='working'?'Completando conexión':'No se completó la conexión')+'</h1><p>Vuelve a ZEN para continuar.</p></main></html>');};
  const server=createServer((req,res)=>{void(async()=>{
   res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
   const p=this.pending,r=this.receipt,owner=p?.server===server?{host:new URL(p.redirect).host}:r?.server===server?r:undefined;let u:URL;try{u=new URL(req.url??'','http://127.0.0.1');}catch{res.writeHead(400).end();return;}
   if(!owner||req.method!=='GET'||req.headers.host!==owner.host){res.writeHead(400).end();return;}
   if(u.pathname==='/favicon.ico'){res.writeHead(204).end();return;}
   if(r?.server===server){if(u.pathname==='/oauth2/complete'){page(res,r.result);return;}if(u.pathname==='/oauth2/callback'&&u.searchParams.get('state')===r.state){res.writeHead(303,{Location:'/oauth2/complete'}).end();return;}res.writeHead(400).end();return;}
   const supplied=u.searchParams.get('state')??'';
   if(!p||p.server!==server||u.pathname!=='/oauth2/callback'||u.searchParams.getAll('state').length!==1||Buffer.byteLength(supplied)!==Buffer.byteLength(p.state)||!timingSafeEqual(Buffer.from(supplied),Buffer.from(p.state))){res.writeHead(400).end();return;}
   if(Date.now()>p.expires){this.cancel();page(res,'error',410);return;}
   this.pending=undefined;clearTimeout(p.timer);const receipt={server,host:owner.host,state:p.state,result:'working' as 'working'|'success'|'error',timer:setTimeout(()=>{if(this.receipt?.server===server){this.receipt=undefined;server.close();server.closeIdleConnections();}},60000)};receipt.timer.unref();this.receipt=receipt;
   const code=u.searchParams.get('code');if(u.searchParams.has('error')||u.searchParams.getAll('code').length!==1||!code||code.length>4096){this.error='Google no concedió la conexión de Calendar.';receipt.result='error';res.writeHead(303,{Location:'/oauth2/complete'}).end();return;}
   this.exchanging=true;
   try{
    this.auth();if(epoch!==this.authEpoch||this.current()?.clientId!==client.clientId)throw Error();const t=await this.http('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:client.clientId,...(client.clientSecret?{client_secret:client.clientSecret}:{}),code,redirect_uri:p.redirect,grant_type:'authorization_code',code_verifier:p.verifier}).toString()},65536,'auth');
    this.auth();if(epoch!==this.authEpoch||this.current()?.clientId!==client.clientId)throw Error();const next=Tokens.parse({clientId:client.clientId,access_token:t.access_token,refresh_token:t.refresh_token,scopes:this.granted(t.scope),expires:Date.now()+Math.min(86400,Math.max(60,Number(t.expires_in)||3600))*1000});this.save(next);this.tokens=next;this.accountRevision++;this.error=undefined;receipt.result='success';
   }catch(e){receipt.result='error';if(epoch===this.authEpoch)this.error=e instanceof CalendarHttpError?e.message:'No se pudo completar y guardar la conexión de Calendar. Vuelve a conectar.';}
   finally{if(epoch===this.authEpoch)this.exchanging=false;}
   if(!res.destroyed){if(epoch!==this.authEpoch)page(res,'error',400);else res.writeHead(303,{Location:'/oauth2/complete'}).end();}
  })().catch(()=>{if(!res.headersSent)res.writeHead(400);if(!res.destroyed)res.end('Solicitud no válida.');});});
  server.maxConnections=8;server.headersTimeout=5000;server.requestTimeout=10000;await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  if(epoch!==this.authEpoch){server.close();throw Error('La conexión se canceló.');}
  const redirect='http://127.0.0.1:'+(server.address() as import('node:net').AddressInfo).port+'/oauth2/callback',timer=setTimeout(()=>{if(this.pending?.server===server){this.cancel();this.error='La conexión caducó. Puedes volver a intentarlo.';}},300000);timer.unref();this.pending={server,state,verifier,redirect,expires:Date.now()+300000,timer,epoch};
  const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');url.search=new URLSearchParams({client_id:client.clientId,redirect_uri:redirect,response_type:'code',scope:CALENDAR_SCOPES.join(' '),state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',access_type:'offline',prompt:'consent'}).toString();
  try{this.auth();await this.deps.open(url.href);}catch{this.cancel();throw Error('No se pudo abrir la conexión de Google.');}return this.status();
 }
 private async token(){
  this.read();if(this.pending||this.exchanging)throw Error('Completa primero la conexión de Google.');if(!this.tokens)throw Error('Conecta Calendar con Google.');
  if(this.tokens.expires>Date.now()+30000)return this.tokens.access_token;
  const epoch=this.readEpoch;if(this.refresh?.epoch===epoch)return this.refresh.promise;const saved=this.tokens,client=this.client;
  if(!saved.refresh_token||!client)throw Error('Vuelve a conectar Calendar.');
  const pending={epoch,promise:undefined! as Promise<string>};this.refresh=pending;pending.promise=(async()=>{try{
   const t=await this.http('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:client.clientId,...(client.clientSecret?{client_secret:client.clientSecret}:{}),refresh_token:saved.refresh_token!,grant_type:'refresh_token'}).toString()},65536,'read');
   this.read();if(epoch!==this.readEpoch||this.tokens!==saved)throw Error('La consulta se canceló.');const next=Tokens.parse({...saved,access_token:t.access_token,refresh_token:t.refresh_token??saved.refresh_token,scopes:t.scope===undefined?saved.scopes:this.granted(t.scope),expires:Date.now()+Math.min(86400,Math.max(60,Number(t.expires_in)||3600))*1000});this.save(next);this.tokens=next;return next.access_token;
  }catch(e){if(e instanceof CalendarHttpError)throw e;throw Error('No se pudo renovar y guardar la conexión de Calendar. Vuelve a conectar.');}finally{if(this.refresh===pending)this.refresh=undefined;}})();return pending.promise;
 }
 async get(path:string,limit:number){this.read();const epoch=this.readEpoch,token=await this.token();this.read();if(epoch!==this.readEpoch)throw Error('La consulta se canceló.');const value=await this.http('https://www.googleapis.com/calendar/v3/'+path,{headers:{Authorization:'Bearer '+token}},limit,'read');this.read();if(epoch!==this.readEpoch)throw Error('La consulta se canceló.');return value;}
 close(){this.closed=true;this.suspend();this.tokens=undefined;}
}
