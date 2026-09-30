import React, { useEffect, useId, useRef } from 'react';
import type { TaskState } from '../shared/contracts';

// Original ZEN character: a floating pearl and its orbit. No reference artwork.
export function Companion({ state = 'idle', size = 'small', animated = true }: { state?: TaskState | 'speaking'; size?: 'small' | 'large'; animated?: boolean }) {
  const face = useRef<SVGGElement>(null);
  const host = useRef<HTMLSpanElement>(null);
  const gradient = useId().replace(/:/g, '');
  useEffect(() => {
    if (!animated || size !== 'large') return;
    let frame = 0;
    const move = (event: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const box = host.current?.getBoundingClientRect();
        if (!box) return;
        const x = Math.max(-4, Math.min(4, (event.clientX - box.x - box.width / 2) / 40));
        const y = Math.max(-3, Math.min(3, (event.clientY - box.y - box.height / 2) / 50));
        face.current?.setAttribute('transform', `translate(${x} ${y})`);
      });
    };
    const reset = () => { cancelAnimationFrame(frame); face.current?.removeAttribute('transform'); };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('blur', reset);
    document.addEventListener('pointerleave', reset);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('pointermove', move); window.removeEventListener('blur', reset); document.removeEventListener('pointerleave', reset); face.current?.removeAttribute('transform'); };
  }, [animated, size]);
  return <span ref={host} className={`zen-companion ${size} mood-${state} ${animated ? '' : 'still'}`} aria-hidden="true">
    <svg viewBox="0 0 96 96" focusable="false">
      <defs><radialGradient id={gradient} cx="32%" cy="22%" r="85%"><stop offset="0" stopColor="#f5eeff" /><stop offset=".48" stopColor="#c6b3fb" /><stop offset="1" stopColor="#8473cc" /></radialGradient></defs>
      <ellipse className="companion-shadow" cx="48" cy="83" rx="22" ry="4" fill="#c9b6ff" opacity=".12" />
      <g className="companion-float">
        <ellipse className="companion-orbit back" cx="48" cy="58" rx="40" ry="15" transform="rotate(-22 48 58)" fill="none" stroke="#b8a0f3" strokeWidth="1.6" opacity=".4" />
        <path className="companion-pearl" d="M48 12C58 12 80 35 80 49C80 68 64 77 48 77C32 77 16 68 16 49C16 35 38 12 48 12Z" fill={`url(#${gradient})`} />
        <path d="M30 30Q40 20 49 20" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity=".45" />
        <g ref={face} className="companion-face">
          <rect x="28" y="38" width="40" height="23" rx="11.5" fill="#29233e" />
          <g className="companion-eyes" fill="#e6f8f1"><rect x="37" y="44" width="5" height="10" rx="2.5" /><rect x="54" y="44" width="5" height="10" rx="2.5" /></g>
          <path className="companion-smile" d="M36 50Q40 43 44 50M52 50Q56 43 60 50" stroke="#e6f8f1" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        </g>
        <path className="companion-orbit front" d="M11 68C20 83 65 73 84 49" stroke="#decfff" strokeWidth="2" strokeLinecap="round" fill="none" />
        <circle className="companion-satellite" cx="80" cy="55" r="3.5" fill="#e4fff3" />
      </g>
    </svg>
  </span>;
}
