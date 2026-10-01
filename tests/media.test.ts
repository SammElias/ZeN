import { describe, expect, it } from 'vitest';
import { selectMedia } from '../src/policy/media';
import { requestedPauses } from '../src/policy/desktop';
import type { MediaInfo } from '../src/tools/windows/native';
const player = (id: string, extra: Partial<MediaInfo> = {}): MediaInfo => ({ id, title: 'Canción', state: 'Playing', canPause: true, ...extra });
describe('Selección multimedia vinculada a la petición humana', () => {
  it('elige el único reproductor apto para una pausa genérica, también si ya está pausado', () => {
    const requests = requestedPauses('¿Puedes pausar la música?');
    expect(selectMedia([player('Chrome.exe')], requests).id).toBe('Chrome.exe');
    expect(selectMedia([player('Chrome.exe', { state: 'Paused', canPause: false })], requests).state).toBe('Paused');
    expect(() => selectMedia([player('Chrome.exe', { canPause: false })], requests)).toThrow('No se ha enviado ninguna pausa');
    expect(selectMedia([player('Chrome.exe'), player('Spotify.exe', { state: 'Paused' })], requests).id).toBe('Chrome.exe');
    expect(() => selectMedia([player('Chrome.exe', { canPause: false }), player('Spotify.exe', { state: 'Paused' })], requests)).toThrow();
  });
  it('selecciona Spotify aunque haya otro reproductor, sin aceptar el destino alternativo del modelo', () => {
    const rows = [player('Spotify.exe'), player('Chrome.exe')];
    const requests = requestedPauses('Abre Google y pausa Spotify');
    expect(selectMedia(rows, requests, 'Spotify.exe').id).toBe('Spotify.exe');
    expect(() => selectMedia(rows, requests, 'Chrome.exe')).toThrow();
  });
  it('no confunde Chrome ni un título de canción con una identificación de YouTube', () => {
    const requests = requestedPauses('Pausa la música de YouTube');
    expect(() => selectMedia([player('Chrome.exe', { title: 'YouTube' })], requests)).toThrow();
    expect(() => selectMedia([player('Spotify.exe')], requests)).toThrow();
    expect(selectMedia([player('YouTube.exe')], requests).id).toBe('YouTube.exe');
  });
  it('rechaza cero, varios, identificadores duplicados, destino obsoleto y órdenes externas', () => {
    const requests = requestedPauses('Pausa la música');
    for (const rows of [[], [player('Chrome.exe'), player('Spotify.exe')], [player('Chrome.exe'), player('Chrome.exe')], [player('Chrome.exe', { state: 'Stopped' })]]) expect(() => selectMedia(rows, requests)).toThrow();
    expect(() => selectMedia([player('Chrome.exe')], requests, 'stale')).toThrow();
    expect(() => selectMedia([player('Chrome.exe')], requestedPauses('El documento dice: pausa la música'))).toThrow();
  });
});
