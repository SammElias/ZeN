import {mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {CompanionAppearance} from '../src/main/companion-appearance';
import {readBackup, restoreBackup, snapshotBackup, writeBackup} from '../src/main/companion-backup';
import {CompanionLauncher} from '../src/main/companion-launcher';
import {KnowledgeHub} from '../src/main/knowledge-hub';
import {CompanionSettingsSchema} from '../src/shared/codex-companion';
import {newFields} from '../src/shared/knowledge-hub';

function profile(root:string) {
  const appearance=new CompanionAppearance(root,bytes=>bytes);
  const launcher=new CompanionLauncher(join(root,'companion-launcher.json'));
  const notes=new KnowledgeHub(join(root,'knowledge-hub.sqlite'),join(root,'companion-notes.json'));
  const settings=CompanionSettingsSchema.parse({paused:true,presentation:true,silencedUntil:123});
  return {appearance,launcher,notes,settings};
}

describe('portable ZEN backup',()=>{
  it('moves library, draft and wallpaper to another profile and keeps a recoverable previous copy',()=>{
    const sourceRoot=mkdtempSync(join(tmpdir(),'zen-backup-origin-'));
    const targetRoot=mkdtempSync(join(tmpdir(),'zen-backup-target-'));
    try {
      const source=profile(sourceRoot), target=profile(targetRoot);
      const png=readFileSync('public/icons/zen-16.png');
      const wallpaper=join(sourceRoot,'wallpaper.png');
      writeFileSync(wallpaper,png);
      source.appearance.import(wallpaper);
      source.notes.change({type:'save',fields:{...newFields('prompt'),title:'Mi prompt',code:'Contenido de prueba'}},()=>{});
      source.notes.draft({fields:{...newFields('note'),title:'Borrador'}});
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
});
