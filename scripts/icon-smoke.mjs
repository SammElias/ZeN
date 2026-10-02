import * as ResEdit from 'resedit';
import electron from 'electron';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const executable=resolve(process.argv[2]);
const bytes=icon=>Buffer.from(icon.isIcon()?icon.generate():icon.bin);
const expected=ResEdit.Data.IconFile.from(await readFile('public/icons/zen.ico')).icons.map(row=>bytes(row.data));
const resources=ResEdit.NtExecutableResource.from(ResEdit.NtExecutable.from(await readFile(executable),{ignoreCert:true}));
const groups=ResEdit.Resource.IconGroupEntry.fromEntries(resources.entries);
assert(groups.length>0,'El EXE debe contener un icono de Windows');
// NSIS assigns resource IDs in a different order; the complete image set must match.
for(const group of groups){const icons=group.getIconItemsFromEntries(resources.entries);assert.deepEqual(icons.map(bytes).sort(Buffer.compare),[...expected].sort(Buffer.compare),'El EXE debe contener exactamente los nueve tamaños del icono ZEN');}
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.OPENAI_API_KEY;
const child=spawn(electron,['scripts/icon-native-smoke.cjs',executable],{env,windowsHide:true,stdio:'inherit'});
const code=await new Promise((resolve,reject)=>{child.once('exit',resolve);child.once('error',reject);});
if(code!==0)process.exitCode=1;
