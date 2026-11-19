import {randomUUID} from 'node:crypto';
import type {DatabaseSync} from 'node:sqlite';
import {imageSize} from 'image-size';
import {
  personalizeTemplate, templateVariables, TemplateDetail, TemplateDraft, TemplateFields, TemplateRecord, TemplateSummary, referenceBytes, templateLibraryBytes,
  templateLimit, type TemplateReply, type TemplateRequest, type TemplateImage,
} from '../shared/knowledge-templates';

const imageTypes = {jpg:'image/jpeg', png:'image/png', webp:'image/webp'} as const;

export function templateImageBytes(data: string, mime: TemplateImage['mime'], thumbnail = false) {
  const bytes = Buffer.from(data, 'base64');
  const maxDimension = thumbnail ? 480 : 8192;
  try {
    if (bytes.length > (thumbnail ? 200_000 : referenceBytes) || bytes.toString('base64') !== data) throw Error();
    const {type, width, height} = imageSize(bytes);
    if (!width || !height || imageTypes[type as keyof typeof imageTypes] !== mime ||
        width > maxDimension || height > maxDimension || width * height > 24_000_000) throw Error();
    return bytes;
  } catch { throw Error('La referencia visual está dañada o supera los límites de imagen.'); }
}

export function validateTemplateImage(image: TemplateImage) {
  templateImageBytes(image.original, image.mime);
  templateImageBytes(image.thumbnail, 'image/jpeg', true);
}

function sizeError() {
  return Error('Templates admite hasta 200 elementos y 16 MB. Reduce el tamaño de las imágenes o elimina algún template.');
}

export function validateTemplates(records: TemplateRecord[]) {
  if (new Set(records.map(record=>record.id)).size !== records.length) throw Error('El respaldo contiene templates duplicados.');
  if (Buffer.byteLength(JSON.stringify(records)) > templateLibraryBytes) throw sizeError();
  for (const {image} of records) if (image) validateTemplateImage(image);
}

export function validateTemplateDraft(draft: TemplateDraft) {
  if (draft.image) validateTemplateImage(draft.image);
}

export function copyTemplatePrompt(prompt:string, values:Record<string,string>, copy:(text:string)=>void) {
  const keys = new Set(templateVariables(prompt));
  const supplied = Object.keys(values);
  if(supplied.length>32 || supplied.some(key=>!keys.has(key))) throw Error('Las variables no coinciden con el prompt guardado.');
  const text=personalizeTemplate(prompt,values);
  if(text.length>100000) throw Error('El prompt personalizado es demasiado largo.');
  try { copy(text); }
  catch { throw Error('No se pudo copiar el prompt. Puedes seleccionarlo y copiarlo manualmente.'); }
}

export function createTemplateTable(db: DatabaseSync) {
  db.exec('CREATE TABLE IF NOT EXISTS hub_templates (id TEXT PRIMARY KEY, value TEXT NOT NULL, image TEXT)');
}

function write(db: DatabaseSync, record: TemplateRecord) {
  const {image, ...detail} = record;
  const item = {...detail, hasImage: Boolean(image)};
  db.prepare('INSERT OR REPLACE INTO hub_templates VALUES (?, ?, ?)').run(record.id, JSON.stringify(item), image ? JSON.stringify(image) : null);
  return item;
}

function setInitialized(db: DatabaseSync) {
  db.prepare("INSERT OR REPLACE INTO hub_state VALUES ('templates-initialized', '1')").run();
}

function checkCapacity(db: DatabaseSync) {
  const result = db.prepare('SELECT count(*) AS count, coalesce(sum(length(CAST(value AS BLOB)) + coalesce(length(CAST(image AS BLOB)), 0)), 0) AS bytes FROM hub_templates').get()!;
  // Leave space for the JSON array separators in the portable representation.
  if (Number(result.count) > templateLimit || Number(result.bytes) + Number(result.count) + 2 > templateLibraryBytes) throw sizeError();
}

export function seedTemplates(db: DatabaseSync, seeds:()=>TemplateRecord[]) {
  if (db.prepare("SELECT 1 FROM hub_state WHERE key='templates-initialized'").get()) return;
  for (const record of seeds()) write(db, TemplateRecord.parse(record));
  checkCapacity(db);
  setInitialized(db);
}

function readDraft(db: DatabaseSync): TemplateDraft | undefined {
  const row = db.prepare("SELECT value FROM hub_state WHERE key='template-draft'").get();
  return row ? TemplateDraft.parse(JSON.parse(String(row.value))) : undefined;
}

function saveDraft(db: DatabaseSync, draft: TemplateDraft | null) {
  if (draft) {
    db.prepare("INSERT OR REPLACE INTO hub_state VALUES ('template-draft', ?)").run(JSON.stringify(draft));
  } else db.exec("DELETE FROM hub_state WHERE key='template-draft'");
}

export function templateBackup(db: DatabaseSync) {
  const templates = db.prepare('SELECT value, image FROM hub_templates ORDER BY id').all().map(row=>{
    const {hasImage, ...detail} = TemplateDetail.parse(JSON.parse(String(row.value)));
    return TemplateRecord.parse({...detail, image: hasImage ? JSON.parse(String(row.image)) : undefined});
  });
  return {templates, templateDraft:readDraft(db)};
}

export function restoreTemplates(db: DatabaseSync, records: TemplateRecord[], draft?:TemplateDraft) {
  db.exec('DELETE FROM hub_templates');
  for (const record of records) write(db, record);
  checkCapacity(db);
  saveDraft(db, draft ?? null);
  setInitialized(db);
}

function loadDetail(db: DatabaseSync, id: string) {
  const row = db.prepare('SELECT value FROM hub_templates WHERE id=?').get(id);
  if (!row) throw Error('El template ya no está disponible.');
  return TemplateDetail.parse(JSON.parse(String(row.value)));
}

function loadImage(db: DatabaseSync,id: string): TemplateImage | undefined {
  const row = db.prepare('SELECT image FROM hub_templates WHERE id=?').get(id);
  return row?.image ? JSON.parse(String(row.image)) as TemplateImage : undefined;
}

export function templateImage(db: DatabaseSync, id: string, thumbnail: boolean) {
  const row = db.prepare("SELECT json_extract(image, ?) AS data, json_extract(image, '$.mime') AS mime FROM hub_templates WHERE id=?")
    .get(thumbnail?'$.thumbnail':'$.original',id);
  if (!row?.data) return;
  return {mime:thumbnail?'image/jpeg':String(row.mime), bytes:Buffer.from(String(row.data),'base64')};
}

type StorageAction = Exclude<TemplateRequest,{type:'image'|'copy'|'source'}>;

export function changeTemplates(db: DatabaseSync, action: StorageAction): TemplateReply {
  if (action.type === 'list') {
    const items = db.prepare(`SELECT json_object(
      'id', id, 'name', json_extract(value,'$.name'), 'description', json_extract(value,'$.description'),
      'tags', json_extract(value,'$.tags'), 'favorite', value -> '$.favorite',
      'createdAt', json_extract(value,'$.createdAt'), 'updatedAt', json_extract(value,'$.updatedAt'),
      'hasImage', value -> '$.hasImage'
    ) AS summary FROM hub_templates ORDER BY id`).all()
      .map(row=>TemplateSummary.parse(JSON.parse(String(row.summary))));
    return {type:'list', items, draft:readDraft(db)};
  }
  if (action.type === 'draft') {
    const {draft} = action;
    if (draft) {
      const previous = readDraft(db);
      const same = previous && previous.id === draft.id && previous.expected === draft.expected;
      saveDraft(db, draft.image===undefined&&same?{...draft,image:previous.image}:draft);
    } else saveDraft(db,null);
    return {type:'done'};
  }
  if (action.type === 'save') {
    const {id, expected, fields, image} = action.draft;
    const prior = id ? loadDetail(db,id) : undefined;
    if (prior && prior.updatedAt !== expected) throw Error('El template cambió. Reabre la versión guardada antes de editarlo.');
    if (image) validateTemplateImage(image);
    const now = Date.now();
    const item = write(db, {
      ...TemplateFields.parse(fields), id:id ?? randomUUID(), createdAt:prior?.createdAt ?? now,
      updatedAt:Math.max(now,(prior?.updatedAt ?? 0)+1), favorite:prior?.favorite ?? false,
      image:image ?? (image === undefined && id ? loadImage(db,id) : undefined),
    });
    checkCapacity(db);
    saveDraft(db,null);
    return {type:'detail', item};
  }

  const prior = loadDetail(db, action.id);
  switch(action.type) {
    case 'detail': return {type:'detail', item:prior};
    case 'favorite': {
      const favorite = !prior.favorite;
      db.prepare('UPDATE hub_templates SET value=? WHERE id=?').run(JSON.stringify({...prior,favorite}),prior.id);
      return {type:'favorite',favorite};
    }
    case 'duplicate': {
      const {hasImage, ...fields} = prior;
      const now=Date.now();
      const item=write(db,{...fields,name:prior.name.slice(0,112)+' (copia)',id:randomUUID(),favorite:false,
        createdAt:now,updatedAt:now,image:hasImage ? loadImage(db,prior.id) : undefined});
      checkCapacity(db);
      return {type:'detail',item};
    }
    case 'delete':
      if(prior.updatedAt !== action.expected) throw Error('El template cambió. Reabre el detalle antes de eliminarlo.');
      db.prepare('DELETE FROM hub_templates WHERE id=?').run(prior.id);
      if (readDraft(db)?.id === prior.id) saveDraft(db,null);
      return {type:'done'};
  }
}
