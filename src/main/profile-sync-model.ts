import {createHash} from 'node:crypto';
import {z} from 'zod';
import {CompanionBackup, PortableAppearance, PortableSettings, type CompanionBackup as Backup} from '../shared/companion-backup';
import {HubData, HubEntry, HubFolder} from '../shared/knowledge-hub';
import {TemplateRecord} from '../shared/knowledge-templates';
import {DiscoveryRecord} from '../shared/app-discovery';
import {LauncherOrder} from '../shared/companion-workspace';

const uuid = z.uuid();
const schemas = {
  appearance: PortableAppearance, settings: PortableSettings, order: LauncherOrder,
  theme: HubData.shape.theme, folderOrder: z.array(uuid).max(150), folders: HubFolder, entries: HubEntry,
  templates: TemplateRecord, discoveries: DiscoveryRecord,
} as const;
const groups = ['folders', 'entries', 'templates', 'discoveries'] as const;
const keyPattern = /^(appearance|settings|order|theme|folderOrder|(folders|entries|templates|discoveries)\/[a-f0-9-]{36})$/;
export const recordKey = z.string().regex(keyPattern);
export const clockSchema = z.record(uuid, z.number().int().positive().safe())
  .refine(clock => Object.keys(clock).length <= 32);
export const revisionSchema = z.object({clock: clockSchema, value: z.unknown()}).strict();
export const revisionsSchema = z.record(recordKey, revisionSchema)
  .refine(revisions => Object.keys(revisions).length <= 16_000);
export const checkpointSchema = z.record(recordKey, z.object({
  clock: clockSchema, digest: z.string().regex(/^[a-f0-9]{64}$/),
}).strict());
export const manifestSchema = z.object({
  format: z.literal(1), device: uuid, revisions: revisionsSchema,
}).strict();

export type Clock = z.infer<typeof clockSchema>;
export type Revision = z.infer<typeof revisionSchema>;
export type Revisions = z.infer<typeof revisionsSchema>;
export type Checkpoint = z.infer<typeof checkpointSchema>;
export type Manifest = z.infer<typeof manifestSchema>;
type Records = Record<string, unknown>;

export function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, part) => part && typeof part === 'object' && !Array.isArray(part)
    ? Object.fromEntries(Object.entries(part).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0))
    : part);
}
export const digest = (value: unknown) => createHash('sha256').update(stableJson(value ?? null)).digest('hex');

export function profileRecords(backup: Backup): Records {
  const records: Records = {
    appearance: backup.appearance, settings: backup.settings, order: backup.order, theme: backup.library.theme,
    folderOrder: backup.library.folders.map(folder => folder.id),
  };
  for (const group of groups) {
    for (const item of backup.library[group] ?? []) records[group + '/' + item.id] = item;
  }
  return records;
}

export function projectProfile(backup: Backup, records: Records): Backup {
  const folders = new Map<string, z.infer<typeof HubFolder>>();
  const aliases = new Map<string, string>();
  // A folder can be created with the same name on two disconnected devices.
  for (const [key, value] of Object.entries(records).sort(([a], [b]) => a.localeCompare(b))) {
    if (!key.startsWith('folders/') || value === null) continue;
    const folder = HubFolder.parse(value);
    const existing = [...folders.values()].find(other => other.group === folder.group &&
      other.name.localeCompare(folder.name, 'es', {sensitivity: 'accent'}) === 0);
    if (existing) aliases.set(folder.id, existing.id);
    else folders.set(folder.id, folder);
  }
  const entries = Object.entries(records).flatMap(([key, value]) =>
    key.startsWith('entries/') && value !== null ? [HubEntry.parse(value)] : []);
  const entryKinds = new Map(entries.map(entry => [entry.id, entry.kind]));
  const portableEntries = entries.map(entry => {
    const folder = entry.folderId && (aliases.get(entry.folderId) ?? entry.folderId);
    const allowed = entry.kind === 'project' ? ['note', 'snippet', 'resource'] : entry.kind === 'resource' ? ['note'] : [];
    return {...entry, folderId: folder && folders.has(folder) ? folder : null,
      related: entry.related.filter(id => allowed.includes(entryKinds.get(id) ?? ''))};
  });
  const templates = Object.entries(records).flatMap(([key, value]) =>
    key.startsWith('templates/') && value !== null ? [TemplateRecord.parse(value)] : []);
  const discoveries = Object.entries(records).flatMap(([key, value]) =>
    key.startsWith('discoveries/') && value !== null ? [DiscoveryRecord.parse(value)] : []);
  const folderOrder = [...schemas.folderOrder.parse(records.folderOrder), ...folders.keys()];
  return CompanionBackup.parse({...backup,
    appearance: records.appearance, settings: records.settings, order: records.order,
    library: {...backup.library, theme: records.theme,
      folders: [...new Set(folderOrder)].flatMap(id => {const folder = folders.get(id); return folder ? [folder] : [];}),
      entries: portableEntries, templates, discoveries},
  });
}

export function checkedManifest(raw: unknown, device: string): Manifest {
  const manifest = manifestSchema.parse(raw);
  if (manifest.device !== device) throw Error('La identidad del archivo de sincronización no coincide.');
  for (const [key, revision] of Object.entries(manifest.revisions)) {
    if (!revision.clock[device]) throw Error('La revisión no identifica a su equipo de origen.');
    const [group, id] = key.split('/');
    if (id && !uuid.safeParse(id).success) throw Error('El identificador del registro no es válido.');
    if (id && revision.value === null) continue;
    const value = schemas[group as keyof typeof schemas].parse(revision.value);
    if (id && (value as {id:string}).id !== id) throw Error('El registro no coincide con su identificador.');
    revision.value = value;
  }
  return manifest;
}

export function dominates(a: Clock, b: Clock) {
  return Object.entries(b).every(([device, count]) => (a[device] ?? 0) >= count) &&
    Object.entries(a).some(([device, count]) => count > (b[device] ?? 0));
}

export type Candidate = Revision & {device: string};
export function heads(manifests: Manifest[]) {
  const candidates = new Map<string, Candidate[]>();
  for (const {device, revisions} of manifests) {
    for (const [key, revision] of Object.entries(revisions)) {
      const bucket = candidates.get(key) ?? [];
      bucket.push({...revision, device});
      candidates.set(key, bucket);
    }
  }
  for (const [key, bucket] of candidates) {
    candidates.set(key, bucket.filter(a => !bucket.some(b => dominates(b.clock, a.clock)))
      .sort((a, b) => a.device < b.device ? -1 : a.device > b.device ? 1 : 0));
  }
  return candidates;
}

export function nextRevision(device: string, value: unknown, ...parents: Clock[]): Revision {
  const clock: Clock = {};
  for (const parent of parents) {
    for (const [peer, count] of Object.entries(parent)) clock[peer] = Math.max(clock[peer] ?? 0, count);
  }
  clock[device] = (clock[device] ?? 0) + 1;
  return revisionSchema.parse({clock, value});
}
export function distinct(candidates: Candidate[]) {
  return [...new Map(candidates.map(candidate => [digest(candidate.value), candidate])).values()];
}
export const candidateId = (candidate: Candidate) => digest({device: candidate.device, clock: candidate.clock});
