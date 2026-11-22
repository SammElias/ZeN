import type {CSSProperties} from 'react';
import type {OfficinaRole} from '../shared/companion-officina';
import type {officinaTrackingLabels} from '../shared/officina-tracking';
import './OfficinaIdleScene.css';

export const officinaIdleRoutines = {
  analyst: {personality: 'Curiosa', action: 'Mira el móvil', id: 'phone'},
  architect: {personality: 'Reflexivo', action: 'Se recuesta y juguetea con el bolígrafo', id: 'pen'},
  developer: {personality: 'Tranquilo', action: 'Se toma un café', id: 'coffee'},
  tester: {personality: 'Inquieta', action: 'Estira los brazos', id: 'stretch'},
  alm: {personality: 'Metódico', action: 'Hojea su cuaderno', id: 'notebook'},
} as const;

export function officinaCanRest(state: keyof typeof officinaTrackingLabels) {
  return state === 'idle' || state === 'done' || state === 'limited';
}

const image = {width: 1374, height: 1145};
type Region = {x: number; y: number; width: number; height: number};
type Seat = {role: OfficinaRole; region: Region; duration: number; delay: number};

const seats: Seat[] = [
  {role: 'analyst', region: {x: 368, y: 239, width: 137, height: 172}, duration: 18.4, delay: -2.3},
  {role: 'architect', region: {x: 945, y: 237, width: 155, height: 191}, duration: 24.5, delay: -7.8},
  {role: 'developer', region: {x: 225, y: 527, width: 193, height: 195}, duration: 17.2, delay: -.5},
  {role: 'tester', region: {x: 1017, y: 552, width: 165, height: 197}, duration: 14.6, delay: -9.8},
  {role: 'alm', region: {x: 238, y: 812, width: 192, height: 169}, duration: 22.6, delay: -15.1},
];

function imageRegion({x, y, width, height}: Region): CSSProperties {
  const percent = (value: number, whole: number) => `${100 * value / whole}%`;
  // Use the same crop in every pose so the furniture stays aligned with the background.
  return {
    left: percent(x, image.width), top: percent(y, image.height),
    width: percent(width, image.width), height: percent(height, image.height),
    '--officina-pose-size': `${percent(image.width, width)} ${percent(image.height, height)}`,
    '--officina-pose-position': `${percent(x, image.width - width)} ${percent(y, image.height - height)}`,
  } as CSSProperties;
}

const leaves = imageRegion({x: 696, y: 491, width: 81, height: 75});

export function OfficinaIdleScene({resting}: {resting: readonly OfficinaRole[]}) {
  return <div className="officina-idle-scene" aria-hidden="true">
    <span className="officina-ambient-lamp" data-lamp="wall"/>
    <span className="officina-ambient-lamp" data-lamp="lounge"/>
    <span className="officina-ambient-leaves" style={leaves}/>
    {seats.filter(seat => resting.includes(seat.role)).map(({role, region, duration, delay}) =>
      <div key={role} className="officina-idle-seat" data-role={role} data-action={officinaIdleRoutines[role].id}
        style={{...imageRegion(region), '--officina-idle-period': `${duration}s`, '--officina-idle-delay': `${delay}s`} as CSSProperties}>
        <span className="officina-idle-frame officina-idle-frame--transition"/>
        <span className="officina-idle-frame officina-idle-frame--rest"/>
      </div>)}
  </div>;
}
