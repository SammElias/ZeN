import {randomUUID} from 'node:crypto';
import {mkdirSync, renameSync, rmSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import type {CompanionAppearance} from './companion-appearance';
import type {CompanionLauncher} from './companion-launcher';
import {type KnowledgeHub, readHubFile, validateHubBackup} from './knowledge-hub';
import {CompanionBackup, PortableSettings} from '../shared/companion-backup';
import type {CompanionSettings} from '../shared/codex-companion';

const maximumBytes=52*1024*1024;
export const backupSuffix='.zen-backup.json';
export const backupName=()=>`ZEN-${new Date().toISOString().slice(0,10)}${backupSuffix}`;

type BackupSources = {
  appearance:CompanionAppearance;
  launcher:CompanionLauncher;
  notes:KnowledgeHub;
  settings:CompanionSettings;
};

export function snapshotBackup({appearance,launcher,notes,settings}:BackupSources):CompanionBackup {
  const library=notes.read();
  const preferences=Object.fromEntries(Object.keys(PortableSettings.shape)
    .map(key=>[key,settings[key as keyof CompanionSettings]]));
  return CompanionBackup.parse({
    format:'zen-backup',
    version:1,
    settings:preferences,
    appearance:appearance.backup(),
    order:launcher.status().order,
    library:library.data,
    draft:library.draft,
  });
}

export function readBackup(path:string):CompanionBackup {
  let raw:unknown;
  try {raw=JSON.parse(readHubFile(path,maximumBytes).toString('utf8').replace(/^\uFEFF/,''));}
  catch {throw Error('No se pudo leer la copia de ZEN. Comprueba que sea un archivo JSON de hasta 52 MB.');}
  const result=CompanionBackup.safeParse(raw);
  if(!result.success)throw Error('El archivo no es una copia compatible de ZEN.');
  validateHubBackup(result.data.library);
  return result.data;
}

export function writeBackup(path:string,backup:CompanionBackup) {
  const bytes=Buffer.from(JSON.stringify(backup),'utf8');
  if(bytes.length>maximumBytes)throw Error('La copia de ZEN supera el límite de 52 MB.');
  const temporary=path+'.'+randomUUID()+'.tmp';
  try {
    writeFileSync(temporary,bytes,{flag:'wx'});
    renameSync(temporary,path);
  }catch {
    throw Error('No se pudo guardar la copia de ZEN.');
  }finally {
    rmSync(temporary,{force:true});
  }
}

export function restoreBackup(
  profile:string,sources:BackupSources,backup:CompanionBackup,saveSettings:(value:CompanionSettings)=>unknown,
) {
  const previous=snapshotBackup(sources);
  const folder=join(profile,'backups');
  const recoveryName='ZEN-anterior-'+randomUUID()+backupSuffix;
  mkdirSync(folder,{recursive:true});
  writeBackup(join(folder,recoveryName),previous);

  const undo:(()=>unknown)[]=[];
  try {
    undo.push(sources.appearance.restoreBackup(backup.appearance));
    sources.launcher.reorder(backup.order);
    undo.push(()=>sources.launcher.reorder(previous.order));
    saveSettings({...sources.settings,...backup.settings});
    undo.push(()=>saveSettings(sources.settings));
    sources.notes.restore(backup.library,backup.draft);
  }catch(error) {
    const recovery=join('backups',recoveryName);
    let restored=true;
    for(const step of undo.reverse()){
      try {step();}catch{restored=false;}
    }
    const message=restored?'Se conservaron los datos anteriores.':'La reversión quedó incompleta.';
    const reason=error instanceof Error && /^(Usa atajos|El atajo|No se pudo registrar|La imagen|No se pudo preparar|El respaldo)/.test(error.message)
      ? error.message+' ' : '';
    throw Error(reason+message+' Copia anterior en '+recovery+'.');
  }
  return recoveryName;
}
