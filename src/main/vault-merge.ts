import {createHash} from 'node:crypto';
import {KdbxEntry, ProtectedValue, type Kdbx, type KdbxGroup} from 'kdbxweb';

export type VaultReplication = {
  active(): boolean;
  hasCopies(): boolean;
  copies(): Buffer[];
  adopted(bytes: Uint8Array): void;
  publish(): void;
  report(error?: string): void;
};

function entries(group: KdbxGroup): KdbxEntry[] {
  return [...group.entries, ...group.groups.flatMap(entries)];
}
function fields(entry: KdbxEntry) {
  // Comparisons stay in memory. Neither these hashes nor field values go into the transport.
  return createHash('sha256').update(JSON.stringify([...entry.fields].sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => [name, value instanceof ProtectedValue ? value.getText() : value]))).digest('hex');
}
function logicalVault(db: Kdbx) {
  function children(group: KdbxGroup): unknown {
    return [group.uuid.id, group.name,
      group.entries.map(entry => [entry.uuid.id, fields(entry), [...new Set(entry.history.map(fields))].sort()]),
      group.groups.map(children)];
  }
  return JSON.stringify([children(db.getDefaultGroup()),
    db.deletedObjects.map(item => item.uuid?.id ?? '').sort()]);
}

export function mergeVaultCopy(local: Kdbx, remote: Kdbx) {
  const before = logicalVault(local);
  if (!local.getDefaultGroup().uuid.equals(remote.getDefaultGroup().uuid)) {
    throw Error('Este equipo tiene otra bóveda. Se han conservado ambas copias.');
  }
  const remoteEntries = new Map(entries(remote.getDefaultGroup()).map(entry => [entry.uuid.id, entry]));
  const alternatives = new Map<string, KdbxEntry[]>();
  for (const entry of entries(local.getDefaultGroup())) {
    const candidate = remoteEntries.get(entry.uuid.id);
    if (!candidate) continue;
    const left = fields(entry), right = fields(candidate);
    if (left === right) continue;
    alternatives.set(entry.uuid.id, [entry, candidate].map(value => {
      const copy = new KdbxEntry();
      copy.copyFrom(value);
      return copy;
    }));
    // KDBX stores modification times at second precision. Give ties the same winner on every device.
    if (entry.lastModTime === candidate.lastModTime) {
      const kept = left > right ? entry : candidate;
      kept.times.lastModTime = new Date(kept.lastModTime + 1000);
    }
  }
  local.merge(remote);
  for (const entry of entries(local.getDefaultGroup())) {
    const versions = alternatives.get(entry.uuid.id);
    if (!versions) continue;
    const retained = new Set([fields(entry), ...entry.history.map(fields)]);
    const timestamps = new Set([entry.lastModTime, ...entry.history.map(item => item.lastModTime)]);
    for (const previous of versions) {
      const value = fields(previous);
      if (retained.has(value)) continue;
      let timestamp = previous.lastModTime;
      while (timestamps.has(timestamp)) timestamp -= 1000;
      previous.times.lastModTime = new Date(timestamp);
      entry.history.push(previous);
      retained.add(value);
      timestamps.add(timestamp);
    }
    entry.history.sort((a, b) => a.lastModTime - b.lastModTime);
  }
  return logicalVault(local) !== before;
}
