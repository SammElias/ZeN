import {dialog, type BrowserWindow} from 'electron';
import {lstatSync} from 'node:fs';
import {join} from 'node:path';
import {ProfileSyncAction} from '../shared/profile-sync';
import type {CompanionIpcHandler, CompanionWindowDialog} from './companion-ipc';
import {defaultSyncFolder, type ProfileSync} from './profile-sync';

type SyncOptions = {
  window: BrowserWindow;
  sync: ProfileSync;
  requireSettings: () => void;
  privateEffectsAllowed: () => boolean;
  withWindowDialog: CompanionWindowDialog;
  copyPrivate: (text: string) => Promise<unknown>;
};

export function profileFingerprint(profile: string) {
  return ['companion-settings.json', 'companion-launcher.json', 'companion-appearance.json',
    'knowledge-hub.sqlite', 'knowledge-hub.sqlite-wal'].map(file => {
    try {
      const stat = lstatSync(join(profile, file), {bigint: true});
      return stat.mtimeNs + ':' + stat.size;
    } catch {
      return '-';
    }
  }).join('/');
}

export function registerProfileSyncIpc(handle: CompanionIpcHandler, options: SyncOptions) {
  let linking = false;
  function authorize() {
    options.requireSettings();
    if (!options.privateEffectsAllowed()) throw Error('Desactiva Pausa o Presentación para sincronizar el perfil.');
  }
  handle('profileSync', ProfileSyncAction, async action => {
    authorize();
    const sync = options.sync;
    switch (action.type) {
      case 'status': return sync.status();
      case 'copyCode':
        await options.copyPrivate(sync.code());
        return sync.status();
      case 'sync': return sync.run();
      case 'disconnect': return sync.disconnect();
      case 'vault': return sync.configureVault(action.enabled);
      case 'resolve': return sync.run(true, action);
      case 'create':
      case 'join': {
        if (linking) throw Error('Ya hay un selector abierto.');
        linking = true;
        try {
          const selected = await options.withWindowDialog(() => dialog.showOpenDialog(options.window, {
            title: 'Elige tu carpeta de Syncthing para el perfil cifrado de ZEN',
            defaultPath: defaultSyncFolder(),
            properties: ['openDirectory'],
          }));
          authorize();
          if (selected.canceled || selected.filePaths.length !== 1) return sync.status();
          return sync.link(selected.filePaths[0], action.type === 'join' ? action.code : undefined);
        } finally {
          linking = false;
        }
      }
    }
  });
}
