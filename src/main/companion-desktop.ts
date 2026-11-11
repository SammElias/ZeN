import {spawn,type ChildProcessWithoutNullStreams} from 'node:child_process';
import {z} from 'zod';
const Identity=z.object({handle:z.string().regex(/^\d{1,20}$/),pid:z.number().int().positive(),started:z.string().regex(/^\d{1,20}$/)}).strict();
const Rect=z.object({x:z.number().int(),y:z.number().int(),width:z.number().int().positive().max(100000),height:z.number().int().positive().max(100000)}).strict();
const RestoreResult=z.object({ok:z.boolean(),error:z.enum(['stale','denied']).optional()}).strict();
const OutsideClick=z.object({event:z.literal('outside-click')}).strict();
export const DesktopObservation=z.object({previous:Identity.nullable(),name:z.string().max(100).nullable(),foreground:z.string().regex(/^\d{1,20}$/),fullscreen:Rect.nullable()}).strict();
export type DesktopObservation=z.infer<typeof DesktopObservation>;
const names:Record<string,string>={chrome:'Google Chrome',msedge:'Microsoft Edge',firefox:'Firefox',EXCEL:'Excel',WINWORD:'Word',POWERPNT:'PowerPoint',explorer:'Explorador de archivos',Code:'Visual Studio Code'};
/** Owns one event-driven observer. Only a human click starts a restore subprocess. */
export class CompanionDesktop{
 observation?:DesktopObservation;error?:string;private child?:ChildProcessWithoutNullStreams;private restoring=false;
 constructor(private executable:string,private changed:()=>void,private outsideClick?:{windowHandle:string;dismiss:()=>void}){}
 status(){return{available:!!this.observation?.previous,name:this.observation?.name?(names[this.observation.name]??this.observation.name):undefined,error:this.error};}
 start(){
  if(this.child)return;
  const args=['--watch',String(process.pid)];
  if(this.outsideClick)args.push(this.outsideClick.windowHandle);
  const child=this.child=spawn(this.executable,args,{stdio:'pipe',windowsHide:true,shell:false});
  let buffer='';
  child.stderr.resume();
  child.stdin.on('error',()=>child.kill());
  child.stdout.setEncoding('utf8');
  child.stdout.on('data',(chunk:string)=>{
   if(this.child!==child)return;
   buffer+=chunk;
   let cut;
   while((cut=buffer.indexOf('\n'))>=0){
    if(cut>16000){child.kill();return;}
    const line=buffer.slice(0,cut);
    buffer=buffer.slice(cut+1);
    try{
     const record:unknown=JSON.parse(line);
     if(OutsideClick.safeParse(record).success){
      this.outsideClick?.dismiss();
      continue;
     }
     const observation=DesktopObservation.parse(record);
     if(!this.observation)this.error=undefined;
     this.observation=observation;
     this.changed();
    }catch{/* Malformed observations cannot replace the previous window identity. */}
   }
   if(buffer.length>16000)child.kill();
  });
  const closed=()=>{
   if(this.child!==child)return;
   this.child=undefined;
   this.observation=undefined;
   this.error='Control de ventanas no disponible.';
   this.changed();
  };
  child.once('error',closed);
  child.once('close',closed);
 }
 async restore(){
  if(this.restoring)throw Error('El retorno ya está en curso.');const identity=this.observation?.previous;if(!identity)throw Error('Activa primero una aplicación de trabajo.');
  this.restoring=true;try{
   const result=await new Promise<{ok:boolean;error?:string}>((resolve,reject)=>{
    const child=spawn(this.executable,['--restore'],{stdio:'pipe',windowsHide:true,shell:false});
    let output='';
    const timer=setTimeout(()=>{child.kill();reject(Error('Windows no respondió al cambio de ventana.'));},2500);
    child.stderr.resume();
    child.stdin.on('error',()=>{});
    child.stdout.setEncoding('utf8');
    child.stdout.on('data',chunk=>{output+=chunk;if(output.length>1000)child.kill();});
    child.once('error',error=>{clearTimeout(timer);reject(error);});
    child.once('close',code=>{
     clearTimeout(timer);
     try{
      if(code!==0||output.length>1000)throw Error();
      resolve(RestoreResult.parse(JSON.parse(output)));
     }catch{reject(Error('No se pudo comprobar el retorno.'));}
    });
    child.stdin.end(JSON.stringify(identity));
   });
   if(!result.ok){if(result.error==='stale'&&this.observation?.previous===identity)this.observation={...this.observation,previous:null,name:null};throw Error(result.error==='stale'?'La ventana anterior ya no está disponible.':'Windows no permitió cambiar el foco. Usa Alt+Tab.');}
   this.error=undefined;return true;
  }catch(e){this.error=(e as Error).message;throw e;}finally{this.restoring=false;this.changed();}
 }
 close(){
  const child=this.child;
  if(!child)return;
  this.child=undefined;
  this.observation=undefined;
  const timer=setTimeout(()=>child.kill(),1000);
  timer.unref();
  child.once('close',()=>clearTimeout(timer));
  child.stdin.end();
 }
}
