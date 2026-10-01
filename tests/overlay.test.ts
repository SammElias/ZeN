import { describe, expect, it, vi } from 'vitest';
import { overlayBounds, draggedRatio } from '../src/main/overlay';
import { SuccessTimer, canAutoHide, type HideConditions } from '../src/renderer/auto-hide';
import { OverlayLayoutSchema, OverlayDragSchema, SettingsSchema } from '../src/shared/contracts';
const area = { x: -1920, y: -200, width: 1920, height: 1040 };
describe('overlay geometry in DIP', () => {
  it('retains top anchor while expanding on a negative-coordinate monitor', () => { const a = overlayBounds(area, { mode: 'capsule', height: 40 }); const b = overlayBounds(area, { mode: 'card', height: 330 }); expect(a.y).toBe(b.y); expect(a.x).toBeLessThan(0); expect(a.width).toBe(240); expect(a.height).toBe(40); expect(b.width).toBe(1120); expect(a.y).toBe(area.y); });
  it.each([1, 1.25, 1.5])('bounds remain within useful DIP area at simulated scale %s', scale => { const work = { x: -1280, y: -180, width: Math.round(1920 / scale), height: Math.round(1040 / scale) }; const bounds = overlayBounds(work, { mode: 'panel', height: 1000 }); expect(bounds.height).toBeLessThanOrEqual(work.height * .8); expect(bounds.y).toBe(work.y); expect(bounds.x).toBeGreaterThanOrEqual(work.x); expect(bounds.x + bounds.width).toBeLessThanOrEqual(work.x + work.width); });
  it('fits small screens without outside transparent region', () => { const a = overlayBounds({ x: 0, y: 0, width: 320, height: 240 }, { mode: 'card', height: 560 }); expect(a.width).toBe(296); expect(a.height).toBe(192); expect(a.y).toBe(0); });
  it('keeps a dragged position when expanded, then returns to the same capsule position', () => {
    const layout = { mode: 'capsule' as const, height: 40 };
    const ratio = draggedRatio(area, layout, -1200, .1);
    const collapsed = overlayBounds(area, layout, ratio);
    const expanded = overlayBounds(area, { mode: 'card', height: 380 }, ratio);
    expect(collapsed.x + collapsed.width * .1).toBe(-1200);
    expect(expanded.x + expanded.width / 2).toBe(collapsed.x + collapsed.width / 2);
    expect(expanded.y).toBe(-200);
    expect(overlayBounds(area, layout, ratio)).toEqual(collapsed);
  });
  it('anchors to a different monitor top and clamps both ends on small displays', () => {
    const destination = { x: 1920, y: 360, width: 800, height: 600 };
    const layout = { mode: 'capsule' as const, height: 40 };
    const left = overlayBounds(destination, layout, draggedRatio(destination, layout, 1000, .5));
    const right = overlayBounds(destination, layout, draggedRatio(destination, layout, 9000, .5));
    expect(left).toMatchObject({ x: 1920, y: 360 });
    expect(right.x + right.width).toBe(2720); expect(right.y).toBe(360);
    const expanded = overlayBounds(destination, { mode: 'card', height: 380 }, .99);
    expect(expanded.x + expanded.width).toBe(2720); expect(expanded.y).toBe(360);
  });
  it('drag IPC accepts only start/end, never coordinates or native movement commands', () => { expect(OverlayDragSchema.safeParse('start').success).toBe(true); expect(OverlayDragSchema.safeParse({ phase: 'start', x: 1, y: 200 }).success).toBe(false); });
  it('rejects arbitrary window commands', () => expect(OverlayLayoutSchema.safeParse({ mode: 'card', height: 250, x: 0, alwaysOnTop: true }).success).toBe(false));
  it('old preferences receive new safe defaults', () => { const c = SettingsSchema.parse({}); expect(c.autoHideSuccess).toBe(false); expect(c.listenOnInvoke).toBe(false); });
});
const base: HideConditions = { enabled: true, visible: true, state: 'completed', voiceActive: false, interacting: false, hasCopyableResult: false, panelOpen: false };
describe('success inactivity timer', () => {
  it.each(['listening','thinking','executing','awaiting_approval','failed','cancelled'] as const)('never hides state %s', state => expect(canAutoHide({ ...base, state })).toBe(false));
  it.each(['voiceActive','interacting','hasCopyableResult','panelOpen'] as const)('pauses when %s', key => expect(canAutoHide({ ...base, [key]: true })).toBe(false));
  it('fires at six seconds and pauses/restarts after interaction', () => { vi.useFakeTimers(); try { const hide = vi.fn(); const timer = new SuccessTimer(hide); timer.update(base); vi.advanceTimersByTime(5000); expect(hide).not.toHaveBeenCalled(); timer.update({ ...base, interacting: true }); vi.advanceTimersByTime(6000); expect(hide).not.toHaveBeenCalled(); timer.update(base); vi.advanceTimersByTime(6000); expect(hide).toHaveBeenCalledOnce(); timer.dispose(); } finally { vi.useRealTimers(); } });
});
