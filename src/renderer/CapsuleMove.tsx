import React, {useEffect, useRef} from 'react';
import type {CapsuleAlignment} from '../shared/overlay-position';

const positions = [
  {id: 'left', label: 'Mover al extremo izquierdo', path: 'M4 5v14m15-7H7m5-5-5 5 5 5'},
  {id: 'center', label: 'Centrar en este monitor', path: 'M12 5v14M3 12h6m-3-3 3 3-3 3m15-3h-6m3-3-3 3 3 3'},
  {id: 'right', label: 'Mover al extremo derecho', path: 'M20 5v14M5 12h12m-5-5 5 5-5 5'},
] as const;

export function CapsuleMove({onError}: {onError: (message: string) => void}) {
  const pointer = useRef<{id: number; x: number; y: number; moving: boolean} | null>(null);

  function endPointer(id: number) {
    const gesture = pointer.current;
    if (!gesture || gesture.id !== id) return;
    pointer.current = null;
    if (gesture.moving) void window.companion.drag('end');
  }

  useEffect(() => () => {
    if (pointer.current?.moving) void window.companion.drag('end');
  }, []);

  async function move(alignment: CapsuleAlignment) {
    try {
      const result = await window.companion.moveCapsule(alignment);
      onError(result.ok ? '' : result.error);
    } catch {
      onError('No se pudo mover la cápsula.');
    }
  }

  return <div className="capsule-move" role="group" aria-label="Posición de la cápsula">
    <span className="capsule-move-grip" title="Arrastra para mover la cápsula" aria-hidden="true"
      onPointerDown={event => {
        if (event.button !== 0 || !event.isPrimary) return;
        pointer.current = {id: event.pointerId, x: event.screenX, y: event.screenY, moving: false};
        event.currentTarget.setPointerCapture(event.pointerId);
      }} onPointerMove={event => {
        const gesture = pointer.current;
        if (!gesture || gesture.id !== event.pointerId || gesture.moving ||
            Math.hypot(event.screenX - gesture.x, event.screenY - gesture.y) < 4) return;
        gesture.moving = true;
        void window.companion.drag('start');
      }} onPointerUp={event => endPointer(event.pointerId)}
      onPointerCancel={event => endPointer(event.pointerId)}
      onLostPointerCapture={event => endPointer(event.pointerId)}>
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        {[5, 12, 19].flatMap(y => [9, 15].map(x => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6"/>))}
      </svg>
    </span>
    {positions.map(({id, label, path}) => <button key={id} type="button" data-alignment={id}
        aria-label={label} title={label} onClick={() => void move(id)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"
          strokeLinejoin="round" aria-hidden="true"><path d={path}/></svg>
    </button>)}
  </div>;
}
