import {GMAIL_THREAD_METADATA_FIELDS,GMAIL_THREAD_FULL_FIELDS} from '../shared/companion-gmail';
export type GoogleFetch=(url:string,init?:RequestInit)=>Promise<Response>;

/** A dedicated in-memory Chromium session is supplied by main after app.ready. */
export function googleNetworkFetch(network:{fetch:GoogleFetch}):GoogleFetch{
 return async(url,init={})=>{
  const u=new URL(url),method=(init.method??'GET').toUpperCase();
  const token=u.origin==='https://oauth2.googleapis.com'&&u.pathname==='/token'&&!u.search&&method==='POST';
  const params=u.searchParams,only=(names:string[])=>[...params.keys()].every(name=>names.includes(name)),single=(name:string)=>params.getAll(name).length<=1;
  const list=u.pathname==='/gmail/v1/users/me/threads'&&only(['labelIds','maxResults','q','pageToken'])&&['labelIds','maxResults','q','pageToken'].every(single)&&params.get('labelIds')==='INBOX'&&params.get('maxResults')==='20'&&(params.get('q')?.length??0)<=240&&(params.get('pageToken')?.length??0)<=2048;
  const format=params.get('format'),thread=/^\/gmail\/v1\/users\/me\/threads\/[a-zA-Z0-9_-]{1,100}$/.test(u.pathname)&&only(['format','fields','metadataHeaders'])&&single('format')&&single('fields')&&(format==='full'&&params.get('fields')===GMAIL_THREAD_FULL_FIELDS&&!params.has('metadataHeaders')||format==='metadata'&&params.get('fields')===GMAIL_THREAD_METADATA_FIELDS&&params.getAll('metadataHeaders').length<=4&&params.getAll('metadataHeaders').every(name=>['Subject','From','To','Date'].includes(name)));
  const inbox=u.pathname==='/gmail/v1/users/me/labels/INBOX'&&(!u.search||only(['fields'])&&single('fields')&&params.get('fields')==='messagesUnread');
  const mailbox=u.origin==='https://gmail.googleapis.com'&&method==='GET'&&(list||thread||inbox)&&init.body==null;
  if(u.username||u.password||u.hash||!token&&!mailbox)throw Error('Destino de Google no permitido.');
  return network.fetch(u.href,{...init,credentials:'omit',redirect:'error',cache:'no-store',referrerPolicy:'no-referrer',bypassCustomProtocolHandlers:true} as RequestInit);
 };
}

const groups={
 TIMEOUT:['UND_ERR_CONNECT_TIMEOUT','ETIMEDOUT','ERR_TIMED_OUT','ERR_CONNECTION_TIMED_OUT'],
 DNS:['ENOTFOUND','EAI_AGAIN','ERR_NAME_NOT_RESOLVED'],
 TLS:['CERT_HAS_EXPIRED','UNABLE_TO_VERIFY_LEAF_SIGNATURE','SELF_SIGNED_CERT_IN_CHAIN','DEPTH_ZERO_SELF_SIGNED_CERT','ERR_CERT_AUTHORITY_INVALID','ERR_CERT_DATE_INVALID','ERR_CERT_COMMON_NAME_INVALID','ERR_SSL_PROTOCOL_ERROR'],
 PROXY:['ERR_PROXY_CONNECTION_FAILED','ERR_TUNNEL_CONNECTION_FAILED','ERR_NO_SUPPORTED_PROXIES'],
 CONNECTION:['UND_ERR_SOCKET','ECONNREFUSED','ECONNRESET','ENETUNREACH','EHOSTUNREACH','ERR_CONNECTION_REFUSED','ERR_CONNECTION_RESET','ERR_CONNECTION_CLOSED','ERR_INTERNET_DISCONNECTED','ERR_NETWORK_CHANGED','ERR_ADDRESS_UNREACHABLE']
} as const;
export function googleNetworkFailure(error:unknown,signal:AbortSignal){
 const queue:unknown[]=[error];let code:string|undefined,kind='NETWORK';
 for(let i=0;i<queue.length&&i<8;i++){
  const e=queue[i];if(!e||typeof e!=='object')continue;
  const v=e as {code?:unknown;name?:unknown;message?:unknown;cause?:unknown;errors?:unknown};
  if(v.name==='TimeoutError'){kind='TIMEOUT';code='TIMEOUT';break;}
  const candidates=[v.code,typeof v.message==='string'?/^net::(ERR_[A-Z_]+)(?:\s|$)/.exec(v.message)?.[1]:undefined];
  for(const [group,codes]of Object.entries(groups))for(const candidate of candidates)if(typeof candidate==='string'&&(codes as readonly string[]).includes(candidate)){kind=group;code=candidate;}
  if(code)break;if(v.cause)queue.push(v.cause);if(Array.isArray(v.errors))queue.push(...v.errors.slice(0,4));
 }
 if(signal.aborted){kind=signal.reason?.name==='TimeoutError'?'TIMEOUT':'CANCELLED';code=kind;}
 const message=kind==='CANCELLED'?'La solicitud a Google se canceló.':kind==='TIMEOUT'?'Google no respondió a tiempo.':kind==='DNS'?'No se pudo resolver la dirección de Google.':kind==='TLS'?'No se pudo verificar la conexión segura con Google.':kind==='PROXY'?'No se pudo conectar con Google a través del proxy del sistema.':'No se pudo establecer la conexión de red con Google.';
 return{kind,code:code??'NETWORK',message};
}
