import React, {memo, useEffect, useRef} from 'react';
import {neonPalettes, neonVisual, type NeonOptions} from '../shared/companion-neon';
import type {NeonAnimation} from './useNeonAnimation';
import './neon-border.css';

const {inset, line, halo, segment} = neonVisual;
const steps = 20;
const step = segment / steps;

export const WorkspaceNeonBorder = memo(function WorkspaceNeonBorder({options, visible, animation}: {
  options: NeonOptions; visible: boolean; animation: NeonAnimation;
}) {
  const overlay = useRef<SVGSVGElement>(null);
  const {enabled, palette, intensity} = options;
  const {color, core} = neonPalettes[palette];
  const strength = intensity / 100;

  useEffect(() => {
    const layer = overlay.current;
    if (!layer) return;
    function paint(phase: number | null) {
      if (phase !== null) layer!.style.setProperty('--neon-phase', String(phase));
      const running = String(phase !== null);
      if (layer!.dataset.running !== running) layer!.dataset.running = running;
    }
    paint(animation.running ? animation.phase : null);
    animation.listeners.add(paint);
    return () => { animation.listeners.delete(paint); };
  }, [animation, enabled, visible]);

  if (!enabled || !visible) return null;
  return <svg ref={overlay} className="neon-border workspace-neon-border" data-palette={palette} aria-hidden="true" focusable="false"
    style={{'--neon-inset': `${inset}px`} as React.CSSProperties}>
    <g fill="none" stroke={color}>
      <rect strokeWidth={halo * 2} opacity={strength * .06}/>
      <rect strokeWidth={halo} opacity={strength * .13}/>
      <rect strokeWidth={line} opacity={strength * .6}/>
    </g>
    <g className="workspace-neon-trail" fill="none" strokeDasharray={`${step} ${1 - step}`}>
      {Array.from({length: steps}, (_, index) => {
        const progress = (index + .5) / steps;
        const opacity = progress ** 2 * Math.min(1, (1 - progress) / .27) * strength;
        return <g key={index} style={{'--neon-step-offset': Number((segment - index * step).toFixed(3))} as React.CSSProperties}>
          <rect pathLength={1} stroke={color} strokeWidth={halo} opacity={opacity * .18}/>
          <rect pathLength={1} stroke={core} strokeWidth={line} opacity={opacity * .9}/>
        </g>;
      })}
    </g>
  </svg>;
});
