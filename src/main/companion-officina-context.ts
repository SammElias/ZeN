import {randomUUID} from 'node:crypto';
import {lstat, realpath} from 'node:fs/promises';
import {basename} from 'node:path';
import {OfficinaLocalSource} from '../shared/companion-officina';
import {normalizeTargetFolder, stripWindowsPathPrefix} from '../shared/companion-target';

type Kind = 'file' | 'folder';
export class OfficinaSourceUnavailable extends Error {}

async function identity(path: string, kind: Kind) {
  const info = await lstat(path, {bigint: true});
  if (info.isSymbolicLink() || !(kind === 'folder' ? info.isDirectory() : info.isFile())) {
    throw Error(kind === 'folder' ? 'Elige una carpeta real, sin enlaces.' : 'Elige archivos locales que no sean enlaces.');
  }
  return {device: String(info.dev), inode: String(info.ino)};
}

export async function captureOfficinaSource(path: string, kind: Kind) {
  const info = await identity(path, kind);
  const canonical = stripWindowsPathPrefix(await realpath(path));
  const source = OfficinaLocalSource.safeParse({id: randomUUID(), name: basename(canonical) || canonical, path: canonical, ...info});
  if (!source.success) throw Error('La ruta seleccionada supera el formato admitido por Officina.');
  await verifyOfficinaSource(source.data, kind);
  return source.data;
}

export async function verifyOfficinaSource(source: OfficinaLocalSource, kind: Kind) {
  try {
    const info = await identity(source.path, kind);
    if (info.device === source.device && info.inode === source.inode &&
      normalizeTargetFolder(await realpath(source.path)) === normalizeTargetFolder(source.path)) return source.path;
  } catch { /* A moved, inaccessible or replaced source requires a new selection. */ }
  throw new OfficinaSourceUnavailable(kind === 'folder' ? 'La carpeta del proyecto cambió o ya no está disponible. Vuelve a elegirla.' :
    `El archivo «${source.name}» cambió o ya no está disponible. Vuelve a adjuntarlo.`);
}
