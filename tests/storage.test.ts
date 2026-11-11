import { it, expect } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/storage/store';
import { CompanionPlacements } from '../src/storage/overlay-position';
it('restores horizontal position after restart and ignores invalid placement files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'zen-position-'));
  const protection = { isEncryptionAvailable: () => false, encryptString: () => Buffer.from(''), decryptString: () => '' };
  try {
    const first = new Store(dir, protection); expect(first.overlayPosition()).toBeUndefined();
    first.saveOverlayPosition({ displayId: -12, horizontalRatio: .8 });
    expect(new Store(dir, protection).overlayPosition()).toEqual({ displayId: -12, horizontalRatio: .8, edge: 'top', verticalRatio: .5 });
    first.saveOverlayPosition({displayId:-12,horizontalRatio:.8,edge:'right',verticalRatio:.72});
    expect(new Store(dir,protection).overlayPosition()).toMatchObject({edge:'right',verticalRatio:.72});
    expect(() => first.saveOverlayPosition({ displayId: 1, horizontalRatio: 2 })).toThrow();
    writeFileSync(join(dir, 'overlay-position.json'), JSON.stringify({ displayId: 1, horizontalRatio: .5, y: 200 }));
    expect(first.overlayPosition()).toBeUndefined();
  } finally { rmSync(dir, { recursive: true }); }
});
it('restores the last display and retains independent capsule placements across restarts', () => {
  const profile = mkdtempSync(join(tmpdir(), 'zen-placement-'));
  try {
    writeFileSync(join(profile, 'overlay-position.json'), JSON.stringify({ displayId: -12, horizontalRatio: .8 }));
    const placements = new CompanionPlacements(profile);
    const previous = { displayId: -12, edge: 'top', horizontalRatio: .8, verticalRatio: .5 } as const;
    expect(placements.initial(1)).toEqual(previous);
    const second = { ...placements.forDisplay(previous, 1), edge: 'right', verticalRatio: .25 } as const;
    expect(second.displayId).toBe(1);
    placements.save(previous);
    placements.save(second);
    const restarted = new CompanionPlacements(profile);
    expect(restarted.initial(99)).toEqual(second);
    expect(restarted.forDisplay(second, -12)).toEqual(previous);
    expect(restarted.forDisplay(second, 99)).toEqual({ ...second, displayId: 99 });
    writeFileSync(join(profile, 'companion-placement.json'), 'invalid');
    expect(new CompanionPlacements(profile).initial(99)).toEqual(second);
  } finally { rmSync(profile, { recursive: true, force: true }); }
});
it('refuses unprotected secret persistence', () => { const dir = mkdtempSync(join(tmpdir(), 'zen-unit-')); try { const store = new Store(dir, { isEncryptionAvailable: () => false, encryptString: () => Buffer.from(''), decryptString: () => '' }); expect(() => store.saveKey('dummy')).toThrow('protección'); expect(store.hasKey()).toBe(false); } finally { rmSync(dir, { recursive: true }); } });
it('retains only bounded recent metadata and supports deletion', () => { const dir = mkdtempSync(join(tmpdir(), 'zen-unit-')); try { const store = new Store(dir, { isEncryptionAvailable: () => false, encryptString: () => Buffer.from(''), decryptString: () => '' }); writeFileSync(join(dir, 'execution.json'), JSON.stringify([{ at: '2000-01-01', type: 'old' }, ...Array.from({ length: 600 }, () => ({ at: new Date().toISOString(), type: 'recent' }))])); store.log({ type: 'new' }); const rows = JSON.parse(readFileSync(join(dir, 'execution.json'), 'utf8')); expect(rows.length).toBe(500); expect(rows.find((r: any) => r.type === 'old')).toBeUndefined(); store.clearLogs(); expect(JSON.parse(readFileSync(join(dir, 'execution.json'), 'utf8'))).toEqual([]); } finally { rmSync(dir, { recursive: true }); } });
