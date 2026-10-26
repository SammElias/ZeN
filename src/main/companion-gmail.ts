import {createServer,type Server} from 'node:http';
import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {readFileSync,writeFileSync,renameSync,unlinkSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {z} from 'zod';
import {GmailClientId,GmailQuery,GMAIL_THREAD_METADATA_FIELDS,GMAIL_THREAD_FULL_FIELDS,type GmailState,type GmailSummary,type GmailItem,type GmailMessage,type GmailThreadMessage,type GmailList,type GmailTrashReview} from '../shared/companion-gmail';
import {prepareMailHtml,mailMime,mailAttachment,type MailHtmlView} from './companion-mail-html';
import {mailDocument} from './companion-mail-document';
import {fetchMailImage,mailWebUrl} from './companion-mail-images';
import type {GmailImageResult} from '../shared/companion-gmail';
import {googleNetworkFailure,type GoogleFetch} from './companion-google-network';
const SCOPE='https://www.googleapis.com/auth/gmail.readonly',MODIFY_SCOPE='https://www.googleapis.com/auth/gmail.modify';
const grantedScopes=(raw:string)=>[...new Set(raw.split(' ').filter(s=>s===SCOPE||s===MODIFY_SCOPE))];
const Tokens=z.object({access_token:z.string().max(8192).optional(),refresh_token:z.string().max(8192).optional(),expires:z.number().optional(),scopes:z.array(z.enum([SCOPE,MODIFY_SCOPE])).max(2).optional()}).strict();
const ClientCredentials=z.object({clientId:GmailClientId,clientSecret:z.string().min(8).max(1024)}).strict();
const DesktopClient=z.object({installed:z.object({client_id:GmailClientId,client_secret:z.string().min(8).max(1024)})}).strict();
const PAGE_SIZE=20,MAX_PAGES=5,MAX_THREAD_MESSAGES=100,MAX_MESSAGE_TEXT=200000,MAX_THREAD_TEXT=1000000;
const validId=(id:unknown):id is string=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(id);
const clean=(s:unknown,n:number)=>String(s??'').replace(/[\x00-\x08\x0b-\x1f]/g,'').slice(0,n);
const header=(v:any,name:string)=>clean((Array.isArray(v.payload?.headers)?v.payload.headers:[]).find((x:any)=>String(x?.name).toLowerCase()===name)?.value,1000);
const messageDate=(v:any)=>{const internal=Number(v.internalDate);if(Number.isSafeInteger(internal)&&internal>0&&internal<=8640000000000000)return internal;return Date.parse(header(v,'date'))||0;};

/** HTML is converted to inert text and is never sent to a browser parser or renderer. */
function htmlText(value:string){
 const entities:Record<string,string>={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};
 return value.replace(/<!--[\s\S]*?(?:-->|$)/g,'').replace(/<(script|style|head|template|noscript)\b[^<>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi,'').replace(/<\s*(?:br\b[^<>]*|\/(?:p|div|li|tr|h[1-6]|blockquote|pre)\s*)>/gi,'\n').replace(/<[^<>]*>/g,'').replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,(all,entity:string)=>{if(entity[0]!=='#')return entities[entity.toLowerCase()]??all;const n=entity[1].toLowerCase()==='x'?parseInt(entity.slice(2),16):Number(entity.slice(1));return Number.isInteger(n)&&n>0&&n<=0x10ffff&&!(n>=0xd800&&n<=0xdfff)?String.fromCodePoint(n):'\ufffd';});
}

/** Keep complete MIME text parts; limits omit a body with an explicit explanation. */
function messageText(payload:any):{text:string;truncated:boolean}{
 let visited=0;
 const visit=(p:any,depth:number):{text:string;truncated:boolean;plain:boolean}=>{
  if(!p||typeof p!=='object'||mailAttachment(p))return{text:'',truncated:false,plain:false};
  if(depth>12||++visited>400)return{text:'',truncated:true,plain:false};
  if(mailMime(p)==='text/plain'||mailMime(p)==='text/html'){
   if(typeof p.body?.data!=='string')return{text:'',truncated:!!p.body?.attachmentId,plain:mailMime(p)==='text/plain'};
   const data=p.body.data;
   if(data.length>1200000||!/^[-_A-Za-z0-9]*={0,2}$/.test(data))return{text:'',truncated:true,plain:mailMime(p)==='text/plain'};
   let decoded:string;try{const charset=/charset\s*=\s*["']?([^\s;"']+)/i.exec(header({payload:p},'content-type'))?.[1]??'utf-8';decoded=new TextDecoder(charset).decode(Buffer.from(data,'base64url'));}catch{return{text:'',truncated:true,plain:mailMime(p)==='text/plain'};}
   const text=clean(mailMime(p)==='text/html'?htmlText(decoded):decoded,MAX_MESSAGE_TEXT+1);
   return{text:text.length<=MAX_MESSAGE_TEXT?text:'',truncated:text.length>MAX_MESSAGE_TEXT,plain:mailMime(p)==='text/plain'};
  }
  const children=Array.isArray(p.parts)?p.parts:[],results=[];let truncated=false;
  for(const child of children){if(visited>=400){truncated=true;break;}results.push(visit(child,depth+1));}
  if(mailMime(p)==='multipart/alternative'){
   const best=results.find(x=>x.plain&&x.text&&!x.truncated)??results.find(x=>x.text&&!x.truncated)??results.find(x=>x.plain)??results[0];
   return best?{...best,truncated:truncated||best.truncated}:{text:'',truncated,plain:false};
  }
  const text=results.map(x=>x.text).filter(Boolean).join('\n\n');
  return{text:text.length<=MAX_MESSAGE_TEXT?text:'',truncated:truncated||text.length>MAX_MESSAGE_TEXT||results.some(x=>x.truncated),plain:results.some(x=>x.plain)};
 };
 const result=visit(payload,0);
 return{text:result.text||(result.truncated?'El texto de este mensaje no está disponible dentro del límite de lectura. Ábrelo en Gmail para verlo completo.':'Este mensaje no contiene texto disponible. Ábrelo en Gmail para ver su formato original o sus adjuntos.'),truncated:result.truncated};
}
type Cipher={isEncryptionAvailable():boolean;encryptString(v:string):Buffer;decryptString(v:Buffer):string};
type ReadPurpose='mail'|'summary';
type Deps={profile:string;cipher:Cipher;allowed:()=>boolean;summaryAllowed?:()=>boolean;authAllowed?:()=>boolean;invalidateAnalysis?:()=>void;open:(url:string)=>Promise<void>;fetch?:GoogleFetch;imageFetch?:(url:string,signal:AbortSignal)=>Promise<string>};
class GmailHttpError extends Error{constructor(message:string,readonly diagnosis:{kind:string;code:string;httpStatus?:number}){super(message);}}
async function jsonBody(r:Response,limit:number){
 if(!r.body)throw new GmailHttpError('Google devolvió una respuesta vacía.',{kind:'RESPONSE',code:'EMPTY_RESPONSE'});
 const reader=r.body.getReader();let total=0;const parts:Uint8Array[]=[];
 for(;;){const {value,done}=await reader.read();if(done)break;total+=value.length;if(total>limit){await reader.cancel();throw new GmailHttpError('La respuesta supera el tamaño permitido.',{kind:'RESPONSE',code:'RESPONSE_TOO_LARGE'});}parts.push(value);}
 try{return JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{throw new GmailHttpError('Google devolvió una respuesta no válida.',{kind:'RESPONSE',code:'INVALID_RESPONSE'});}
}
export class CompanionGmail{
 private client?:string;private clientSecret?:string;private tokens:z.infer<typeof Tokens>={};private error?:string;private generation=0;private authGeneration=0;private exchanging=false;private refresh?:{generation:number;purpose:ReadPurpose;promise:Promise<string>};private ids=new Set<string>();private pages=new Set<string>();private activeQuery?:string;private pageCount=0;private listRevision=0;private requests=new Map<AbortController,'read'|'auth'>();
 private htmlViews=new Map<string,MailHtmlView>();private imageRequests=new Set<AbortController>();private imageCancels=new Map<string,AbortController>();private imageFlight?:object;
 private items=new Map<string,GmailItem>();private trashReview?:{value:GmailTrashReview;generation:number};private trashPending=false;
 private readerKey=randomBytes(16).toString('hex');
 private analysisSource?:{version:string;thread:GmailMessage};private messageRevision=0;
 private pending?:{scope:string;server:Server;timer:ReturnType<typeof setTimeout>;state:string;verifier:string;redirect:string;generation:number;expiresAt:number};
 private receipt?:{server:Server;host:string;state:string;result:'working'|'success'|'error';timer:ReturnType<typeof setTimeout>};
 constructor(private deps:Deps){try{this.client=GmailClientId.parse(JSON.parse(readFileSync(join(deps.profile,'gmail-client.json'),'utf8')).clientId);}catch{}if(existsSync(join(deps.profile,'gmail-client-secret.bin')))try{if(!deps.cipher.isEncryptionAvailable())throw Error();const v=ClientCredentials.parse(JSON.parse(deps.cipher.decryptString(readFileSync(join(deps.profile,'gmail-client-secret.bin')))));if(v.clientId===this.client)this.clientSecret=v.clientSecret;}catch{this.error='Importa de nuevo el JSON de escritorio de Google en este usuario de Windows.';}if(existsSync(join(deps.profile,'gmail-oauth.bin')))try{if(deps.cipher.isEncryptionAvailable())this.tokens=Tokens.parse(JSON.parse(deps.cipher.decryptString(readFileSync(join(deps.profile,'gmail-oauth.bin')))));}catch{this.error='Vuelve a conectar Gmail en este usuario de Windows.';}}
 status():GmailState{return{readerKey:this.tokens.refresh_token||this.tokens.access_token?this.readerKey:undefined,configured:!!this.client,connected:!!(this.tokens.refresh_token||this.tokens.access_token),authorizing:!!this.pending||this.exchanging,clientCredentialsReady:!!this.clientSecret,canTrash:!!(this.tokens.refresh_token||this.tokens.access_token)&&this.tokens.scopes?.includes(MODIFY_SCOPE)===true,error:this.error};}
 private checkAuth(){if(!(this.deps.authAllowed??this.deps.allowed)())throw Error('La conexión se canceló por pausa o presentación.');}
 private check(purpose:ReadPurpose='mail'){if(purpose==='summary'?!this.deps.summaryAllowed?.():!this.deps.allowed())throw Error(purpose==='summary'?'Abre Inicio y desactiva Presentación o pausa para consultar el recuento de Gmail.':'Abre Gmail y desactiva Presentación o pausa para continuar.');}
 configure(raw:string){this.check();const id=GmailClientId.parse(raw);this.readerKey=randomBytes(16).toString('hex');this.suspend();if(id!==this.client){this.clientSecret=undefined;try{unlinkSync(join(this.deps.profile,'gmail-client-secret.bin'));}catch{}}this.client=id;writeFileSync(join(this.deps.profile,'gmail-client.json'),JSON.stringify({clientId:this.client}));this.tokens={};try{unlinkSync(join(this.deps.profile,'gmail-oauth.bin'));}catch{}this.error=undefined;return this.status();}
 importClientJson(raw:string){
  this.check();let parsed:unknown;try{if(Buffer.byteLength(raw)>16384)throw Error();parsed=JSON.parse(raw);}catch{throw Error('Selecciona un JSON de credenciales de Google válido, de hasta 16 KB.');}
  const result=DesktopClient.safeParse(parsed);if(!result.success)throw Error('El JSON debe ser de una aplicación de escritorio y contener su Client ID y client_secret.');
  const {client_id:clientId,client_secret:clientSecret}=result.data.installed;
  if(!this.deps.cipher.isEncryptionAvailable())throw Error('Windows no ofrece almacenamiento seguro para esta conexión.');
  let encrypted:Buffer;try{encrypted=this.deps.cipher.encryptString(JSON.stringify({clientId,clientSecret}));}catch{throw Error('No se pudieron proteger las credenciales de Google en este PC.');}
  this.suspend();const path=join(this.deps.profile,'gmail-client-secret.bin');
  try{writeFileSync(path+'.tmp',encrypted);renameSync(path+'.tmp',path);if(this.client!==clientId)writeFileSync(join(this.deps.profile,'gmail-client.json'),JSON.stringify({clientId}));}catch{throw Error('No se pudieron guardar las credenciales de Google en este PC.');}
  if(this.client!==clientId){this.readerKey=randomBytes(16).toString('hex');this.tokens={};try{unlinkSync(join(this.deps.profile,'gmail-oauth.bin'));}catch{}}
  this.client=clientId;this.clientSecret=clientSecret;this.error=undefined;return this.status();
 }
 private save(){if(!this.deps.cipher.isEncryptionAvailable())throw Error('Windows no ofrece almacenamiento seguro para esta conexión.');const p=join(this.deps.profile,'gmail-oauth.bin');writeFileSync(p+'.tmp',this.deps.cipher.encryptString(JSON.stringify(this.tokens)));renameSync(p+'.tmp',p);}
 private clientParameters(){return{client_id:this.client!,...(this.clientSecret?{client_secret:this.clientSecret}:{})};}
 private async http(url:string,init:RequestInit={},limit=1500000,scope:'read'|'auth'='read'){
  const c=new AbortController(),signal=AbortSignal.any([c.signal,AbortSignal.timeout(15000)]);this.requests.set(c,scope);
  try{
   const r=await(this.deps.fetch??fetch)(url,{...init,credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',redirect:'error',signal});
   if(!r.ok){
    const body=await jsonBody(r,8192).catch(()=>undefined),oauth=typeof body?.error==='string'?body.error:undefined;
    const messages:Record<string,string>={invalid_grant:'La autorización de Google caducó o ya se utilizó. Inicia una conexión nueva desde ZEN.',invalid_client:'Google rechazó el cliente OAuth. Revisa el Client ID de escritorio.',unauthorized_client:'Google no permite este cliente OAuth. Revisa su configuración de escritorio.',invalid_request:'Google rechazó los parámetros de conexión. Revisa la configuración del cliente OAuth.',redirect_uri_mismatch:'El retorno no coincide con el cliente de escritorio de Google.',access_denied:'Google no concedió el acceso de lectura a Gmail.',temporarily_unavailable:'Google no está disponible temporalmente. Inicia una conexión nueva más tarde.'};
    const missingSecret=oauth==='invalid_request'&&typeof body?.error_description==='string'&&/^(?:client_secret is missing\.?|Missing required parameter: client_secret)$/i.test(body.error_description.trim());
    const code=missingSecret?'CLIENT_SECRET_MISSING':oauth&&Object.hasOwn(messages,oauth)?oauth:'HTTP_'+r.status;
    const message=missingSecret?'Este cliente de Google requiere client_secret. Importa el JSON de la aplicación de escritorio en Configuración de Google.':oauth&&Object.hasOwn(messages,oauth)?messages[oauth]:r.status===401?'La sesión de Google caducó. Vuelve a conectar Gmail.':r.status===403?'Google no permite leer Gmail. Revisa la API habilitada y los permisos de tu cuenta.':r.status===429?'Google ha limitado temporalmente las consultas. Inténtalo más tarde.':'Google no pudo completar la conexión o la consulta.';
    throw new GmailHttpError(message+' ['+code+']',{kind:'HTTP',code,httpStatus:r.status});
   }
   return await jsonBody(r,limit);
  }catch(e){
   const failure=e instanceof GmailHttpError?e:new GmailHttpError('',googleNetworkFailure(e,signal));
   if(!(e instanceof GmailHttpError)){const d=googleNetworkFailure(e,signal);failure.message=d.message+(scope==='auth'?' Inicia una conexión nueva desde ZEN.':' Vuelve a actualizar Gmail.')+' ['+d.code+']';}
   try{writeFileSync(join(this.deps.profile,'gmail-network-diagnostic.json'),JSON.stringify({at:new Date().toISOString(),phase:url.endsWith('/token')?scope==='auth'?'authorization':'refresh':'mailbox',...failure.diagnosis}));}catch{/* Diagnostics must not replace the original error. */}
   throw failure;
  }finally{this.requests.delete(c);}
 }
 cancelAuth(){this.authGeneration++;const p=this.pending,r=this.receipt;this.pending=undefined;this.receipt=undefined;this.exchanging=false;for(const item of [p,r])if(item){clearTimeout(item.timer);item.server.close();item.server.closeIdleConnections();}for(const [c,scope]of this.requests)if(scope==='auth')c.abort();}
 private clearRich(){this.messageRevision++;this.analysisSource=undefined;this.deps.invalidateAnalysis?.();for(const c of this.imageRequests)c.abort();this.imageRequests.clear();this.imageCancels.clear();this.imageFlight=undefined;this.htmlViews.clear();}
 closeMessage(){this.clearRich();this.trashReview=undefined;}
 snapshotForAnalysis(id:string){this.check();if(this.status().authorizing||this.trashPending||this.trashReview||!this.analysisSource||this.analysisSource.thread.id!==id)throw Error('Vuelve a abrir el correo que quieres analizar.');return{...structuredClone(this.analysisSource),context:this.readerKey};}
 suspendReads(){this.clearRich();this.generation++;for(const [c,scope]of this.requests)if(scope==='read')c.abort();this.ids.clear();this.items.clear();this.trashReview=undefined;this.pages.clear();this.activeQuery=undefined;this.pageCount=0;}
 suspend(){this.suspendReads();this.cancelAuth();}
 async connect(enableTrash=false){
  this.check();this.checkAuth();if(!this.client)throw Error('Configura el Client ID de Google.');if(!this.deps.cipher.isEncryptionAvailable())throw Error('Windows no ofrece almacenamiento seguro para esta conexión.');this.suspend();this.error=undefined;
  const requestedScope=enableTrash?MODIFY_SCOPE:SCOPE;
  const generation=this.authGeneration,state=randomBytes(32).toString('base64url'),verifier=randomBytes(48).toString('base64url');
  const page=(res:import('node:http').ServerResponse,status:'working'|'success'|'error',code=200)=>{res.writeHead(code,{'Content-Type':'text/html; charset=utf-8'});const title=status==='success'?'Gmail conectado':status==='working'?'Completando conexión':'No se completó la conexión';const detail=status==='success'?'Puedes volver a ZEN. Tu conexión se ha guardado en este PC.':status==='working'?'ZEN está comprobando la autorización. Vuelve a la cápsula para ver el resultado.':'Vuelve a ZEN para ver el motivo e iniciar una conexión nueva.';res.end('<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>ZEN · Gmail</title><style>body{margin:0;background:#101116;color:#eee9f8;font:16px system-ui;display:grid;min-height:100vh;place-items:center}main{max-width:480px;padding:36px}small{color:#baa3e7}h1{font-size:28px}p{line-height:1.6;color:#b9b2c7}</style><main><small>ZEN / GOOGLE</small><h1>'+title+'</h1><p>'+detail+'</p></main></html>');};
  const server=createServer((req,res)=>{void(async()=>{
   res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
   const p=this.pending,r=this.receipt,owner=p?.server===server?{host:new URL(p.redirect).host}:r?.server===server?r:undefined;
   let u:URL;try{u=new URL(req.url??'','http://127.0.0.1');}catch{res.writeHead(400).end();return;}
   if(!owner||req.method!=='GET'||req.headers.host!==owner.host){res.writeHead(400).end('Solicitud no válida.');return;}
   if(u.pathname==='/favicon.ico'){res.writeHead(204).end();return;}
   if(r?.server===server){if(u.pathname==='/oauth2/complete'){page(res,r.result);return;}if(u.pathname==='/oauth2/callback'&&u.searchParams.get('state')===r.state){res.writeHead(303,{Location:'/oauth2/complete'}).end();return;}res.writeHead(400).end('Solicitud no válida.');return;}
   const supplied=u.searchParams.get('state')??'';
   if(!p||p.server!==server||u.pathname!=='/oauth2/callback'||Buffer.byteLength(supplied)!==Buffer.byteLength(p.state)||!timingSafeEqual(Buffer.from(supplied),Buffer.from(p.state))){res.writeHead(400).end('Solicitud no válida.');return;}
   if(Date.now()>p.expiresAt){this.cancelAuth();res.writeHead(410).end('La conexión caducó. Vuelve a conectar desde ZEN.');return;}
   this.pending=undefined;clearTimeout(p.timer);const receipt={server,host:owner.host,state:p.state,result:'working' as 'working'|'success'|'error',timer:setTimeout(()=>{if(this.receipt?.server===server){this.receipt=undefined;server.close();server.closeIdleConnections();}},60000)};receipt.timer.unref();this.receipt=receipt;
   const code=u.searchParams.get('code');
   if(u.searchParams.has('error')||!code||code.length>4096){this.error='No se concedió el acceso de lectura a Gmail.';receipt.result='error';res.writeHead(303,{Location:'/oauth2/complete'}).end();return;}
   this.exchanging=true;
   try{this.checkAuth();const t=await this.http('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({...this.clientParameters(),code,redirect_uri:p.redirect,grant_type:'authorization_code',code_verifier:p.verifier}).toString()},100000,'auth');if(generation!==this.authGeneration)throw Error('La conexión se canceló.');this.checkAuth();const scopes=typeof t.scope==='string'?grantedScopes(t.scope):[p.scope];if(typeof t.access_token!=='string'||!t.access_token||scopes.length===0)throw Error('Google no concedió acceso a Gmail.');const next=Tokens.parse({scopes,access_token:t.access_token,refresh_token:t.refresh_token,expires:Date.now()+Math.min(86400,Number(t.expires_in)||3600)*1000});const path=join(this.deps.profile,'gmail-oauth.bin');if(!this.deps.cipher.isEncryptionAvailable())throw Error('Windows no ofrece almacenamiento seguro para esta conexión.');writeFileSync(path+'.tmp',this.deps.cipher.encryptString(JSON.stringify(next)));renameSync(path+'.tmp',path);this.readerKey=randomBytes(16).toString('hex');this.tokens=next;this.error=undefined;receipt.result='success';}
   catch(e){receipt.result='error';if(generation===this.authGeneration)this.error=e instanceof GmailHttpError?e.message:'No se pudo completar y guardar la conexión de Gmail en este PC. Inicia una conexión nueva.';}
   finally{if(generation===this.authGeneration)this.exchanging=false;}
   if(!res.destroyed){if(generation!==this.authGeneration)page(res,'error',400);else res.writeHead(303,{Location:'/oauth2/complete'}).end();}
  })().catch(()=>{if(!res.headersSent)res.writeHead(400);if(!res.destroyed)res.end('Solicitud no válida.');});});
  server.maxConnections=8;server.headersTimeout=5000;server.requestTimeout=10000;await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});const port=(server.address() as import('node:net').AddressInfo).port,redirect='http://127.0.0.1:'+port+'/oauth2/callback';
  if(generation!==this.authGeneration){server.close();throw Error('La conexión se canceló.');}const timer=setTimeout(()=>{if(this.pending?.server===server){this.cancelAuth();this.error='El inicio de sesión caducó. Puedes intentarlo de nuevo.';}},300000);timer.unref();this.pending={scope:requestedScope,server,timer,state,verifier,redirect,generation,expiresAt:Date.now()+300000};
  const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');url.search=new URLSearchParams({client_id:this.client,redirect_uri:redirect,response_type:'code',scope:requestedScope,state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',access_type:'offline',prompt:'consent'}).toString();try{this.checkAuth();await this.deps.open(url.toString());}catch(e){this.cancelAuth();throw e;}return this.status();
 }
 private async token(purpose:ReadPurpose='mail'){this.check(purpose);if(this.tokens.access_token&&(this.tokens.expires??0)>Date.now()+30000)return this.tokens.access_token;if(this.refresh?.generation===this.generation&&this.refresh.purpose===purpose)return this.refresh.promise;if(!this.tokens.refresh_token||!this.client)throw Error('Conecta tu cuenta de Google.');const generation=this.generation,pending={generation,purpose,promise:undefined! as Promise<string>};this.refresh=pending;pending.promise=(async()=>{try{const t=await this.http('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({...this.clientParameters(),refresh_token:this.tokens.refresh_token!,grant_type:'refresh_token'}).toString()},100000);this.check(purpose);if(generation!==this.generation)throw Error('La consulta se canceló.');if(typeof t.access_token!=='string')throw Error('Vuelve a conectar Gmail.');const scopes=typeof t.scope==='string'?grantedScopes(t.scope):this.tokens.scopes;this.tokens={...this.tokens,scopes,access_token:t.access_token,refresh_token:t.refresh_token??this.tokens.refresh_token,expires:Date.now()+Math.min(86400,Number(t.expires_in)||3600)*1000};this.save();return t.access_token as string;}finally{if(this.refresh===pending)this.refresh=undefined;}})();return pending.promise;}
 private async get(path:string,limit=1500000,purpose:ReadPurpose='mail'){this.check(purpose);const generation=this.generation,token=await this.token(purpose);this.check(purpose);if(generation!==this.generation)throw Error('La consulta se canceló.');const v=await this.http('https://gmail.googleapis.com/gmail/v1/users/me/'+path,{headers:{Authorization:'Bearer '+token}},limit);this.check(purpose);if(generation!==this.generation)throw Error('La consulta se canceló.');return v;}
 async summary():Promise<GmailSummary>{
  this.check('summary');const {configured,connected,authorizing}=this.status(),state={configured,connected};
  if(!configured||!connected||authorizing)return state;
  const label=await this.get('labels/INBOX?fields=messagesUnread',8192,'summary'),unread=label?.messagesUnread;
  if(!Number.isSafeInteger(unread)||unread<0||unread>2147483647)throw Error('Google no devolvió un recuento válido de mensajes sin leer.');
  return{...state,unread,checkedAt:Date.now()};
 }
 private item(v:any):Omit<GmailItem,'messageCount'>{return{id:v.id,subject:header(v,'subject')||'(Sin asunto)',from:header(v,'from'),date:header(v,'date'),snippet:clean(v.snippet,1000),unread:Array.isArray(v.labelIds)&&v.labelIds.includes('UNREAD')};}
 private threadMessages(v:any,id:string):any[]{
  if(v?.id!==id||!Array.isArray(v.messages)||v.messages.length===0||v.messages.length>1000)throw Error('Google devolvió una conversación no válida o demasiado extensa. Ábrela en Gmail.');
  const seen=new Set<string>(),messages:any[]=[];
  for(const m of v.messages){if(!m||!validId(m.id)||m.threadId!==undefined&&m.threadId!==id)throw Error('Google devolvió una conversación no válida.');if(!seen.has(m.id)){seen.add(m.id);messages.push(m);}}
  return messages.sort((a,b)=>messageDate(a)-messageDate(b));
 }
 private threadItem(id:string,messages:any[]):GmailItem{return{...this.item(messages[messages.length-1]),id,unread:messages.some(m=>Array.isArray(m.labelIds)&&m.labelIds.includes('UNREAD')),messageCount:messages.length};}
 async list(raw:unknown):Promise<GmailList>{
  this.check();this.clearRich();this.trashReview=undefined;const q=GmailQuery.parse(raw);
  if(q.page&&(!this.pages.has(q.page)||this.activeQuery!==q.query||this.pageCount>=MAX_PAGES))throw Error('La página ya no pertenece a esta consulta.');
  if(!q.page){this.suspendReads();this.activeQuery=q.query;}
  const generation=this.generation,revision=++this.listRevision,assertCurrent=()=>{this.check();if(generation!==this.generation||revision!==this.listRevision)throw Error('La consulta se canceló.');};
  const p=new URLSearchParams({labelIds:'INBOX',maxResults:String(PAGE_SIZE)});if(q.query)p.set('q',q.query);if(q.page)p.set('pageToken',q.page);
  const v=await this.get('threads?'+p);assertCurrent();
  const ids=[...new Set<string>((Array.isArray(v.threads)?v.threads:[]).map((m:any)=>m?.id).filter(validId))].slice(0,PAGE_SIZE),messages:GmailItem[]=[];
  for(let i=0;i<ids.length;i+=4){assertCurrent();const part=await Promise.all(ids.slice(i,i+4).map(async id=>{const metadata=await this.get('threads/'+id+'?'+new URLSearchParams({format:'metadata',fields:GMAIL_THREAD_METADATA_FIELDS})+'&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date');return this.threadItem(id,this.threadMessages(metadata,id));}));assertCurrent();messages.push(...part);}
  let unread:number|undefined;if(!q.page){const label=await this.get('labels/INBOX').catch(()=>undefined);assertCurrent();if(Number.isSafeInteger(label?.messagesUnread)&&label.messagesUnread>=0&&label.messagesUnread<=2147483647)unread=label.messagesUnread;}
  assertCurrent();for(const m of messages){this.ids.add(m.id);this.items.set(m.id,{...m});}this.pageCount++;if(q.page)this.pages.delete(q.page);
  const next=this.pageCount<MAX_PAGES&&typeof v.nextPageToken==='string'&&v.nextPageToken.length>0&&v.nextPageToken.length<=2048&&v.nextPageToken!==q.page?v.nextPageToken:undefined;if(next)this.pages.add(next);
  return{messages,next,unread,limited:this.pageCount>=MAX_PAGES&&typeof v.nextPageToken==='string'&&v.nextPageToken.length>0};
 }
 async message(id:string):Promise<GmailMessage>{
  this.check();this.clearRich();this.trashReview=undefined;const generation=this.generation,revision=this.messageRevision;if(!validId(id)||!this.ids.has(id))throw Error('Abre una conversación de la lista actual.');
  const v=await this.get('threads/'+id+'?'+new URLSearchParams({format:'full',fields:GMAIL_THREAD_FULL_FIELDS}),8000000);
  if(generation!==this.generation||revision!==this.messageRevision)throw Error('La consulta se canceló.');const ordered=this.threadMessages(v,id),messages:GmailThreadMessage[]=[];let total=0;
  for(const m of ordered.slice(0,MAX_THREAD_MESSAGES)){
   const body=messageText(m.payload);if(total+body.text.length>MAX_THREAD_TEXT){body.text='';body.truncated=true;}
   total+=body.text.length;const prepared=prepareMailHtml(m.payload,body.text);if(prepared)this.htmlViews.set(prepared.rich.view,prepared);
   messages.push({...this.item(m),to:header(m,'to'),...body,...(prepared&&this.htmlViews.has(prepared.rich.view)?{rich:prepared.rich}:{})});
  }
  const item=this.threadItem(id,ordered);this.items.set(id,{...item});const omittedMessages=ordered.length-messages.length,result={...item,messages,omittedMessages,truncated:omittedMessages>0||messages.some(m=>m.truncated)};
  this.analysisSource={version:randomBytes(16).toString('hex'),thread:structuredClone({...result,messages:messages.map(({rich,...text})=>text)})};return result;
 }
 private richView(id:string){this.check();const view=this.htmlViews.get(id);if(!view)throw Error('Vuelve a abrir la conversación para ver su contenido.');return view;}
 document(id:string){return mailDocument(this.richView(id).rich);}
 cancelImages(id:string){this.imageCancels.get(id)?.abort();}
 async images(id:string,external=false):Promise<GmailImageResult>{
  let cancellation:AbortController|undefined;const view=this.richView(id),generation=this.generation,current=()=>{cancellation?.signal.throwIfAborted();this.check();if(generation!==this.generation||this.htmlViews.get(id)!==view)throw Error('La lectura de imágenes se canceló.');};
  let failed=0;
  if(external){
   if(this.imageFlight)throw Error('Espera a que termine la carga de imágenes.');const marker={},cancel=new AbortController(),batch=AbortSignal.any([cancel.signal,AbortSignal.timeout(20000)]);this.imageFlight=marker;this.imageRequests.add(cancel);this.imageCancels.set(id,cancel);cancellation=cancel;
   try{for(const item of view.images.values()){
    current();if(!item.url||item.data)continue;
    try{const data=await(this.deps.imageFetch??fetchMailImage)(item.url,batch);current();const used=[...this.htmlViews.values()].reduce((sum,v)=>sum+[...v.images.values()].reduce((n,i)=>n+(i.data?.length??0),0),0);if(used+data.length>8000000){failed++;continue;}item.data=data;}
    catch{current();failed++;}
   }}finally{this.imageRequests.delete(cancel);if(this.imageCancels.get(id)===cancel)this.imageCancels.delete(id);if(this.imageFlight===marker)this.imageFlight=undefined;}
  }
  current();return{images:Object.fromEntries([...view.images].filter(([,v])=>v.data).map(([key,v])=>[key,v.data!])),failed,remaining:[...view.images.values()].filter(v=>v.url&&!v.data).length};
 }
 async openLink(viewId:string,linkId:string){const view=this.richView(viewId),value=view.links.get(linkId),url=value&&mailWebUrl(value);if(!url)throw Error('Este enlace no está disponible en el correo abierto.');await this.deps.open(url);return true;}
 private checkTrash(){this.check();if(this.status().authorizing)throw Error('Completa primero la conexión de Google.');if(!this.status().canTrash)throw Error('Pulsa Permitir eliminar y autoriza el permiso de Google para mover correos a la papelera.');}
 prepareTrash(id:string):GmailTrashReview{
  this.checkTrash();if(this.trashPending)throw Error('Espera a que termine la operación actual.');const item=this.items.get(id);
  if(!validId(id)||!this.ids.has(id)||!item)throw Error('Abre una conversación de la lista actual.');
  const value={token:randomBytes(24).toString('hex'),threadId:id,subject:item.subject,messageCount:item.messageCount,expiresAt:Date.now()+60000};
  this.deps.invalidateAnalysis?.();this.trashReview={value:{...value},generation:this.generation};return value;
 }
 cancelTrash(){this.trashReview=undefined;}
 async trash(token:string):Promise<{threadId:string}>{
  this.checkTrash();const review=this.trashReview;this.trashReview=undefined;
  if(this.trashPending||!review||token!==review.value.token||review.generation!==this.generation||Date.now()>=review.value.expiresAt||!this.ids.has(review.value.threadId))throw Error('La confirmación de eliminación ya no es válida. Vuelve a revisar la conversación.');
  const generation=this.generation,id=review.value.threadId;this.trashPending=true;let dispatched=false;
  try{
   const access=await this.token();this.checkTrash();if(generation!==this.generation||Date.now()>=review.value.expiresAt)throw Error('La eliminación se canceló antes de enviarse.');
   dispatched=true;const result=await this.http('https://gmail.googleapis.com/gmail/v1/users/me/threads/'+id+'/trash?fields=id',{method:'POST',headers:{Authorization:'Bearer '+access}},8192);
   this.check();if(generation!==this.generation||result?.id!==id)throw Error('No se pudo confirmar el resultado.');
   this.suspendReads();return{threadId:id};
  }catch(e){if(dispatched)throw Error('No se pudo confirmar la eliminación. Comprueba la conversación en Gmail antes de volver a intentarlo. ZEN no ha repetido la petición.');throw e;}
  finally{this.trashPending=false;}
 }
 disconnect(){this.check();this.readerKey=randomBytes(16).toString('hex');this.suspend();this.tokens={};try{unlinkSync(join(this.deps.profile,'gmail-oauth.bin'));}catch{}this.error=undefined;return this.status();}
 close(){this.suspend();}
}
