import {beforeEach, describe, expect, it, vi} from 'vitest';
import {officinaRequestQueued, openCodexRequest, queueCodexContextRequest, queueCodexRequest} from '../src/main/companion-request';

const execute = vi.hoisted(() => vi.fn());
vi.mock('node:child_process', () => ({execFile: execute}));
vi.mock('../src/main/codex-rpc', () => ({findCodex: () => 'codex.exe', codexEnvironment: () => ({})}));

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

describe('Codex desktop queue', () => {
  const thread = '12345678-1234-4234-8234-123456789abc';
  const otherThread = '12345678-1234-4234-8234-123456789def';
  const message = '12345678-1234-4234-8234-123456789123';
  const verify = vi.fn();
  const wake = vi.fn(async (_url: string) => {});
  const receipt = (destination: string) => `Queued message ${message} for thread ${destination}.\r\n`;
  let output: string;
  const submissions = () => execute.mock.calls.filter(([, args]) => args[0] === 'queue');

  beforeEach(() => {
    verify.mockReset();
    wake.mockReset();
    output = receipt(thread);
    execute.mockReset().mockImplementation((_binary, args, _options, callback) => {
      callback(null, {stdout: args[0] === 'queue' ? output : ''});
    });
  });

  it('wakes the exact pinned chat only after a confirmed single submission', async () => {
    await queueCodexRequest(thread, request, 'codex-fixture', verify, wake);
    expect(submissions()).toHaveLength(1);
    expect(submissions()[0][1]).toEqual(['queue', '--thread', thread, `--message=${request}`]);
    expect(verify.mock.invocationCallOrder[0]).toBeLessThan(execute.mock.invocationCallOrder.at(-1)!);
    expect(wake).toHaveBeenCalledExactlyOnceWith(`codex://threads/wake/${thread}`);
    expect(execute).toHaveBeenCalledBefore(wake);
  });

  it('does not wake Codex if delivery is unconfirmed or acknowledged for another chat', async () => {
    for (const mismatched of ['', receipt(otherThread)]) {
      output = mismatched;
      await expect(queueCodexRequest(thread, request, 'codex-fixture', verify, wake)).rejects.toThrow('No se pudo confirmar');
    }
    expect(wake).not.toHaveBeenCalled();
  });

  it('reports a wake failure without submitting the already queued request again', async () => {
    wake.mockRejectedValueOnce(Error('Protocol handler unavailable'));
    await expect(queueCodexRequest(thread, request, 'codex-fixture', verify, wake)).rejects.toThrow('La petición quedó en cola');
    expect(submissions()).toHaveLength(1);
    expect(wake).toHaveBeenCalledOnce();
  });

  it('keeps a revoked request out of the CLI and desktop', async () => {
    verify.mockImplementationOnce(() => {throw Error('Autorización caducada');});
    await expect(queueCodexRequest(thread, request, 'codex-fixture', verify, wake)).rejects.toThrow('Autorización caducada');
    expect(submissions()).toHaveLength(0);
    expect(wake).not.toHaveBeenCalled();
  });

  it('queues caption and local image together and wakes only the confirmed destination', async () => {
    const image = 'C:\\fixture\\captura.jpg';
    const rpc = {request: vi.fn().mockResolvedValue({queuedSubmission: {id: message, clientUserMessageId: message}})};
    await queueCodexContextRequest(rpc, thread, message, request, {images: [image]}, verify, wake);
    expect(rpc.request).toHaveBeenCalledExactlyOnceWith('thread/queue/add', {
      threadId: thread, clientUserMessageId: message,
      input: [{type: 'text', text: request, text_elements: []}, {type: 'localImage', path: image}],
    });
    expect(verify).toHaveBeenCalledBefore(rpc.request);
    expect(rpc.request).toHaveBeenCalledBefore(wake);
    expect(wake).toHaveBeenCalledExactlyOnceWith(`codex://threads/wake/${thread}`);
  });

  it('recognizes a paginated queue entry by its complete Officina identity', async () => {
    const identity = {project: thread, task: otherThread, run: message, role: 'coordinator' as const};
    const entry = (run: typeof identity) => ({input: [{type: 'text', text: `Encargo\n${JSON.stringify({identity: run})}`} ]});
    const rpc = {request: vi.fn().mockResolvedValueOnce({data: [entry({...identity, task: thread})], nextCursor: 'older'})
      .mockResolvedValueOnce({data: [entry(identity)]})};
    expect(await officinaRequestQueued(rpc, thread, identity)).toBe(true);
    expect(rpc.request.mock.calls).toEqual([
      ['thread/queue/list', {threadId: thread, limit: 100, cursor: undefined}],
      ['thread/queue/list', {threadId: thread, limit: 100, cursor: 'older'}],
    ]);
    rpc.request.mockResolvedValueOnce({data: [entry({...identity, project: otherThread})]});
    expect(await officinaRequestQueued(rpc, thread, identity)).toBe(false);
  });
});
