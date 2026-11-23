export type OfficinaReference =
  | {kind: 'web'; url: string}
  | {kind: 'local'; path: string; absolute: boolean; line?: number; column?: number};

const control = /[\x00-\x1f\x7f\uD800-\uDFFF]/u;
const drive = /^[a-z]:[\\/]/i;
const reserved = /^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/iu;

export function officinaReference(raw: string): OfficinaReference | undefined {
  if (raw.length > 2048 || control.test(raw)) return;
  let path = raw.trim();
  if (/^https?:\/\/[^/]/i.test(path)) {
    try {
      const url = new URL(path);
      if (url.hostname && !url.username && !url.password && !path.includes('\\')) return {kind: 'web', url: url.href};
    } catch { /* Invalid URL. */ }
    return;
  }

  const fileUrl = /^file:\/\/(?:localhost)?(?=\/)/i.exec(path);
  if (fileUrl) path = path.slice(fileUrl[0].length);
  const fragment = /#L(\d+)(?:-L\d+)?$/i.exec(path);
  if (fragment) path = path.slice(0, fragment.index);
  try {
    path = decodeURIComponent(path);
  } catch {
    if (fileUrl) return;
    // A native filename can include a literal percent sign.
  }
  path = path.replace(/^\/(?=[a-z]:[\\/])/i, '');
  const absolute = drive.test(path);
  const position = /:(\d+)(?::(\d+))?$/.exec(absolute ? path.slice(2) : path);
  if (position && !absolute && !/[.\\/]/.test(path.slice(0, position.index))) return;
  if (position) path = path.slice(0, position.index + (absolute ? 2 : 0));
  const line = Number(fragment?.[1] ?? position?.[1]) || undefined;
  const column = Number(position?.[2]) || undefined;
  const components = absolute ? path.slice(3) : path;
  if (!path || fileUrl && !absolute || control.test(path) || /^[\\/]/.test(components) ||
    /[:*?"<>|]/.test(components) || components.split(/[\\/]/).some(part =>
      reserved.test(part) || (part !== '.' && part !== '..' && /[. ]$/.test(part))) ||
    line !== undefined && !Number.isSafeInteger(line) || column !== undefined && !Number.isSafeInteger(column)) return;
  return {kind: 'local', path, absolute, line, column};
}
