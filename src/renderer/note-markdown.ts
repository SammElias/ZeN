/** Give plain headings and bullet symbols Markdown structure without rewriting the note. */
export function formatNoteMarkdown(text: string) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const result: string[] = [];
  let fence: string | undefined;

  for (const [index, line] of lines.entries()) {
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence) {
      result.push(line);
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) {
        fence = undefined;
      }
      continue;
    }
    if (marker) {
      fence = marker[1];
      result.push(line);
      continue;
    }

    const heading = /^([\p{Lu}¿][\p{L}\p{M}\p{N} ()¿?&/–-]{1,62}):\s*$/u.exec(line);
    if (heading && lines.slice(index + 1).some(value => value.trim())) {
      if (result.length && result.at(-1)?.trim()) result.push('');
      result.push(`## ${heading[1]}`);
      if (lines[index + 1]?.trim()) result.push('');
      continue;
    }
    result.push(line.replace(/^( {0,3})[•●▪◦‣]\s+/, '$1- '));
  }

  return result.join('\n');
}
