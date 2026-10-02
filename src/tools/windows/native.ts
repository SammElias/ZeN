import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { z } from 'zod';
import { ZenError } from '../../shared/errors';
export const BoundsSchema=z.object({x:z.number().int(),y:z.number().int(),width:z.number().int().positive(),height:z.number().int().positive()});
export const WindowSchema = z.object({ id: z.string().regex(/^\d+$/), title: z.string(), pid: z.number().int(), foreground: z.boolean(), processName:z.string().optional(), bounds:BoundsSchema.optional(),monitorBounds:BoundsSchema.optional() });
export const MediaSchema = z.object({ id: z.string(), title: z.string().default(''), state: z.string(), canPause: z.boolean() });
export type WindowInfo = z.infer<typeof WindowSchema>;
export type MediaInfo = z.infer<typeof MediaSchema>;
export async function native<T>(directory: string, command: 'windows' | 'read' | 'capture' | 'capture-screen' | 'media' | 'pause' | 'apps' | 'open-app' | 'computer-frame' | 'computer-action', schema: z.ZodType<T>, id?: string, signal?: AbortSignal, options?:Record<string,unknown>): Promise<T> {
  signal?.throwIfAborted();
  // Finish an already dispatched, bounded input transaction so key-up events
  // cannot be lost to process termination. No subsequent action survives Stop.
  const child = spawn(join(directory, 'Zen.Windows.exe'), [], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], signal:command==='computer-action'?undefined:signal });
  child.stdin.end(JSON.stringify({ command, id,...options }) + '\n');
  child.stdin.on('error', () => {});
  let output = ''; const timer = setTimeout(() => child.kill(), 15000);
  try {
    const result = await new Promise<string>((resolve, reject) => {
      child.on('error', () => reject(new ZenError('No se pudo iniciar el auxiliar Windows. Ejecuta npm run build:native.')));
      child.stdout.on('data', chunk => { output += chunk; if (output.length > 12_000_000) child.kill(); });
      child.on('exit', code => {
        if (code === 0) return resolve(output);
        let detail = ''; try { const error = JSON.parse(output); if (/^[A-Za-z0-9]+Exception$/.test(error.code)) detail = ` (${error.code}, ${Number(error.hresult)}, ${/^[a-z-]+$/.test(error.stage) ? error.stage : 'operation'}, Win32 ${Number(error.nativeCode??0)})`; } catch {}
        reject(new ZenError('Operación Windows no verificada. Revisa permisos, selección y escritorio desbloqueado.' + detail));
      });
    });
    const parsed = z.object({ ok: z.literal(true), value: schema }).safeParse(JSON.parse(result));
    if (!parsed.success) throw new ZenError('El auxiliar devolvió evidencia inválida.');
    return parsed.data.value;
  } finally { clearTimeout(timer); }
}
