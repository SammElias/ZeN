import type { CompanionLastReply } from '../shared/codex-companion';

export function preferCompanionReply(previous?: CompanionLastReply, next?: CompanionLastReply) {
  if (!previous || !next) return previous ?? next;
  // Both represent the same final. The original rollout is authoritative over the relay.
  if (previous.turn && previous.turn === next.turn && previous.source !== next.source) {
    return next.source === 'local' ? next : previous;
  }
  if (previous.at > next.at || (previous.at === next.at && previous.source === 'hook')) return previous;
  return next;
}
