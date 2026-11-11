import {spawn,type ChildProcessWithoutNullStreams} from 'node:child_process';
import {z} from 'zod';
import {MediaSession,MediaTrack,MediaCommand,MediaNowPlaying,MediaSnapshot} from '../shared/companion-media';
type MediaMethod = 'list' | 'select' | 'read' | 'action' | 'nowPlaying' | 'snapshot';
export interface MediaRpc{request(method:MediaMethod,params?:Record<string,unknown>):Promise<unknown>;close():void;}
type MediaQuery = <T>(method:MediaMethod,params:Record<string,unknown>,accept:(value:unknown)=>T)=>Promise<T>;
/** Private, bounded line protocol to the fixed Windows helper. No shell and no retry. */
export class NativeMediaRpc implements MediaRpc{
 private child:ChildProcessWithoutNullStreams;private next=0;private pending?:{id:number;resolve:(v:unknown)=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>};private buffer='';private closed=false;
 constructor(executable:string){
  this.child=spawn(executable,[],{stdio:'pipe',windowsHide:true,shell:false});this.child.stderr.resume();this.child.stdin.on('error',()=>this.close());this.child.on('error',()=>this.close());this.child.on('close',()=>this.close());this.child.stdout.setEncoding('utf8');
  this.child.stdout.on('data',(chunk:string)=>{this.buffer+=chunk;if(this.buffer.length>800000){this.close();return;}let cut;while((cut=this.buffer.indexOf('\n'))>=0){const line=this.buffer.slice(0,cut);this.buffer=this.buffer.slice(cut+1);try{const r=JSON.parse(line),p=this.pending;if(!p||r.id!==p.id)continue;clearTimeout(p.timer);this.pending=undefined;if(r.ok===true)p.resolve(r.result);else p.reject(Error(r.error==='stale'?'La sesión cambió. Elige de nuevo el reproductor.':r.error==='unsupported'?'Este control no está disponible en el reproductor.':'Windows no pudo completar la petición multimedia.'));}catch{this.close();return;}}});
 }
 request(method:MediaMethod,params:Record<string,unknown>={}){if(this.closed)return Promise.reject(Error('El reproductor se ha desconectado.'));if(this.pending)return Promise.reject(Error('Hay otra consulta multimedia en curso.'));return new Promise<unknown>((resolve,reject)=>{const id=++this.next,timer=setTimeout(()=>this.close(),6000);this.pending={id,resolve,reject,timer};this.child.stdin.write(JSON.stringify({id,method,...params})+'\n');});}
 close(){if(this.closed)return;this.closed=true;const p=this.pending;this.pending=undefined;if(p){clearTimeout(p.timer);p.reject(Error('El reproductor se ha desconectado. Comprueba de nuevo la sesión.'));}this.child.stdin.end();this.child.kill();}
}
/** UI actions act only on the exact session shown by the player. */
export class CompanionMedia{
 private rpc?:MediaRpc;private generation=0;private queued=0;private chain:Promise<unknown>=Promise.resolve();private sessions:MediaSession[]=[];private track?:MediaTrack;private used=new Set<string>();
 constructor(private factory:()=>MediaRpc,private allowed:()=>boolean){}
 current(){this.check();return this.track?structuredClone(this.track):null;}
 private check(){if(!this.allowed())throw Error('Abre Sonido y desactiva Presentación o pausa para usar el reproductor.');}
 private enqueue<T>(operation:(query:MediaQuery)=>Promise<T>){
  this.check();
  if(this.queued>=4)throw Error('El reproductor está actualizando su estado.');
  this.queued++;
  const generation=this.generation;
  const verify=()=>{
   this.check();
   if(generation!==this.generation)throw Error('La sesión ya no está activa.');
  };
  const query:MediaQuery=async(method,params,accept)=>{
   let value:unknown;
   try{
    verify();
    const rpc=this.rpc??=this.factory();
    value=await rpc.request(method,params);
    verify();
   }catch(error){
    if(generation===this.generation)this.close();
    throw error;
   }
   return accept(value);
  };
  const run=async()=>{
   try{verify();return await operation(query);}
   finally{this.queued--;}
  };
  const result=this.chain.then(run);
  this.chain=result.catch(()=>{});
  return result;
 }
 private accept(value:unknown,id:string){try{const track=MediaTrack.parse(value);if(track.session!==id)throw Error();return this.track=track;}catch{this.close();throw Error('La información multimedia cambió o no es válida. Elige de nuevo la fuente.');}}
 snapshot(followSystem?:true){
  return this.enqueue(query=>query('snapshot',followSystem?{followSystem}:{},value=>{
   const result=MediaSnapshot.safeParse(value);
   if(!result.success){this.close();throw Error('Windows no pudo actualizar el reproductor.');}
   this.sessions=result.data.sessions;
   this.track=result.data.track??undefined;
   return result.data;
  }));
 }
 async list(){
  this.check();
  this.track=undefined;
  this.sessions=[];
  return this.enqueue(query=>query('list',{},value=>{
   try{return this.sessions=z.object({sessions:z.array(MediaSession).max(16)}).strict().parse(value).sessions;}
   catch{this.close();throw Error('No se pudo validar la lista de reproductores.');}
  }));
 }
 private listed(id:string){
  if(!this.sessions.some(session=>session.id===id))throw Error('Elige una sesión de la lista actual.');
 }
 async select(id:string){
  this.check();
  this.listed(id);
  return this.enqueue(query=>{
   this.listed(id);
   return query('select',{session:id},value=>this.accept(value,id));
  });
 }
 private selected(id:string,message:string){
  if(this.track?.session!==id)throw Error(message);
  return this.track;
 }
 async read(id:string){
  const requireSelection=()=>this.selected(id,'Elige de nuevo el reproductor.');
  requireSelection();
  return this.enqueue(query=>{
   requireSelection();
   return query('read',{session:id},value=>this.accept(value,id));
  });
 }
 async command(raw:MediaCommand){
  this.check();
  const {id,session,action,value}=MediaCommand.parse(raw);
  const requireSelection=()=>this.selected(session,'El destino multimedia cambió.');
  const requireControl=()=>{
   if(!requireSelection().controls[action])throw Error('Este control no está disponible en el reproductor.');
  };
  requireSelection();
  if(this.used.has(id))throw Error('Esta acción ya se ha enviado.');
  requireControl();
  this.used.add(id);
  if(this.used.size>256)this.used.delete(this.used.values().next().value!);
  return this.enqueue(query=>{
   requireControl();
   return query('action',{session,action,...(value?{value}:{})},result=>z.object({accepted:z.boolean()}).strict().parse(result));
  });
 }
 close(){this.generation++;this.track=undefined;this.sessions=[];this.rpc?.close();this.rpc=undefined;}
}

/** Read-only header observation. Its helper and lifecycle are independent of manual playback authority. */
export class CompanionMediaObserver{
 private rpc?:MediaRpc;private generation=0;private track:MediaNowPlaying|null=null;private pending?:Promise<MediaNowPlaying|null>;
 constructor(private factory:()=>MediaRpc,private allowed:()=>boolean){}
 private check(){if(!this.allowed()){this.close();throw Error('La información multimedia está oculta mientras ZEN está oculto, en pausa o en Presentación.');}}
 current(){this.check();return this.track?structuredClone(this.track):null;}
 async read():Promise<MediaNowPlaying|null>{
  this.check();if(this.pending)return this.pending;
  const generation=this.generation;
  const run=async()=>{
   try{
    this.check();const rpc=this.rpc??=this.factory();const result=await rpc.request('nowPlaying');
    this.check();if(generation!==this.generation)throw Error('La observación multimedia ya no está activa.');
    const value=z.object({track:MediaNowPlaying.nullable()}).strict().parse(result).track;
    this.track=value;return value?structuredClone(value):null;
   }catch(e){if(generation===this.generation)this.close();throw e;}
  };
  const pending=run();this.pending=pending;
  try{return await pending;}finally{if(this.pending===pending)this.pending=undefined;}
 }
 close(){this.generation++;this.track=null;this.pending=undefined;this.rpc?.close();this.rpc=undefined;}
}
