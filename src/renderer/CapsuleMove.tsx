import React, {useEffect, useRef} from 'react';
import {CompanionIcon} from './CompanionActions';

export function CapsulePin({locked, ready, onError}: {locked: boolean; ready: boolean; onError: (error: string) => void}) {
  return <button className="capsule-pin" type="button" aria-label="Bloquear posición" data-ui-sound="press"
    title={locked ? 'Desbloquear posición' : 'Bloquear posición'} aria-pressed={locked} disabled={!ready}
    onClick={() => void window.companion.pinWindow(!locked).then(result => {if (!result.ok) onError(result.error);})}>
    <CompanionIcon name={locked ? 'lock' : 'lockOpen'}/>
  </button>;
}

export function CapsuleDragGrip({workspace, locked}: {workspace: boolean; locked: boolean}) {
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

  return <span className="capsule-move-grip" data-locked={locked} title={locked?'Posición bloqueada':workspace ? 'Arrastra para mover la ventana' : 'Arrastra para mover la cápsula'} aria-hidden="true"
      onPointerDown={event => {
        if (locked || workspace || event.button !== 0 || !event.isPrimary) return;
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
  </span>;
}
