import type {HubEntry} from './knowledge-hub';

export function fileStem(title: string) {
  const stem = title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').replace(/[. ]+$/g, '').slice(0, 90);
  return !stem || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(stem) ? 'apunte-' + (stem || 'zen') : stem;
}

export function entryMarkdown(entry: HubEntry) {
  const title = entry.title.replace(/[\r\n]+/g, ' ');
  const sections = ['# ' + title];
  if (entry.description) sections.push(entry.description);
  if (entry.url) sections.push('<' + new URL(entry.url).href + '>');
  if (entry.code) {
    const length = Math.max(2, ...(entry.code.match(/`+/g) ?? []).map(match => match.length));
    const fence = '`'.repeat(length + 1);
    const language = entry.language.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    sections.push(fence + language + '\n' + entry.code + '\n' + fence);
  }
  for (const [label, value] of [
    ['Explicación', entry.explanation], ['Requisitos', entry.requirements], ['Advertencias', entry.warnings],
    ['Ejemplo', entry.example], ['Modelo o proveedor', entry.model],
  ]) if (value) sections.push('## ' + label + '\n\n' + value);
  if (entry.tags.length) sections.push('Etiquetas: ' + entry.tags.join(', '));
  for (const image of entry.images) sections.push('![' + image.name.replace(/[\[\]\\\r\n]/g, '') + '](' + image.data + ')');
  return sections.join('\n\n') + '\n';
}
