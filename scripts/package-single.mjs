// Wrap a previously compiled ZEN package as one portable EXE. Nothing is
// published or installed globally; desktop deployment is a separate action.
import {build,Platform,Arch} from 'electron-builder';
import {access,readFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
if(process.platform!=='win32')throw Error('El ejecutable portable requiere Windows.');
const argument=process.argv[2];
if(!argument)throw Error('Indica la carpeta compilada: npm run package:single -- release/ZEN-<version>');
const source=resolve(argument),root=resolve('release');
if(!source.startsWith(root+sep)||source===resolve('release/single-file'))throw Error('La fuente debe ser un paquete compilado dentro de release.');
await access(resolve(source,'ZEN.exe'));
await access(resolve(source,'resources/app/dist/main.cjs'));
const config=JSON.parse(await readFile('config/portable-win.json','utf8'));
const files=await build({targets:Platform.WINDOWS.createTarget(['portable'],Arch.x64),prepackaged:source,config,publish:'never'});
console.log(JSON.stringify({files,source,singleExe:true,fullObjectiveVerified:false}));
