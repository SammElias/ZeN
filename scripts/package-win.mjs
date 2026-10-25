import { cp, mkdir, writeFile, rename, readdir, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import {tmpdir} from 'node:os';
import { spawn } from 'node:child_process';
import { applyWindowsIcon } from './windows-icon.mjs';
async function writeEvidence(path,data){
  const temporary=path+'.'+randomUUID()+'.tmp';
  await writeFile(temporary,data);
  for(let attempt=0;;attempt++){
    try{await rename(temporary,path);return;}
    catch(error){if(attempt>=4||!['EPERM','EACCES','EBUSY','UNKNOWN'].includes(error.code))throw error;await new Promise(r=>setTimeout(r,200*(attempt+1)));}
  }
}
if (process.platform !== 'win32') throw Error('Este paquete requiere Windows.');
const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '');
const interfaceOnly = process.argv.includes('--interface');
const interactionsOnly=process.argv.includes('--interactions');
const shellOnly=process.argv.includes('--shell');
const root = resolve('release'); const destination = join(root, `ZEN-${stamp}`);
if (!destination.startsWith(root + '\\')) throw Error('Destino de paquete inválido.');
await mkdir(root, { recursive: true });
await cp('node_modules/electron/dist', destination, { recursive: true, force: false, errorOnExist: true, filter:path=>!path.toLowerCase().endsWith('.log') });
await rename(join(destination, 'electron.exe'), join(destination, 'ZEN.exe'));
await applyWindowsIcon(join(destination, 'ZEN.exe'));
const appDirectory = join(destination, 'resources/app'); await mkdir(join(appDirectory, 'dist'), { recursive: true });
for (const path of (shellOnly?['main.cjs','preload.cjs','renderer','hook','desktop','media']:['main.cjs', 'preload.cjs', 'renderer', 'tools', 'native'])) await cp(join('dist', path), join(appDirectory, 'dist', path), { recursive: true });
if(!shellOnly){
await mkdir(join(appDirectory,'dist/documents'),{recursive:true});
for(const path of ['worker.mjs','pdf.mjs','pdf.worker.mjs','standard_fonts'])await cp(join('dist/documents',path),join(appDirectory,'dist/documents',path),{recursive:true});
// PDF.js uses its local geometry implementation even for text extraction.
await cp('node_modules/@napi-rs',join(appDirectory,'node_modules/@napi-rs'),{recursive:true});
await cp('node_modules/pdfjs-dist/LICENSE',join(appDirectory,'dist/documents/PDFJS-LICENSE'));
await cp('node_modules/fast-xml-parser/LICENSE',join(appDirectory,'dist/documents/XML-LICENSE'));
}
await writeFile(join(appDirectory, 'package.json'), JSON.stringify({ name: 'zen-desktop', version: '0.1.0', main: 'dist/main.cjs', private: true }, null, 2));
await writeFile(join(destination, 'LEEME.txt'), 'ZEN compañero de Codex. Cápsula ZEN sin personaje, con actividad observada, código, permisos de un uso y avisos. Sin chat, proyectos, capturas, contexto ni llamadas al modelo. Prepara la integración en Preferencias y revisa sus hooks con /hooks en Codex CLI; no se concede confianza automáticamente. Si ZEN está cerrado o no respondes, el permiso vuelve a Codex. Historial previo conservado fuera de la interfaz. Auxiliar requiere .NET Runtime 10. Incluye código MIT adaptado de Coucou; iconos ZEN y tonos propios. Consulta docs/codex-companion-reset.md.');
const files = [];
async function inspect(directory, relative = '') { for (const item of await readdir(directory, { withFileTypes: true })) { const path = join(directory, item.name); const name = join(relative, item.name); if (item.isDirectory()) await inspect(path, name); else files.push({ path: name, sha256: createHash('sha256').update(await readFile(path)).digest('hex') }); } }
await inspect(appDirectory);
const env = { ...process.env }; delete env.OPENAI_API_KEY; delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(join(destination, 'ZEN.exe'), [shellOnly?'--zen-shell-smoke':interactionsOnly?'--zen-interactions-smoke':interfaceOnly ? '--zen-smoke' : '--zen-objective-smoke'], { env, windowsHide: true });
let output = ''; let errors = ''; child.stdout.on('data', chunk => output += chunk); child.stderr.on('data', chunk => errors += chunk);
const timer = setTimeout(() => child.kill(), shellOnly?90000:40000);
const code = await new Promise(resolve => { child.on('error', error => { errors = error.message; resolve(1); }); child.on('exit', resolve); }); clearTimeout(timer);
let line = output.split(/\r?\n/).find(row => row.startsWith('{'));
if(shellOnly&&code===0){try{const proof=JSON.parse(await readFile(join(tmpdir(),'zen-companion-smoke-'+child.pid,'smoke-result.json'),'utf8'));if(proof.pid===child.pid&&resolve(proof.executable)===resolve(destination,'ZEN.exe'))line=JSON.stringify(proof.result);}catch{}}
if (code !== 0 || !line) {
  const diagnostic = errors.split(/\r?\n/).find(row => row.startsWith('Objective assertions failed: '));
  let assertions; try { assertions = JSON.parse(diagnostic.slice('Objective assertions failed: '.length)); } catch {}
  await writeFile('docs/evidence/portable-attempt.json', JSON.stringify({ at: new Date().toISOString(), passed: false, executable: join(destination, 'ZEN.exe'), exitCode: code, assertions }, null, 2));
  throw Error('El paquete no pasó el arranque real: ' + errors.slice(0, 2000));
}
const smoke = JSON.parse(line);
if(shellOnly){
 if(smoke.passed!==true||smoke.companionOnly!==true||smoke.capsuleNoAuthority!==true)throw Error('El paquete no pasó el compañero de Codex.');
 const report={at:new Date().toISOString(),destination,executable:join(destination,'ZEN.exe'),validationScope:'codex-companion-native-hook-IPC',smoke,files,credentialsIncluded:false,fullObjectivePassed:false};
 await writeEvidence('docs/evidence/portable-shell.json',JSON.stringify(report,null,2));console.log(JSON.stringify({executable:report.executable,passed:true,validationScope:report.validationScope}));
}else if(interactionsOnly){
  if(smoke.fullscreenChatVerified!==true||smoke.passed!==true||!smoke.quickNativeWidth||!smoke.chatNativeWidth||!smoke.rendererNodeUnavailable||!smoke.frozenContextAndDedup||!smoke.invalidVisualRejected||!smoke.localGuidePersisted||!smoke.appearanceSaved)throw Error('El paquete no pasó las comprobaciones de interacciones.');
  const report={validationScope:'contextual-interactions-IPC-and-native-bounds',fullObjectivePassed:false,at:new Date().toISOString(),destination,executable:join(destination,'ZEN.exe'),smoke,files,credentialsIncluded:false,selfContainedElectron:true,requiresDotNetDesktop10:true,installer:false,customApplicationSigning:false};
  await writeEvidence('docs/evidence/portable-interactions.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify({executable:report.executable,passed:true,validationScope:report.validationScope,fullObjectivePassed:false,credentialsIncluded:false}));
}else{
if (!smoke.shownOnTop || !smoke.startedCompact || !smoke.preferencesIsolated || !smoke.topAnchorStable || !smoke.positionLocked || !smoke.collapsedHeightVerified || !smoke.latestOnlyExpanded || !smoke.latestTranscriptVerified || !smoke.latestInterruptionVerified || !smoke.unknownArtifactBlocked || !smoke.mcpSecretProtectionVerified || !smoke.libraryRootsLocal || !smoke.localFileWithoutApiVerified || !smoke.widthsVerified || !smoke.invalidDragBlocked || !smoke.horizontalDragVerified || !smoke.dragPositionPersisted || (!interfaceOnly && (!smoke.objective || Object.values(smoke.objective).some(value => value !== true)))) throw Error('Pruebas funcionales del paquete fallidas: ' + JSON.stringify(smoke));
if (!smoke.fullscreenChatVerified || !smoke.dailyWorkspaceVerified || !smoke.homeChatOnlyVerified || !smoke.dropContextIpcVerified || !smoke.workspaceIpcVerified || !smoke.cursorGazeVerified || !smoke.documentReaderVerified || !smoke.activityTimelineVerified || !smoke.computerIpcVerified || !smoke.edgeDockingVerified || !smoke.taskbarReturnVerified || !smoke.backgroundTaskbarVerified || !smoke.miniCapsuleVerified || !smoke.stableStreamingVerified || !smoke.voiceNoticePreserved || !smoke.pasteImageCspVerified || !smoke.singleAttachmentClipVerified || !smoke.folderIpcVerified || !smoke.folderDelegationVerified || !smoke.humanConfirmationVerified || !smoke.imageIpcVerified || !smoke.projectIpcVerified || !smoke.unknownProjectBlocked || !smoke.invalidLiveSessionBlocked || !smoke.bridge || !smoke.nodeAbsent || !smoke.rendered || !smoke.protectedRoundTrip) throw Error('Pruebas de proyectos, voz o aislamiento del paquete fallidas.');
const report = { validationScope: interfaceOnly ? 'interface' : 'full-objective', fullObjectivePassed: !interfaceOnly, at: new Date().toISOString(), destination, executable: join(destination, 'ZEN.exe'), smoke, files, credentialsIncluded: false, selfContainedElectron: true, requiresDotNetDesktop10: true, installer: false, customApplicationSigning: false };
await writeFile(interfaceOnly ? 'docs/evidence/portable-interface.json' : 'docs/evidence/portable-package.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ executable: report.executable, passed: true, validationScope: report.validationScope, fullObjectivePassed: report.fullObjectivePassed, credentialsIncluded: false }));

}
