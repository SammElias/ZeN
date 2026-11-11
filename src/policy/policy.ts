import { z } from 'zod';
import type { Settings } from '../shared/contracts';
import { ZenError } from '../shared/errors';
import { requestsNotepad } from '../shared/direct-operation';
const Arguments = z.object({ application: z.literal('notepad') }).strict();
export function authorize(name: string, args: unknown, directUserText: string, settings: Settings) {
  if (name !== 'open_application') throw new ZenError('Herramienta desconocida: ejecución bloqueada.');
  const parsed = Arguments.safeParse(args);
  if (!parsed.success) throw new ZenError('Argumentos de herramienta inválidos: ejecución bloqueada.');
  if (!settings.allowNotepad) throw new ZenError('Bloc de notas está deshabilitado en los permisos locales.');
  if (!requestsNotepad(directUserText)) throw new ZenError('No hay una petición directa autorizada para abrir Bloc de notas. Usa «Abre el Bloc de notas».');
  return parsed.data;
}
