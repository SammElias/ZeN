import {createHash, randomUUID} from 'node:crypto';
import {lstat, mkdir, readFile, realpath, writeFile} from 'node:fs/promises';
import {basename, dirname, join} from 'node:path';
import {imageSize} from 'image-size';
import {OfficinaLocalSource} from '../shared/companion-officina';
import {normalizeTargetFolder, stripWindowsPathPrefix} from '../shared/companion-target';

type Kind = 'file' | 'folder';
export class OfficinaSourceUnavailable extends Error {}

export async function prepareOfficinaFile(path: string, content: string | Buffer, issue: string) {
  const bytes = typeof content === 'string' ? Buffer.from(content) : content;
  try {
    const directory = dirname(path);
    await mkdir(directory, {recursive: true});
    if (!(await lstat(directory)).isDirectory()) throw Error('La carpeta de contexto no es local.');
    try {
      await writeFile(path, bytes, {flag: 'wx'});
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
    const file = await lstat(path);
    if (file.isFile() && file.size === bytes.length && (await readFile(path)).equals(bytes)) return;
  } catch { /* Report the source issue without exposing filesystem details. */ }
  throw new OfficinaSourceUnavailable(issue);
}

export async function prepareOfficinaImages(directory: string, request: string, images: string[]) {
  const encoded = images.map(image => {
    const bytes = Buffer.from(image.slice(image.indexOf(',') + 1), 'base64');
    try {
      const {type, width, height} = imageSize(bytes);
      if (type === 'jpg' && width > 0 && height > 0 && width <= 1920 && height <= 1920 &&
          bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9) return bytes;
    } catch { /* Only prepared JPEG images are accepted. */ }
    throw Error('No se pudo verificar la imagen pegada. Vuelve a pegarla.');
  });
  return Promise.all(encoded.map(async (bytes, index) => {
    const digest = createHash('sha256').update(bytes).digest('hex');
    const file = join(directory, `${request}-${index + 1}-${digest.slice(0, 20)}.jpg`);
    await prepareOfficinaFile(file, bytes, 'No se pudo guardar la imagen para el encargo.');
    return {...await captureOfficinaSource(file, 'file'), name: `Imagen ${index + 1}.jpg`, sha256: digest};
  }));
}

async function identity(path: string, kind: Kind) {
  const info = await lstat(path, {bigint: true});
  if (info.isSymbolicLink() || !(kind === 'folder' ? info.isDirectory() : info.isFile())) {
    throw Error(kind === 'folder' ? 'Elige una carpeta real, sin enlaces.' : 'Elige archivos locales que no sean enlaces.');
  }
  return {device: String(info.dev), inode: String(info.ino), size: info.size};
}

export async function captureOfficinaSource(path: string, kind: Kind) {
  const info = await identity(path, kind);
  const canonical = stripWindowsPathPrefix(await realpath(path));
  const source = OfficinaLocalSource.safeParse({id: randomUUID(), name: basename(canonical) || canonical, path: canonical,
    device: info.device, inode: info.inode});
  if (!source.success) throw Error('La ruta seleccionada supera el formato admitido por Officina.');
  await verifyOfficinaSource(source.data, kind);
  return source.data;
}

export async function verifyOfficinaSource(source: OfficinaLocalSource, kind: Kind) {
  try {
    const info = await identity(source.path, kind);
    if (info.device === source.device && info.inode === source.inode &&
      normalizeTargetFolder(await realpath(source.path)) === normalizeTargetFolder(source.path) &&
      (!source.sha256 || kind === 'file' && info.size <= 2_250_000n &&
        createHash('sha256').update(await readFile(source.path)).digest('hex') === source.sha256)) return source.path;
  } catch { /* A moved, inaccessible or replaced source requires a new selection. */ }
  throw new OfficinaSourceUnavailable(kind === 'folder' ? 'La carpeta del proyecto cambió o ya no está disponible. Vuelve a elegirla.' :
    `El archivo «${source.name}» cambió o ya no está disponible. Vuelve a adjuntarlo.`);
}
