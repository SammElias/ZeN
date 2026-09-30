import { describe, expect, it } from 'vitest';
import { publicResultPreview } from '../src/agent/public-stream';
describe('public result stream', () => {
  it('reads only the root result after skipping private and narrative fields', () => {
    const raw = '{"reasoning_steps":[{"result":"privado","nested":["\\\"result\\\":\\\"secreto"]}],"actions":["abrir"],"result":"Hola mundo"}';
    const previews = Array.from({ length: raw.length }, (_, length) => publicResultPreview(raw.slice(0, length + 1))).filter(text => text !== undefined);
    expect(previews).toContain('Hola'); expect(previews.at(-1)).toBe('Hola mundo');
    expect(previews.join('')).not.toMatch(/privado|secreto|abrir|reasoning_steps/);
  });
  it('decodes escaped content and waits for complete escape sequences', () => {
    expect(publicResultPreview('{"result":"Hola\\n' + '\\')).toBe('Hola\n');
    expect(publicResultPreview('{"result":"Hola\\n\\"mundo\\"')).toBe('Hola\n"mundo"');
    expect(publicResultPreview('{"result":"\\u00')).toBe('');
    expect(publicResultPreview('{"result":"\\u00f1')).toBe('ñ');
  });
  it.each(['{"reasoning_steps":["result",', '{"result":{"reasoning_steps":["privado"]}}', '{"result":["uno","dos"]}', '{"reasoning_steps":[x],"result":"hola"}', '{"actions":{"result":"privado"}', 'Texto sin contrato'])('does not preview incomplete, nested or collection output %s', raw => expect(publicResultPreview(raw)).toBeUndefined());
});
