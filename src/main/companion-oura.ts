import {existsSync,readFileSync,renameSync,rmSync,writeFileSync} from 'node:fs';
import {z} from 'zod';
import {addCalendarDays,calendarDateInZone} from '../shared/companion-calendar';
import {emptyOuraCache,ouraCache,ouraCapsuleMode,ouraClientId,ouraLatest,ouraNumber,ouraResources,type OuraCapsuleMode,type OuraGlance,type OuraHomeSleep,type OuraResource,type OuraStatus} from '../shared/companion-oura';
import type {OuraToken} from './oura-oauth';
import {mergeOuraRows,OuraHttpError,readOura} from './oura-api';

const stored=z.object({version:z.literal(1),clientId:ouraClientId,mode:ouraCapsuleMode,cache:ouraCache,sessionExpired:z.boolean().optional(),
 token:z.object({accessToken:z.string().regex(/^[\x21-\x7e]{1,4096}$/),expiresAt:ouraNumber}).strict().optional()}).strict();
type Stored=z.infer<typeof stored>;
type Protection={isEncryptionAvailable():boolean;encryptString(value:string):Buffer;decryptString(value:Buffer):string};
const earliestCheck=5*60_000,latestBackoff=60*60_000;
const blank=()=>({version:1 as const,clientId:'',mode:'icon' as const,cache:emptyOuraCache(),sessionExpired:false});
type Dependencies={changed:()=>void;allowed:()=>boolean;authorize:(id:string,signal:AbortSignal)=>Promise<OuraToken>;
 read?:typeof readOura;now?:()=>number;zone?:()=>string;interval?:number;demo?:boolean};

export class CompanionOura {
 private data:Stored=blank();
 private error?:string;
 private connection?:AbortController;
 private request?:AbortController;
 private running?:Promise<void>;
 private timer?:ReturnType<typeof setTimeout>;
 private expiry?:ReturnType<typeof setTimeout>;
 private retryAt=0;
 private failures=0;
 private closed=false;
 private lastWakeDay?:string;
 private lastAttempt?:number;
 private readonly now:()=>number;
 private readonly today:()=>string;
 constructor(private path:string,private protection:Protection,private deps:Dependencies){
  this.now=deps.now??Date.now;
  this.today=()=>calendarDateInZone(new Date(this.now()),deps.zone?.()??Intl.DateTimeFormat().resolvedOptions().timeZone);
  if(existsSync(path))try{this.data=stored.parse(JSON.parse(protection.decryptString(readFileSync(path))));}
  catch{this.error='No se pudo abrir la sesión guardada de Oura. Puedes volver a conectarla.';}
  if(!this.token&&(this.data.token||Object.values(this.data.cache).some(values=>Object.keys(values).length))){
   this.sessionEnded('La sesión de Oura caducó. Vuelve a conectar tu cuenta.');
  }
  this.trackExpiry();
 }
 private get allowed(){return !this.closed&&this.deps.allowed();}
 private get token(){const token=this.data.token;return token&&token.expiresAt>this.now()?token:undefined;}
 private get state():OuraStatus['state']{
  // Older profiles only saved an ID without a token after ending a session.
  const expired=this.data.sessionExpired??Boolean(this.data.clientId);
  return this.connection?'connecting':this.token?'connected':expired?'expired':'disconnected';
 }
 private get interval(){return this.deps.interval??earliestCheck;}
 private save(value:Stored){
  if(!this.protection.isEncryptionAvailable())throw Error('El almacenamiento seguro de Windows no está disponible.');
  const encrypted=this.protection.encryptString(JSON.stringify(value));
  writeFileSync(this.path+'.tmp',encrypted,{mode:0o600});renameSync(this.path+'.tmp',this.path);
  this.data=value;
 }
 snapshot():OuraStatus{
  return{state:this.state,
   clientId:this.data.clientId,capsule:this.data.mode,busy:!!this.running,demo:this.deps.demo,
   today:this.today(),cache:this.token?structuredClone(this.data.cache):emptyOuraCache(),error:this.error};
 }
 homeSleep():OuraHomeSleep{
  const state=this.state;
  if(state!=='connected')return{state};
  const today=this.today();
  return{state,today,latest:ouraLatest(this.data.cache,'sleep',today)};
 }
 glance():OuraGlance|undefined{
  if(!this.token||this.data.mode!=='sleep')return;
  const today=this.today();
  const day=Object.keys(this.data.cache.sleep).filter(value=>value<=today).sort().at(-1);
  if(day)return{day,seconds:this.data.cache.sleep[day],current:day===today};
 }
 async connect(id:string){
  if(!this.allowed||this.connection||this.token)throw Error('La conexión con Oura no está disponible en este momento.');
  if(!this.protection.isEncryptionAvailable())throw Error('El almacenamiento seguro de Windows no está disponible.');
  if(id!==this.data.clientId){
   try{this.save({...blank(),clientId:id,mode:this.data.mode});}
   catch{throw Error('No se pudo guardar el Client ID de Oura.');}
  }
  const abort=this.connection=new AbortController();
  this.error=undefined;this.stopPolling();this.deps.changed();
  try{
   const token=await this.deps.authorize(id,abort.signal);
   if(abort.signal.aborted||!this.allowed)return;
   // A fresh token may belong to another person even if the public client ID is the same.
   try{this.save({...blank(),clientId:id,mode:this.data.mode,token});}
   catch{throw Error('No se pudo cifrar o guardar la sesión de Oura.');}
   this.retryAt=0;this.failures=0;this.lastAttempt=undefined;
   this.trackExpiry();
  }catch(error){if(!abort.signal.aborted)this.error=error instanceof Error?error.message:'No se pudo conectar con Oura.';}
  finally{if(this.connection===abort){this.connection=undefined;this.deps.changed();this.wake();}}
 }
 cancel(){this.connection?.abort();}
 setCapsule(mode:OuraCapsuleMode){
  if(!this.data.clientId)throw Error('Conecta Oura antes de configurar la cápsula.');
  this.save({...this.data,mode});this.deps.changed();
 }
 disconnect(){
  this.cancel();this.stopPolling();
  const cleared={...blank(),clientId:this.data.clientId};
  this.error=undefined;
  try{
   if(cleared.clientId)this.save(cleared);
   else rmSync(this.path,{force:true});
  }catch{
   rmSync(this.path+'.tmp',{force:true});rmSync(this.path,{force:true});
   this.error='ZEN borró la sesión y las métricas, pero no pudo conservar el Client ID en el almacenamiento seguro de Windows.';
  }
  this.data=cleared;this.retryAt=0;this.failures=0;this.lastAttempt=undefined;
  clearTimeout(this.expiry);
  this.deps.changed();
 }
 policyChanged(){
  if(!this.allowed){this.cancel();this.stopPolling();return;}
  this.wake();
 }
 close(){this.closed=true;this.cancel();this.stopPolling();clearTimeout(this.expiry);}
 wake(){
  if(!this.allowed||!this.token||this.connection)return;
  if(this.lastWakeDay!==this.today()||this.lastAttempt===undefined||this.now()-this.lastAttempt>=this.interval){void this.refresh();return;}
  this.schedule();
 }
 private stopPolling(){clearTimeout(this.timer);this.timer=undefined;this.request?.abort();}
 private trackExpiry(){
  clearTimeout(this.expiry);
  const token=this.data.token;
  if(!token)return;
  this.expiry=setTimeout(()=>{
   if(this.token){this.trackExpiry();return;}
   this.sessionEnded('La sesión de Oura caducó. Vuelve a conectar tu cuenta.');
   this.deps.changed();
  },Math.max(0,Math.min(2_147_483_647,token.expiresAt-this.now())));
 }
 private sessionEnded(message:string){
  clearTimeout(this.expiry);
  this.stopPolling();
  const cleared={...blank(),clientId:this.data.clientId,mode:this.data.mode,sessionExpired:true};
  this.data=cleared;
  this.error=message;
  try{
   rmSync(this.path+'.tmp',{force:true});rmSync(this.path,{force:true});
   this.save(cleared);
  }catch{this.error=message+' No se pudo actualizar el almacenamiento seguro de Windows.';}
 }
 private pending(day:string):OuraResource[]{
  return ouraResources.filter(resource=>{
   if(resource==='daily_activity'){
    const value=this.data.cache.daily_activity[day];return value?.steps===undefined||value?.score===undefined;
   }
   return this.data.cache[resource][day]===undefined;
  });
 }
 private schedule(){
  clearTimeout(this.timer);this.timer=undefined;
  const token=this.token;
  if(!this.allowed||this.connection||!token||this.running||!this.pending(this.today()).length)return;
  const wait=Math.min(latestBackoff,this.interval*2**Math.min(8,this.failures));
  const next=Math.max(this.retryAt,(this.lastAttempt??this.now())+wait);
  if(next>=token.expiresAt)return;
  this.timer=setTimeout(()=>{this.timer=undefined;void this.refresh(false);},Math.min(2_147_483_647,Math.max(0,next-this.now())));
 }
 refresh(all=true):Promise<void>{
  if(this.running)return this.running;
  const token=this.token;
  if(!this.allowed||!token||this.connection)return Promise.resolve();
  if(this.retryAt>this.now()){this.schedule();return Promise.resolve();}
  clearTimeout(this.timer);this.timer=undefined;
  const today=this.today(),resources=all?ouraResources:this.pending(today);
  if(!resources.length)return Promise.resolve();
  const start=addCalendarDays(today,all?-13:-1),end=addCalendarDays(today,1);
  const abort=this.request=new AbortController();this.lastAttempt=this.now();this.lastWakeDay=today;
  this.running=Promise.resolve().then(async()=>{
   const cache=structuredClone(this.data.cache);
   const fetchRows=this.deps.read??readOura;
   let failed=false,changed=false;
   this.error=undefined;
   for(const resource of resources){
    if(abort.signal.aborted||!this.allowed)break;
    try{
     const rows=await fetchRows(resource,start,end,token.accessToken,abort.signal);
     if(abort.signal.aborted||!this.allowed)break;
     mergeOuraRows(cache,resource,rows,start,today);
     cache.checked[resource]=this.now();changed=true;
    }catch(error){
     if(abort.signal.aborted)break;
     failed=true;
     if(error instanceof OuraHttpError){
      if(error.status===401||error.status===403){
       this.sessionEnded(error.status===401?'Oura invalidó la sesión. Vuelve a conectar tu cuenta.':
        'Oura denegó el acceso. Revisa el permiso diario y tu membresía antes de volver a conectar.');
       return;
      }
      if(error.status===429){this.retryAt=Math.max(this.now()+this.interval,error.retryAt);this.error='Oura limitó las consultas. ZEN esperará antes de volver a intentarlo.';break;}
     }
     this.error='No se pudo consultar Oura Cloud. Se muestran los últimos datos disponibles.';
    }
   }
   if(abort.signal.aborted||!this.allowed)return;
   this.failures=failed?this.failures+1:0;
   if(changed){
    const limit=addCalendarDays(today,-59);
    for(const resource of ouraResources)for(const day of Object.keys(cache[resource]))if(day<limit)delete cache[resource][day];
    this.storeUpdate({...this.data,cache});
   }
  }).finally(()=>{
   if(!abort.signal.aborted)this.lastAttempt=this.now();
   this.request=undefined;this.running=undefined;
   if(!this.closed){this.deps.changed();this.schedule();}
  });
  this.deps.changed();
  return this.running;
 }
 private storeUpdate(value:Stored){
  try{this.save(value);}
  catch{this.error='No se pudo guardar la consulta en el almacenamiento seguro de Windows.';}
 }
}
