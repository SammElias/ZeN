import {lookup} from 'node:dns/promises';
import {request} from 'node:https';
import {isIP} from 'node:net';
import ipaddr from 'ipaddr.js';
import {imageSize} from 'image-size';

export const MAIL_IMAGE_MAX_BYTES=1048576;
export function publicMailAddress(address:string){try{const parsed=ipaddr.process(address);return parsed.range()==='unicast';}catch{return false;}}
/** Only web URLs, with no ambient credentials or local/literal-private destinations. */
export function mailWebUrl(raw:string,httpsOnly=false):string|undefined{
 try{if(raw.length>2048||/[\x00-\x20\x7f]/.test(raw))return;const u=new URL(raw),host=u.hostname.replace(/^\[|\]$/g,'');if(!['https:',...(httpsOnly?[]:['http:'])].includes(u.protocol)||u.username||u.password||u.port&&u.port!=='443'&&u.port!=='80'||!host.includes('.')&&!isIP(host)||/(?:^|\.)(?:localhost|local|internal|test|invalid)$/i.test(host)||isIP(host)&&!publicMailAddress(host))return;return u.href;}catch{return;}
}
export function rasterMailImage(bytes:Uint8Array,declared?:string):string{
 if(!bytes.length||bytes.length>MAIL_IMAGE_MAX_BYTES)throw Error('Imagen fuera de límite.');
 const size=imageSize(bytes),types:Record<string,string>={png:'image/png',jpg:'image/jpeg',gif:'image/gif',webp:'image/webp'},mime=types[size.type??''];
 if(!mime||declared&&declared.toLowerCase().split(';')[0].trim()!==mime||!size.width||!size.height||size.width>8192||size.height>8192||size.width*size.height>4000000)throw Error('Formato de imagen no disponible.');
 return 'data:'+mime+';base64,'+Buffer.from(bytes).toString('base64');
}
type Address={address:string;family:number};
type Download={status:number;type?:string;location?:string;body:Buffer};
type ImageDeps={lookup:(host:string)=>Promise<Address[]>;download:(url:URL,address:Address,signal:AbortSignal)=>Promise<Download>};
function abortable<T>(pending:Promise<T>,signal:AbortSignal):Promise<T>{return new Promise((resolve,reject)=>{const cancel=()=>{signal.removeEventListener('abort',cancel);reject(signal.reason);};if(signal.aborted){pending.catch(()=>{});cancel();return;}signal.addEventListener('abort',cancel,{once:true});pending.then(value=>{signal.removeEventListener('abort',cancel);resolve(value);},error=>{signal.removeEventListener('abort',cancel);reject(error);});});}
/** The TLS hostname remains the original host; only its DNS result is pinned. */
const download:ImageDeps['download']=(url,address,signal)=>new Promise((resolve,reject)=>{
 const req=request(url,{method:'GET',agent:false,signal,lookup:((_host:unknown,_options:unknown,cb:(e:Error|null,address:string,family:number)=>void)=>cb(null,address.address,address.family)) as any,headers:{Accept:'image/png,image/jpeg,image/gif,image/webp','User-Agent':'ZEN-Mail/1.0'}},response=>{
  const status=response.statusCode??0;if(status!==200){response.resume();resolve({status,location:response.headers.location,body:Buffer.alloc(0)});return;}
  if(Number(response.headers['content-length'])>MAIL_IMAGE_MAX_BYTES){response.destroy();reject(Error('Imagen fuera de límite.'));return;}
  const chunks:Buffer[]=[];let length=0;response.on('data',chunk=>{length+=chunk.length;if(length>MAIL_IMAGE_MAX_BYTES){response.destroy(Error('Imagen fuera de límite.'));return;}chunks.push(chunk);});response.on('error',reject);response.on('end',()=>resolve({status,type:response.headers['content-type'],body:Buffer.concat(chunks)}));
 });req.on('error',reject);req.end();
});
export async function fetchMailImage(raw:string,cancel:AbortSignal,deps:ImageDeps={lookup:host=>lookup(host,{all:true,verbatim:true}),download}):Promise<string>{
 const signal=AbortSignal.any([cancel,AbortSignal.timeout(10000)]);let next=raw;
 try{for(let redirect=0;redirect<3;redirect++){
  signal.throwIfAborted();const safe=mailWebUrl(next,true);if(!safe)throw Error();const url=new URL(safe),host=url.hostname.replace(/^\[|\]$/g,'');
  const addresses=isIP(host)?[{address:host,family:isIP(host)}]:await abortable(deps.lookup(host),signal);signal.throwIfAborted();
  if(!addresses.length||addresses.length>64||addresses.some(a=>!publicMailAddress(a.address)))throw Error();const pinned=addresses.find(a=>a.family===4)??addresses[0];
  const response=await deps.download(url,pinned,signal);signal.throwIfAborted();
  if([301,302,303,307,308].includes(response.status)&&response.location&&redirect<2){next=new URL(response.location,url).href;continue;}
  if(response.status!==200||!response.type)throw Error();return rasterMailImage(response.body,response.type);
 }}catch{/* Do not expose URL, DNS, query strings, response bytes or remote errors. */}
 throw Error('No se pudo cargar esta imagen.');
}
