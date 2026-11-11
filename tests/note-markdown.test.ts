import {expect, it} from 'vitest';
import {formatNoteMarkdown} from '../src/renderer/note-markdown';

it('formats a plain section while preserving its fenced code and existing Markdown', () => {
  const code = '```text\nEtiqueta:\n• Símbolo literal\n```';
  const table = '| A | B |\n| --- | --- |\n| 1 | 2 |';
  const formatted = formatNoteMarkdown(`Pasos:\n• Crear carpeta\n\n${code}\n\n${table}`);
  expect(formatted).toBe(`## Pasos\n\n- Crear carpeta\n\n${code}\n\n${table}`);
  expect(formatNoteMarkdown(formatted)).toBe(formatted);
});
