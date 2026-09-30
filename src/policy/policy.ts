import { z } from 'zod';
import type { Settings } from '../shared/contracts';
import { ZenError } from '../shared/errors';
const Arguments = z.object({ application: z.literal('notepad') }).strict();
// Authority is the direct user turn, never the model's chosen arguments.
export function authorizesNotepad(text: string): boolean {
  const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  return /^(?:por favor[, ]+)?(?:zen[, ]+)?(?:abre|abrir|inicia|iniciar|lanza|lanzar|open)(?:me)?\s+(?:el\s+)?(?:bloc de notas|notepad)(?:\s+por favor)?[.!?]*$/.test(normalized);
}
export function authorize(name: string, args: unknown, directUserText: string, settings: Settings) {
  if (name !== 'open_application') throw new ZenError('Herramienta desconocida: ejecución bloqueada.');
  const parsed = Arguments.safeParse(args);
  if (!parsed.success) throw new ZenError('Argumentos de herramienta inválidos: ejecución bloqueada.');
  if (!settings.allowNotepad) throw new ZenError('Bloc de notas está deshabilitado en los permisos locales.');
  if (!authorizesNotepad(directUserText)) throw new ZenError('No hay una petición directa autorizada para abrir Bloc de notas. Usa «Abre el Bloc de notas».');
  return parsed.data;
}
