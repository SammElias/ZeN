import {randomUUID} from 'node:crypto';
import {mkdirSync, renameSync, rmSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import type {CompanionAppearance} from './companion-appearance';
import type {CompanionLauncher} from './companion-launcher';
import {type KnowledgeHub, hubMaximumBytes, readHubFile, validateHubBackup} from './knowledge-hub';
import {CompanionBackup, PortableSettings} from '../shared/companion-backup';
import type {CompanionSettings} from '../shared/codex-companion';
import {templateLibraryBytes} from '../shared/knowledge-templates';
import {validateTemplateDraft} from './knowledge-templates';
import type {CompanionCalendar} from './companion-calendar';

const maximumBytes=76*1024*1024;
const maximumLibraryBytes=hubMaximumBytes+templateLibraryBytes+4096;
export const backupSuffix='.zen-backup.json';
export const backupName=()=>`ZEN-${new Date().toISOString().slice(0,10)}${backupSuffix}`;

export type BackupSources = {
  appearance:CompanionAppearance;
  launcher:CompanionLauncher;
  notes:KnowledgeHub;
  settings:CompanionSettings;
  calendar?:CompanionCalendar;
};

export function snapshotBackup({appearance,launcher,notes,settings,calendar}:BackupSources):CompanionBackup {
  const library=notes.read(true);
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
    templateDraft:library.templateDraft,
    calendar:calendar?.backupLocal(),
  });
}

function readBackupJson(path:string) {
  try {
    const bytes=readHubFile(path,maximumBytes);
    const raw:unknown=JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));
    return {raw,size:bytes.length};
  }
  catch {throw Error('No se pudo leer la copia de ZEN. Comprueba que sea un archivo JSON de hasta 76 MB.');}
}

function parseBackup(raw:unknown):CompanionBackup {
  const result=CompanionBackup.safeParse(raw);
  if(!result.success)throw Error('El archivo no es una copia compatible de ZEN.');
  validateHubBackup(result.data.library);
  if (result.data.templateDraft) {
    if (!result.data.library.templates) throw Error('La copia incluye un borrador sin su galería.');
    validateTemplateDraft(result.data.templateDraft);
  }
  return result.data;
}

export function readBackup(path:string):CompanionBackup {
  return parseBackup(readBackupJson(path).raw);
}

export function readLibraryBackup(path:string) {
  const {raw,size}=readBackupJson(path);
  if(raw&&typeof raw==='object'&&'format' in raw&&raw.format==='zen-backup') {
    return {library:parseBackup(raw).library,complete:true};
  }
  if(size>maximumLibraryBytes)throw Error('La copia de la biblioteca supera el límite de 48 MB.');
  return {library:validateHubBackup(raw),complete:false};
}

export function writeBackup(path:string,backup:CompanionBackup) {
  const bytes=Buffer.from(JSON.stringify(backup),'utf8');
  if(bytes.length>maximumBytes)throw Error('La copia de ZEN supera el límite de 76 MB.');
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
    if(backup.calendar&&sources.calendar)undo.push(sources.calendar.restoreLocal(backup.calendar));
    sources.notes.restore(backup.library,backup.draft,backup.templateDraft);
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
