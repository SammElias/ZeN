import { spawn } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export async function readCompanionSmokeReceipt(profile, pid, executable, launchedAt) {
  const file = join(profile, 'smoke-result.json');
  if ((await stat(file)).mtimeMs < launchedAt) throw Error('El resultado pertenece a una ejecución anterior.');
  const receipt = JSON.parse(await readFile(file, 'utf8'));
  if (receipt.pid !== pid || resolve(receipt.executable) !== resolve(executable)) {
    throw Error('La prueba de Electron pertenece a otro proceso.');
  }
  return receipt.result;
}

export function companionSmokePassed(result) {
  return result?.passed === true && result.companionOnly === true && result.capsuleNoAuthority === true;
}

export async function runCompanionSmoke(executable, { timeout = 65000 } = {}) {
  const sourceMode = !executable;
  const binary = sourceMode ? createRequire(import.meta.url)('electron') : resolve(executable);
  const args = sourceMode ? ['.', '--zen-shell-smoke'] : ['--zen-shell-smoke'];
  const env = { ...process.env };
  delete env.OPENAI_API_KEY;
  delete env.ELECTRON_RUN_AS_NODE;
  const launchedAt = Date.now();
  const child = spawn(binary, args, { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.resume();
  let errors = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', chunk => { errors = (errors + chunk).slice(-4000); });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    child.kill();
  }, timeout);
  let exitCode;
  try {
    exitCode = await new Promise((resolveExit, reject) => {
      child.once('error', reject);
      child.once('exit', resolveExit);
    });
  } finally {
    clearTimeout(timer);
    // Chromium descendants can retain pipes after the main process has exited.
    child.stdout.unref?.();
    child.stderr.unref?.();
  }
  if (timedOut || exitCode !== 0) {
    const message = timedOut ? 'Electron excedió el tiempo de prueba.' : `Electron terminó con código ${exitCode}.`;
    throw Object.assign(Error(`${message} ${errors.trim()}`), { exitCode });
  }
  const profile = join(tmpdir(), `zen-companion-smoke-${child.pid}`);
  const result = await readCompanionSmokeReceipt(profile, child.pid, binary, launchedAt);
  if (!companionSmokePassed(result)) throw Error('El compañero de Codex no pasó la prueba de Electron.');
  return result;
}
