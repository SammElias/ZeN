import { randomUUID, createHash } from 'node:crypto';
import { mkdir, writeFile, readFile, realpath, lstat } from 'node:fs/promises';
import { join, relative, isAbsolute } from 'node:path';
import { ProjectBundleSchema, type ProjectBundle, type ProjectDraft } from '../shared/project';
import { ZenError } from '../shared/errors';
function component(value:string){
  if(!value||value.length>100||value==='.'||value==='..'||/[<>:"/\\|?*\x00-\x1f]/.test(value)||value.trim()!==value||/[. ]$/.test(value)||/^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(value))throw new ZenError('Codex propuso un nombre no válido para Windows.');
}
function portablePath(value:string){
  const parts=value.split('/');if(parts.length>8)throw new ZenError('La estructura tiene demasiados niveles.');parts.forEach(component);
  if(parts.some(part=>/^\.(?:git|ssh|codex)$/i.test(part)))throw new ZenError('No se exportan directorios de credenciales ni configuración de Codex.');
  if(/\.(?:exe|com|dll|msi|lnk|sys)$/i.test(value))throw new ZenError('No se crean ejecutables en esta entrega.');
}
export function validateProjectBundle(raw:unknown):ProjectBundle{
  const bundle=ProjectBundleSchema.parse(raw);component(bundle.name);
  const directories=new Set<string>(),files=new Set<string>();let bytes=0;
  for(const directory of bundle.directories){portablePath(directory);const key=directory.toLowerCase();if(directories.has(key))throw new ZenError('Carpeta repetida en la propuesta.');directories.add(key);}
  for(const file of bundle.files){portablePath(file.path);const key=file.path.toLowerCase();if(files.has(key)||directories.has(key))throw new ZenError('Ruta repetida o ambigua en la propuesta.');files.add(key);bytes+=Buffer.byteLength(file.content,'utf8');}
  if(bytes>2000000)throw new ZenError('El proyecto supera el límite de 2 MB.');
  for(const path of [...directories,...files]){const parts=path.split('/');for(let i=1;i<parts.length;i++)if(files.has(parts.slice(0,i).join('/')))throw new ZenError('Un archivo ocupa la ruta de una carpeta.');}
  return bundle;
}
type Draft={bundle:ProjectBundle;at:number;parent?:string;approvalId?:string};
export class ProjectDrafts{
  private drafts=new Map<string,Draft>();
  add(raw:unknown){for(const[id,draft]of this.drafts)if(Date.now()-draft.at>1800000)this.drafts.delete(id);if(this.drafts.size>=3)throw new ZenError('Revisa o descarta los proyectos pendientes antes de preparar otro.');const id=randomUUID();this.drafts.set(id,{bundle:validateProjectBundle(raw),at:Date.now()});return this.view(id);}
  private get(id:string){const draft=this.drafts.get(id);if(!draft||Date.now()-draft.at>1800000){this.drafts.delete(id);throw new ZenError('La propuesta de Codex ya no está disponible.');}return draft;}
  view(id:string):ProjectDraft{const draft=this.get(id);return{id,name:draft.bundle.name,summary:draft.bundle.summary,paths:draft.bundle.files.map(file=>file.path),directories:[...draft.bundle.directories],...(draft.parent?{destination:join(draft.parent,draft.bundle.name),approvalId:draft.approvalId}:{})};}
  preview(id:string){return structuredClone(this.get(id).bundle);}
  async destination(id:string,parent:string){const draft=this.get(id);const canonical=await realpath(parent);if(!(await lstat(canonical)).isDirectory())throw new ZenError('El destino no es una carpeta.');draft.parent=canonical;draft.approvalId=randomUUID();return this.view(id);}
  discard(id:string){if(!this.drafts.delete(id))throw new ZenError('La propuesta ya no está disponible.');}
  clear(){this.drafts.clear();}
  async approve(id:string,approvalId:string,signal:AbortSignal){
    const draft=this.get(id);if(!draft.parent||draft.approvalId!==approvalId)throw new ZenError('El destino ha cambiado. Revisa la propuesta actual.');
    this.drafts.delete(id); // immutable, single-use before the first filesystem effect
    signal.throwIfAborted();if(await realpath(draft.parent)!==draft.parent)throw new ZenError('La carpeta de destino cambió.');
    const root=join(draft.parent,draft.bundle.name);let created=false;
    try{
      signal.throwIfAborted();
      await mkdir(root);created=true;
      const verify=async(path:string)=>{signal.throwIfAborted();const info=await lstat(path);if(info.isSymbolicLink())throw new ZenError('El destino contiene un enlace.');const actual=await realpath(path),part=relative(root,actual);if(part.startsWith('..')||isAbsolute(part))throw new ZenError('El destino salió de la carpeta revisada.');signal.throwIfAborted();};
      await verify(root);
      const directories=new Set(draft.bundle.directories);
      for(const file of draft.bundle.files){const parts=file.path.split('/');for(let i=1;i<parts.length;i++)directories.add(parts.slice(0,i).join('/'));}
      for(const directory of [...directories].sort((a,b)=>a.split('/').length-b.split('/').length)){const parts=directory.split('/');for(let i=1;i<=parts.length;i++){const target=join(root,...parts.slice(0,i));await verify(join(root,...parts.slice(0,i-1)));try{await mkdir(target);}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;}await verify(target);}}
      for(const file of draft.bundle.files){const parts=file.path.split('/');const destination=join(root,...parts);await verify(join(root,...parts.slice(0,-1)));await writeFile(destination,file.content,{flag:'wx',encoding:'utf8',signal});await verify(destination);if(createHash('sha256').update(await readFile(destination)).digest('hex')!==createHash('sha256').update(file.content).digest('hex'))throw new ZenError('No se verificó el archivo creado.');}
      signal.throwIfAborted();return{message:`${draft.bundle.name} creado y verificado: ${root}`,verified:true as const,destination:root};
    }catch(error){if(created)throw new ZenError('La creación quedó incompleta. Hay elementos en el destino revisado; no se eliminaron ni se volverá a escribir automáticamente.');if((error as NodeJS.ErrnoException).code==='EEXIST')throw new ZenError('Ese proyecto ya existe. No se sobrescribió nada.');throw error;}
  }
}
