import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CompanionHover } from '../src/main/companion-hover';
import { motion } from '../src/shared/companion-motion';
import { appCubeDirection, type AppPage, type WorkspacePage } from '../src/shared/companion-navigation';

function fixture() {
  const state = { visible:true, expanded:false, page:'home' as WorkspacePage, overCapsule:false, overWorkspace:false, blocked:false, locked:false, animate:false };
  const open = vi.fn((app:AppPage) => { state.expanded = true; state.page = app; });
  const close = vi.fn(() => { state.expanded = false; hover.collapsed(); });
  const previewClose = vi.fn();
  const hover = new CompanionHover({ sample: () => state, open, close, previewClose });
  const capsule = (over: boolean, app: AppPage = 'home') => { state.overCapsule = over; hover.pointer(over ? app : undefined); };
  const lock = (locked: boolean) => { state.locked = locked; hover.lockChanged(); };
  return {state, open, close, hover, capsule, lock, previewClose};
}

describe('the Windows capsule hover', () => {
  beforeEach(() => vi.useFakeTimers({toFake:['setTimeout','clearTimeout','performance']}));
  afterEach(() => vi.useRealTimers());

  it('requires a real entry and a fresh 150 ms after a quick pass', () => {
    const {state, hover, capsule, open} = fixture();
    state.overCapsule = true;
    hover.refresh();
    vi.advanceTimersByTime(500);
    expect(open).not.toHaveBeenCalled();
    capsule(true);
    vi.advanceTimersByTime(149);
    capsule(false);
    vi.advanceTimersByTime(150);
    expect(open).not.toHaveBeenCalled();
    capsule(true);
    vi.advanceTimersByTime(149);
    expect(open).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('opens the exact app only after its own dwell, ignoring header controls', () => {
    const {state, capsule, hover, open} = fixture();
    state.overCapsule = true;
    hover.pointer();
    vi.advanceTimersByTime(700);
    expect(open).not.toHaveBeenCalled();
    capsule(true, 'home');
    vi.advanceTimersByTime(80);
    capsule(true, 'calendar');
    vi.advanceTimersByTime(140);
    capsule(true, 'notes');
    vi.advanceTimersByTime(149);
    expect(open).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(open.mock.calls).toEqual([['notes']]);
  });

  it('keeps the visited section while over the panel and switches apps without collecting', () => {
    const {state, capsule, close, open} = fixture();
    capsule(true, 'notes');
    vi.advanceTimersByTime(150);
    state.overWorkspace = true;
    capsule(false);
    vi.advanceTimersByTime(700);
    expect(state.page).toBe('notes');
    state.overWorkspace = false;
    capsule(true, 'spotify');
    vi.advanceTimersByTime(149);
    expect(state.page).toBe('notes');
    vi.advanceTimersByTime(1);
    vi.advanceTimersByTime(400);
    expect(open.mock.calls).toEqual([['notes'], ['spotify']]);
    expect(close).not.toHaveBeenCalled();
    capsule(false);
    vi.advanceTimersByTime(450);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('lets explicit navigation cancel a pending app without a new pointer entry', () => {
    const {state, hover, capsule, open} = fixture();
    capsule(true, 'notes');
    vi.advanceTimersByTime(100);
    state.expanded = true;
    state.page = 'codex';
    hover.selectExplicitly();
    hover.refresh();
    vi.advanceTimersByTime(500);
    expect(open).not.toHaveBeenCalled();
    capsule(true, 'spotify');
    vi.advanceTimersByTime(150);
    expect(open.mock.calls).toEqual([['spotify']]);
  });

  it('keeps the panel open across a gap or a return before 450 ms', () => {
    const {state, hover, capsule, close} = fixture();
    capsule(true);
    vi.advanceTimersByTime(150);
    capsule(false);
    vi.advanceTimersByTime(150);
    state.overWorkspace = true;
    hover.refresh();
    vi.advanceTimersByTime(900);
    expect(close).not.toHaveBeenCalled();
    state.overWorkspace = false;
    hover.refresh();
    vi.advanceTimersByTime(449);
    capsule(true);
    vi.advanceTimersByTime(100);
    expect(close).not.toHaveBeenCalled();
    capsule(false);
    vi.advanceTimersByTime(450);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('defers while an interaction is in progress and checks the latest position', () => {
    const {state, hover, capsule, close, open} = fixture();
    state.blocked = true;
    capsule(true);
    vi.advanceTimersByTime(1000);
    expect(open).not.toHaveBeenCalled();
    state.blocked = false;
    hover.refresh();
    vi.advanceTimersByTime(150);
    state.blocked = true;
    capsule(false);
    vi.advanceTimersByTime(1000);
    expect(close).not.toHaveBeenCalled();
    state.overWorkspace = true;
    state.blocked = false;
    hover.refresh();
    vi.advanceTimersByTime(1000);
    expect(close).not.toHaveBeenCalled();
    state.overWorkspace = false;
    hover.refresh();
    vi.advanceTimersByTime(450);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('does not reopen after a manual collapse until the pointer leaves and reenters', () => {
    const {state, hover, capsule, open} = fixture();
    capsule(true);
    vi.advanceTimersByTime(100);
    state.expanded = true;
    hover.refresh();
    vi.advanceTimersByTime(150);
    expect(open).not.toHaveBeenCalled();
    state.expanded = false;
    hover.collapsed();
    capsule(true);
    vi.advanceTimersByTime(1000);
    expect(open).not.toHaveBeenCalled();
    capsule(false);
    capsule(true);
    vi.advanceTimersByTime(150);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('can arm another app immediately after collecting over the previous icon', () => {
    const {state, hover, capsule, open} = fixture();
    capsule(true, 'home');
    vi.advanceTimersByTime(150);
    state.expanded = false;
    hover.collapsed();
    vi.advanceTimersByTime(250);
    expect(open.mock.calls).toEqual([['home']]);
    capsule(true, 'notes');
    vi.advanceTimersByTime(150);
    expect(open.mock.calls).toEqual([['home'], ['notes']]);
  });

  it('starts the existing close animation at 450 ms and can reverse it', () => {
    const {state, capsule, close, previewClose} = fixture();
    state.animate = true;
    capsule(true);
    vi.advanceTimersByTime(150);
    capsule(false);
    vi.advanceTimersByTime(450);
    expect(previewClose).toHaveBeenLastCalledWith(true);
    vi.advanceTimersByTime(100);
    capsule(true);
    expect(previewClose).toHaveBeenLastCalledWith(false);
    expect(close).not.toHaveBeenCalled();
    capsule(false);
    vi.advanceTimersByTime(450 + motion.panelTransition - 1);
    expect(close).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('leaves a keyboard-opened panel available until the pointer visits its zone', () => {
    const {state, hover, close} = fixture();
    state.expanded = true;
    hover.refresh();
    vi.advanceTimersByTime(1000);
    expect(close).not.toHaveBeenCalled();
  });

  it('cancels a pending opening when locked and starts a fresh dwell on unlock', () => {
    const {capsule, lock, open} = fixture();
    capsule(true);
    vi.advanceTimersByTime(149);
    lock(true);
    vi.advanceTimersByTime(600);
    capsule(false);
    capsule(true);
    vi.advanceTimersByTime(600);
    expect(open).not.toHaveBeenCalled();
    lock(false);
    vi.advanceTimersByTime(149);
    expect(open).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('keeps a pinned app even when another app is hovered inside the rail', () => {
    const {state, capsule, lock, open} = fixture();
    capsule(true, 'notes');
    vi.advanceTimersByTime(150);
    lock(true);
    capsule(true, 'spotify');
    vi.advanceTimersByTime(700);
    expect(state.page).toBe('notes');
    expect(open.mock.calls).toEqual([['notes']]);
  });

  it('cancels an automatic close already in progress when pinned', () => {
    const {state, capsule, lock, close, previewClose} = fixture();
    state.animate = true;
    capsule(true);
    vi.advanceTimersByTime(150);
    capsule(false);
    vi.advanceTimersByTime(500);
    expect(previewClose).toHaveBeenLastCalledWith(true);
    lock(true);
    expect(previewClose).toHaveBeenLastCalledWith(false);
    vi.advanceTimersByTime(1000);
    expect(close).not.toHaveBeenCalled();
  });

  it('starts a full dismissal interval only after the pointer leaves an unpinned panel', () => {
    const {state, hover, capsule, lock, close} = fixture();
    capsule(true);
    vi.advanceTimersByTime(150);
    lock(true);
    capsule(false);
    vi.advanceTimersByTime(1100);
    expect(close).not.toHaveBeenCalled();
    state.overWorkspace = true;
    lock(false);
    vi.advanceTimersByTime(1100);
    expect(close).not.toHaveBeenCalled();
    state.overWorkspace = false;
    hover.refresh();
    vi.advanceTimersByTime(449);
    expect(close).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('starts a fresh dismissal interval when unlocked from outside', () => {
    const {state, lock, close} = fixture();
    lock(true);
    state.expanded = true;
    vi.advanceTimersByTime(700);
    lock(false);
    vi.advanceTimersByTime(449);
    expect(close).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(close).toHaveBeenCalledTimes(1);
  });
});

describe('the app cube direction', () => {
  it('reverses with traversal order and follows a reordered visible menu', () => {
    expect(appCubeDirection(['home','codex','spotify','notes'], 'codex', 'notes')).toBe('bottom');
    expect(appCubeDirection(['home','codex','spotify','notes'], 'notes', 'codex')).toBe('top');
    expect(appCubeDirection(['home','notes','calendar','codex','spotify'], 'permissions', 'notes')).toBe('top');
  });

  it('skips the cube on repeats and when a view does not have a visible app icon', () => {
    expect(appCubeDirection(['home','codex','notes'], 'permissions', 'codex')).toBeUndefined();
    expect(appCubeDirection(['home','codex','notes'], 'calendar', 'notes')).toBeUndefined();
    expect(appCubeDirection(['home','codex','notes'], 'settings', 'home')).toBeUndefined();
  });
});
