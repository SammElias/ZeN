import {createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID} from 'node:crypto';
import {existsSync, lstatSync, mkdirSync, readdirSync, realpathSync, renameSync} from 'node:fs';
import {homedir} from 'node:os';
import {isAbsolute, join, relative, sep} from 'node:path';
import {z} from 'zod';
import type {CompanionBackup} from '../shared/companion-backup';
import type {ProfileSyncStatus} from '../shared/profile-sync';
import {readHubFile} from './knowledge-hub';
import {atomicVaultWrite} from './password-vault';
import {
  candidateId, checkedManifest, checkpointSchema, digest, distinct, dominates, heads, nextRevision,
  profileRecords, projectProfile, revisionsSchema, type Candidate, type Checkpoint, type Manifest,
} from './profile-sync-model';

const maximum = 96 * 1024 * 1024;
const maximumVault = 32 * 1024 * 1024;
const configSchema = z.object({
  device: z.uuid(), root: z.string().min(1), code: z.string().regex(/^[a-f0-9]{64}$/),
  joining: z.boolean(), vault: z.boolean().default(false),
}).strict();
const stateSchema = z.object({
  own: revisionsSchema, known: checkpointSchema, pending: checkpointSchema.optional(),
}).strict();
type Config = z.infer<typeof configSchema>;
type State = z.infer<typeof stateSchema>;
type SecureStorage = {
  isEncryptionAvailable(): boolean;
  encryptString(text: string): Buffer;
  decryptString(bytes: Buffer): string;
};
type SyncSources = {
  fingerprint(): string;
  snapshot(): CompanionBackup;
  apply(next: CompanionBackup, previous: CompanionBackup, first: boolean): void;
};

const inside = (parent: string, child: string) => {
  const path = relative(parent, child);
  return !path || (!isAbsolute(path) && path !== '..' && !path.startsWith('..' + sep));
};
const originalNames = {
  appearance: 'Apariencia', settings: 'Preferencias', order: 'Accesos', theme: 'Tema del HUB', folderOrder: 'Orden de carpetas',
  entries: 'Biblioteca', folders: 'Carpeta', templates: 'Template', discoveries: 'Descubrimiento',
};
export const defaultSyncFolder = () => join(homedir(), 'Servidor-personal', 'Notas');

function seal(key: Buffer, context: string, value: unknown) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(Buffer.from('ZEN Sync 1/' + context));
  const bytes = Buffer.from(JSON.stringify(value));
  if (bytes.length > maximum) throw Error('El perfil supera el tamaño permitido para sincronizar.');
  const encrypted = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return Buffer.concat([nonce, cipher.getAuthTag(), encrypted]);
}
function open(key: Buffer, context: string, path: string): unknown {
  if (!lstatSync(path).isFile()) throw Error('Archivo de sincronización no válido.');
  const bytes = readHubFile(path, maximum + 28);
  if (bytes.length < 29) throw Error('Archivo de sincronización incompleto.');
  const cipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
  cipher.setAAD(Buffer.from('ZEN Sync 1/' + context));
  cipher.setAuthTag(bytes.subarray(12, 28));
  return JSON.parse(Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString('utf8'));
}
function formatConflict(record: string, choices: Candidate[], local: string): ProfileSyncStatus['conflicts'][number] {
  const group = record.split('/')[0] as keyof typeof originalNames;
  const previews = choices.map(candidate => {
    const value = candidate.value as {title?:string; name?:string; description?: string; code?: string; prompt?: string} | null;
    let preview = value === null ? 'Borrado' : [value?.title ?? value?.name, value?.description || value?.code || value?.prompt]
      .filter(Boolean).join(' · ');
    if (!preview) {
      const appearance = candidate.value as CompanionBackup['appearance'] | undefined;
      preview = group === 'appearance' && appearance?.options
        ? [appearance.options.theme, appearance.wallpaper?.name ?? appearance.options.background].join(' · ')
        : 'Versión guardada';
    }
    return {id: candidateId(candidate), device: candidate.device === local ? 'Este equipo' : 'Equipo ' + candidate.device.slice(0, 6),
      preview: preview.replace(/\s+/g, ' ').slice(0, 180)};
  });
  return {record, label: originalNames[group], choices: previews};
}

export class ProfileSync {
  private readonly configPath: string;
  private config?: Config;
  private state: State = {own: {}, known: {}};
  private readonly cache = new Map<string, {stamp: string; manifest: Manifest}>();
  private fingerprint?: string;
  private published?: string;
  private info: ProfileSyncStatus = {linked: false, peers: 0, conflicts: []};
  private results = new Map<string, Candidate[]>();

  constructor(private profile: string, private storage: SecureStorage, private sources: SyncSources) {
    this.configPath = join(profile, 'profile-sync.bin');
    try {
      if (!existsSync(this.configPath)) return;
      this.config = configSchema.parse(JSON.parse(storage.decryptString(readHubFile(this.configPath, 16_384))));
      this.info = {...this.info, linked: true, vault: this.config.vault};
      this.loadState();
    } catch {
      this.config = undefined;
      this.info = {linked: false, peers: 0, conflicts: [], error: 'ZEN no pudo abrir la configuración local de sincronización.'};
    }
  }
  status() {return this.info;}
  code() {
    if (!this.config) throw Error('Vincula un dispositivo primero.');
    return this.config.code;
  }
  vaultActive() {return Boolean(this.config?.vault);}
  vaultReport(error?: string) {this.info = {...this.info, vaultError: error};}
  configureVault(enabled: boolean) {
    const config = this.config;
    if (!config) throw Error('Vincula un perfil antes de sincronizar la bóveda.');
    const next = {...config, vault: enabled};
    atomicVaultWrite(this.configPath, this.storage.encryptString(JSON.stringify(next)));
    this.config = next;
    this.info = {...this.info, vault: enabled, vaultError: undefined};
    if (enabled) this.syncVault();
    return this.info;
  }
  hasVaultCopies() {
    const config = this.config;
    if (!config?.vault) return false;
    try {return this.vaultFiles(config).length > 0;} catch {return false;}
  }
  vaultCopies() {
    const config = this.config;
    if (!config?.vault) return [];
    return this.vaultFiles(config).map(name => {
      const value = open(this.key(config), name, join(this.directory(config), name));
      const base64 = z.string().max(Math.ceil(maximumVault / 3) * 4)
        .regex(/^[A-Za-z0-9+/]+={0,2}$/).parse(value);
      const bytes = Buffer.from(base64, 'base64');
      if (bytes.length > maximumVault) throw Error('La copia de la bóveda es demasiado grande.');
      return bytes;
    });
  }
  adoptedVault(bytes: Uint8Array) {
    const config = this.config;
    if (!config?.vault) return;
    atomicVaultWrite(this.vaultMark(config), Buffer.from(this.vaultDigest(bytes)));
  }
  syncVault() {
    const config = this.config;
    if (!config?.vault) return;
    const local = join(this.profile, 'passwords.kdbx');
    if (!existsSync(local)) return;
    try {
      const stamp = lstatSync(local, {bigint: true});
      const fingerprint = stamp.mtimeNs + ':' + stamp.size;
      if (this.vaultFingerprint === fingerprint) return;
      const bytes = readHubFile(local, maximumVault);
      const mark = this.vaultMark(config);
      if (!existsSync(mark) || readHubFile(mark, 64).toString() !== this.vaultDigest(bytes)) {
        const name = config.device + '.vault.zensync';
        atomicVaultWrite(join(this.directory(config), name), seal(this.key(config), name, bytes.toString('base64')));
        this.adoptedVault(bytes);
      }
      this.vaultFingerprint = fingerprint;
    } catch {
      this.vaultReport('La bóveda queda guardada en este equipo. ZEN volverá a intentar enviar la copia cifrada.');
    }
  }

  link(selection: string, code?: string) {
    if (this.config || existsSync(this.configPath)) throw Error('Este ZEN ya tiene una configuración de sincronización.');
    if (!this.storage.isEncryptionAvailable()) throw Error('El almacén seguro de Windows no está disponible.');
    const selected = realpathSync(selection);
    const profile = realpathSync(this.profile);
    if (!existsSync(join(selected, '.stfolder')) || inside(selected, profile) || inside(profile, selected)) {
      throw Error('Elige la raíz de una carpeta gestionada por Syncthing, como Notas.');
    }
    const config = configSchema.parse({device: randomUUID(), root: selected,
      code: code?.toLowerCase() ?? randomBytes(32).toString('hex'), joining: Boolean(code)});
    const directory = this.directory(config);
    if (code) {
      try {
        if (!this.manifests(config).length) throw Error();
      } catch {
        this.cache.clear();
        throw Error('No se encontró el perfil de ese código. Espera a que Syncthing reciba los datos y comprueba el código.');
      }
    } else {
      mkdirSync(directory, {recursive: true});
    }
    atomicVaultWrite(this.configPath, this.storage.encryptString(JSON.stringify(config)));
    this.config = config;
    this.info = {linked: true, peers: 0, conflicts: []};
    return this.run();
  }

  disconnect() {
    if (!this.config) return this.info;
    renameSync(this.configPath, join(this.profile, 'profile-sync-desvinculado-' + this.config.device + '.bin'));
    this.config = undefined;
    this.state = {own: {}, known: {}};
    this.cache.clear();
    this.results.clear();
    this.fingerprint = undefined;
    this.published = undefined;
    this.vaultFingerprint = undefined;
    this.info = {linked: false, peers: 0, conflicts: []};
    return this.info;
  }

  run(force = true, resolution?: {record: string; candidate: string}) {
    const config = this.config;
    if (!config) return this.info;
    try {
      const folder = this.directory(config);
      const peers = this.manifests(config);
      const ownFile = join(folder, config.device + '.zensync');
      const token = this.sources.fingerprint() + '/' + [...this.cache].map(([id, item]) => id + item.stamp).join(',');
      if (!force && !this.info.error && token === this.fingerprint && existsSync(ownFile)) return this.info;
      const current = this.sources.snapshot();
      const local = profileRecords(current);
      const previous = this.state;
      const peersOnly = heads(peers);
      const known = {...previous.known};
      const own = {...previous.own};
      const first = !Object.keys(previous.known).length;
      for (const record of new Set([...Object.keys(local), ...Object.keys(known)])) {
        const value = local[record] ?? null;
        const hash = digest(value);
        const recovered = previous.pending?.[record];
        if (recovered?.digest === hash) known[record] = recovered;
        if (known[record]?.digest === hash) continue;
        const incoming = peersOnly.get(record);
        // An existing shared profile owns portable preferences when a new machine joins.
        if (first && config.joining && incoming?.length &&
          (!record.includes('/') || digest(incoming[0].value) === hash)) continue;
        own[record] = nextRevision(config.device, value, known[record]?.clock ?? {}, own[record]?.clock ?? {});
        known[record] = {digest: hash, clock: own[record].clock};
      }
      let revisions = heads([...peers, {format: 1, device: config.device, revisions: own}]);
      if (resolution) {
        const candidates = revisions.get(resolution.record) ?? [];
        const selected = candidates.find(candidate => candidateId(candidate) === resolution.candidate);
        if (!selected || distinct(candidates).length < 2) throw Error('El conflicto ha cambiado. Vuelve a revisar sus versiones.');
        own[resolution.record] = nextRevision(config.device, selected.value, ...candidates.map(candidate => candidate.clock));
        revisions = heads([...peers, {format: 1, device: config.device, revisions: own}]);
      }
      const winners = Object.fromEntries([...revisions].flatMap(([record, candidates]) =>
        known[record] && candidates.every(candidate => dominates(known[record].clock, candidate.clock))
          ? [] : [[record, candidates[0]] as const]));
      const next = projectProfile(current,
        {...local, ...Object.fromEntries(Object.entries(winners).map(([record, winner]) => [record, winner.value]))});
      const nextRecords = profileRecords(next);
      const applied: Checkpoint = {};
      for (const record of new Set([...Object.keys(known), ...Object.keys(nextRecords), ...Object.keys(winners)])) {
        applied[record] = {digest: digest(nextRecords[record]), clock: winners[record]?.clock ?? known[record]?.clock ?? {}};
      }
      const changed = digest(local) !== digest(nextRecords);
      this.save({own, known, pending: changed ? applied : undefined});
      const manifest: Manifest = {format: 1, device: config.device, revisions: own};
      const hash = digest(own);
      if (hash !== this.published || !existsSync(ownFile)) {
        atomicVaultWrite(ownFile, seal(this.key(config), config.device, manifest));
        this.published = hash;
      }
      if (changed) this.sources.apply(next, current, first);
      this.save({own, known: applied});
      this.fingerprint = this.sources.fingerprint() + '/' + [...this.cache].map(([id, item]) => id + item.stamp).join(',');
      this.results = revisions;
      const conflicts = [...this.results].flatMap(([record, candidates]) => {
        const versions = distinct(candidates);
        return versions.length > 1 ? [formatConflict(record, versions, config.device)] : [];
      });
      this.info = {...this.info, linked: true, peers: peers.length, lastSync: Date.now(), conflicts, error: undefined};
    } catch (error) {
      const message = error instanceof Error && /^El conflicto ha cambiado/.test(error.message) ?
        error.message : 'No se pudo sincronizar. Revisa la carpeta de Syncthing y las preferencias de este equipo.';
      this.info = {...this.info, error: message};
    }
    return this.info;
  }

  private directory(config: Config) {
    const parent = join(config.root, 'Perfil ZEN');
    const target = join(parent, digest(config.code).slice(0, 24));
    if (!lstatSync(config.root).isDirectory() || (existsSync(parent) && !lstatSync(parent).isDirectory()) ||
        (existsSync(target) && !lstatSync(target).isDirectory())) {
      throw Error('La carpeta de sincronización no está disponible.');
    }
    return target;
  }
  private key(config: Config) {return Buffer.from(config.code, 'hex');}
  private statePath(config: Config) {return join(this.profile, 'profile-sync-' + config.device + '.bin');}
  private vaultFingerprint?: string;
  private vaultMark(config: Config) {return join(this.profile, 'profile-sync-vault-' + config.device + '.sha256');}
  private vaultDigest(bytes: Uint8Array) {return createHash('sha256').update(bytes).digest('hex');}
  private vaultFiles(config: Config) {
    const local = existsSync(join(this.profile, 'passwords.kdbx'));
    const files = readdirSync(this.directory(config)).filter(name =>
      /^[a-f0-9-]{36}\.vault\.zensync$/.test(name) && (!local || name !== config.device + '.vault.zensync'));
    if (files.length > 32) throw Error('Hay demasiadas copias de la bóveda.');
    return files.sort();
  }

  private loadState() {
    const config = this.config!;
    const path = this.statePath(config);
    if (existsSync(path)) this.state = stateSchema.parse(open(this.key(config), 'local/' + config.device, path));
  }
  private save(state: State) {
    if (digest(state) === digest(this.state)) return;
    const config = this.config!;
    atomicVaultWrite(this.statePath(config), seal(this.key(config), 'local/' + config.device, state));
    this.state = state;
  }
  private manifests(config: Config) {
    const root = this.directory(config);
    if (!lstatSync(root).isDirectory() || !existsSync(join(config.root, '.stfolder'))) {
      throw Error('La carpeta de sincronización no está disponible.');
    }
    const names = readdirSync(root).filter(name => /^[a-f0-9-]{36}\.zensync$/.test(name));
    if (names.length > 32) throw Error('Hay demasiados dispositivos en este perfil.');
    for (const device of this.cache.keys()) {
      if (!names.includes(device + '.zensync')) this.cache.delete(device);
    }
    const found: Manifest[] = [];
    for (const name of names.sort()) {
      const device = name.slice(0, 36);
      if (device === config.device) continue;
      const path = join(root, name);
      const stat = lstatSync(path, {bigint: true});
      const stamp = stat.mtimeNs + '/' + stat.size;
      let cached = this.cache.get(device);
      if (cached?.stamp !== stamp) {
        cached = {stamp, manifest: checkedManifest(open(this.key(config), device, path), device)};
        this.cache.set(device, cached);
      }
      found.push(cached.manifest);
    }
    return found;
  }
}
