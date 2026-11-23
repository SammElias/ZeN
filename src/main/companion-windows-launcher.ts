import {shell} from 'electron';
import {existsSync, lstatSync, mkdirSync} from 'node:fs';
import {basename, dirname, extname, isAbsolute, join, relative} from 'node:path';

export const zenAppUserModelId = 'com.zen.desktop';

export function windowsPortableLauncher() {
  const portable = process.env.PORTABLE_EXECUTABLE_FILE;
  if (portable && isAbsolute(portable) && extname(portable).toLowerCase() === '.exe' && existsSync(portable)) return portable;
}

export function registerZenShortcut(programs: string, launcher: string) {
  const file = join(programs, 'ZEN.lnk');
  const installed = lstatSync(file, {throwIfNoEntry: false});
  if (installed) {
    if (!installed.isFile()) return false;
    const existing = shell.readShortcutLink(file);
    const usesLauncher = existing.target && relative(launcher, existing.target) === '';
    // A shortcut with our ID can be repaired when its original executable has disappeared.
    const stale = existing.appUserModelId === zenAppUserModelId &&
      basename(existing.target).toLowerCase() === 'zen.exe' && !existsSync(existing.target);
    if (existing.args || (existing.appUserModelId && existing.appUserModelId !== zenAppUserModelId) || (!usesLauncher && !stale)) return false;
    if (usesLauncher && existing.appUserModelId === zenAppUserModelId &&
      existing.icon && relative(launcher, existing.icon) === '' && existing.iconIndex === 0) return true;
  } else {
    mkdirSync(programs, {recursive: true});
  }
  return shell.writeShortcutLink(file, installed ? 'update' : 'create', {
    target: launcher,
    cwd: dirname(launcher),
    args: '',
    description: 'ZEN',
    icon: launcher,
    iconIndex: 0,
    appUserModelId: zenAppUserModelId,
  });
}
