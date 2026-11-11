import {randomUUID} from 'node:crypto';
import {closeSync, fstatSync, openSync, readFileSync, renameSync, rmSync, writeFileSync} from 'node:fs';
import {Notebook, NotesChange, type NotesChangeResult} from '../shared/companion-notes';

const maximumBytes = 8 * 1024 * 1024;

export class CompanionNotes {
  constructor(private readonly path: string) {}

  read(): Notebook {
    let file: number | undefined;
    try {
      file = openSync(this.path, 'r');
      const info = fstatSync(file);
      if (!info.isFile() || info.size > maximumBytes) throw Error();
      const notebook = Notebook.parse(JSON.parse(readFileSync(file, 'utf8')));
      const folderIds = new Set(notebook.folders.map(folder => folder.id));
      if (folderIds.size !== notebook.folders.length ||
          new Set(notebook.notes.map(note => note.id)).size !== notebook.notes.length ||
          notebook.notes.some(note => !folderIds.has(note.folderId))) throw Error();
      return notebook;
    } catch (error) {
      if (file === undefined && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        return {version: 1, folders: [], notes: []};
      }
      throw Error('No se pudieron leer los apuntes guardados.');
    } finally {
      if (file !== undefined) closeSync(file);
    }
  }

  change(input: NotesChange): NotesChangeResult {
    const change = NotesChange.parse(input);
    const notebook = this.read();
    let id: string | undefined;

    switch (change.type) {
      case 'createFolder':
      case 'renameFolder': {
        const existing = change.type === 'renameFolder'
          ? notebook.folders.find(folder => folder.id === change.id) : undefined;
        if (change.type === 'renameFolder' && !existing) throw Error('La carpeta ya no existe.');
        if (notebook.folders.some(folder => folder.id !== existing?.id &&
            folder.name.localeCompare(change.name, 'es', {sensitivity: 'accent'}) === 0)) {
          throw Error('Ya existe una carpeta con ese nombre.');
        }
        if (existing) {
          existing.name = change.name;
          id = existing.id;
        } else {
          if (notebook.folders.length >= 100) throw Error('Has alcanzado el límite de 100 carpetas.');
          id = randomUUID();
          notebook.folders.push({id, name: change.name});
        }
        break;
      }
      case 'removeFolder':
        if (notebook.notes.some(note => note.folderId === change.id)) throw Error('Vacía la carpeta antes de eliminarla.');
        notebook.folders = notebook.folders.filter(folder => folder.id !== change.id);
        break;
      case 'saveNote': {
        if (!notebook.folders.some(folder => folder.id === change.folderId)) throw Error('La carpeta ya no existe.');
        const index = change.id ? notebook.notes.findIndex(note => note.id === change.id) : -1;
        if (change.id && index === -1) throw Error('El apunte ya no existe.');
        if (index === -1 && notebook.notes.length >= 1000) throw Error('Has alcanzado el límite de 1.000 apuntes.');
        id = change.id ?? randomUUID();
        const {folderId, title, description, code} = change;
        const note = {id, folderId, title, description, code, updatedAt: Date.now()};
        if (index === -1) notebook.notes.push(note);
        else notebook.notes[index] = note;
        break;
      }
      case 'removeNote':
        notebook.notes = notebook.notes.filter(note => note.id !== change.id);
        break;
    }

    const content = JSON.stringify(notebook);
    if (Buffer.byteLength(content) > maximumBytes) throw Error('El cuaderno está lleno. Libera espacio para guardar más apuntes.');
    const temporary = `${this.path}.${randomUUID()}.tmp`;
    try {
      writeFileSync(temporary, content, {encoding: 'utf8', flag: 'wx'});
      renameSync(temporary, this.path);
    } catch {
      try { rmSync(temporary, {force: true}); } catch { /* Keep the original write error. */ }
      throw Error('No se pudieron guardar los apuntes.');
    }
    return {notebook, id};
  }
}
