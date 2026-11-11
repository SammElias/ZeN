import { lstat, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

export async function projectFile(root: string, name: string, allowMissing = false) {
  if (!name || /[\0\r\n]/.test(name) || isAbsolute(name)) throw Error('Ubicación no válida.');
  const base = await realpath(root);
  const file = resolve(base, name);
  const part = relative(base, file);
  if (!part || part === '..' || part.startsWith('..' + sep) || isAbsolute(part)) {
    throw Error('Ubicación fuera del proyecto.');
  }

  let current = base;
  const segments = part.split(/[\\/]/);
  for (const [index, segment] of segments.entries()) {
    current = join(current, segment);
    try {
      const stat = await lstat(current);
      if (stat.isSymbolicLink() || (index < segments.length - 1 && !stat.isDirectory())) {
        throw Error('Ubicación enlazada no permitida.');
      }
    } catch (error) {
      if (allowMissing && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { file, folder: dirname(current), missing: true };
      }
      throw error;
    }
  }
  return { file, folder: dirname(file), missing: false };
}
