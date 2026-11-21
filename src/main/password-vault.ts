import {existsSync,readFileSync,openSync,writeFileSync,fsyncSync,closeSync,renameSync,rmSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {Kdbx,Credentials,ProtectedValue,CryptoEngine,Consts,VarDictionary,Int64,type KdbxEntry} from 'kdbxweb';
import {argon2id} from 'hash-wasm';
import type {VaultChange,VaultSnapshot} from '../shared/password-vault';
import type {VaultHelloBinding} from './vault-hello';

// KDBX 4 authenticates the entire encrypted database.
CryptoEngine.setArgon2Impl(async (password,salt,memory,iterations,length,parallelism,type,version) => {
 if(type!==2||version!==0x13)throw Error('KDF no admitida.');
 const result=await argon2id({password:new Uint8Array(password),salt:new Uint8Array(salt),memorySize:memory,
  iterations,parallelism,hashLength:length,outputType:'binary'});
 return new Uint8Array(result).buffer;
});
const credentials=(master:string)=>new Credentials(ProtectedValue.fromString(master));
const field=(entry:KdbxEntry,key:string)=>{
 const value=entry.fields.get(key);
 return value instanceof ProtectedValue?value.getText():value??'';
};

export function atomicVaultWrite(path:string,bytes:Uint8Array,create=false) {
 const temporary=path+'.'+randomUUID()+'.tmp';
 let fd:number|undefined;
 try {
  fd=openSync(temporary,'wx',0o600);writeFileSync(fd,bytes);fsyncSync(fd);closeSync(fd);fd=undefined;
  if(create&&existsSync(path))throw Error('La bóveda ya existe.');
  renameSync(temporary,path);
 } finally {if(fd!==undefined)closeSync(fd);rmSync(temporary,{force:true});}
}

export class PasswordVault {
 private db?:Kdbx;
 private epoch=0;
 private busy=false;
 private helloOperation?:AbortController;
 constructor(readonly path:string,private write=atomicVaultWrite,private hello?:VaultHelloBinding){}
 lock(){this.epoch++;this.db=undefined;this.helloOperation?.abort();}
 snapshot():VaultSnapshot {
  const db=this.db;
  const exists=!!db||existsSync(this.path);
  const hello=exists&&this.hello?(this.hello.enabled?'enabled':'available'):undefined;
  const local=hello?{hello} as const:{};
  if(!db)return {exists,locked:true,...local};
  return {exists:true,locked:false,...local,projects:db.getDefaultGroup().groups.map(group=>({id:group.uuid.id,name:group.name??'',
   accounts:group.entries.map(entry=>({id:entry.uuid.id,service:field(entry,'Title'),user:field(entry,'UserName')}))}))};
 }
 private async exclusive<T>(run:(epoch:number)=>Promise<T>) {
  if(this.busy)throw Error('Espera a que termine la operación de la bóveda.');
  this.busy=true;
  try{return await run(this.epoch);}finally{this.busy=false;}
 }
 private current(epoch:number){if(epoch!==this.epoch)throw Error('La bóveda se ha bloqueado.');}
 async create(master:string,confirmation:string) {
  return this.exclusive(async epoch=>{
   if(existsSync(this.path))throw Error('La bóveda ya existe. Desbloquéala con su contraseña maestra.');
   if(!master||master!==confirmation)throw Error('Las contraseñas maestras no coinciden.');
   const db=Kdbx.create(credentials(master),'ZEN');db.setVersion(4);db.setKdf(Consts.KdfId.Argon2id);
   db.meta.recycleBinEnabled=false;db.getDefaultGroup().groups=[];
   const params=db.header.kdfParameters!;
   params.set('M',VarDictionary.ValueType.UInt64,Int64.from(64*1024*1024));
   params.set('I',VarDictionary.ValueType.UInt64,Int64.from(3));
   params.set('P',VarDictionary.ValueType.UInt32,1);
   const bytes=new Uint8Array(await db.save());this.current(epoch);
   this.write(this.path,bytes,true);this.db=db;return this.snapshot();
  });
 }
 async unlock(master:string) {
  return this.exclusive(async epoch=>this.load(credentials(master),()=>this.current(epoch)));
 }
 private async load(authentication:Credentials,check:()=>void) {
  this.db=undefined;
  let db:Kdbx;
  try {db=await this.read(authentication);}
  catch {throw Error('No se pudo abrir la bóveda. Comprueba la contraseña maestra y el archivo.');}
  check();this.db=db;return this.snapshot();
 }
 private read(authentication:Credentials) {
  const bytes=readFileSync(this.path);
  return Kdbx.load(new Uint8Array(bytes).buffer,authentication);
 }
 private async withHello<T>(run:(binding:VaultHelloBinding,signal:AbortSignal,check:()=>void)=>Promise<T>,authorize:()=>void) {
  return this.exclusive(async epoch=>{
   const binding=this.hello;
   if(!binding)throw Error('Windows Hello no está disponible.');
   const check=()=>{this.current(epoch);authorize();};
   const controller=new AbortController();this.helloOperation=controller;
   try {return await run(binding,controller.signal,check);}
   finally{this.helloOperation=undefined;}
  });
 }
 async enableHello(master:string,authorize:()=>void) {
  return this.withHello(async (binding,signal,check)=>{
   this.database();
   const authentication=credentials(master);
   try {await this.read(authentication);}
   catch {throw Error('La contraseña maestra no es correcta o la bóveda no está disponible.');}
   check();
   const hash=authentication.passwordHash!.getBinary();
   try{await binding.enable(hash,signal,check);}
   finally{hash.fill(0);}
   return this.snapshot();
  },authorize);
 }
 async unlockHello(authorize:()=>void) {
  return this.withHello(async (binding,signal,check)=>{
   this.db=undefined;
   const hash=await binding.unlock(signal,check);
   const authentication=new Credentials(null);
   try{authentication.passwordHash=ProtectedValue.fromBinary(new Uint8Array(hash).buffer);}
   finally{hash.fill(0);}
   return this.load(authentication,check);
  },authorize);
 }
 async disableHello(authorize:()=>void) {
  return this.withHello(async (binding,_signal,check)=>{
   this.database();check();
   await binding.disable();check();
   return this.snapshot();
  },authorize);
 }
 private database(){if(!this.db)throw Error('Desbloquea la bóveda.');return this.db;}
 private account(project:string,id:string){
  const group=this.database().getDefaultGroup().groups.find(g=>g.uuid.id===project);
  const entry=group?.entries.find(e=>e.uuid.id===id);
  if(!entry)throw Error('La cuenta ya no está disponible.');return entry;
 }
 secret(project:string,id:string,which:'user'|'password'){return field(this.account(project,id),which==='user'?'UserName':'Password');}
 async change(change:VaultChange) {
  return this.exclusive(async epoch=>{
   const db=this.database(),root=db.getDefaultGroup();
   // If persistence fails, discard the mutated session; the previous disk file stays authoritative.
   try {
    if(change.type==='project'){
     if(change.id){const group=root.groups.find(g=>g.uuid.id===change.id);if(!group)throw Error();group.name=change.name;group.times.update();}
     else db.createGroup(root,change.name);
    }else{
     const project=change.type==='removeProject'?change.id:change.project;
     const group=root.groups.find(g=>g.uuid.id===project);if(!group)throw Error();
     if(change.type==='removeProject'){
      if(group.entries.length!==change.accounts)throw Error();
      db.remove(group);
     }else if(change.type==='removeAccount')db.remove(this.account(change.project,change.id));
     else {
      if(!change.id&&!change.password)throw Error();
      const entry=change.id?this.account(change.project,change.id):db.createEntry(group);
      entry.fields.set('Title',change.service);entry.fields.set('UserName',change.user);
      if(change.password!==undefined)entry.fields.set('Password',ProtectedValue.fromString(change.password));
      entry.times.update();entry.history=[];
     }
    }
    const bytes=new Uint8Array(await db.save());this.current(epoch);
    this.write(this.path,bytes);return this.snapshot();
   }catch {this.lock();throw Error('No se pudo guardar. La bóveda se ha bloqueado; vuelve a abrirla.');}
  });
 }
}
