import {execFile} from 'node:child_process';
import {existsSync} from 'node:fs';
import {isAbsolute, join} from 'node:path';
import {promisify} from 'node:util';
import {CodexRequest, type CodexRequestReceipt} from '../shared/companion-request';
import {codexEnvironment, findCodex} from './codex-rpc';

const newChat = 'codex://threads/new';
// Electron's Windows shell.openExternal limit applies after percent encoding.
const maxExternalUrlLength = 2081;
const exec = promisify(execFile);
const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const unknownDelivery = 'No se pudo confirmar el envío. Revisa el chat fijado en Codex antes de reintentar.';

async function desktopCodex(): Promise<string> {
  if (process.platform === 'win32') {
    const powershell = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    try {
      const {stdout} = await exec(powershell, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command',
        '(Get-AppxPackage -Name OpenAI.Codex | Select-Object -First 1).InstallLocation'],
        {windowsHide: true, timeout: 5000, maxBuffer: 8192});
      const directory = stdout.trim();
      const binary = join(directory, 'app', 'resources', 'codex.exe');
      if (isAbsolute(directory) && existsSync(binary)) return binary;
    } catch {/* Older standalone installations can still be resolved by the CLI locator. */}
  }
  return findCodex();
}

export async function queueCodexRequest(thread: string, text: string, codexHome: string, verify: () => void | Promise<void>) {
  if (!uuid.test(thread)) throw Error('El chat fijado no tiene un identificador válido. Revisa el vínculo con Codex.');
  const binary = await desktopCodex();
  const args = ['queue', '--thread', thread, '--message=' + text];
  // Windows counts UTF-16 units, including the escapes used to quote arguments.
  const windowsLength = [binary, ...args].reduce((length, arg) =>
    length + arg.replace(/(\\*)("|$)/g, '$1$1$2').replace(/"/g, '\\"').length + 3, 1);
  if (process.platform === 'win32' && windowsLength > 32767) {
    throw Error('La petición es demasiado larga para enviarla desde Windows. Acorta el texto o adjunta un archivo.');
  }
  await verify();
  try {
    const {stdout} = await exec(binary, args, {
      env: {...codexEnvironment(process.env), CODEX_HOME: codexHome},
      cwd: codexHome, windowsHide: true, timeout: 10000, maxBuffer: 8192,
    });
    const receipt = /^Queued message ([\da-f-]+) for thread ([\da-f-]+)\.$/im.exec(stdout);
    if (receipt && uuid.test(receipt[1]) && receipt[2].toLowerCase() === thread.toLowerCase()) return;
  } catch (error) {
    const stderr = (error as {stderr?: string}).stderr ?? '';
    if (/(?:unexpected argument|unrecognized subcommand) ['`"]queue['`"]/i.test(stderr)) {
      throw Error('Esta instalación de Codex no admite el envío desde ZEN. Puedes copiar la petición al chat fijado.');
    }
  }
  throw Error(unknownDelivery);
}

export async function openCodexRequest(
  input: string,
  deps: {queue?: (text: string) => Promise<void>; copy: (text: string) => void; open: (url: string) => Promise<void>},
): Promise<CodexRequestReceipt> {
  const text = CodexRequest.parse(input);
  if (deps.queue) {
    await deps.queue(text);
    return {mode: 'queued'};
  }
  const draftUrl = `${newChat}?prompt=${encodeURIComponent(text)}`;
  const useClipboard = draftUrl.length > maxExternalUrlLength;
  const url = useClipboard ? newChat : draftUrl;

  if (useClipboard) {
    try { deps.copy(text); }
    catch { throw Error('No se pudo copiar la petición. Puedes volver a intentarlo.'); }
  }
  try { await deps.open(url); }
  catch {
    if (useClipboard) return {mode: 'clipboard', opened: false};
    throw Error('No se pudo abrir Codex. Comprueba que esté instalado y vuelve a intentarlo.');
  }
  return {mode: useClipboard ? 'clipboard' : 'draft', opened: true};
}
