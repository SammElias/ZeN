import {realpath, stat} from 'node:fs/promises';
import {win32 as path} from 'node:path';
import type {OfficinaProject} from '../shared/companion-officina';
import {stripWindowsPathPrefix} from '../shared/companion-target';
import type {OfficinaReference} from '../shared/officina-reference';
import {verifyOfficinaSource} from './companion-officina-context';

type LocalReference = Extract<OfficinaReference, {kind: 'local'}>;

export function officinaReferenceScope(project: OfficinaProject, task?: string) {
  return {folder: project.folder, cwd: project.team?.cwd ?? project.binding?.cwd,
    files: task ? project.goals?.find(goal => goal.task === task)?.files ?? [] : []};
}

function within(root: string, file: string) {
  const relative = path.relative(root, file);
  return relative !== '..' && !relative.startsWith('..\\') && !path.isAbsolute(relative);
}

export async function resolveOfficinaReference(reference: LocalReference, scope: ReturnType<typeof officinaReferenceScope>) {
  const cwd = scope.folder?.path ?? scope.cwd;
  const root = cwd && /^[a-z]:[\\/]/i.test(cwd) ? path.resolve(cwd) : undefined;
  const target = reference.absolute ? path.resolve(reference.path) : root && path.resolve(root, reference.path);
  if (!target) throw Error('El proyecto necesita una carpeta de trabajo para abrir esta ruta.');
  const attached = scope.files.find(file => /^[a-z]:[\\/]/i.test(file.path) && path.relative(file.path, target) === '');
  if (attached) return {path: await verifyOfficinaSource(attached, 'file'), directory: false};
  if (!root || !within(root, target)) throw Error('La ruta está fuera de la carpeta de trabajo del proyecto.');
  try {
    if (scope.folder) await verifyOfficinaSource(scope.folder, 'folder');
    const canonicalRoot = stripWindowsPathPrefix(await realpath(root));
    const canonical = stripWindowsPathPrefix(await realpath(target));
    if (!/^[a-z]:[\\/]/i.test(canonical) || !within(canonicalRoot, canonical)) {
      throw Error('La ruta resuelve fuera de la carpeta de trabajo del proyecto.');
    }
    const details = await stat(canonical);
    if (details.isFile() || details.isDirectory()) return {path: canonical, directory: details.isDirectory()};
  } catch (error) {
    if (error instanceof Error && !('code' in error)) throw error;
  }
  throw Error('El archivo o la carpeta ya no está disponible.');
}

export function officinaEditorUrl(file: string, {line, column}: LocalReference) {
  const encoded = file.replace(/\\/g, '/').split('/').map((part, index) => index ? encodeURIComponent(part) : part).join('/');
  const url = `vscode://file/${encoded}${line ? `:${line}:${column ?? 1}` : ''}`;
  if (url.length > 2081) throw Error('La ruta es demasiado larga para VS Code. Puedes mostrar el archivo en el Explorador.');
  return url;
}
