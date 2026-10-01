import { posix } from 'node:path';
import { z } from 'zod';
import { ZenError } from '../shared/errors';
const Patch = z.discriminatedUnion('type', [
  z.object({type:z.literal('create_file'),path:z.string(),diff:z.string().max(100000)}).strict(),
  z.object({type:z.literal('update_file'),path:z.string(),diff:z.string().max(100000)}).strict(),
  z.object({type:z.literal('delete_file'),path:z.string()}).strict(),
]);
// Apply Patch operates on an in-memory workspace. It never writes or runs PC files.
export class PatchWorkspace {
  private files = new Map<string, string>();
  apply(raw: unknown) {
    const patch = Patch.parse(raw), path = patch.path;
    if (!path || path.length > 180 || /[\\\0:]/.test(path) || posix.isAbsolute(path) || path.split('/').some(part => !part || part === '.' || part === '..') || posix.normalize(path) !== path) throw new ZenError('Ruta de parche fuera del espacio aislado.');
    const current = this.files.get(path);
    if (patch.type === 'delete_file') { if (current === undefined) throw new ZenError('El archivo no existe en el espacio aislado.'); this.files.delete(path); return; }
    if (patch.type === 'create_file') {
      if (current !== undefined || this.files.size >= 30) throw new ZenError('No se sobrescribe un archivo ni se excede el límite del espacio aislado.');
      const lines = patch.diff.replace(/\r\n/g,'\n').split('\n'); if (lines.at(-1) === '') lines.pop();
      if (lines.some(line => !line.startsWith('+'))) throw new ZenError('Parche de creación inválido.');
      this.files.set(path, lines.map(line=>line.slice(1)).join('\n')+'\n');
    } else {
      if (current === undefined) throw new ZenError('El archivo no existe en el espacio aislado.');
      const lines = patch.diff.replace(/\r\n/g,'\n').split('\n'); if (lines.at(-1)==='') lines.pop();
      let next = current;
      const chunks: {old:string[]; replacement:string[]}[] = []; let chunk: typeof chunks[number] | undefined;
      for (const line of lines) {
        if (line === '*** End of File') continue;
        if (line.startsWith('@@')) { chunk={old:[],replacement:[]}; chunks.push(chunk); continue; }
        if (!chunk || !/^[ +\-]/.test(line)) throw new ZenError('Parche de actualización inválido.');
        if (line[0] !== '+') chunk.old.push(line.slice(1));
        if (line[0] !== '-') chunk.replacement.push(line.slice(1));
      }
      for (const block of chunks) {
        const old=block.old.join('\n'); if (!old) throw new ZenError('El parche requiere contexto inequívoco.');
        const at=next.indexOf(old); if(at<0 || next.indexOf(old,at+1)>=0) throw new ZenError('Contexto de parche ausente o ambiguo.');
        next=next.slice(0,at)+block.replacement.join('\n')+next.slice(at+old.length);
      }
      if (!chunks.length) throw new ZenError('Parche sin cambios.'); this.files.set(path,next);
    }
    if ([...this.files.values()].reduce((size,text)=>size+Buffer.byteLength(text),0)>200000) { if(current===undefined)this.files.delete(path);else this.files.set(path,current); throw new ZenError('Espacio de parche demasiado grande.'); }
  }
  snapshot() { return Object.fromEntries(this.files); }
}
