import {randomUUID} from 'node:crypto';
import {renameSync, rmSync, writeFileSync} from 'node:fs';
import {basename} from 'node:path';
import {dialog, nativeImage, type BrowserWindow} from 'electron';
import {z} from 'zod';
import {HubAction, HubDraft, HubFileAction, type HubFileResult, type HubImage} from '../shared/knowledge-hub';
import {entryMarkdown, fileStem} from '../shared/knowledge-markdown';
import {wallpaperBytes} from './companion-appearance';
import {readLibraryBackup} from './companion-backup';
import type {CompanionIpcHandler, CompanionWindowDialog} from './companion-ipc';
import type {KnowledgeHub} from './knowledge-hub';

type NotesIpcOptions = {
  notes: KnowledgeHub;
  window: BrowserWindow;
  requireWorkspace: (page: 'home' | 'notes') => void;
  privateEffectsAllowed: () => boolean;
  withWindowDialog: CompanionWindowDialog;
  copy: (text: string) => void;
  openExternal: (url: string) => Promise<void>;
};

function readAttachment(path: string): HubImage {
  let decoded = nativeImage.createFromBuffer(wallpaperBytes(path));
  if (decoded.isEmpty()) throw Error('No se pudo abrir la imagen.');

  for (const size of [1440, 1100, 800, 560, 400]) {
    const {width, height} = decoded.getSize();
    const scale = Math.min(1, size / Math.max(width, height));
    if (scale < 1) {
      decoded = decoded.resize({
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale)),
        quality: 'best',
      });
    }
    const bytes = decoded.toPNG();
    if (bytes.length <= 540_000) {
      return {
        id: randomUUID(),
        name: basename(path).slice(0, 160),
        data: 'data:image/png;base64,' + bytes.toString('base64'),
      };
    }
  }
  throw Error('La imagen es demasiado grande. Prueba con una más pequeña.');
}

export function registerNotesIpc(handle: CompanionIpcHandler, {
  notes, window, requireWorkspace, privateEffectsAllowed, withWindowDialog, copy, openExternal,
}: NotesIpcOptions) {
  let restoring = false;

  function requireNotes() {
    requireWorkspace('notes');
    if (!privateEffectsAllowed()) throw Error('Desactiva la pausa o Presentación para abrir Apuntes.');
  }

  async function restoreLibrary(): Promise<HubFileResult> {
    if (restoring) throw Error('Ya hay una restauración de Apuntes abierta.');
    restoring = true;
    try {
      const picked = await withWindowDialog(() => dialog.showOpenDialog(window, {
        title: 'Elegir copia para restaurar Apuntes', properties: ['openFile'],
        filters: [{name: 'Copias de ZEN y de Apuntes', extensions: ['json']}],
      }));
      requireNotes();
      if (picked.canceled || picked.filePaths.length !== 1) return {type: 'cancelled'};
      const {library, complete} = readLibraryBackup(picked.filePaths[0]);
      const {response} = await withWindowDialog(() => dialog.showMessageBox(window, {
        type: 'warning', message: '¿Restaurar la biblioteca de Apuntes?',
        detail: `La copia contiene ${library.entries.length} elementos. Sustituirá la biblioteca actual y su borrador guardado.` +
          (complete ? '\n\nAquí se restaura solo la biblioteca. Para recuperar también el borrador y los ajustes, usa Ajustes → Datos y configuración → Importar copia.' : ''),
        buttons: ['Cancelar', 'Restaurar biblioteca'], defaultId: 0, cancelId: 0, noLink: true,
      }));
      requireNotes();
      if (response !== 1) return {type: 'cancelled'};
      return {type: 'import', data: notes.restore(library)};
    } finally {
      restoring = false;
    }
  }

  handle('notesRecent', z.undefined(), () => {
    requireWorkspace('home');
    if (!privateEffectsAllowed()) throw Error('Desactiva la pausa o Presentación para ver apuntes.');
    try { return notes.recentNotes(); }
    catch { throw Error('No se pudieron cargar los apuntes recientes.'); }
  });
  handle('notesRead', z.undefined(), () => {
    requireNotes();
    return notes.read();
  });
  handle('notesChange', HubAction, change => {
    requireNotes();
    return notes.change(change, copy);
  });
  handle('notesDraft', HubDraft.nullable(), draft => {
    requireNotes();
    return notes.draft(draft);
  });
  handle('notesFile', HubFileAction, async (action): Promise<HubFileResult> => {
    requireNotes();
    if (action.type === 'url') {
      await openExternal(action.url);
      return {type: 'done'};
    }
    if (action.type === 'import') return restoreLibrary();
    if (action.type === 'image') {
      const picked = await withWindowDialog(() => dialog.showOpenDialog(window, {
        title: 'Adjuntar imagen', properties: ['openFile'],
        filters: [{name: 'Imagen', extensions: ['png', 'jpg', 'jpeg', 'webp']}],
      }));
      requireNotes();
      const path = picked.filePaths[0];
      if (picked.canceled || !path) return {type: 'cancelled'};
      return {type: 'image', image: readAttachment(path)};
    }

    const {data} = notes.read();
    const entry = action.type === 'markdown' ? data.entries.find(item => item.id === action.id) : undefined;
    if (action.type === 'markdown' && !entry) throw Error('Guarda el elemento antes de exportarlo.');
    const destination = await withWindowDialog(() => dialog.showSaveDialog(window, {
      title: 'Exportar Knowledge Hub',
      defaultPath: entry ? fileStem(entry.title) + '.md' : 'zen-knowledge-hub.json',
      filters: [{name: entry ? 'Markdown' : 'Respaldo JSON', extensions: [entry ? 'md' : 'json']}],
    }));
    requireNotes();
    const path = destination.filePath;
    if (destination.canceled || !path) return {type: 'cancelled'};
    if (notes.isStoragePath(path)) throw Error('Elige otro destino para la exportación.');

    const temporary = path + '.' + randomUUID() + '.tmp';
    try {
      writeFileSync(temporary, entry ? entryMarkdown(entry) : JSON.stringify(data), {encoding: 'utf8', flag: 'wx'});
      renameSync(temporary, path);
    } finally {
      rmSync(temporary, {force: true});
    }
    return {type: 'done'};
  });
}
