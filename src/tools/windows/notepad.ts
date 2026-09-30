import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import type { Evidence } from '../../shared/contracts';
import { ZenError } from '../../shared/errors';
const EvidenceSchema = z.object({ application: z.literal('notepad'), pid: z.number().int().positive(), windowHandle: z.string().regex(/^[1-9][0-9]*$/), alreadyOpen: z.boolean(), verifiedAt: z.string() }).strict();
export function openNotepad(scriptPath: string, signal: AbortSignal): Promise<Evidence> {
  if (process.platform !== 'win32') throw new ZenError('Esta herramienta requiere Windows.');
  signal.throwIfAborted();
  // Fixed application-owned script, encoded only for reliable Unicode transport.
  // No model/user code is accepted and no Windows execution policy is changed.
  const encoded = Buffer.from(readFileSync(scriptPath, 'utf8'), 'utf16le').toString('base64');
  return new Promise((resolve, reject) => {
    execFile(join(process.env.WINDIR ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
      ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], { signal, timeout: 18000, windowsHide: true, maxBuffer: 65536 },
      (error, stdout) => {
        if (error) return reject(signal.aborted ? signal.reason : new ZenError('No se pudo verificar una ventana de Bloc de notas. Puede haberse abierto; comprueba el escritorio antes de repetir.'));
        try { resolve(EvidenceSchema.parse(JSON.parse(stdout.trim()))); }
        catch { reject(new ZenError('El ejecutor no devolvió evidencia válida de una ventana.')); }
      });
  });
}
