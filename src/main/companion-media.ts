import {spawn,type ChildProcessWithoutNullStreams} from 'node:child_process';
import {z} from 'zod';
import {MediaSession,MediaTrack,MediaCommand,MediaNowPlaying} from '../shared/companion-media';
export interface MediaRpc{request(method:string,params?:Record<string,unknown>):Promise<any>;close():void;}
/** Private, bounded line protocol to the fixed Windows helper. No shell and no retry. */
export class NativeMediaRpc implements MediaRpc{
 private child:ChildProcessWithoutNullStreams;private next=0;private pending?:{id:number;resolve:(v:any)=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>};private buffer='';private closed=false;
 constructor(executable:string){
  this.child=spawn(executable,[],{stdio:'pipe',windowsHide:true,shell:false});this.child.stderr.resume();this.child.stdin.on('error',()=>this.close());this.child.on('error',()=>this.close());this.child.on('close',()=>this.close());this.child.stdout.setEncoding('utf8');
  this.child.stdout.on('data',(chunk:string)=>{this.buffer+=chunk;if(this.buffer.length>800000){this.close();return;}let cut;while((cut=this.buffer.indexOf('\n'))>=0){const line=this.buffer.slice(0,cut);this.buffer=this.buffer.slice(cut+1);try{const r=JSON.parse(line),p=this.pending;if(!p||r.id!==p.id)continue;clearTimeout(p.timer);this.pending=undefined;if(r.ok===true)p.resolve(r.result);else p.reject(Error(r.error==='stale'?'La sesión cambió. Elige de nuevo el reproductor.':r.error==='unsupported'?'Este control no está disponible en el reproductor.':'Windows no pudo completar la petición multimedia.'));}catch{this.close();return;}}});
 }
 request(method:string,params:Record<string,unknown>={}){if(this.closed)return Promise.reject(Error('El reproductor se ha desconectado.'));if(this.pending)return Promise.reject(Error('Hay otra consulta multimedia en curso.'));return new Promise<any>((resolve,reject)=>{const id=++this.next,timer=setTimeout(()=>this.close(),6000);this.pending={id,resolve,reject,timer};this.child.stdin.write(JSON.stringify({id,method,...params})+'\n');});}
 close(){if(this.closed)return;this.closed=true;const p=this.pending;this.pending=undefined;if(p){clearTimeout(p.timer);p.reject(Error('El reproductor se ha desconectado. Comprueba de nuevo la sesión.'));}this.child.stdin.end();this.child.kill();}
}
/** UI actions act on one explicitly selected, revocable Windows media session. */
export class CompanionMedia{
 private rpc?:MediaRpc;private generation=0;private queued=0;private chain:Promise<unknown>=Promise.resolve();private sessions:MediaSession[]=[];private track?:MediaTrack;private used=new Set<string>();
 constructor(private factory:()=>MediaRpc,private allowed:()=>boolean){}
 current(){this.check();return this.track?structuredClone(this.track):null;}
 private check(){if(!this.allowed())throw Error('Abre Música y desactiva Presentación o pausa para usar el reproductor.');}
 private query(method:string,params:Record<string,unknown>={}){this.check();if(this.queued>=4)throw Error('El reproductor está actualizando su estado.');this.queued++;const generation=this.generation;const run=async()=>{try{this.check();if(generation!==this.generation)throw Error('La sesión ya no está activa.');const rpc=this.rpc??=this.factory();const value=await rpc.request(method,params);this.check();if(generation!==this.generation)throw Error('La sesión ya no está activa.');return value;}catch(e){if(generation===this.generation)this.close();throw e;}finally{this.queued--;}};const result=this.chain.then(run,run);this.chain=result.catch(()=>{});return result;}
 private accept(value:unknown,id:string){try{const track=MediaTrack.parse(value);if(track.session!==id)throw Error();return this.track=track;}catch{this.close();throw Error('La información multimedia cambió o no es válida. Elige de nuevo la fuente.');}}
 async list(){this.check();this.track=undefined;this.sessions=[];const value=await this.query('list');try{return this.sessions=z.object({sessions:z.array(MediaSession).max(16)}).strict().parse(value).sessions;}catch{this.close();throw Error('No se pudo validar la lista de reproductores.');}}
 async select(id:string){this.check();if(!this.sessions.some(s=>s.id===id))throw Error('Elige una sesión de la lista actual.');return this.accept(await this.query('select',{session:id}),id);}
 async read(id:string){if(this.track?.session!==id)throw Error('Elige de nuevo el reproductor.');return this.accept(await this.query('read',{session:id}),id);}
 async command(raw:MediaCommand){
  this.check();const v=MediaCommand.parse(raw);if(this.track?.session!==v.session)throw Error('El destino multimedia cambió.');if(this.used.has(v.id))throw Error('Esta acción ya se ha enviado.');if(!this.track.controls[v.action])throw Error('Este control no está disponible en el reproductor.');
  this.used.add(v.id);if(this.used.size>256)this.used.delete(this.used.values().next().value!);const result=await this.query('action',{session:v.session,action:v.action,...(v.value?{value:v.value}:{})});return z.object({accepted:z.boolean()}).strict().parse(result);
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
