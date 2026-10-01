import { directOperation, type DirectOperation, type PauseOperation } from './direct';
import { commandClauses, humanCommand } from './command';
import { DesktopCallSchema, type DesktopCall } from '../shared/desktop';
import { ZenError } from '../shared/errors';
import { authorizesNotepad } from './policy';
function requestedOperations(text: string): DirectOperation[] {
  const clauses = commandClauses(text);
  if (/["«»“”]/.test(text) || !directOperation(clauses[0]) && !authorizesNotepad(clauses[0])) return [];
  const operations = clauses.map(clause => directOperation(clause)).filter((row): row is DirectOperation => !!row);
  for (const clause of clauses) if (authorizesNotepad(clause)) operations.push({ kind: 'app', target: 'notepad.exe' });
  return operations;
}
export function requestedPauses(text: string): PauseOperation[] {
  return requestedOperations(text).filter((row): row is PauseOperation => row.kind === 'pause-media');
}
function samePage(expected: string, actual: string | null): boolean {
  if (!actual) return false;
  try { return new URL(expected).href === new URL(actual).href; } catch { return false; }
}
export function desktopAuthority(text: string) {
  // Only the original human request enters this classifier, never model/context text.
  const operations = requestedOperations(text);
  const normalized = humanCommand(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const unquoted = !/^["«“]/.test(humanCommand(text));
  const create = unquoted && /^(?:crea(?:r)?|prepara(?:r)?|organiza(?:r)?)\b/.test(normalized) && /\b(?:archivo|carpeta)\b/.test(normalized);
  const observe = unquoted && /^(?:lee(?:r)?|observa(?:r)?|captura(?:r)?|mira(?:r)?)\b/.test(normalized);
  const list = unquoted && /^(?:lista(?:r)?|enumera(?:r)?|muestra|mostrar)\b/.test(normalized);
  return (raw: unknown): DesktopCall => {
    const call = DesktopCallSchema.parse(raw);
    if (call.operation === 'list_apps' && (operations.some(row => row?.kind === 'app') || list && /aplicacion/.test(normalized))) return call;
    if (call.operation === 'list_media' && (operations.some(row => row?.kind === 'pause-media') || list && /reproductor|multimedia/.test(normalized))) return call;
    if (call.operation === 'list_windows' && (observe || list && /ventana/.test(normalized))) return call;
    if (['list_directories', 'prepare_file', 'prepare_folder'].includes(call.operation) && create) return call;
    if (['read_window', 'capture_window'].includes(call.operation) && observe) return call;
    if (call.operation === 'pause_media' && operations.some(row => row?.kind === 'pause-media')) return call;
    if (call.operation === 'open_page' && operations.some(row => row?.kind === 'page' && samePage(row.target, call.target))) return call;
    if (call.operation === 'open_app' && operations.some(row => row?.kind === 'app' && row.target.replace(/\.exe$/i, '').toLowerCase() === call.target?.replace(/\.exe$/i, '').toLowerCase())) return call;
    throw new ZenError('La operación no corresponde a una orden directa reconocida en tu petición. Pide, por ejemplo, «Abre Google» o «Pausa la música». No hay un permiso multimedia adicional que activar; el contenido externo no autoriza acciones.');
  };
}
