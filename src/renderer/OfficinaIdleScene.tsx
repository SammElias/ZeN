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
type Point = readonly [number, number];
type Seat = {role: OfficinaRole; region: Region; duration: number; delay: number;
  head: Point; hand: Point; gesture: {duration: number; delay: number; tilt: number}};

const seats: Seat[] = [
  {role: 'analyst', region: {x: 368, y: 239, width: 137, height: 172}, duration: 61, delay: -13,
    head: [421, 280], hand: [473, 320], gesture: {duration: 7.4, delay: -1.6, tilt: 3}},
  {role: 'architect', region: {x: 945, y: 237, width: 155, height: 191}, duration: 78, delay: -7,
    head: [1019, 276], hand: [1039, 301], gesture: {duration: 9.8, delay: -3.1, tilt: -3.3}},
  {role: 'developer', region: {x: 225, y: 527, width: 193, height: 195}, duration: 56, delay: -23,
    head: [342, 564], hand: [284, 617], gesture: {duration: 5.3, delay: -2.4, tilt: 3.5}},
  {role: 'tester', region: {x: 1017, y: 552, width: 165, height: 197}, duration: 70, delay: -8,
    head: [1074, 601], hand: [1146, 656], gesture: {duration: 6.1, delay: -.9, tilt: -3}},
  {role: 'alm', region: {x: 238, y: 812, width: 192, height: 169}, duration: 86, delay: -6,
    head: [300, 851], hand: [371, 918], gesture: {duration: 8.6, delay: -3.8, tilt: 2.8}},
];

const percent = (value: number, whole: number) => `${100 * value / whole}%`;

export function officinaImageRegion(region: Region, placement = region): CSSProperties {
  const {x, y, width, height} = region;
  // Use the same crop in every pose so the furniture stays aligned with the background.
  return {
    left: percent(placement.x, image.width), top: percent(placement.y, image.height),
    width: percent(placement.width, image.width), height: percent(placement.height, image.height),
    '--officina-pose-size': `${percent(image.width, width)} ${percent(image.height, height)}`,
    '--officina-pose-position': `${percent(x, image.width - width)} ${percent(y, image.height - height)}`,
  } as CSSProperties;
}

function gestureRegion([x, y]: Point, width: number, height: number) {
  return officinaImageRegion({x: x - width / 2, y: y - height / 2, width, height});
}

function gestureTiming(gesture: Seat['gesture']) {
  return {'--gesture-period': `${gesture.duration}s`, '--gesture-delay': `${gesture.delay}s`,
    '--gesture-tilt': `${gesture.tilt}deg`} as CSSProperties;
}

const leaves = officinaImageRegion({x: 696, y: 491, width: 81, height: 75});

export function OfficinaIdleScene({resting}: {resting: readonly OfficinaRole[]}) {
  return <div className="officina-idle-scene" aria-hidden="true">
    <span className="officina-ambient-lamp" data-lamp="wall"/>
    <span className="officina-ambient-lamp" data-lamp="lounge"/>
    <span className="officina-ambient-leaves" style={leaves}/>
    <div className="officina-gestures">
      {seats.map(({role, head, hand, gesture}) => <span key={role} data-seated-gesture={role} style={gestureTiming(gesture)}>
        <i className="officina-gesture-hands" style={gestureRegion(hand, 44, 36)}/>
        <i className="officina-gesture-head" style={gestureRegion(head, 66, 72)}/>
      </span>)}
    </div>
    {seats.filter(seat => resting.includes(seat.role)).map(({role, region, duration, delay, head, gesture}) =>
      <div key={role} className="officina-idle-seat" data-role={role} data-action={officinaIdleRoutines[role].id}
        style={{...officinaImageRegion(region), ...gestureTiming(gesture),
          '--officina-idle-period': `${duration}s`, '--officina-idle-delay': `${delay}s`,
          '--officina-pose-head-x': percent(head[0] - region.x, region.width),
          '--officina-pose-head-y': percent(head[1] - region.y, region.height)} as CSSProperties}>
        <span className="officina-idle-frame officina-idle-frame--transition"/>
        {role !== 'developer' && <span className="officina-idle-frame officina-idle-frame--rest"/>}
        <span className="officina-idle-frame officina-idle-frame--coffee" data-coffee={role}/>
      </div>)}
  </div>;
}
