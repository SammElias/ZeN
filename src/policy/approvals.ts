import { randomUUID, createHash } from 'node:crypto';
import { realpath, mkdir, writeFile, readFile, stat, lstat } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { PrepareSchema, type Prepare, type Approval } from '../shared/approval';
import { ZenError } from '../shared/errors';
export class Approvals {
  private grants = new Map<string, string>();
  private pending = new Map<string, { approval: Approval; parent: string; request: Prepare }>();
  private undoable=new Map<string,{path:string;parent:string;hash:string;ino:number;dev:number;mtime:number;expires:number}>();
  undoPreview(id:string){const item=this.undoable.get(id);if(!item||Date.now()>item.expires)throw new ZenError('Esta creación ya no se puede deshacer desde ZEN.');return{destination:item.path,signature:JSON.stringify(item)};}
  async undo(id:string,signal:AbortSignal,recycle:(path:string)=>Promise<void>){
    this.undoPreview(id);const item=this.undoable.get(id)!;
    const current=await lstat(item.path);
    if(!current.isFile()||current.isSymbolicLink()||current.ino!==item.ino||current.dev!==item.dev||current.mtimeMs!==item.mtime||await realpath(item.parent)!==item.parent||await realpath(item.path)!==item.path)throw new ZenError('El archivo cambió. No se deshace para conservar tus cambios.');
    if(current.size>100000||createHash('sha256').update(await readFile(item.path)).digest('hex')!==item.hash)throw new ZenError('El contenido cambió. No se deshace.');
    const final=await lstat(item.path);if(final.ino!==current.ino||final.dev!==current.dev||final.mtimeMs!==current.mtimeMs||final.size!==current.size)throw new ZenError('El archivo cambió durante la revisión.');
    signal.throwIfAborted();this.undoable.delete(id);await recycle(item.path);
    try{await lstat(item.path);}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return;throw error;}
    throw new ZenError('No se pudo verificar que el archivo se movió a la papelera. No se repite automáticamente.');
  }
  async grant(path: string) { const canonical = await realpath(path); if (!(await stat(canonical)).isDirectory()) throw new ZenError('La selección no es una carpeta.'); const grantId = randomUUID(); this.grants.set(grantId, canonical); return { grantId, label: canonical }; }
  prepare(raw: Prepare): Approval {
    if (this.pending.size) throw new ZenError('Revisa o cancela la aprobación pendiente antes de preparar otra creación.');
    const request = PrepareSchema.parse(raw); const parent = this.grants.get(request.grantId);
    if (!parent) throw new ZenError('Elige una carpeta desde el selector de Windows.');
    if (!/^[^<>:"/\\|?*\x00-\x1f]+$/.test(request.name) || request.name.trim() !== request.name || /[. ]$/.test(request.name) || /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(request.name)) throw new ZenError('Nombre de archivo o carpeta inválido.');
    if (request.kind === 'create-file' && !/\.(?:txt|md|json|csv)$/i.test(request.name)) throw new ZenError('Solo se crean archivos de texto. No se ejecuta código.');
    const approval: Approval = { id: randomUUID(), kind: request.kind, title: request.kind === 'create-folder' ? 'Crear esta carpeta' : 'Crear este archivo nuevo', destination: join(parent, request.name), ...(request.kind === 'create-file' ? { content: request.content } : {}) };
    this.pending.set(approval.id, { approval, parent, request }); return structuredClone(approval);
  }
  cancel(id: string) { if (!this.pending.delete(id)) throw new ZenError('La aprobación ya no está pendiente.'); }
  clear() { this.pending.clear(); this.grants.clear(); }
  async approve(id: string, signal: AbortSignal) {
    const pending = this.pending.get(id); if (!pending) throw new ZenError('La aprobación ya no está pendiente. No se repite una acción.');
    this.pending.delete(id); // Single-use before any effect, including failures.
    signal.throwIfAborted();
    if (await realpath(pending.parent) !== pending.parent) throw new ZenError('La carpeta de destino cambió. Vuelve a seleccionar y revisar.');
    const { approval, request } = pending;
    signal.throwIfAborted();
    if (request.kind === 'create-folder') {
      try { await mkdir(approval.destination, { recursive: false }); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new ZenError('El destino ya existe. No se sobrescribe ni se cambia.'); throw error; }
      if (!(await stat(approval.destination)).isDirectory()) throw new ZenError('No se verificó la carpeta creada.');
    } else {
      try { await writeFile(approval.destination, request.content, { flag: 'wx', encoding: 'utf8', signal }); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new ZenError('El destino ya existe. No se sobrescribe ni se cambia.'); throw error; }
      const actual = await readFile(approval.destination, 'utf8');
      if (createHash('sha256').update(actual).digest('hex') !== createHash('sha256').update(request.content).digest('hex')) throw new ZenError('No se verificó el contenido. No se repite la escritura.');
      const info=await lstat(approval.destination);
      this.undoable.set(id,{path:approval.destination,parent:pending.parent,hash:createHash('sha256').update(actual).digest('hex'),ino:info.ino,dev:info.dev,mtime:info.mtimeMs,expires:Date.now()+1800000});
      if(this.undoable.size>20)this.undoable.delete(this.undoable.keys().next().value!);
    }
    return { message: `${request.kind === 'create-folder' ? 'Carpeta' : 'Archivo'} creado y verificado: ${basename(approval.destination)}`, verified: true as const,undoAvailable:request.kind==='create-file' };
  }
}
