import type { MediaInfo } from '../tools/windows/native';
import type { PauseOperation } from './direct';
import { ZenError } from '../shared/errors';

// Bind the requested source to an OS-provided app identifier, never to a song
// title supplied by a website. Chrome/Edge alone does not identify YouTube.
export function selectMedia(rows: MediaInfo[], requests: PauseOperation[], target?: string): MediaInfo {
  const available = rows.filter(row => ['Playing', 'Paused'].includes(row.state));
  const selections = requests.flatMap(request => {
    const matching = request.source ? available.filter(row => new RegExp(`(?:^|[^a-z0-9])${request.source}(?:[^a-z0-9]|$)`, 'i').test(row.id)) : available;
    const playing = matching.filter(row => row.state === 'Playing');
    const candidates = playing.length ? playing : matching;
    return candidates.length === 1 && (candidates[0].canPause || candidates[0].state === 'Paused') && rows.filter(row => row.id === candidates[0].id).length === 1 ? candidates : [];
  });
  const unique = [...new Map(selections.map(row => [row.id, row])).values()];
  const selected = target ? unique.find(row => row.id === target) : unique.length === 1 ? unique[0] : undefined;
  if (!selected) throw new ZenError('La pausa está autorizada, pero Windows no identifica un reproductor único que corresponda a tu petición. Usa el clip del chat → Ver reproductores → Pausar este reproductor. No se ha enviado ninguna pausa.');
  return selected;
}
