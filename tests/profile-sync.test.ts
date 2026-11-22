import {randomUUID} from 'node:crypto';
import {mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {Credentials, Kdbx, ProtectedValue} from 'kdbxweb';
import {CompanionAppearance} from '../src/main/companion-appearance';
import {CompanionLauncher} from '../src/main/companion-launcher';
import {restoreBackup, snapshotBackup} from '../src/main/companion-backup';
import {KnowledgeHub} from '../src/main/knowledge-hub';
import {ProfileSync} from '../src/main/profile-sync';
import {PasswordVault} from '../src/main/password-vault';
import {CompanionSettingsSchema} from '../src/shared/codex-companion';
import {newFields} from '../src/shared/knowledge-hub';
import {emptyTemplate} from '../src/shared/knowledge-templates';

const testDirectories:string[] = [];
afterEach(() => {
  vi.useRealTimers();
  for (const directory of testDirectories.splice(0)) rmSync(directory, {recursive:true, force:true});
});

function setup() {
  const root = mkdtempSync(join(tmpdir(), 'zen-profile-sync-'));
  testDirectories.push(root);
  const folder = join(root, 'shared');
  mkdirSync(join(folder, '.stfolder'), {recursive:true});
  return {root, folder};
}
function device(root: string) {
  const profile = join(root, randomUUID());
  mkdirSync(profile);
  const sources = {
    notes: new KnowledgeHub(join(profile, 'knowledge-hub.sqlite'), join(profile, 'legacy.json')),
    appearance: new CompanionAppearance(profile, bytes => bytes),
    launcher: new CompanionLauncher(join(profile, 'companion-launcher.json')),
    settings: CompanionSettingsSchema.parse({}),
  };
  const storage = {
    isEncryptionAvailable: () => true,
    encryptString: (text:string) => Buffer.from(text),
    decryptString: (bytes:Buffer) => bytes.toString(),
  };
  const create = () => new ProfileSync(profile, storage, {
    fingerprint: () => '',
    snapshot: () => snapshotBackup(sources),
    apply: (next, previous, first) => {
      restoreBackup(profile, sources, next, settings => {sources.settings = settings;}, {previous, first});
    },
  });
  const note = (title:string) => sources.notes.change({type:'save',
    fields:{...newFields('note'),title,description:'Texto de prueba'}}, () => {}).id!;
  const edit = (id:string, title:string) => {
    const entry = sources.notes.read().data.entries.find(item => item.id === id)!;
    sources.notes.change({type:'save', id, expected:entry.updatedAt, fields:{...newFields('note'), title,
      description:'Texto de prueba'}}, () => {});
  };
  const titles = () => sources.notes.read().data.entries.map(entry => entry.title).sort();
  return {profile, sources, create, note, edit, titles};
}

function manifestFiles(folder:string) {
  const parent = join(folder,'Perfil ZEN');
  const directory = join(parent,readdirSync(parent)[0]);
  return readdirSync(directory).map(file => join(directory,file));
}

describe('encrypted profile sync', () => {
  it('joins a second profile with portable settings, templates, and only encrypted transport', () => {
    const {root, folder} = setup();
    const a = device(root), b = device(root);
    a.note('Nota privada de muestra');
    a.sources.settings.sounds = false;
    a.sources.notes.templates({type:'save',draft:{fields:{...emptyTemplate(),
      name:'Diseño compartido',description:'Descripción',prompt:'Prompt de muestra'}}});
    a.sources.notes.draft({fields:{...newFields('note'),title:'Borrador privado'}});
    writeFileSync(join(a.profile,'passwords.kdbx'),'VAULT_STAYS_LOCAL');
    const source = a.create(), target = b.create();
    expect(source.link(folder).error).toBeUndefined();
    expect(target.link(folder,source.code())).toMatchObject({linked:true, peers:1, conflicts:[]});
    expect(b.titles()).toEqual(['Nota privada de muestra']);
    expect(b.sources.settings.sounds).toBe(false);
    expect(b.sources.notes.read(true).data.templates).toMatchObject([{name:'Diseño compartido'}]);
    expect(b.sources.notes.read(true).draft).toBeUndefined();
    for (const path of manifestFiles(folder)) {
      const bytes = readFileSync(path);
      expect(bytes.toString('utf8')).not.toMatch(/Nota privada|Diseño compartido|Borrador privado|VAULT_STAYS_LOCAL/);
    }
  });

  it('merges independent edits, tracks simultaneous edits and resolves them permanently', () => {
    const {root, folder} = setup();
    const a = device(root), b = device(root);
    const id = a.note('Compartida');
    const source = a.create();
    const target = b.create();
    source.link(folder);
    target.link(folder,source.code());
    a.note('Desde A');
    b.note('Desde B');
    source.run(); target.run(); source.run();
    expect(a.titles()).toEqual(['Compartida','Desde A','Desde B']);
    expect(b.titles()).toEqual(a.titles());

    a.edit(id,'Edición A');
    b.edit(id,'Edición B');
    source.run(); target.run();
    const conflict = source.run().conflicts.find(item => item.record === 'entries/' + id)!;
    expect(conflict.choices.map(choice => choice.preview)).toEqual(
      expect.arrayContaining([expect.stringContaining('Edición A'),expect.stringContaining('Edición B')]));
    const selected = conflict.choices.find(choice => choice.preview.includes('Edición B'))!;
    expect(source.run(true,{record:conflict.record,candidate:selected.id}).conflicts).toEqual([]);
    expect(target.run().conflicts).toEqual([]);
    expect(a.titles()).toEqual(['Desde A','Desde B','Edición B']);
    expect(b.titles()).toEqual(a.titles());

    const restarted = a.create();
    a.sources.notes.change({type:'remove',id}, () => {});
    restarted.run();
    target.run();
    expect(b.titles()).toEqual(['Desde A','Desde B']);
  });

  it('keeps local data when a key is wrong or a transport file is modified', () => {
    const {root, folder} = setup();
    const a = device(root), b = device(root);
    a.note('Segura');
    const origin = a.create(), target = b.create();
    origin.link(folder);
    expect(() => target.link(folder,'f'.repeat(64))).toThrow(/no se encontró/i);
    expect(target.status().linked).toBe(false);
    target.link(folder,origin.code());
    const path = manifestFiles(folder).find(file => readFileSync(file).length > 500)!;
    const bytes = readFileSync(path);
    bytes[bytes.length - 1] ^= 0xff;
    writeFileSync(path,bytes);
    expect(target.run().error).toBeTruthy();
    expect(b.titles()).toEqual(['Segura']);
  });

  it('opens a replicated KDBX with the master password and keeps simultaneous edits at the same second', async () => {
    const {root, folder} = setup();
    const a = device(root), b = device(root);
    const syncA = a.create(), syncB = b.create();
    syncA.link(folder);
    syncB.link(folder,syncA.code());
    syncA.configureVault(true);
    syncB.configureVault(true);
    const vault = (profile:string, replication:ProfileSync) => new PasswordVault(join(profile,'passwords.kdbx'),
      undefined,undefined,{
        active:() => replication.vaultActive(),
        hasCopies:() => replication.hasVaultCopies(),
        copies:() => replication.vaultCopies(),
        adopted:bytes => replication.adoptedVault(bytes),
        publish:() => replication.syncVault(),
        report:error => replication.vaultReport(error),
      });
    const first = vault(a.profile,syncA), second = vault(b.profile,syncB);
    const master = 'maestra-de-prueba';
    await first.create(master,master);
    await first.change({type:'project',name:'Proyecto de prueba'});
    let snapshot = first.snapshot();
    if (snapshot.locked || !snapshot.projects) throw Error('Se esperaba la bóveda abierta.');
    const project = snapshot.projects[0].id;
    await first.change({type:'account',project,service:'Cuenta de prueba',user:'usuario',password:'original-ficticia'});
    snapshot = first.snapshot();
    if (snapshot.locked || !snapshot.projects) throw Error('Se esperaba la bóveda abierta.');
    const id = snapshot.projects[0].accounts[0].id;
    expect(second.snapshot()).toMatchObject({exists:true,locked:true});
    await expect(second.unlock('maestra-incorrecta')).rejects.toThrow();
    await second.unlock(master);

    vi.useFakeTimers({toFake:['Date']});
    vi.setSystemTime(new Date('2026-11-22T15:00:00Z'));
    await first.change({type:'account',id,project,service:'Cuenta de prueba',user:'usuario',password:'edicion-A-ficticia'});
    await second.change({type:'account',id,project,service:'Cuenta de prueba',user:'usuario',password:'edicion-B-ficticia'});
    first.lock(); second.lock();
    await first.unlock(master);
    await second.unlock(master);
    expect(first.secret(project,id,'password')).toEqual(second.secret(project,id,'password'));
    for (const profile of [a.profile,b.profile]) {
      const bytes = new Uint8Array(readFileSync(join(profile,'passwords.kdbx')));
      const db = await Kdbx.load(bytes.buffer,new Credentials(ProtectedValue.fromString(master)));
      const entry = db.getDefaultGroup().groups[0].entries[0];
      const variants = [entry,...entry.history].map(item => (item.fields.get('Password') as ProtectedValue).getText());
      expect(variants).toEqual(expect.arrayContaining(['edicion-A-ficticia','edicion-B-ficticia']));
    }
    expect(manifestFiles(folder).filter(path => path.endsWith('.vault.zensync'))).toHaveLength(2);
    for (const path of manifestFiles(folder)) expect(readFileSync(path).includes(Buffer.from('edicion-'))).toBe(false);
  }, 20_000);
});
