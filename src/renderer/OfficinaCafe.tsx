import {officinaImageRegion} from './OfficinaIdleScene';
import './OfficinaCafe.css';

const counter = officinaImageRegion(
  {x: 775, y: 172, width: 136, height: 162},
  {x: 405, y: 66, width: 94, height: 112},
);

export function OfficinaCafe() {
  return <span className="officina-cafe-counter" aria-hidden="true" style={counter}/>;
}
