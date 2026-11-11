import { commandClauses, humanCommand } from './human-command';

// Authority is the direct user turn, never the model's chosen arguments.
export function requestsNotepad(text: string): boolean {
  const normalized = humanCommand(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  return /^(?:por favor[, ]+)?(?:zen[, ]+)?(?:abre|abrir|inicia|iniciar|lanza|lanzar|open)(?:me)?\s+(?:el\s+)?(?:bloc de notas|notepad)(?:\s+por favor)?[.!?]*$/.test(normalized);
}

export type PauseOperation = { kind: 'pause-media'; source?: string };
export type DirectOperation = { kind: 'page'; target: string } | { kind: 'file'; target?: string } | { kind: 'app'; target: string } | PauseOperation;
export function directOperation(text: string): DirectOperation | undefined {
  const value = humanCommand(text);
  if (commandClauses(text).length !== 1 || /["«»“”]/.test(value)) return;
  const pause = /^(?:p[aá]usa(?:me)?|pausar(?:me)?|para|det[eé]n)\s+(?:(?:la\s+(?:pel[ií]cula|m[uú]sica|canci[oó]n|reproducci[oó]n)|el\s+(?:reproductor|v[ií]deo|audio))(?:\s+(?:de|en)\s+(youtube|spotify|chrome|edge|vlc))?|(youtube|spotify|chrome|edge|vlc))[.!?]*$/i.exec(value);
  if (pause) { const source = (pause[1] ?? pause[2])?.toLowerCase(); return source ? { kind: 'pause-media', source } : { kind: 'pause-media' }; }
  const match = /^(?:abre(?:me)?|[aá]breme|abrir(?:me)?|inicia|iniciar|open)\s+(.+?)\s*[!]?$/i.exec(value);
  if (!match) return;
  const target = match[1];
  if (/^https?:\/\/\S+$/i.test(target)) return { kind: 'page', target };
  const site = /^(?:el )?(linkedin|google|youtube)[.!?]*$/i.exec(target);
  if (site) return { kind: 'page', target: `https://www.${site[1].toLowerCase()}.com/` };
  if (/^(?:este|el|un) archivo[.]?$/i.test(target)) return { kind: 'file' };
  if (/^[a-z]:\\[^\r\n]+$/i.test(target)) return { kind: 'file', target };
  if (/^(?:el )?(?:bloc de notas|notepad)[.]?$/i.test(target)) return; // existing permission and evidence path
  if (/^[\p{L}\p{N} ._-]{1,100}$/u.test(target)) return { kind: 'app', target: target.replace(/^el /i, '') };
}
