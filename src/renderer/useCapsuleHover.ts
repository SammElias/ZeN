import { useEffect, type RefObject } from 'react';
import { HoverApp, type CapsuleHoverInput } from '../shared/companion-workspace';

export function useCapsuleHover(root: RefObject<HTMLElement|null>, enabled: boolean) {
  useEffect(() => {
    const element = root.current;
    if (!enabled || !element) return;

    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let app: CapsuleHoverInput['app'];
    let inside = false;
    let pressed = false;
    let previous: CapsuleHoverInput | undefined;
    let selectTimer: ReturnType<typeof setInterval> | undefined;
    const sync = () => {
      // Chromium's native select popup can extend past the window. Its open state
      // does not dispatch a DOM mutation, so sample it while that select has focus.
      const active = document.activeElement;
      const select = active instanceof HTMLSelectElement ? active : null;
      if (select && selectTimer === undefined) selectTimer = setInterval(sync, 40);
      if (!select) { clearInterval(selectTimer); selectTimer = undefined; }
      const blocked = pressed || !!select?.matches(':open') ||
        !!element.querySelector('dialog[open], [data-island-gesture]:not([hidden] *, [inert] *)');
      const holdOpen = !!(document.hasFocus() && active?.matches('[data-hold-island-open]') &&
        element.contains(active) && !active.closest('[hidden],[inert]'));
      const input = {app, inside, blocked, holdOpen, reduced: motion.matches};
      if (previous && previous.app === app && previous.inside === inside && previous.blocked === blocked &&
          previous.holdOpen === holdOpen && previous.reduced === input.reduced) return;
      previous = input;
      void window.companion.capsuleHover(input);
    };
    const readTarget = (target: EventTarget|null) => {
      const surface = target instanceof Element ? target.closest('.compact-capsule,.workspace-surface') : null;
      inside = !!surface && element.contains(surface);
      const button = inside && target instanceof Element ? target.closest<HTMLButtonElement>('button[data-hover-app]:enabled') : null;
      app = button ? HoverApp.safeParse(button.dataset.hoverApp).data : undefined;
    };
    const updatePointer = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      if (!event.buttons) pressed = false;
      readTarget(event.type === 'pointerout' ? event.relatedTarget : event.target);
      sync();
    };
    const start = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      readTarget(event.target);
      pressed = inside && !(event.target instanceof Element && event.target.closest('select'));
      sync();
    };
    const release = () => { if (pressed) { pressed = false; sync(); } };
    const blur = () => { pressed = false; sync(); };
    const afterFocus = () => queueMicrotask(sync);
    const observer = new MutationObserver(sync);
    observer.observe(element, {subtree:true,childList:true,attributes:true,attributeFilter:['open','hidden','inert','data-island-gesture']});
    window.addEventListener('pointerover', updatePointer, true);
    window.addEventListener('pointerout', updatePointer, true);
    window.addEventListener('pointermove', updatePointer, true);
    window.addEventListener('pointerdown', start, true);
    window.addEventListener('pointerup', updatePointer, true);
    window.addEventListener('pointercancel', release, true);
    window.addEventListener('blur', blur);
    window.addEventListener('focus', afterFocus);
    document.addEventListener('focusin', afterFocus);
    document.addEventListener('focusout', afterFocus);
    motion.addEventListener('change', sync);
    sync();
    return () => {
      observer.disconnect();
      clearInterval(selectTimer);
      window.removeEventListener('pointerover', updatePointer, true);
      window.removeEventListener('pointerout', updatePointer, true);
      window.removeEventListener('pointermove', updatePointer, true);
      window.removeEventListener('pointerdown', start, true);
      window.removeEventListener('pointerup', updatePointer, true);
      window.removeEventListener('pointercancel', release, true);
      window.removeEventListener('blur', blur);
      window.removeEventListener('focus', afterFocus);
      document.removeEventListener('focusin', afterFocus);
      document.removeEventListener('focusout', afterFocus);
      motion.removeEventListener('change', sync);
    };
  }, [root, enabled]);
}
