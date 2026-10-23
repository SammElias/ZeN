import {mkdir,readFile,writeFile,rename,copyFile,lstat} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash,randomBytes} from 'node:crypto';
import {createServer,type Server} from 'node:net';
import {hookEvents} from '../shared/codex-companion';
import type {CompanionHub} from './companion-hub';
export function mergeCompanionHooks(raw:any,command:string,previousCommands:string[]=[]){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||raw.hooks&&(typeof raw.hooks!=='object'||Array.isArray(raw.hooks)))throw Error('hooks.json no tiene un formato válido.');
 const next=structuredClone(raw);next.hooks??={};
 for(const event of hookEvents){const groups=next.hooks[event]??[];if(!Array.isArray(groups))throw Error('hooks.json contiene un grupo no reconocido.');
  next.hooks[event]=groups.map((g:any)=>({...g,hooks:Array.isArray(g.hooks)?g.hooks.filter((h:any)=>!(typeof h.command==='string'&&(h.command===command||previousCommands.includes(h.command)))):g.hooks})).filter((g:any)=>!Array.isArray(g.hooks)||g.hooks.length);
  next.hooks[event].push({hooks:[{type:'command',command,timeout:event==='PermissionRequest'?120:['Interrupt','SessionEnd'].includes(event)?3:5,...(event==='PermissionRequest'?{statusMessage:'Revisa el permiso en la cápsula de ZEN'}:{})}]});
 }return next;
}
export class CompanionIntegration{
 readonly root:string;readonly pipe:string;private token='';private server?:Server;
 constructor(private profile:string,private codexHome:string,private binaryDirectory:string,private hub:CompanionHub){this.root=join(profile,'codex-companion');this.pipe='zen-codex-'+createHash('sha256').update(profile.toLowerCase()).digest('hex').slice(0,24);}
 get executable(){return join(this.root,'Zen.CodexHook.exe');}
 get command(){return companionHookCommand(this.executable);}
 async start(){await mkdir(this.root,{recursive:true});try{const p=JSON.parse(await readFile(join(this.root,'bridge.json'),'utf8'));if(typeof p.token==='string'&&/^[a-f0-9]{64}$/.test(p.token))this.token=p.token;}catch{}if(!this.token)this.token=randomBytes(32).toString('hex');await writeFile(join(this.root,'bridge.json'),JSON.stringify({pipe:this.pipe,token:this.token}),{mode:0o600});
  this.server=createServer(socket=>{let data='';let handled=false;let cleanup=()=>{};const timer=setTimeout(()=>socket.destroy(),2000);socket.setEncoding('utf8');socket.on('data',chunk=>{if(handled)return;data+=chunk;if(data.length>140000){socket.destroy();return;}if(!data.includes('\n'))return;handled=true;clearTimeout(timer);try{const message=JSON.parse(data.slice(0,data.indexOf('\n')));if(message.token!==this.token){socket.end('{}\n');return;}cleanup=this.hub.accept(message.event,decision=>{if(!socket.destroyed)socket.end(JSON.stringify({id:message.event.id,decision})+'\n');});}catch{socket.end('{}\n');}});socket.on('error',()=>{});socket.on('close',()=>{clearTimeout(timer);cleanup();});});
  await new Promise<void>((resolve,reject)=>{this.server!.once('error',reject);this.server!.listen('\\\\.\\pipe\\'+this.pipe,()=>{this.server!.removeListener('error',reject);resolve();});});
  this.server.on('error',()=>{this.hub.error='No se pudo recibir actividad de Codex.';this.hub.publish();});await this.refresh();
 }
 async refresh(){try{const raw=JSON.parse(await readFile(join(this.codexHome,'hooks.json'),'utf8'));this.hub.installed=hookEvents.every(e=>raw.hooks?.[e]?.some((g:any)=>g.hooks?.some((h:any)=>h.command===this.command)));}catch{this.hub.installed=false;}this.hub.publish();}
 async install(){await mkdir(this.codexHome,{recursive:true});const path=join(this.codexHome,'hooks.json');let original='{}';try{if((await lstat(path)).isSymbolicLink())throw Error('Revisa el enlace hooks.json desde Codex.');original=await readFile(path,'utf8');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  const next=mergeCompanionHooks(JSON.parse(original),this.command,['"'+this.executable+'" --zen-companion']);await mkdir(this.root,{recursive:true});
  for(const file of ['Zen.CodexHook.exe','Zen.CodexHook.dll','Zen.CodexHook.deps.json','Zen.CodexHook.runtimeconfig.json'])await copyFile(join(this.binaryDirectory,file),join(this.root,file));
  await writeFile(join(this.root,'hooks-before-'+Date.now()+'.json'),original,{mode:0o600});
  // Abort if another client edited the hooks while the fixed relay was copied.
  let current='{}';try{current=await readFile(path,'utf8');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}if(current!==original)throw Error('Los hooks cambiaron. Vuelve a preparar la integración.');
  await writeFile(path+'.zen.tmp',JSON.stringify(next,null,2),{mode:0o600});await rename(path+'.zen.tmp',path);await this.refresh();
 }
 close(){this.hub.dispose();this.server?.close();}
}
/** Match Coucou's Windows launcher: plain paths need no shell quotes and work in cmd and PowerShell. */
export function companionHookCommand(path:string){return (/^[a-zA-Z]:[\\/][a-zA-Z0-9_.\\/-]+$/.test(path)?path:'"'+path+'"')+' --zen-companion';}
