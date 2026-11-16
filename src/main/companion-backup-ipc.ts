import {dialog, type BrowserWindow} from 'electron';
import {z} from 'zod';
import type {CompanionSettings} from '../shared/codex-companion';
import {backupName, backupSuffix, readBackup, restoreBackup, snapshotBackup, writeBackup, type BackupSources} from './companion-backup';
import type {CompanionIpcHandler, CompanionWindowDialog} from './companion-ipc';

type BackupIpcOptions = {
  window: BrowserWindow;
  profile: string;
  requireSettings: () => void;
  privateEffectsAllowed: () => boolean;
  withWindowDialog: CompanionWindowDialog;
  getSources: () => BackupSources;
  saveSettings: (settings: CompanionSettings) => unknown;
  broadcast: () => void;
};

export function registerProfileBackupIpc(handle: CompanionIpcHandler, {
  window, profile, requireSettings, privateEffectsAllowed, withWindowDialog, getSources, saveSettings, broadcast,
}: BackupIpcOptions) {
  let busy = false;
  const filters = [{name: 'Copia de ZEN', extensions: ['json']}];

  function requireBackup() {
    requireSettings();
    if (!privateEffectsAllowed()) throw Error('Desactiva Pausa o Presentación para gestionar copias.');
  }

  handle('profileBackup', z.enum(['export', 'import']), async action => {
    requireBackup();
    if (busy) throw Error('Ya hay una operación de respaldo abierta.');
    busy = true;
    try {
      if (action === 'export') {
        const destination = await withWindowDialog(() => dialog.showSaveDialog(window, {
          title: 'Exportar datos y configuración de ZEN', defaultPath: backupName(), filters,
        }));
        requireBackup();
        if (destination.canceled || !destination.filePath) return 'cancelled';
        if (!destination.filePath.toLowerCase().endsWith(backupSuffix)) {
          throw Error('Guarda la copia con la extensión ' + backupSuffix + '.');
        }
        writeBackup(destination.filePath, snapshotBackup(getSources()));
        return 'exported';
      }

      const source = await withWindowDialog(() => dialog.showOpenDialog(window, {
        title: 'Importar datos y configuración de ZEN', properties: ['openFile'], filters,
      }));
      requireBackup();
      if (source.canceled || source.filePaths.length !== 1) return 'cancelled';
      const backup = readBackup(source.filePaths[0]);
      const {response} = await withWindowDialog(() => dialog.showMessageBox(window, {
        type: 'warning', message: '¿Importar esta copia de ZEN?',
        detail: `La copia contiene ${backup.library.entries.length} elementos de Apuntes. Sustituirá la biblioteca y las preferencias de este equipo. ZEN guardará una copia anterior en el perfil local.`,
        buttons: ['Cancelar', 'Importar copia'], defaultId: 0, cancelId: 0, noLink: true,
      }));
      requireBackup();
      if (response !== 1) return 'cancelled';
      restoreBackup(profile, getSources(), backup, saveSettings);
      broadcast();
      return 'imported';
    } finally {
      busy = false;
    }
  });
}
