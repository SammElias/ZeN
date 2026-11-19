import {mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {CompanionAppearance} from '../src/main/companion-appearance';
import {readBackup, readLibraryBackup, restoreBackup, snapshotBackup, writeBackup} from '../src/main/companion-backup';
import {CompanionLauncher} from '../src/main/companion-launcher';
import {KnowledgeHub} from '../src/main/knowledge-hub';
import {CompanionSettingsSchema} from '../src/shared/codex-companion';
import {libraryFolders,newFields,type HubData} from '../src/shared/knowledge-hub';
import {emptyTemplate} from '../src/shared/knowledge-templates';

// 2 × 2 JPEG fixture, used as both original and thumbnail for the round trip.
const jpeg='/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAACAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD8qqKKKAP/2Q==';

function profile(root:string) {
  const appearance=new CompanionAppearance(root,bytes=>bytes);
  const launcher=new CompanionLauncher(join(root,'companion-launcher.json'));
  const notes=new KnowledgeHub(join(root,'knowledge-hub.sqlite'),join(root,'companion-notes.json'));
  const settings=CompanionSettingsSchema.parse({paused:true,presentation:true,silencedUntil:123});
  return {appearance,launcher,notes,settings};
}

describe('portable ZEN backup',()=>{
  it('keeps empty folders and assigned legacy categories selectable in the right library',()=>{
    const built='77fc2ea1-5952-4d90-88de-0591b99e6123', used='77fc2ea1-5952-4d90-88de-0591b99e6124';
    const empty='77fc2ea1-5952-4d90-88de-0591b99e6125', entry='77fc2ea1-5952-4d90-88de-0591b99e6126';
    const data:HubData={version:2,theme:'light',folders:[
      {id:built,name:'Carpeta vacía',group:'folder'},
      {id:used,name:'Dataverse',group:'technology'},
      {id:empty,name:'RAG',group:'ai'},
    ],entries:[
      {...newFields('note',used),id:entry,title:'Apunte',description:'Texto',createdAt:1,updatedAt:1},
    ]};
    expect(libraryFolders(data,'note').map(folder=>folder.id)).toEqual([built,used]);
    expect(libraryFolders(data,'prompt').map(folder=>folder.id)).toEqual([built]);
    expect(libraryFolders(data,'note',empty).map(folder=>folder.id)).toEqual([built,used,empty]);
  });

  it('starts a fresh library without generating unused folders',()=>{
    const root=mkdtempSync(join(tmpdir(),'zen-empty-hub-'));
    try {expect(profile(root).notes.read().data.folders).toEqual([]);}
    finally {rmSync(root,{recursive:true,force:true});}
  });

  it('moves library, draft and wallpaper to another profile and keeps a recoverable previous copy',()=>{
    const sourceRoot=mkdtempSync(join(tmpdir(),'zen-backup-origin-'));
    const targetRoot=mkdtempSync(join(tmpdir(),'zen-backup-target-'));
    try {
      const source=profile(sourceRoot), target=profile(targetRoot);
      const png=readFileSync('public/icons/zen-16.png');
      const wallpaper=join(sourceRoot,'wallpaper.png');
      writeFileSync(wallpaper,png);
      source.appearance.import(wallpaper);
      const {theme,accent,background,opacity,blur}=source.appearance.status();
      source.appearance.save({theme,accent,background,opacity,blur,neon:{palette:'jade',extension:0,speed:'fast'}});
      expect(new CompanionAppearance(sourceRoot,bytes=>bytes).status().neon).toMatchObject({palette:'jade',extension:0,speed:'fast'});
      source.notes.change({type:'save',fields:{...newFields('prompt'),title:'Mi prompt',code:'Contenido de prueba'}},()=>{});
      source.notes.draft({fields:{...newFields('note'),title:'Borrador'}});
      const image={name:'fixture.jpg',mime:'image/jpeg' as const,original:jpeg,thumbnail:jpeg};
      source.notes.templates({type:'save',draft:{fields:{...emptyTemplate(),name:'Diseño',description:'Una referencia',prompt:'Diseña {{nombre_proyecto}}'},image}});
      source.notes.templates({type:'draft',draft:{fields:{...emptyTemplate(),name:'Otro diseño'},image}});
      source.launcher.reorder(source.launcher.status().order.reverse());
      source.settings.sounds=false;
      writeFileSync(join(sourceRoot,'gmail-oauth.bin'),'NOT_A_PORTABLE_CREDENTIAL');
      writeFileSync(join(sourceRoot,'companion-target.json'),'NOT_A_PORTABLE_TARGET');
      target.notes.change({type:'save',fields:{...newFields('note'),title:'Anterior',description:'Anterior'}},()=>{});

      const path=join(sourceRoot,'transfer.zen-backup.json');
      writeBackup(path,snapshotBackup(source));
      const raw=readFileSync(path,'utf8');
      expect(raw).not.toMatch(/NOT_A_PORTABLE|silencedUntil|presentation|"paused"/);
      const backup=readBackup(path);
      const recovery=restoreBackup(targetRoot,target,backup,value=>{target.settings=value;});
      expect(snapshotBackup(target)).toEqual(backup);
      expect(backup.library.templates).toMatchObject([{name:'Diseño',image}]);
      expect(backup.templateDraft?.image).toEqual(image);
      expect(target.notes.referenceImage(backup.library.templates![0].id,false)?.bytes).toEqual(Buffer.from(jpeg,'base64'));
      expect(target.settings).toMatchObject({paused:true,presentation:true,silencedUntil:123,sounds:false});
      expect(readBackup(join(targetRoot,'backups',recovery)).library.entries.map(entry=>entry.title)).toEqual(['Anterior']);
    }finally {
      rmSync(sourceRoot,{recursive:true,force:true});
      rmSync(targetRoot,{recursive:true,force:true});
    }
  });

  it('restores previous appearance, navigation and library when applying settings fails',()=>{
    const root=mkdtempSync(join(tmpdir(),'zen-backup-rollback-'));
    try {
      const current=profile(root);
      const before=snapshotBackup(current);
      const backup=structuredClone(before);
      backup.appearance.options.theme='dark';
      backup.order.reverse();
      expect(()=>restoreBackup(root,current,backup,()=>{throw Error('El atajo está ocupado.');})).toThrow(/El atajo.*Se conservaron/);
      expect(snapshotBackup(current)).toEqual(before);
      expect(readdirSync(join(root,'backups'))).toHaveLength(1);
    }finally {
      rmSync(root,{recursive:true,force:true});
    }
  });

  it('loads backups from before the candado and always-on-top were separate',()=>{
    const root=mkdtempSync(join(tmpdir(),'zen-backup-window-'));
    try {
      const backup=snapshotBackup(profile(root));
      const {windowLocked,alwaysOnTop,dismissCapsuleOnOutsideClick,hideCapsuleFromTaskbar,...legacy}=backup.settings;
      const path=join(root,'legacy.zen-backup.json');
      writeFileSync(path,JSON.stringify({...backup,settings:{...legacy,keepOnTop:true}}));
      expect(readBackup(path).settings).toMatchObject({
        windowLocked:true,alwaysOnTop:false,dismissCapsuleOnOutsideClick:false,hideCapsuleFromTaskbar:false,
      });
    } finally {
      rmSync(root,{recursive:true,force:true});
    }
  });

  it('reads both backup formats in Apuntes and rejects unsupported full copies',()=>{
    const root=mkdtempSync(join(tmpdir(),'zen-backup-library-'));
    try {
      const source=profile(root);
      source.notes.change({type:'save',fields:{...newFields('note'),title:'Ejemplo',description:'Mi apunte'}},()=>{});
      const backup=snapshotBackup(source);
      const path=join(root,'transfer.json');
      writeBackup(path,backup);
      expect(readLibraryBackup(path)).toEqual({library:backup.library,complete:true});
      writeFileSync(path,'\uFEFF'+JSON.stringify(backup.library));
      expect(readLibraryBackup(path)).toEqual({library:backup.library,complete:false});
      writeFileSync(path,JSON.stringify({...backup,version:2}));
      expect(()=>readLibraryBackup(path)).toThrow('El archivo no es una copia compatible de ZEN.');
    } finally {
      rmSync(root,{recursive:true,force:true});
    }
  });
});
