import { describe, expect, it, vi } from 'vitest';
import { overlayBounds } from '../src/main/overlay';
import { SuccessTimer, canAutoHide, type HideConditions } from '../src/renderer/auto-hide';
import { OverlayLayoutSchema, SettingsSchema } from '../src/shared/contracts';
const area = { x: -1920, y: -200, width: 1920, height: 1040 };
describe('overlay geometry in DIP', () => {
  it('retains top anchor while expanding on a negative-coordinate monitor', () => { const a = overlayBounds(area, { mode: 'capsule', height: 48 }); const b = overlayBounds(area, { mode: 'card', height: 330 }); expect(a.y).toBe(b.y); expect(a.x).toBeLessThan(0); expect(a.width).toBe(320); expect(a.height).toBe(48); expect(b.width).toBe(560); expect(a.y).toBe(area.y); });
  it.each([1, 1.25, 1.5])('bounds remain within useful DIP area at simulated scale %s', scale => { const work = { x: -1280, y: -180, width: Math.round(1920 / scale), height: Math.round(1040 / scale) }; const bounds = overlayBounds(work, { mode: 'panel', height: 1000 }); expect(bounds.height).toBeLessThanOrEqual(work.height * .8); expect(bounds.y).toBe(work.y); expect(bounds.x).toBeGreaterThanOrEqual(work.x); expect(bounds.x + bounds.width).toBeLessThanOrEqual(work.x + work.width); });
  it('fits small screens without outside transparent region', () => { const a = overlayBounds({ x: 0, y: 0, width: 320, height: 240 }, { mode: 'card', height: 560 }); expect(a.width).toBe(296); expect(a.height).toBe(192); expect(a.y).toBe(0); });
  it('rejects arbitrary window commands', () => expect(OverlayLayoutSchema.safeParse({ mode: 'card', height: 250, x: 0, alwaysOnTop: true }).success).toBe(false));
  it('old preferences receive new safe defaults', () => { const c = SettingsSchema.parse({}); expect(c.autoHideSuccess).toBe(false); expect(c.listenOnInvoke).toBe(false); });
});
const base: HideConditions = { enabled: true, visible: true, state: 'completed', voiceActive: false, interacting: false, hasCopyableResult: false, panelOpen: false };
describe('success inactivity timer', () => {
  it.each(['listening','thinking','executing','awaiting_approval','failed','cancelled'] as const)('never hides state %s', state => expect(canAutoHide({ ...base, state })).toBe(false));
  it.each(['voiceActive','interacting','hasCopyableResult','panelOpen'] as const)('pauses when %s', key => expect(canAutoHide({ ...base, [key]: true })).toBe(false));
  it('fires at six seconds and pauses/restarts after interaction', () => { vi.useFakeTimers(); try { const hide = vi.fn(); const timer = new SuccessTimer(hide); timer.update(base); vi.advanceTimersByTime(5000); expect(hide).not.toHaveBeenCalled(); timer.update({ ...base, interacting: true }); vi.advanceTimersByTime(6000); expect(hide).not.toHaveBeenCalled(); timer.update(base); vi.advanceTimersByTime(6000); expect(hide).toHaveBeenCalledOnce(); timer.dispose(); } finally { vi.useRealTimers(); } });
});
