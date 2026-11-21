import {spawn} from 'node:child_process';
import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {existsSync,readFileSync,rmSync} from 'node:fs';

export interface VaultHelloProvider {
 create(signal:AbortSignal):Promise<Buffer>;
 derive(id:Buffer,salt:Buffer,signal:AbortSignal):Promise<Buffer>;
 remove(id:Buffer):Promise<void>;
}

const unavailable='Windows Hello con cifrado no está disponible en esta sesión. Puedes usar la contraseña maestra.';
const failure='No se pudo usar Windows Hello. Puedes usar la contraseña maestra.';
const cancelled='Se canceló la verificación de Windows Hello.';

export function windowsVaultHello(helper:string,windowHandle:()=>string,method:'prf'|'passport'):VaultHelloProvider {
 function call(operation:'create'|'derive'|'remove',input:Record<string,string>,signal?:AbortSignal):Promise<Buffer> {
  return new Promise((resolve,reject)=>{
   if(signal?.aborted){reject(Error(cancelled));return;}
   const command=method==='passport'?'passport-'+operation:operation;
   const child=spawn(helper,[command,windowHandle()],{windowsHide:true,stdio:['pipe','pipe','pipe']});
   const chunks:Buffer[]=[];
   let size=0,nativeStatus='',killTimer:ReturnType<typeof setTimeout>|undefined;
   const cancel=()=>{
    if(method==='passport'){child.kill();return;}
    child.stdin.end('\n');
    killTimer??=setTimeout(()=>child.kill(),3000);
   };
   const timer=setTimeout(cancel,75_000);
   signal?.addEventListener('abort',cancel,{once:true});
   child.stdin.on('error',()=>{});
   child.stderr.setEncoding('utf8').on('data',(chunk:string)=>{nativeStatus=(nativeStatus+chunk).slice(0,64);});
   child.stdout.on('data',(chunk:Buffer)=>{
    size+=chunk.length;
    if(size>1024){chunk.fill(0);child.kill();return;}
    chunks.push(chunk);
   });
   child.once('error',()=>reject(Error(failure)));
   child.once('close',code=>{
    clearTimeout(timer);clearTimeout(killTimer);
    signal?.removeEventListener('abort',cancel);
    const validSize=operation==='derive'?size===32:operation==='create'?
     (method==='passport'?size===272:size>0&&size<=1024):size===0;
    const result=code===0&&validSize?Buffer.concat(chunks,size):undefined;
    for(const chunk of chunks)chunk.fill(0);
    if(result)resolve(result);
    else {
     const status=nativeStatus.trim();
     const problem=code===4&&/^0x[0-9A-F]{8}$/.test(status)?
      'Windows Hello no completó la operación ('+status+'). Puedes usar la contraseña maestra.':failure;
     reject(Error(signal?.aborted||code===3?cancelled:code===2?unavailable:problem));
    }
   });
   child.stdin.write(JSON.stringify(input)+'\n');
  });
 }
 return {
  create:signal=>call('create',{},signal),
  derive:(id,salt,signal)=>call('derive',{Id:id.toString('base64'),Salt:salt.toString('base64')},signal),
  remove:async id=>{await call('remove',{Id:id.toString('base64')});},
 };
}

// Existing PRF bindings keep their original format. New bindings use a random
// wrapping key whose private decryption requires the Passport gesture.
const aad=(version:1|2,id:Buffer,salt:Buffer)=>Buffer.concat([Buffer.from('ZEN vault Hello v'+version+'\0','utf8'),salt,id]);
const invalidBinding='Windows Hello necesita volver a configurarse. Abre la bóveda con la contraseña maestra.';
const decode=(value:unknown)=>typeof value==='string'?Buffer.from(value,'base64'):Buffer.alloc(0);

export class VaultHelloBinding {
 constructor(readonly path:string,private prf:VaultHelloProvider,private write:(path:string,bytes:Uint8Array)=>void,
  private passport?:VaultHelloProvider){}

 get enabled(){return existsSync(this.path);}

 private read() {
  try{
   const record=JSON.parse(readFileSync(this.path,'utf8'));
   const version=record.version;
   const provider=version===1?this.prf:version===2?this.passport:undefined;
   if(!provider||version!==1&&version!==2)return;
   const id=decode(record.id),salt=decode(record.salt),iv=decode(record.iv),tag=decode(record.tag),encrypted=decode(record.encrypted);
   if((version===2?id.length!==272:!id.length||id.length>1024)||salt.length!==32||iv.length!==12||tag.length!==16||encrypted.length!==32)return;
   return {version,provider,id,salt,iv,tag,encrypted};
  }catch{return undefined;}
 }

 async enable(hash:Uint8Array,signal:AbortSignal,check:()=>void) {
  if(this.enabled)throw Error('Windows Hello ya está activado para esta bóveda.');
  const version=this.passport?2:1;
  const provider=this.passport??this.prf;
  const id=await provider.create(signal);
  let key:Buffer|undefined;
  try{
   check();
   const salt=randomBytes(32),iv=randomBytes(12);
   key=await provider.derive(id,salt,signal);
   check();
   const cipher=createCipheriv('aes-256-gcm',key,iv);
   cipher.setAAD(aad(version,id,salt));
   const encrypted=Buffer.concat([cipher.update(hash),cipher.final()]);
   const tag=cipher.getAuthTag();
   const record=Buffer.from(JSON.stringify({
    version,id:id.toString('base64'),salt:salt.toString('base64'),iv:iv.toString('base64'),
    tag:tag.toString('base64'),encrypted:encrypted.toString('base64'),
   }),'utf8');
   try{this.write(this.path,record);}
   catch{throw Error('No se pudo guardar la activación de Windows Hello.');}
  }catch(error){
   await provider.remove(id).catch(()=>{});
   throw error;
  }finally{key?.fill(0);}
 }

 async unlock(signal:AbortSignal,check:()=>void) {
  const binding=this.read();
  if(!binding)throw Error(invalidBinding);
  const {version,provider,id,salt,iv,tag,encrypted}=binding;
  const key=await provider.derive(id,salt,signal);
  let hash:Buffer|undefined;
  try{
   check();
   const decipher=createDecipheriv('aes-256-gcm',key,iv);
   decipher.setAAD(aad(version,id,salt));decipher.setAuthTag(tag);
   hash=decipher.update(encrypted);
   decipher.final();
   return hash;
  }catch(error){
   hash?.fill(0);
   if(signal.aborted)throw error;
   throw Error(invalidBinding);
  }finally{key.fill(0);}
 }

 async disable(){
  const binding=this.read();
  if(binding)await binding.provider.remove(binding.id);
  try{rmSync(this.path,{force:true});}
  catch{throw Error('No se pudo quitar la configuración local de Windows Hello.');}
 }
}
