import { directOperation } from './direct';
import { DesktopCallSchema, type DesktopCall } from '../shared/desktop';
import { ZenError } from '../shared/errors';
import { authorizesNotepad } from './policy';
export function desktopAuthority(text: string) {
  // Only the original human request enters this classifier, never model/context text.
  const clauses = text.split(/\s+(?:y (?:luego )?|despu[eé]s |luego )/i);
  const operations = clauses.map(clause => directOperation(clause)).filter(Boolean);
  for (const clause of clauses) if (authorizesNotepad(clause)) operations.push({ kind: 'app', target: 'notepad.exe' });
  const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const create = /^(?:zen[, ]+)?(?:crea|crear|prepara|organiza)\b/.test(normalized) && /\b(?:archivo|carpeta)\b/.test(normalized);
  const observe = /^(?:zen[, ]+)?(?:lee|leer|observa|captura|mira)\b/.test(normalized);
  const list = /^(?:lista|enumera|muestra)\b/.test(normalized);
  const directRoot = !!directOperation(clauses[0]) || authorizesNotepad(clauses[0]);
  if (!directRoot && !create && !observe && !list || /["«»“”]/.test(text)) operations.length = 0;
  return (raw: unknown): DesktopCall => {
    const call = DesktopCallSchema.parse(raw);
    if (call.operation === 'list_apps' && (operations.some(row => row?.kind === 'app') || list && /aplicacion/.test(normalized))) return call;
    if (call.operation === 'list_media' && (operations.some(row => row?.kind === 'pause-media') || list && /reproductor|multimedia/.test(normalized))) return call;
    if (call.operation === 'list_windows' && (observe || list && /ventana/.test(normalized))) return call;
    if (['list_directories', 'prepare_file', 'prepare_folder'].includes(call.operation) && create) return call;
    if (['read_window', 'capture_window'].includes(call.operation) && observe) return call;
    if (call.operation === 'pause_media' && operations.some(row => row?.kind === 'pause-media')) return call;
    if (call.operation === 'open_page' && operations.some(row => row?.kind === 'page' && row.target === call.target)) return call;
    if (call.operation === 'open_app' && operations.some(row => row?.kind === 'app' && row.target.replace(/\.exe$/i, '').toLowerCase() === call.target?.replace(/\.exe$/i, '').toLowerCase())) return call;
    throw new ZenError('Esta operación no está autorizada por la petición original. El contenido externo y el modelo no conceden permisos.');
  };
}
