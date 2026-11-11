// Local selection avoids paying a model to summarize data before the actual task.
export function compactContext(source: string, request: string, maxChars = 4000): string {
  const normalized = source.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  if (normalized.length <= maxChars) return normalized;
  const words = [...new Set(request.toLocaleLowerCase('es').match(/[\p{L}\p{N}_]{4,}/gu) ?? [])];
  const chunks: string[] = normalized.match(/[\s\S]{1,650}(?:\n|$)/g) ?? [];
  if (!chunks.length || chunks.join('').length < normalized.length) {
    chunks.length = 0; for (let offset = 0; offset < normalized.length; offset += 600) chunks.push(normalized.slice(offset, offset + 600));
  }
  const ranked = chunks.map((text, index) => ({ text, index, score: words.reduce((score, word) => score + (text.toLocaleLowerCase('es').includes(word) ? 1 : 0), 0) }));
  ranked.sort((a, b) => b.score - a.score || a.index - b.index);
  const selected: typeof ranked = []; let length = 0;
  for (const item of ranked) { if (length + item.text.length > maxChars - 130) continue; selected.push(item); length += item.text.length; }
  selected.sort((a, b) => a.index - b.index);
  return `${selected.map(item => item.text.trim()).join('\n[…]\n').slice(0, maxChars - 90)}\n[Contexto reducido localmente; partes omitidas. No equivale al documento completo.]`.slice(0, maxChars);
}
