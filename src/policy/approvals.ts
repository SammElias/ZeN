import { randomUUID, createHash } from 'node:crypto';
import { realpath, mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { PrepareSchema, type Prepare, type Approval } from '../shared/approval';
import { ZenError } from '../shared/errors';
export class Approvals {
  private grants = new Map<string, string>();
  private pending = new Map<string, { approval: Approval; parent: string; request: Prepare }>();
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
    }
    return { message: `${request.kind === 'create-folder' ? 'Carpeta' : 'Archivo'} creado y verificado: ${basename(approval.destination)}`, verified: true as const };
  }
}
