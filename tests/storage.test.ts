import { it, expect } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/storage/store';
it('restores horizontal position after restart and ignores invalid placement files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'zen-position-'));
  const protection = { isEncryptionAvailable: () => false, encryptString: () => Buffer.from(''), decryptString: () => '' };
  try {
    const first = new Store(dir, protection); expect(first.overlayPosition()).toBeUndefined();
    first.saveOverlayPosition({ displayId: -12, horizontalRatio: .8 });
    expect(new Store(dir, protection).overlayPosition()).toEqual({ displayId: -12, horizontalRatio: .8 });
    expect(() => first.saveOverlayPosition({ displayId: 1, horizontalRatio: 2 })).toThrow();
    writeFileSync(join(dir, 'overlay-position.json'), JSON.stringify({ displayId: 1, horizontalRatio: .5, y: 200 }));
    expect(first.overlayPosition()).toBeUndefined();
  } finally { rmSync(dir, { recursive: true }); }
});
it('refuses unprotected secret persistence', () => { const dir = mkdtempSync(join(tmpdir(), 'zen-unit-')); try { const store = new Store(dir, { isEncryptionAvailable: () => false, encryptString: () => Buffer.from(''), decryptString: () => '' }); expect(() => store.saveKey('dummy')).toThrow('protección'); expect(store.hasKey()).toBe(false); } finally { rmSync(dir, { recursive: true }); } });
it('retains only bounded recent metadata and supports deletion', () => { const dir = mkdtempSync(join(tmpdir(), 'zen-unit-')); try { const store = new Store(dir, { isEncryptionAvailable: () => false, encryptString: () => Buffer.from(''), decryptString: () => '' }); writeFileSync(join(dir, 'execution.json'), JSON.stringify([{ at: '2000-01-01', type: 'old' }, ...Array.from({ length: 600 }, () => ({ at: new Date().toISOString(), type: 'recent' }))])); store.log({ type: 'new' }); const rows = JSON.parse(readFileSync(join(dir, 'execution.json'), 'utf8')); expect(rows.length).toBe(500); expect(rows.find((r: any) => r.type === 'old')).toBeUndefined(); store.clearLogs(); expect(JSON.parse(readFileSync(join(dir, 'execution.json'), 'utf8'))).toEqual([]); } finally { rmSync(dir, { recursive: true }); } });
