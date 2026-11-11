import type { CodexTransport } from './codex-rpc';
import { hookEvents, type CompanionConnection, type CompanionSession } from '../shared/codex-companion';

type ReportedHook = {
  key?: string;
  eventName?: string;
  handlerType?: string;
  command?: string;
  trustStatus?: string;
  enabled?: boolean;
};

export function hookConnection(result: unknown, command: string, expected: number, now = Date.now()): CompanionConnection {
  const rows = (result as { data?: { hooks?: ReportedHook[] }[] })?.data;
  if (!Array.isArray(rows)) throw Error('Respuesta de hooks no reconocida.');
  const definitions = new Map<string | undefined, ReportedHook>();
  for (const row of rows) {
    if (!Array.isArray(row?.hooks)) continue;
    for (const hook of row.hooks) {
      if (hook?.handlerType === 'command' && hook.command === command) {
        definitions.set(hook.key ?? hook.eventName, hook);
      }
    }
  }
  const hooks = [...definitions.values()];
  const total = hooks.length;
  const trusted = hooks.filter(hook => hook.trustStatus === 'trusted' || hook.trustStatus === 'managed').length;
  const enabled = hooks.filter(hook => hook.enabled === true).length;
  const state = total < expected ? 'missing' : trusted < total ? 'review' : enabled < total ? 'disabled' : 'ready';
  return { state, checkedAt: now, total, trusted, enabled };
}

/** Read-only metadata. Never resumes a chat, reads turns, submits work or changes trust. */
export async function inspectCodexCompanion(
  rpc: Pick<CodexTransport, 'request'>,
  command: string,
  cwd: string,
  sessions: CompanionSession[],
) {
  const account = await rpc.request('account/read', { refreshToken: false });
  const connection = hookConnection(await rpc.request('hooks/list', { cwds: [cwd] }), command, hookEvents.length);
  const titles = new Map<string, string>();
  for (const session of sessions.filter(session => !session.title).slice(0, 6)) {
    try {
      const result = await rpc.request('thread/read', { threadId: session.id, includeTurns: false });
      const name = result.thread?.name;
      if (result.thread?.id === session.id && typeof name === 'string' && name.trim() && name.length <= 200) {
        titles.set(session.id, name.trim());
      }
    } catch { /* A missing title never prevents the hook status from being shown. */ }
  }
  return {
    account: account.account?.type === 'chatgpt' ? 'chatgpt' as const : account.account ? 'unsupported' as const : 'missing' as const,
    connection,
    titles,
  };
}
