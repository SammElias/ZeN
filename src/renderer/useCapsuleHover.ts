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
      const select = document.activeElement instanceof HTMLSelectElement ? document.activeElement : null;
      if (select && selectTimer === undefined) selectTimer = setInterval(sync, 40);
      if (!select) { clearInterval(selectTimer); selectTimer = undefined; }
      const blocked = pressed || !!select?.matches(':open') || !!element.querySelector('dialog[open]');
      const input = {app, inside, blocked, reduced: motion.matches};
      if (previous && previous.app === app && previous.inside === inside && previous.blocked === blocked && previous.reduced === input.reduced) return;
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
    const afterFocus = () => queueMicrotask(sync);
    const observer = new MutationObserver(sync);
    observer.observe(element, {subtree:true,childList:true,attributes:true,attributeFilter:['open']});
    window.addEventListener('pointerover', updatePointer, true);
    window.addEventListener('pointerout', updatePointer, true);
    window.addEventListener('pointermove', updatePointer, true);
    window.addEventListener('pointerdown', start, true);
    window.addEventListener('pointerup', updatePointer, true);
    window.addEventListener('pointercancel', release, true);
    window.addEventListener('blur', release);
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
      window.removeEventListener('blur', release);
      document.removeEventListener('focusin', afterFocus);
      document.removeEventListener('focusout', afterFocus);
      motion.removeEventListener('change', sync);
    };
  }, [root, enabled]);
}
