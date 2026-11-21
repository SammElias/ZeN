import {randomUUID} from 'node:crypto';
import type {BrowserWindow} from 'electron';
import {VaultRequest,VAULT_REVEAL_MS,vaultSignalChannel,type VaultReply,type VaultSignal} from '../shared/password-vault';
import {PasswordVault} from './password-vault';
import type {CompanionIpcHandler,CompanionWindowDialog} from './companion-ipc';

export function registerVaultIpc(handle:CompanionIpcHandler,window:BrowserWindow,vault:PasswordVault,
 allowed:()=>boolean,copy:(text:string)=>Promise<void>,withDialog:CompanionWindowDialog=show=>show()) {
 let session:string|undefined,revealTimer:ReturnType<typeof setTimeout>|undefined;
 const signal=(value:VaultSignal)=>{if(!window.isDestroyed())window.webContents.send(vaultSignalChannel,value);};
 const conceal=()=>{clearTimeout(revealTimer);signal('conceal');};
 const lock=()=>{session=undefined;vault.lock();conceal();signal('lock');};
 handle('vault',VaultRequest,async (action):Promise<VaultReply>=>{
  if(action.type==='lock'){lock();return {type:'state',state:vault.snapshot()};}
  if(action.type==='conceal'){conceal();return {type:'state',state:{exists:true,locked:true}};}
  if(!allowed()) {lock();throw Error('Abre Contraseñas y desactiva Pausa o Presentación.');}
  if(action.type==='enter'){
   // The entering view already starts empty. Sending an extra async lock here could race
   // the subsequent explicit unlock reply and erase its newly rendered state.
   session=undefined;vault.lock();clearTimeout(revealTimer);session=randomUUID();
   return {type:'state',session,state:vault.snapshot()};
  }
  const current=action.session;
  const check=()=>{if(!allowed()||session!==current)throw Error('La bóveda se ha bloqueado.');};
  check();
  try {
   if(action.type==='create'||action.type==='unlock') {
    if(!window.isFocused())throw Error('Activa ZEN para desbloquear la bóveda.');
    const state=action.type==='create'?await vault.create(action.master,action.confirmation):await vault.unlock(action.master);
    check();return {type:'state',state};
   }
   if(action.type==='hello-unlock'||action.type==='hello-enable'||action.type==='hello-disable'){
    if(!window.isFocused())throw Error('Activa ZEN para usar Windows Hello.');
    const state=action.type==='hello-disable'?await vault.disableHello(check):
     await withDialog(()=>action.type==='hello-unlock'?vault.unlockHello(check):vault.enableHello(action.master,check));
    check();return {type:'state',state};
   }
   if(!window.isFocused())throw Error('Activa ZEN para usar las credenciales.');
   if(action.type==='change'){conceal();const state=await vault.change(action.change);check();return {type:'state',state};}
   if(action.type==='reveal'){
    clearTimeout(revealTimer);const value=vault.secret(action.project,action.id,'password');
    const expiresAt=Date.now()+VAULT_REVEAL_MS;revealTimer=setTimeout(conceal,VAULT_REVEAL_MS);
    return {type:'secret',value,expiresAt};
   }
   conceal();await copy(vault.secret(action.project,action.id,action.field));check();return {type:'copied'};
  }catch(error){if(action.type==='change'&&vault.snapshot().locked)signal('lock');throw error;}
 });
 const lockBeforeTransition=()=>{
  const sensitive=!vault.snapshot().locked;lock();
  if(!sensitive)return;
  // Native clipping runs in main. Wait for the scrubbed renderer frame before moving
  // the outgoing surface; a queued IPC signal alone is not a compositor barrier.
  return window.webContents.executeJavaScript("window.dispatchEvent(new Event('zen-vault-conceal'))")
   .then(()=>window.webContents.capturePage({x:0,y:0,width:1,height:1},{stayAwake:true}))
   .then(()=>true,()=>false);
 };
 return {lock,conceal,lockBeforeTransition};
}
