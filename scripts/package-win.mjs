import { cp, mkdir, writeFile, rename, readdir, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
if (process.platform !== 'win32') throw Error('Este paquete requiere Windows.');
const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '');
const interfaceOnly = process.argv.includes('--interface');
const root = resolve('release'); const destination = join(root, `ZEN-${stamp}`);
if (!destination.startsWith(root + '\\')) throw Error('Destino de paquete inválido.');
await mkdir(destination, { recursive: true });
await cp('node_modules/electron/dist', destination, { recursive: true, force: false, errorOnExist: true });
await rename(join(destination, 'electron.exe'), join(destination, 'ZEN.exe'));
const appDirectory = join(destination, 'resources/app'); await mkdir(join(appDirectory, 'dist'), { recursive: true });
for (const path of ['main.cjs', 'preload.cjs', 'renderer', 'tools', 'native']) await cp(join('dist', path), join(appDirectory, 'dist', path), { recursive: true });
await writeFile(join(appDirectory, 'package.json'), JSON.stringify({ name: 'zen-desktop', version: '0.1.0', main: 'dist/main.cjs', private: true }, null, 2));
await writeFile(join(destination, 'LEEME.txt'), 'ZEN Isla portable para Windows. Conserva esta carpeta completa y ejecuta ZEN.exe; aparece una isla de 640x48 anclada arriba. Haz clic para abrir o usa Ctrl+Alt+Z. Incluye GPT-Live, contexto visual automático y preparación de proyectos con Codex. Preferencias disponibles por separado desde la bandeja de Windows. El auxiliar Windows requiere .NET Desktop Runtime 10. No incluye claves, perfil ni conversaciones; conserva la configuración local existente. Si falta la conexión, configura tu clave desde Preferencias. El objetivo completo y las pruebas físicas de voz/reunión siguen pendientes. Consulta docs/objective-verification.md en el repositorio para funciones y límites.\r\n');
const files = [];
async function inspect(directory, relative = '') { for (const item of await readdir(directory, { withFileTypes: true })) { const path = join(directory, item.name); const name = join(relative, item.name); if (item.isDirectory()) await inspect(path, name); else files.push({ path: name, sha256: createHash('sha256').update(await readFile(path)).digest('hex') }); } }
await inspect(appDirectory);
const env = { ...process.env }; delete env.OPENAI_API_KEY; delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(join(destination, 'ZEN.exe'), [interfaceOnly ? '--zen-smoke' : '--zen-objective-smoke'], { env, windowsHide: true });
let output = ''; let errors = ''; child.stdout.on('data', chunk => output += chunk); child.stderr.on('data', chunk => errors += chunk);
const timer = setTimeout(() => child.kill(), 40000);
const code = await new Promise(resolve => { child.on('error', error => { errors = error.message; resolve(1); }); child.on('exit', resolve); }); clearTimeout(timer);
const line = output.split(/\r?\n/).find(row => row.startsWith('{'));
if (code !== 0 || !line) {
  const diagnostic = errors.split(/\r?\n/).find(row => row.startsWith('Objective assertions failed: '));
  let assertions; try { assertions = JSON.parse(diagnostic.slice('Objective assertions failed: '.length)); } catch {}
  await writeFile('docs/evidence/portable-attempt.json', JSON.stringify({ at: new Date().toISOString(), passed: false, executable: join(destination, 'ZEN.exe'), exitCode: code, assertions }, null, 2));
  throw Error('El paquete no pasó el arranque real: ' + errors.slice(0, 2000));
}
const smoke = JSON.parse(line); if (!smoke.startedCompact || !smoke.preferencesIsolated || !smoke.topAnchorStable || !smoke.positionLocked || !smoke.collapsedHeightVerified || !smoke.latestOnlyExpanded || !smoke.latestTranscriptVerified || !smoke.latestInterruptionVerified || !smoke.unknownArtifactBlocked || !smoke.mcpSecretProtectionVerified || !smoke.libraryRootsLocal || !smoke.localFileWithoutApiVerified || !smoke.widthsVerified || !smoke.invalidDragBlocked || !smoke.horizontalDragVerified || !smoke.dragPositionPersisted || (!interfaceOnly && (!smoke.objective || Object.values(smoke.objective).some(value => value !== true)))) throw Error('Pruebas funcionales del paquete fallidas: ' + JSON.stringify(smoke));
if (!smoke.projectIpcVerified || !smoke.unknownProjectBlocked || !smoke.invalidLiveSessionBlocked || !smoke.bridge || !smoke.nodeAbsent || !smoke.rendered || !smoke.protectedRoundTrip) throw Error('Pruebas de proyectos, voz o aislamiento del paquete fallidas.');
const report = { validationScope: interfaceOnly ? 'interface' : 'full-objective', fullObjectivePassed: !interfaceOnly, at: new Date().toISOString(), destination, executable: join(destination, 'ZEN.exe'), smoke, files, credentialsIncluded: false, selfContainedElectron: true, requiresDotNetDesktop10: true, installer: false, customApplicationSigning: false };
await writeFile(interfaceOnly ? 'docs/evidence/portable-interface.json' : 'docs/evidence/portable-package.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ executable: report.executable, passed: true, validationScope: report.validationScope, fullObjectivePassed: report.fullObjectivePassed, credentialsIncluded: false }));
