export type DirectOperation = { kind: 'page'; target: string } | { kind: 'file'; target?: string } | { kind: 'app'; target: string } | { kind: 'pause-media' };
export function directOperation(text: string): DirectOperation | undefined {
  const value = text.trim().replace(/^(?:oye[, ]+)?zen[, ]+/i, '').replace(/\s+por favor[.!]?$/i, '');
  if (/^(?:pausa(?:me)?|p[aá]usa(?:me)?|para) (?:la pel[ií]cula|el reproductor|el v[ií]deo)[.!]?$/i.test(value)) return { kind: 'pause-media' };
  const match = /^(?:abre(?:me)?|[aá]breme|abrir|inicia|open)\s+(.+?)\s*[!]?$/i.exec(value);
  if (!match) return;
  const target = match[1];
  if (/^https?:\/\/\S+$/i.test(target)) return { kind: 'page', target };
  if (/^(?:el )?linkedin[.]?$/i.test(target)) return { kind: 'page', target: 'https://www.linkedin.com/' };
  if (/^(?:este|el|un) archivo[.]?$/i.test(target)) return { kind: 'file' };
  if (/^[a-z]:\\[^\r\n]+$/i.test(target)) return { kind: 'file', target };
  if (/^(?:el )?(?:bloc de notas|notepad)[.]?$/i.test(target)) return; // existing permission and evidence path
  if (/^[\p{L}\p{N} ._-]{1,100}$/u.test(target)) return { kind: 'app', target: target.replace(/^el /i, '') };
}
