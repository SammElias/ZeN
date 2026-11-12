import {randomUUID} from 'node:crypto';
import {closeSync, existsSync, fstatSync, openSync, readSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {imageSize} from 'image-size';
import {CompanionNotes} from './companion-notes';
import {
  collections, HubAction, HubData, HubDraft, HubEntry, HubFolder, newFields, variables,
  type HubFields, type HubResult, type HubSession, type RecentHubNote,
} from '../shared/knowledge-hub';

export const hubMaximumBytes = 32 * 1024 * 1024;

export function readHubFile(path: string, limit = hubMaximumBytes) {
  const file = openSync(path, 'r');
  try {
    const info = fstatSync(file);
    if (!info.isFile() || info.size < 1 || info.size > limit) throw Error('El archivo está vacío o supera el tamaño permitido.');
    const bytes = Buffer.alloc(info.size);
    for (let offset = 0; offset < bytes.length;) {
      const read = readSync(file, bytes, offset, bytes.length - offset, offset);
      if (!read) throw Error('El archivo cambió durante la lectura.');
      offset += read;
    }
    const after = fstatSync(file);
    if (after.size !== info.size || after.mtimeMs !== info.mtimeMs) throw Error('El archivo cambió durante la lectura.');
    return bytes;
  } finally {
    closeSync(file);
  }
}

const namesMatch = (a: string, b: string) => a.localeCompare(b, 'es', {sensitivity: 'accent'}) === 0;

function validateFields(fields: HubFields, data: HubData) {
  if (fields.folderId && !data.folders.some(folder => folder.id === fields.folderId)) throw Error('La carpeta ya no existe.');
  if (fields.kind === 'note' && !fields.description.trim()) throw Error('Escribe el contenido del apunte.');
  if (['snippet', 'prompt'].includes(fields.kind) && !fields.code.trim()) throw Error('Escribe el código o el texto.');
  if (fields.kind === 'resource' && !fields.url) throw Error('Introduce la URL del recurso.');
  if (fields.related.length !== new Set(fields.related).size) throw Error('Hay relaciones duplicadas.');
  const allowed = fields.kind === 'project' ? ['note', 'snippet', 'resource'] : fields.kind === 'resource' ? ['note'] : [];
  if (fields.related.some(id => !data.entries.some(entry => entry.id === id && allowed.includes(entry.kind)))) {
    throw Error('Algún elemento relacionado ya no está disponible.');
  }
  validateImages(fields.images);
}

function validateImages(images: HubFields['images']) {
  if (new Set(images.map(image => image.id)).size !== images.length) throw Error('Hay imágenes duplicadas.');
  for (const image of images) {
    const [prefix, encoded] = image.data.split(',');
    const bytes = Buffer.from(encoded, 'base64');
    const {type, width, height} = imageSize(bytes);
    const mime = type === 'jpg' ? 'jpeg' : type;
    if (prefix !== 'data:image/' + mime + ';base64' || !width || !height || width > 1600 || height > 1600) {
      throw Error('El respaldo contiene una imagen incompatible.');
    }
  }
}

export function validateHubBackup(raw: unknown) {
  const parsed = HubData.safeParse(raw);
  if (!parsed.success) throw Error('El archivo no es un respaldo válido de Knowledge Hub.');
  const data = parsed.data;
  if (new Set(data.folders.map(folder => folder.id)).size !== data.folders.length ||
      new Set(data.entries.map(entry => entry.id)).size !== data.entries.length) throw Error('El respaldo tiene identificadores duplicados.');
  for (const [index, folder] of data.folders.entries()) {
    if (data.folders.slice(0, index).some(other => folder.group === other.group && namesMatch(folder.name, other.name))) {
      throw Error('El respaldo tiene carpetas duplicadas.');
    }
  }
  for (const entry of data.entries) validateFields(entry, data);
  if (Buffer.byteLength(JSON.stringify(data)) > hubMaximumBytes) throw Error('La biblioteca supera el límite de 32 MB.');
  return data;
}

export class KnowledgeHub {
  constructor(private readonly path: string, private readonly legacyPath: string) {}

  private transaction<T>(run: (db: DatabaseSync) => T): T {
    const db = new DatabaseSync(this.path);
    try {
      db.exec(`
        PRAGMA busy_timeout = 3000;
        CREATE TABLE IF NOT EXISTS hub_state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS hub_folders (id TEXT PRIMARY KEY, position INTEGER NOT NULL, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS hub_entries (id TEXT PRIMARY KEY, value TEXT NOT NULL);
        BEGIN IMMEDIATE;
      `);
      if (!db.prepare("SELECT value FROM hub_state WHERE key='theme'").get()) this.initialize(db);
      const result = run(db);
      db.exec('COMMIT');
      return result;
    } catch (error) {
      if (db.isTransaction) db.exec('ROLLBACK');
      throw error;
    } finally {
      db.close();
    }
  }

  private initialize(db: DatabaseSync) {
    const legacy = new CompanionNotes(this.legacyPath).read();
    const folders: HubFolder[] = legacy.folders.map(folder => ({...folder, group: 'folder'}));
    for (const group of ['folder', 'technology', 'ai'] as const) {
      for (const name of collections[group]) {
        if (!folders.some(folder => folder.group === group && namesMatch(folder.name, name))) folders.push({id: randomUUID(), name, group});
      }
    }
    const entries: HubEntry[] = legacy.notes.map(note => ({
      ...newFields('note', note.folderId), ...note, createdAt: note.updatedAt,
    }));
    this.replace(db, {version: 2, theme: 'light', folders, entries});
  }

  private replace(db: DatabaseSync, data: HubData) {
    db.exec('DELETE FROM hub_entries; DELETE FROM hub_folders; DELETE FROM hub_state;');
    db.prepare("INSERT INTO hub_state VALUES ('theme', ?)").run(data.theme);
    this.writeFolders(db, data.folders);
    for (const entry of data.entries) this.writeEntry(db, entry);
  }

  private writeFolders(db: DatabaseSync, folders: HubFolder[]) {
    db.exec('DELETE FROM hub_folders');
    const insert = db.prepare('INSERT INTO hub_folders VALUES (?, ?, ?)');
    folders.forEach((folder, index) => insert.run(folder.id, index, JSON.stringify(folder)));
  }

  private writeEntry(db: DatabaseSync, entry: HubEntry) {
    db.prepare('INSERT OR REPLACE INTO hub_entries VALUES (?, ?)').run(entry.id, JSON.stringify(entry));
  }

  private snapshot(db: DatabaseSync): HubData {
    const theme = db.prepare("SELECT value FROM hub_state WHERE key='theme'").get()?.value;
    const folders = db.prepare('SELECT value FROM hub_folders ORDER BY position').all().map(row => JSON.parse(String(row.value)));
    const entries = db.prepare('SELECT value FROM hub_entries').all().map(row => JSON.parse(String(row.value)));
    return HubData.parse({version: 2, theme, folders, entries});
  }

  read(): HubSession {
    return this.transaction(db => {
      const data = this.snapshot(db);
      const draft = db.prepare("SELECT value FROM hub_state WHERE key='draft'").get()?.value;
      return {data, draft: draft ? HubDraft.parse(JSON.parse(String(draft))) : undefined};
    });
  }

  recentNotes(): RecentHubNote[] {
    if (!existsSync(this.path)) {
      const {notes, folders} = new CompanionNotes(this.legacyPath).read();
      return notes.sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,4).map(({id,title,updatedAt,folderId})=>({
        id, title, updatedAt, favorite:false, folder:folders.find(item=>item.id===folderId)?.name ?? null,
      }));
    }
    const db = new DatabaseSync(this.path, {readOnly:true});
    try {
      const rows = db.prepare(`
        SELECT entry.id, json_extract(entry.value, '$.title') AS title,
               json_extract(entry.value, '$.updatedAt') AS updatedAt,
               json_extract(entry.value, '$.favorite') AS favorite,
               json_extract(folder.value, '$.name') AS folder
        FROM hub_entries AS entry
        LEFT JOIN hub_folders AS folder ON folder.id = json_extract(entry.value, '$.folderId')
        WHERE json_extract(entry.value, '$.kind') = 'note'
        ORDER BY updatedAt DESC, entry.id
        LIMIT 4
      `).all() as (Omit<RecentHubNote, 'favorite'> & {favorite: number})[];
      return rows.map(row=>({...row,favorite:row.favorite===1}));
    } finally {
      db.close();
    }
  }

  draft(value: HubDraft | null) {
    return this.transaction(db => {
      if (value === null) db.exec("DELETE FROM hub_state WHERE key='draft'");
      else db.prepare("INSERT OR REPLACE INTO hub_state VALUES ('draft', ?)").run(JSON.stringify(HubDraft.parse(value)));
      return true as const;
    });
  }

  restore(raw: unknown, draft?: HubDraft) {
    const data = validateHubBackup(raw);
    const recovered = draft && HubDraft.parse(draft);
    if (recovered) validateImages(recovered.fields.images);
    return this.transaction(db => {
      this.replace(db, data);
      if (recovered) db.prepare("INSERT INTO hub_state VALUES ('draft', ?)").run(JSON.stringify(recovered));
      return data;
    });
  }

  change(raw: HubAction, copy: (text: string) => void): HubResult {
    const action = HubAction.parse(raw);
    let textToCopy: string | undefined;
    const result = this.transaction(db => {
      const data = this.snapshot(db);
      const entry = 'id' in action && data.entries.find(item => item.id === action.id) || undefined;
      const folder = 'id' in action && data.folders.find(item => item.id === action.id) || undefined;
      let id: string | undefined;
      switch (action.type) {
        case 'save': {
          if (action.id && (!entry || entry.updatedAt !== action.expected || entry.kind !== action.fields.kind)) {
            throw Error('El elemento cambió. Reabre la biblioteca para revisar la versión guardada.');
          }
          validateFields(action.fields, data);
          const now = Date.now();
          id = entry?.id ?? randomUUID();
          const saved = {
            ...action.fields, id, createdAt: entry?.createdAt ?? now,
            updatedAt: Math.max(now, (entry?.updatedAt ?? 0) + 1), copiedAt: entry?.copiedAt,
          };
          this.writeEntry(db, saved);
          db.exec("DELETE FROM hub_state WHERE key='draft'");
          break;
        }
        case 'duplicate': {
          if (!entry) throw Error('El elemento ya no existe.');
          id = randomUUID();
          const now = Date.now();
          this.writeEntry(db, {...entry, id, title: entry.title.slice(0, 112) + ' (copia)', createdAt: now, updatedAt: now, copiedAt: undefined});
          break;
        }
        case 'favorite':
          if (!entry) throw Error('El elemento ya no existe.');
          this.writeEntry(db, {...entry, favorite: !entry.favorite});
          break;
        case 'remove':
          if (!entry) throw Error('El elemento ya no existe.');
          db.prepare('DELETE FROM hub_entries WHERE id=?').run(entry.id);
          for (const related of data.entries.filter(item => item.related.includes(entry.id))) {
            this.writeEntry(db, {...related, related: related.related.filter(key => key !== entry.id), updatedAt: Math.max(Date.now(), related.updatedAt + 1)});
          }
          break;
        case 'folder':
          if (action.id && !folder) throw Error('La carpeta ya no existe.');
          if (data.folders.some(other => other.id !== folder?.id && other.group === action.group && namesMatch(other.name, action.name))) {
            throw Error('Ya existe una carpeta con ese nombre.');
          }
          id = folder?.id ?? randomUUID();
          if (folder) Object.assign(folder, {name: action.name, group: action.group});
          else data.folders.push({id, name: action.name, group: action.group});
          this.writeFolders(db, data.folders);
          break;
        case 'reorder': {
          if (!folder) throw Error('La carpeta ya no existe.');
          const group = data.folders.filter(other => other.group === folder.group);
          const next = group[group.indexOf(folder) + (action.direction === 'up' ? -1 : 1)];
          if (next) {
            const a = data.folders.indexOf(folder);
            const b = data.folders.indexOf(next);
            [data.folders[a], data.folders[b]] = [next, folder];
            this.writeFolders(db, data.folders);
          }
          break;
        }
        case 'removeFolder':
          if (data.entries.some(item => item.folderId === action.id)) throw Error('Mueve los elementos de la carpeta antes de eliminarla.');
          this.writeFolders(db, data.folders.filter(item => item.id !== action.id));
          break;
        case 'theme':
          db.prepare("UPDATE hub_state SET value=? WHERE key='theme'").run(action.theme);
          break;
        case 'copy': {
          if (!entry?.code.trim()) throw Error('No hay texto para copiar.');
          const keys = new Set(variables(entry.code));
          const values = Object.entries(action.values);
          if (values.length > 32 || values.some(([key]) => !keys.has(key))) throw Error('Las variables no coinciden con el texto guardado.');
          textToCopy = entry.code.replace(/\{\{([A-Za-z_][A-Za-z0-9_]{0,63})\}\}/g, (whole, key) => Object.hasOwn(action.values, key) ? action.values[key] : whole);
          if (textToCopy.length > 100000) throw Error('El texto con variables es demasiado largo.');
          this.writeEntry(db, {...entry, copiedAt: Date.now()});
          break;
        }
      }
      const updated = this.snapshot(db);
      if (Buffer.byteLength(JSON.stringify(updated)) > hubMaximumBytes) throw Error('La biblioteca supera el límite de 32 MB.');
      if (textToCopy !== undefined) copy(textToCopy);
      return {data: updated, id};
    });
    return result;
  }
}
