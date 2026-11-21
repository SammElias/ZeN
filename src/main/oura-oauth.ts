import {randomBytes,timingSafeEqual} from 'node:crypto';
import {createServer,type RequestListener,type ServerResponse} from 'node:http';
import {ouraRedirect} from '../shared/companion-oura';
import {OuraHttpError,verifyOuraDaily} from './oura-api';

export type OuraToken={accessToken:string;expiresAt:number};
const callback=new URL(ouraRedirect);

class OuraCallbackError extends Error {}

function authorizationError(code:string){
 switch(code){
  case 'access_denied':return 'Oura no concedió el acceso. Vuelve a conectar y permite el acceso a las métricas diarias.';
  case 'invalid_scope':return 'Oura rechazó el permiso de métricas diarias solicitado. Revisa que Daily esté habilitado en la aplicación de Oura.';
  case 'invalid_client':
  case 'unauthorized_client':return 'Oura rechazó la aplicación. Revisa el Client ID y la configuración de la aplicación en el portal de Oura.';
  case 'unsupported_response_type':return 'Oura no admite la conexión directa de ZEN para esta aplicación.';
  case 'server_error':
  case 'temporarily_unavailable':return 'Oura no está disponible en este momento. Vuelve a intentarlo más tarde.';
  default:return 'Oura rechazó la solicitud de autorización. Inicia una conexión nueva desde Métricas.';
 }
}

function tokenFromFragment(fields:URLSearchParams,now:number):OuraToken {
 const error=fields.get('error');
 if(error!==null)throw new OuraCallbackError(authorizationError(error));
 const accessToken=fields.get('access_token')??'';
 if(!accessToken&&fields.has('code'))throw new OuraCallbackError('Oura devolvió un código de autorización en vez de una sesión de acceso directo. Revisa la configuración de la aplicación de Oura.');
 if(!/^[\x21-\x7e]{1,4096}$/.test(accessToken))throw new OuraCallbackError('Oura no devolvió un token de acceso válido. Inicia una conexión nueva desde Métricas.');
 if(fields.get('token_type')?.toLowerCase()!=='bearer')throw new OuraCallbackError('Oura no indicó un tipo de token compatible con ZEN.');
 const seconds=Number(fields.get('expires_in'));
 if(!Number.isInteger(seconds)||seconds<1||seconds>366*86400)throw new OuraCallbackError('Oura no indicó una duración válida para la sesión.');
 return{accessToken,expiresAt:now+seconds*1000};
}

async function confirmDailyScope(fields:URLSearchParams,token:OuraToken,now:number,signal:AbortSignal){
 const scope=fields.get('scope');
 if(scope?.trim().split(/\s+/).includes('daily'))return;
 try{await verifyOuraDaily(token.accessToken,new Date(now).toISOString().slice(0,10),signal);}
 catch(error){
  if(error instanceof OuraHttpError){
   if(error.status===401)throw new OuraCallbackError('Oura rechazó la sesión de acceso. Inicia una conexión nueva desde Métricas.');
   if(error.status===403)throw new OuraCallbackError('La API de Oura denegó la lectura de métricas diarias. Revisa el permiso Daily y el estado de tu membresía.');
   if(error.status===429)throw new OuraCallbackError('Oura limitó las consultas al comprobar el permiso diario. Espera antes de volver a conectar.');
  }
  throw new OuraCallbackError('No se pudo confirmar el permiso diario con Oura. Comprueba la conexión y vuelve a intentarlo.');
 }
}

/** Oura's documented public-client flow hands the fragment only to this one-shot loopback page. */
export function authorizeOura(clientId:string,openBrowser:(url:string)=>Promise<void>,signal:AbortSignal):Promise<OuraToken> {
 signal.throwIfAborted();
 const state=randomBytes(32).toString('base64url'),nonce=randomBytes(16).toString('base64url');
 const expectedState=Buffer.from(state);
 const consent=new URL('https://cloud.ouraring.com/oauth/authorize');
 consent.search=new URLSearchParams({response_type:'token',client_id:clientId,redirect_uri:ouraRedirect,scope:'daily',state}).toString();
 return new Promise((resolve,reject)=>{
  let done=false,callbackPending=false;
  const verification=new AbortController();
  const finish=(outcome:OuraToken|Error)=>{
   if(done)return;
   done=true;
   verification.abort();
   clearTimeout(timer);
   signal.removeEventListener('abort',cancel);
   for(const {server} of servers){server.close();server.closeIdleConnections();}
   if(outcome instanceof Error)reject(outcome);else resolve(outcome);
  };
  const cancel=()=>finish(Error('Conexión con Oura cancelada.'));
  const send=(res:ServerResponse,status:number,body:string,type='text/plain; charset=utf-8')=>{
   res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','Referrer-Policy':'no-referrer',Connection:'close',
    'X-Content-Type-Options':'nosniff','Content-Security-Policy':`default-src 'none'; script-src 'nonce-${nonce}'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'`});
   res.end(body);
  };
  const handle:RequestListener=(req,res)=>{
   if(done||req.headers.host!==callback.host||req.url?.split('?')[0]!==callback.pathname){send(res,404,'Ruta no disponible.');return;}
   if(req.method==='GET'){
    send(res,200,`<!doctype html><html lang="es"><meta charset="utf-8"><title>Conectar Oura con ZEN</title><main id="status">Comprobando la conexión con ZEN…</main><script nonce="${nonce}">
     const payload=location.hash.slice(1)||location.search.slice(1);
     history.replaceState(null,'',location.pathname);
     const status=document.getElementById('status');
     fetch(location.pathname,{method:'POST',body:new URLSearchParams(payload),cache:'no-store'}).then(async r=>{
      status.textContent=await r.text();
     }).catch(()=>{status.textContent='La conexión ha terminado. Vuelve a ZEN.';});
    </script></html>`,'text/html; charset=utf-8');
    return;
   }
   if(req.method!=='POST'||req.headers.origin!==callback.origin||!req.headers['content-type']?.startsWith('application/x-www-form-urlencoded')){
    send(res,403,'Origen no autorizado.');return;
   }
   let body='';req.setEncoding('utf8');
   req.on('data',chunk=>{body+=chunk;if(body.length>8192)req.destroy();});
   req.on('error',()=>{});
   req.on('end',async()=>{
    if(done||callbackPending){send(res,409,'ZEN ya procesó o está comprobando esta conexión.');return;}
    const fields=new URLSearchParams(body);
    const returnedState=Buffer.from(fields.get('state')??'');
    if(returnedState.length!==expectedState.length||!timingSafeEqual(returnedState,expectedState)){
     send(res,400,'Esta respuesta no corresponde a la conexión abierta. Inicia un intento desde Métricas.');return;
    }
    callbackPending=true;
    try{
     const now=Date.now(),token=tokenFromFragment(fields,now);
     res.setTimeout(10_000);
     await confirmDailyScope(fields,token,now,AbortSignal.any([verification.signal,AbortSignal.timeout(7000)]));
     if(done)return;
     if(token.expiresAt<=Date.now())throw new OuraCallbackError('La sesión de Oura caducó durante la comprobación. Inicia una conexión nueva desde Métricas.');
     send(res,200,'Permiso recibido. Puedes volver a ZEN.');finish(token);
    }
    catch(error){
     if(done)return;
     const failure=error instanceof OuraCallbackError?error:Error('ZEN no pudo validar la respuesta de Oura. Inicia una conexión nueva desde Métricas.');
     send(res,400,failure.message);finish(failure);
    }
   });
  };
  // Oura requires the hostname localhost. Both address families must lead to this listener.
  // A busy address aborts before opening the browser so another listener cannot receive the token.
  const servers=['127.0.0.1','::1'].map(host=>{
   const server=createServer({requestTimeout:5000,headersTimeout:5000,maxHeaderSize:8192},handle);
   server.setTimeout(5000,socket=>socket.destroy());
   return {host,server};
  });
  const timer=setTimeout(()=>finish(Error('La conexión con Oura caducó. Puedes intentarlo de nuevo.')),180_000);
  signal.addEventListener('abort',cancel,{once:true});
  const listening=servers.map(({server,host})=>new Promise<void>((resolve,reject)=>{
   server.on('error',(error:NodeJS.ErrnoException)=>{
    if(host==='::1'&&['EAFNOSUPPORT','EADDRNOTAVAIL','EPROTONOSUPPORT'].includes(error.code??'')){resolve();return;}
    const failure=Error('No se pudo abrir el puerto local 46328 para conectar Oura.');
    reject(failure);finish(failure);
   });
   server.listen({port:Number(callback.port),host,exclusive:true},()=>{
    if(done)server.close();
    resolve();
   });
  }));
  void Promise.all(listening).then(()=>{
   if(done)return;
   return Promise.resolve().then(()=>openBrowser(consent.href)).catch(()=>finish(Error('No se pudo abrir el navegador para conectar Oura.')));
  },()=>{});
 });
}
