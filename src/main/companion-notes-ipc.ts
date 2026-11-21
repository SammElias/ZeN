import {randomUUID} from 'node:crypto';
import {renameSync, rmSync, writeFileSync} from 'node:fs';
import {basename} from 'node:path';
import {dialog, nativeImage, type BrowserWindow} from 'electron';
import {z} from 'zod';
import {hubName} from '../shared/companion-navigation';
import {HubAction, HubDraft, HubFileAction, type HubFileResult, type HubImage} from '../shared/knowledge-hub';
import {TemplateRequest, templatePrompt, type TemplateReply} from '../shared/knowledge-templates';
import {QuickNotesAction} from '../shared/quick-notes';
import {WhiteboardAction} from '../shared/whiteboard';
import {readTemplateImage} from './companion-template-images';
import {copyTemplatePrompt} from './knowledge-templates';
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
    if (!privateEffectsAllowed()) throw Error(`Desactiva la pausa o Presentación para abrir ${hubName}.`);
  }

  async function restoreLibrary(): Promise<HubFileResult> {
    if (restoring) throw Error(`Ya hay una restauración del ${hubName} abierta.`);
    restoring = true;
    try {
      const picked = await withWindowDialog(() => dialog.showOpenDialog(window, {
        title: `Elegir copia para restaurar el ${hubName}`, properties: ['openFile'],
        filters: [{name: `Copias de ZEN y del ${hubName}`, extensions: ['json']}],
      }));
      requireNotes();
      if (picked.canceled || picked.filePaths.length !== 1) return {type: 'cancelled'};
      const {library, complete} = readLibraryBackup(picked.filePaths[0]);
      const {response} = await withWindowDialog(() => dialog.showMessageBox(window, {
        type: 'warning', message: `¿Restaurar la biblioteca del ${hubName}?`,
        detail: `La copia contiene ${library.entries.length} elementos${library.templates ? ', '+library.templates.length+' templates' : ''}${library.discoveries ? ' y '+library.discoveries.length+' fichas de descubrimiento' : ''}. Sustituirá los datos de la biblioteca incluidos en la copia.` +
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
  // Finish the small local write before another input, navigation or window close can overtake it.
  handle.sync('quickNotes', QuickNotesAction, action => {
    requireNotes();
    try {
      return notes.quickNotes(action.type==='save'?action.value:undefined);
    } catch {
      throw Error(action.type==='save'?'No se pudieron guardar los apuntes.':'No se pudieron abrir los apuntes.');
    }
  });
  handle.sync('whiteboard', WhiteboardAction, action => {
    requireNotes();
    try {
      if (action.type==='read') return notes.whiteboard();
      notes.whiteboard(action.value);
      return null;
    } catch {
      throw Error(action.type==='save'?'No se pudo guardar la pizarra.':'No se pudo abrir la pizarra.');
    }
  });
  handle('templates', TemplateRequest, async (action):Promise<TemplateReply> => {
    requireNotes();
    if(action.type==='image'){
      const picked=await withWindowDialog(()=>dialog.showOpenDialog(window,{
        title:'Elegir referencia visual',properties:['openFile'],
        filters:[{name:'Imagen',extensions:['png','jpg','jpeg','webp']}],
      }));
      requireNotes();
      if(picked.canceled||picked.filePaths.length!==1)return {type:'cancelled'};
      return {type:'image',image:readTemplateImage(picked.filePaths[0])};
    }
    if(action.type==='source'||action.type==='copy'){
      const detail=notes.templates({type:'detail',id:action.id});
      if(detail.type!=='detail')throw Error('El template no está disponible.');
      if(action.type==='source'){
        if(!detail.item.sourceUrl)throw Error('El template no tiene enlace de origen.');
        await openExternal(detail.item.sourceUrl);
      }else{
        const prompt=templatePrompt(detail.item,action.platform);
        if(!prompt)throw Error('El template no tiene un prompt para React.');
        copyTemplatePrompt(prompt,action.values,copy);
      }
      return {type:'done'};
    }
    return notes.templates(action);
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

    const {data} = notes.read(action.type==='export');
    const entry = action.type === 'markdown' ? data.entries.find(item => item.id === action.id) : undefined;
    if (action.type === 'markdown' && !entry) throw Error('Guarda el elemento antes de exportarlo.');
    const destination = await withWindowDialog(() => dialog.showSaveDialog(window, {
      title: `Exportar ${hubName}`,
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
