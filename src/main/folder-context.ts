import {lstat,realpath} from 'node:fs/promises';
import {basename} from 'node:path';
import {randomUUID} from 'node:crypto';
import {LocalLibrary} from '../tools/library';
import {ZenError} from '../shared/errors';
export type FolderAttachment={id:string;name:string;label:string};
export class FolderContext{
  private entries=new Map<string,{public:FolderAttachment;path:string;ino:number;dev:number;at:number}>();
  async grant(path:string,signal:AbortSignal){signal.throwIfAborted();const info=await lstat(path),canonical=await realpath(path);if(!info.isDirectory()||info.isSymbolicLink())throw new ZenError('Elige una carpeta real, sin enlaces.');signal.throwIfAborted();const value={id:randomUUID(),name:basename(canonical)||canonical,label:canonical};this.entries.set(value.id,{public:value,path:canonical,ino:info.ino,dev:info.dev,at:Date.now()});if(this.entries.size>5)this.entries.delete(this.entries.keys().next().value!);return value;}
  revoke(id:string){this.entries.delete(id);}
  clear(){this.entries.clear();}
  validate(id:string){const entry=this.entries.get(id);if(!entry||Date.now()-entry.at>=1800000)throw new ZenError('Vuelve a elegir la carpeta del proyecto.');}
  async read(id:string,request:string,signal:AbortSignal,maxChars:number){
    const path=await this.resolve(id,signal);
    const result=await new LocalLibrary(()=>[path]).projectContext(request,signal,maxChars);signal.throwIfAborted();await this.resolve(id,signal);return result;
  }
  async resolve(id:string,signal:AbortSignal){
    signal.throwIfAborted();const entry=this.entries.get(id);if(!entry||Date.now()-entry.at>=1800000)throw new ZenError('Vuelve a elegir la carpeta del proyecto.');
    const info=await lstat(entry.path);if(info.isSymbolicLink()||!info.isDirectory()||info.ino!==entry.ino||info.dev!==entry.dev||await realpath(entry.path)!==entry.path)throw new ZenError('La carpeta cambió. Vuelve a elegirla.');
    signal.throwIfAborted();if(this.entries.get(id)!==entry)throw new ZenError('Se retiró la carpeta antes de enviar el contexto.');return entry.path;
  }
}
