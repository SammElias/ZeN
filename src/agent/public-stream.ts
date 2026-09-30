// Read only the root `result` string from the approved structured response.
// Never match a nested key or stream the surrounding JSON/reasoning fields.
function stringAt(source: string, start: number) {
  if (source[start] !== '"') return;
  const decode = (end: number, complete: boolean) => {
    try { return { value: JSON.parse(source.slice(start, end) + (complete ? '' : '"')) as string, end, complete }; } catch { return undefined; }
  };
  for (let index = start + 1; index < source.length; index++) {
    if (source[index] === '"') return decode(index + 1, true);
    if (source[index] !== '\\') continue;
    if (index + 1 === source.length) return decode(index, false);
    if (source[index + 1] === 'u') {
      if (index + 6 > source.length) return decode(index, false);
      if (!/^[a-f\d]{4}$/i.test(source.slice(index + 2, index + 6))) return;
      index += 5;
    } else { if (!/["\\/bfnrt]/.test(source[index + 1])) return; index++; }
  }
  return decode(source.length, false);
}

function valueEnd(source: string, start: number): number | undefined {
  if (source[start] === '"') { const string = stringAt(source, start); return string?.complete ? string.end : undefined; }
  if (source[start] === '{' || source[start] === '[') {
    const stack: string[] = [];
    for (let index = start; index < source.length; index++) {
      const char = source[index];
      if (char === '"') { const string = stringAt(source, index); if (!string?.complete) return; index = string.end - 1; }
      else if (char === '{' || char === '[') stack.push(char);
      else if (char === '}' || char === ']') { if (stack.pop() !== (char === '}' ? '{' : '[')) return; if (!stack.length) { try { JSON.parse(source.slice(start, index + 1)); return index + 1; } catch { return; } } }
    }
    return;
  }
  const match = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)(?=\s*[,}])/.exec(source.slice(start));
  return match ? start + match[0].length : undefined;
}

export function publicResultPreview(raw: string): string | undefined {
  const source = raw.replace(/^\s*```(?:json)?\s*/, '').trimStart();
  if (source[0] !== '{') return;
  let index = 1;
  const whitespace = () => { while (/\s/.test(source[index] ?? '') && index < source.length) index++; };
  while (index < source.length) {
    whitespace(); const key = stringAt(source, index); if (!key?.complete) return;
    index = key.end; whitespace(); if (source[index++] !== ':') return; whitespace();
    if (key.value === 'result') return source[index] === '"' ? stringAt(source, index)?.value : undefined;
    const end = valueEnd(source, index); if (end === undefined) return; index = end; whitespace();
    if (source[index++] !== ',') return;
  }
}
