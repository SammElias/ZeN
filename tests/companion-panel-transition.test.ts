import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {CompanionPanelTransition} from '../src/main/companion-panel-transition';
import {motion} from '../src/shared/companion-motion';

function fixture() {
  const state = {expanded: true, visible: true, motion: true};
  const updateShape = vi.fn();
  const broadcast = vi.fn();
  const panel = new CompanionPanelTransition({
    visible: () => state.visible,
    expanded: () => state.expanded,
    quitting: () => false,
    motionEnabled: () => state.motion,
    updateShape,
    broadcast,
  });
  return {panel, state, updateShape, broadcast};
}

function deferredFrame() {
  let resolve!: (captured: boolean) => void;
  const promise = new Promise<boolean>(complete => { resolve = complete; });
  return {promise, resolve};
}

describe('the native panel transition', () => {
  beforeEach(() => vi.useFakeTimers({toFake: ['setTimeout','clearTimeout','setInterval','clearInterval','performance']}));
  afterEach(() => vi.useRealTimers());

  it('keeps hover opening clipped until capture, then reveals the panel over the shared duration', async () => {
    const {panel, updateShape, broadcast} = fixture();
    panel.prepareHoverOpen();
    vi.advanceTimersByTime(200);
    expect(updateShape).not.toHaveBeenCalled();
    expect(await panel.confirmPaint(panel.paintToken!, async () => true)).toBe(true);
    expect(panel.status()).toMatchObject({panelPaint:undefined,panelOpening:true});
    expect(panel.retraction).toBe(1);
    vi.advanceTimersByTime(motion.panelTransition / 2);
    expect(panel.retraction).toBeGreaterThan(0);
    expect(panel.retraction).toBeLessThan(1);
    vi.advanceTimersByTime(motion.panelTransition / 2 + 16);
    expect(panel.retraction).toBe(0);
    expect(panel.status().panelOpening).toBe(false);
    expect(broadcast).toHaveBeenCalledTimes(2);
  });

  it('uses the paint deadline with reduced motion after a failed capture', async () => {
    const {panel, state, updateShape} = fixture();
    state.motion = false;
    panel.prepareHoverOpen();
    expect(await panel.confirmPaint(panel.paintToken!, async () => false)).toBe(false);
    vi.advanceTimersByTime(249);
    expect(panel.paintToken).toBeDefined();
    vi.advanceTimersByTime(1);
    expect(panel.status()).toMatchObject({panelPaint:undefined,panelOpening:false});
    expect(panel.retraction).toBe(0);
    expect(updateShape).toHaveBeenCalledTimes(1);
  });

  it('ignores a capture from an opening that was abandoned', async () => {
    const {panel, updateShape} = fixture();
    panel.prepareHoverOpen();
    const captured = deferredFrame();
    const oldToken = panel.paintToken!;
    const pending = panel.confirmPaint(oldToken, () => captured.promise);
    panel.reset();
    panel.prepareHoverOpen();
    captured.resolve(true);
    expect(await pending).toBe(false);
    expect(panel.paintToken).toBeGreaterThan(oldToken);
    expect(updateShape).not.toHaveBeenCalled();
  });

  it('waits for the current vault frame and reverses an active retraction', async () => {
    const {panel, updateShape} = fixture();
    const previous = deferredFrame();
    const current = deferredFrame();
    panel.previewClose(true, previous.promise);
    expect(panel.hoverClosing).toBe(true);
    panel.previewClose(false);
    panel.previewClose(true, current.promise);
    previous.resolve(true);
    await previous.promise;
    vi.advanceTimersByTime(200);
    expect(updateShape).not.toHaveBeenCalled();

    current.resolve(true);
    await current.promise;
    vi.advanceTimersByTime(160);
    const partiallyRetracted = panel.retraction;
    expect(partiallyRetracted).toBeGreaterThan(0);
    panel.previewClose(false);
    expect(panel.retraction).toBe(partiallyRetracted);
    vi.advanceTimersByTime(motion.panelTransition + 16);
    expect(panel.retraction).toBe(0);
    expect(panel.status()).toMatchObject({hoverClosing:false,panelOpening:false});
  });
});
