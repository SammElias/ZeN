import * as ResEdit from 'resedit';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';

// Only edit our intermediate Electron copy, never the installed runtime.
export async function applyWindowsIcon(executable){
  const target=resolve(executable),root=resolve('release');
  if(!target.startsWith(root+sep)||!target.endsWith(sep+'ZEN.exe'))throw Error('Icono: destino fuera del paquete ZEN.');
  const exe=ResEdit.NtExecutable.from(await readFile(target),{ignoreCert:true});
  const resources=ResEdit.NtExecutableResource.from(exe);
  const icon=ResEdit.Data.IconFile.from(await readFile('public/icons/zen.ico'));
  const groups=ResEdit.Resource.IconGroupEntry.fromEntries(resources.entries);
  for(const group of groups.length?groups:[{id:1,lang:1033}]){
    ResEdit.Resource.IconGroupEntry.replaceIconsForResource(resources.entries,group.id,group.lang,icon.icons.map(item=>item.data));
  }
  for(const version of ResEdit.Resource.VersionInfo.fromEntries(resources.entries)){
    version.setStringValues({lang:1033,codepage:1200},{FileDescription:'ZEN',ProductName:'ZEN',InternalName:'ZEN',OriginalFilename:'ZEN.exe'});
    version.outputToResourceEntries(resources.entries);
  }
  resources.outputResource(exe);
  await writeFile(target,Buffer.from(exe.generate()));
}
