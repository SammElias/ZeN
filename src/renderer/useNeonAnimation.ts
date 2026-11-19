import {useEffect, useRef} from 'react';
import {neonSpeeds, neonVisual, type NeonOptions} from '../shared/companion-neon';

type Paint = (phase: number | null) => void;

export function useNeonAnimation(options: NeonOptions, visible: boolean, motion: boolean) {
  const timeline = useRef({phase: .34, running: false, listeners: new Set<Paint>()}).current;
  const {enabled, animated, speed} = options;

  useEffect(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const {duration} = neonSpeeds[speed];
    let frame: number | undefined;
    let lastTime: number | undefined;

    function publish() {
      for (const paint of timeline.listeners) paint(timeline.running ? timeline.phase : null);
    }

    function tick(time: number) {
      lastTime ??= time;
      const elapsed = time - lastTime;
      if (elapsed >= neonVisual.frameMs) {
        timeline.phase = (timeline.phase + elapsed / duration) % 1;
        lastTime = time;
        publish();
      }
      frame = requestAnimationFrame(tick);
    }

    function schedule() {
      if (frame !== undefined) cancelAnimationFrame(frame);
      frame = lastTime = undefined;
      timeline.running = enabled && visible && animated && motion && !reduced.matches && !document.hidden;
      publish();
      if (timeline.running) frame = requestAnimationFrame(tick);
    }

    schedule();
    reduced.addEventListener('change', schedule);
    document.addEventListener('visibilitychange', schedule);
    return () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      reduced.removeEventListener('change', schedule);
      document.removeEventListener('visibilitychange', schedule);
    };
  }, [timeline, enabled, visible, animated, motion, speed]);

  return timeline;
}

export type NeonAnimation = ReturnType<typeof useNeonAnimation>;
