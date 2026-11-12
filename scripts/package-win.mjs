import { cp, mkdir, writeFile, rename, readdir, readFile } from 'node:fs/promises';
import { resolve, join, sep, dirname, extname } from 'node:path';
import { createRequire } from 'node:module';
import { createHash, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { applyWindowsIcon } from './windows-icon.mjs';
import { runCompanionSmoke } from './companion-smoke-runner.mjs';
import helpers from '../config/native-helpers.json' with { type: 'json' };

async function writeEvidence(path, data) {
  const temporary = path + '.' + randomUUID() + '.tmp';
  await writeFile(temporary, data);
  for (let attempt = 0; ; attempt++) {
    try {
      await rename(temporary, path);
      return;
    } catch (error) {
      if (attempt >= 4 || !['EPERM', 'EACCES', 'EBUSY', 'UNKNOWN'].includes(error.code)) throw error;
      await delay(200 * (attempt + 1));
    }
  }
}

async function fileHashes(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    const path = join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...await fileHashes(file, path));
    else files.push({ path, sha256: createHash('sha256').update(await readFile(file)).digest('hex') });
  }
  return files;
}

if (process.platform !== 'win32') throw Error('Este paquete requiere Windows.');
if (process.argv.includes('--interface') || process.argv.includes('--interactions')) {
  throw Error('Los paquetes históricos se generan desde la versión correspondiente.');
}
const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '');
const root = resolve('release');
const destination = join(root, `ZEN-${stamp}`);
if (!destination.startsWith(root + sep)) throw Error('Destino de paquete inválido.');
await mkdir(root, { recursive: true });
await mkdir('docs/evidence', { recursive: true });
const electronDist = dirname(createRequire(import.meta.url)('electron'));
await cp(electronDist, destination, {
  recursive: true, force: false, errorOnExist: true, filter: path => !path.toLowerCase().endsWith('.log'),
});
const executable = join(destination, 'ZEN.exe');
await rename(join(destination, 'electron.exe'), executable);
await applyWindowsIcon(executable);

const appDirectory = join(destination, 'resources/app');
await mkdir(join(appDirectory, 'dist'), { recursive: true });
const paths = ['main.cjs', 'preload.cjs', 'renderer', helpers.hook.output, helpers.desktop.output, helpers.media.output];
for (const path of paths) {
  await cp(join('dist', path), join(appDirectory, 'dist', path), {
    recursive: true, filter: source => extname(source).toLowerCase() !== '.pdb',
  });
}
await writeFile(join(appDirectory, 'package.json'), JSON.stringify({ name: 'zen-desktop', version: '0.1.0', main: 'dist/main.cjs', private: true }, null, 2));
await writeFile(join(destination, 'LEEME.txt'), 'ZEN es un compañero de Codex para Windows con actividad observada, permisos de un uso, avisos, Sonido y Apuntes. Los auxiliares requieren .NET Runtime 10. Para observar actividad, prepara la integración en Preferencias y revisa los hooks con /hooks en el CLI de Codex. Si ZEN está cerrado o no respondes, el permiso vuelve a Codex. Incluye código MIT adaptado de Coucou, iconos de ZEN y tonos propios. Consulta docs/DEPLOYMENT.md en el repositorio de ZEN.');

const files = await fileHashes(appDirectory);
let smoke;
try {
  smoke = await runCompanionSmoke(executable, { timeout: 90000 });
} catch (error) {
  await writeFile('docs/evidence/portable-attempt.json', JSON.stringify({
    at: new Date().toISOString(), passed: false, executable, exitCode: error.exitCode,
  }, null, 2));
  throw error;
}
const report = {
  at: new Date().toISOString(), destination, executable, validationScope: 'codex-companion-native-hook-IPC',
  smoke, files, credentialsIncluded: false, fullObjectivePassed: false,
};
await writeEvidence('docs/evidence/portable-shell.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ executable, passed: true, validationScope: report.validationScope }));
