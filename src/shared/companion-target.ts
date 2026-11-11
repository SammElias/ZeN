import type { CompanionTarget } from './codex-companion';

export function stripWindowsPathPrefix(path: string) {
  return path.replace(/^\\\\\?\\UNC\\/i, '\\\\').replace(/^\\\\\?\\(?=[a-z]:[\\/])/i, '');
}

export function normalizeTargetFolder(path: string) {
  return stripWindowsPathPrefix(path).replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase();
}

export function matchesTarget(target: CompanionTarget, session: string, cwd: unknown) {
  return target.session === session && typeof cwd === 'string' &&
    normalizeTargetFolder(target.cwd) === normalizeTargetFolder(cwd);
}
