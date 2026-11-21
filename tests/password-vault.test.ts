import {afterEach,describe,expect,it,vi} from 'vitest';
import {mkdtempSync,readFileSync,readdirSync,rmSync,writeFileSync} from 'node:fs';
import {createHash,createHmac,randomBytes} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PasswordVault,atomicVaultWrite} from '../src/main/password-vault';
import {VaultHelloBinding} from '../src/main/vault-hello';

const directories:string[]=[];
function fixture(write=atomicVaultWrite){const directory=mkdtempSync(join(tmpdir(),'zen-vault-unit-'));directories.push(directory);return new PasswordVault(join(directory,'passwords.kdbx'),write);}
function helloFixture(write=atomicVaultWrite) {
 const local=fixture();
 const secret=randomBytes(32);
 const id=randomBytes(32);
 const provider={
  create:vi.fn(async(_signal:AbortSignal)=>id),
  derive:vi.fn(async(credential:Buffer,salt:Buffer,_signal:AbortSignal)=>{
   if(!id.equals(credential))throw Error('Credencial desconocida');
   return createHmac('sha256',secret).update(salt).digest();
  }),
  remove:vi.fn(async(_id:Buffer)=>{}),
 };
 const binding=new VaultHelloBinding(local.path+'.hello',provider,write);
 const reopen=()=>new PasswordVault(local.path,atomicVaultWrite,binding);
 return {local,provider,binding,vault:reopen(),reopen};
}
const authorized=()=>{};
afterEach(()=>{directories.splice(0).forEach(path=>rmSync(path,{recursive:true,force:true}));});
describe('KDBX password vault',()=>{
 it('encrypts every field, supports duplicate services, edits without revealing and restarts locked',async()=>{
  const vault=fixture();await vault.create('Ficticia maestra 2026!','Ficticia maestra 2026!');
  await vault.change({type:'project',name:'Proyecto ficticio único'});
  const project=vault.snapshot().projects![0].id;
  for(const user of ['uno@ficticio.invalid','dos@ficticio.invalid'])await vault.change({type:'account',project,service:'Servicio ficticio único',user,password:'Clave ficticia secreta 123'});
  const state=vault.snapshot(),account=state.projects![0].accounts[0].id;
  expect(state.projects![0].accounts).toHaveLength(2);expect(JSON.stringify(state)).not.toContain('Clave ficticia');
  expect(vault.secret(project,account,'password')).toBe('Clave ficticia secreta 123');
  await vault.change({type:'account',project,id:account,service:'Servicio editado',user:'nuevo@ficticio.invalid'});
  expect(vault.secret(project,account,'password')).toBe('Clave ficticia secreta 123');
  const disk=readFileSync(vault.path);
  for(const text of ['Proyecto ficticio','Servicio','ficticio.invalid','Clave ficticia','Ficticia maestra'])expect(disk.includes(Buffer.from(text))).toBe(false);
  const restart=new PasswordVault(vault.path);expect(restart.snapshot()).toEqual({exists:true,locked:true});
  expect(()=>restart.secret(project,account,'password')).toThrow();
  await expect(restart.unlock('incorrecta')).rejects.toThrow('No se pudo abrir');
  expect(readFileSync(vault.path)).toEqual(disk);expect(restart.snapshot().projects).toBeUndefined();
  await restart.unlock('Ficticia maestra 2026!');expect(restart.snapshot().projects![0].accounts).toHaveLength(2);
  await restart.change({type:'project',id:project,name:'Renombrado'});
  await restart.change({type:'removeAccount',project,id:account});
  await restart.change({type:'removeProject',id:project,accounts:1});expect(restart.snapshot().projects).toEqual([]);
 },15000);
 it('never creates over an existing or corrupt file and validates master confirmation',async()=>{
  const vault=fixture();await expect(vault.create('a','b')).rejects.toThrow('no coinciden');
  writeFileSync(vault.path,'damaged');await expect(vault.create('a','a')).rejects.toThrow('ya existe');
  await expect(vault.unlock('a')).rejects.toThrow();expect(readFileSync(vault.path,'utf8')).toBe('damaged');
 });
 it('keeps the committed file intact on failed writes and requires unlock again',async()=>{
  let fail=false;const vault=fixture((path,bytes,create)=>{if(fail)throw Error('interrupted');atomicVaultWrite(path,bytes,create);});
  await vault.create('test','test');const before=readFileSync(vault.path);fail=true;
  await expect(vault.change({type:'project',name:'unsaved'})).rejects.toThrow('bloqueado');
  expect(vault.snapshot().locked).toBe(true);expect(readFileSync(vault.path)).toEqual(before);
  expect(readdirSync(directories.at(-1)!)).toEqual(['passwords.kdbx']);
 });
 it('revokes pending unlocks and writes when locked during the KDF',async()=>{
  const vault=fixture();await vault.create('test','test');vault.lock();
  const unlock=vault.unlock('test');vault.lock();await expect(unlock).rejects.toThrow('bloqueado');
  expect(vault.snapshot().locked).toBe(true);await vault.unlock('test');const before=readFileSync(vault.path);
  const write=vault.change({type:'project',name:'late'});vault.lock();await expect(write).rejects.toThrow();
  expect(readFileSync(vault.path)).toEqual(before);expect(vault.snapshot().locked).toBe(true);
 });
 it('cleans an encrypted temporary file if atomic replacement fails',()=>{
  const vault=fixture();writeFileSync(vault.path,'original');
  expect(()=>atomicVaultWrite(vault.path,new Uint8Array([1]),true)).toThrow();
  expect(readFileSync(vault.path,'utf8')).toBe('original');expect(readdirSync(directories.at(-1)!)).toEqual(['passwords.kdbx']);
 });
});

describe('local Windows Hello binding',()=>{
 it('validates the master before enrollment and keeps the KDBX portable after restart and revocation',async()=>{
  const {vault,local,binding,provider,reopen}=helloFixture();
  const master='ficticia ⛅ para Hello';
  await vault.create(master,master);
  await vault.change({type:'project',name:'Proyecto Hello'});
  const original=readFileSync(vault.path);
  expect(vault.snapshot().hello).toBe('available');
  await expect(vault.enableHello('wrong',authorized)).rejects.toThrow('contraseña maestra');
  expect(provider.create).not.toHaveBeenCalled();
  await vault.enableHello(master,authorized);
  const record=readFileSync(binding.path,'utf8');
  expect(record).not.toContain(master);
  expect(record).not.toContain(createHash('sha256').update(master).digest('base64'));
  expect(readFileSync(vault.path)).toEqual(original);
  const restarted=reopen();
  expect(restarted.snapshot()).toMatchObject({locked:true,hello:'enabled'});
  expect((await restarted.unlockHello(authorized)).projects?.[0].name).toBe('Proyecto Hello');
  await restarted.disableHello(authorized);
  expect(provider.remove).toHaveBeenCalledOnce();
  expect(binding.enabled).toBe(false);
  expect(readFileSync(vault.path)).toEqual(original);
  expect((await local.unlock(master)).projects?.[0].name).toBe('Proyecto Hello');
 },15000);

 it('rejects altered ciphertext and preserves the master route if verification fails',async()=>{
  const {vault,binding,provider}=helloFixture();
  await vault.create('fixture','fixture');
  await vault.enableHello('fixture',authorized);
  vault.lock();
  provider.derive.mockRejectedValueOnce(Error('Verificación cancelada'));
  await expect(vault.unlockHello(authorized)).rejects.toThrow('cancelada');
  const record=JSON.parse(readFileSync(binding.path,'utf8'));
  record.encrypted=Buffer.alloc(32).toString('base64');
  writeFileSync(binding.path,JSON.stringify(record));
  await expect(vault.unlockHello(authorized)).rejects.toThrow('volver a configurarse');
  expect(vault.snapshot()).toMatchObject({locked:true,hello:'enabled'});
  await vault.unlock('fixture');
  expect(vault.snapshot().locked).toBe(false);
 });

 it('revokes enrollment and unlock when locking during the native prompt',async()=>{
  const {vault,binding,provider}=helloFixture();
  await vault.create('fixture','fixture');
  let release:(key:Buffer<ArrayBuffer>)=>void=()=>{};
  provider.derive.mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;}));
  const enrollment=vault.enableHello('fixture',authorized);
  await vi.waitFor(()=>expect(provider.derive).toHaveBeenCalledTimes(1));
  vault.lock();
  const lateKey=Buffer.alloc(32,3);release(lateKey);
  await expect(enrollment).rejects.toThrow('bloqueado');
  expect(lateKey).toEqual(Buffer.alloc(32));
  expect(provider.derive.mock.calls[0][2].aborted).toBe(true);
  expect(provider.remove).toHaveBeenCalledOnce();
  expect(binding.enabled).toBe(false);
  await vault.unlock('fixture');
  await vault.enableHello('fixture',authorized);
  vault.lock();
  provider.derive.mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;}));
  const unlocking=vault.unlockHello(authorized);
  vault.lock();release(Buffer.alloc(32));
  await expect(unlocking).rejects.toThrow('bloqueado');
  expect(vault.snapshot().locked).toBe(true);
 });

 it('rolls back credential enrollment when the binding cannot be written',async()=>{
  const {vault,binding,provider}=helloFixture(()=>{throw Error('write failure');});
  await vault.create('fixture','fixture');
  const original=readFileSync(vault.path);
  await expect(vault.enableHello('fixture',authorized)).rejects.toThrow('guardar la activación');
  expect(provider.remove).toHaveBeenCalledOnce();
  expect(binding.enabled).toBe(false);
  expect(readFileSync(vault.path)).toEqual(original);
 });

 it('enrolls with the Passport provider and keeps existing PRF bindings usable',async()=>{
  const {local,vault,binding,provider}=helloFixture();
  const passportId=randomBytes(272);
  const passportKey=randomBytes(32);
  const passport={
   create:vi.fn(async()=>passportId),
   derive:vi.fn(async(id:Buffer)=>{
    if(!passportId.equals(id))throw Error('Clave local desconocida');
    return Buffer.from(passportKey);
   }),
   remove:vi.fn(async(_id:Buffer)=>{}),
  };
  await vault.create('fixture','fixture');
  const original=readFileSync(vault.path);
  await vault.enableHello('fixture',authorized);
  const upgradedBinding=new VaultHelloBinding(binding.path,provider,atomicVaultWrite,passport);
  const upgraded=new PasswordVault(local.path,atomicVaultWrite,upgradedBinding);
  await upgraded.unlockHello(authorized);
  expect(passport.derive).not.toHaveBeenCalled();
  await upgraded.disableHello(authorized);
  expect(provider.remove).toHaveBeenCalledOnce();
  await upgraded.enableHello('fixture',authorized);
  expect(passport.create).toHaveBeenCalledOnce();
  expect(JSON.parse(readFileSync(binding.path,'utf8')).version).toBe(2);
  upgraded.lock();
  await upgraded.unlockHello(authorized);
  expect(passport.derive).toHaveBeenCalledTimes(2);
  await upgraded.disableHello(authorized);
  expect(passport.remove).toHaveBeenCalledWith(passportId);
  expect(readFileSync(local.path)).toEqual(original);
 },15000);
});
