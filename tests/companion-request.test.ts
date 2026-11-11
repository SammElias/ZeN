import {describe, expect, it, vi} from 'vitest';
import {openCodexRequest} from '../src/main/companion-request';

const request = 'Revisa mi correo 📬\nIncluye lo urgente & path=C:\\prueba #hoy.';

describe('Codex request from Home', () => {
  it('prefills only the composer in a new chat when no chat is pinned', async () => {
    const copy = vi.fn();
    const open = vi.fn(async (_url: string) => {});
    expect(await openCodexRequest(request, {copy, open})).toEqual({mode: 'draft', opened: true});
    const url = new URL(open.mock.calls[0][0]);
    expect(`${url.protocol}//${url.host}${url.pathname}`).toBe('codex://threads/new');
    expect([...url.searchParams.entries()]).toEqual([['prompt', request]]);
    expect(copy).not.toHaveBeenCalled();
  });

  it('queues the exact text once without switching windows or overwriting the clipboard', async () => {
    const copy = vi.fn();
    const queue = vi.fn(async (_text: string) => {});
    const open = vi.fn(async () => {throw Error('Launch failed');});
    expect(await openCodexRequest(request, {queue, copy, open})).toEqual({mode: 'queued'});
    expect(queue).toHaveBeenCalledExactlyOnceWith(request);
    expect(open).not.toHaveBeenCalled();
    expect(copy).not.toHaveBeenCalled();
  });

  it('keeps an unconfirmed queue attempt separate from the draft and clipboard flows', async () => {
    const copy = vi.fn();
    const queue = vi.fn(async () => {throw Error('Unconfirmed');});
    const open = vi.fn(async () => {});
    await expect(openCodexRequest(request, {queue, copy, open})).rejects.toThrow('Unconfirmed');
    expect(queue).toHaveBeenCalledOnce();
    expect(open).not.toHaveBeenCalled();
    expect(copy).not.toHaveBeenCalled();
  });

  it('copies long encoded text and opens a blank draft within the Windows URL limit', async () => {
    const copy = vi.fn();
    const open = vi.fn(async () => {});
    const longRequest = '📬'.repeat(800);
    expect(await openCodexRequest(longRequest, {copy, open})).toEqual({mode: 'clipboard', opened: true});
    expect(copy).toHaveBeenCalledExactlyOnceWith(longRequest);
    expect(open).toHaveBeenCalledExactlyOnceWith('codex://threads/new');
  });

  it('rejects empty, oversized and malformed text before any effect', async () => {
    const copy = vi.fn();
    const open = vi.fn(async () => {});
    for (const text of ['  \n', 'a'.repeat(8001), 'hola\x00', '\uD800']) {
      await expect(openCodexRequest(text, {copy, open})).rejects.toThrow();
    }
    expect(copy).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });
});
