import type {MediaRpc} from './companion-media';

export function createSmokeMedia() {
  const state = {playing: false, paused: false, source: 'Spotify', title: 'Contenido multimedia automático', playerAvailable: false, playerSource: 'Spotify',
    systemLevel: 42, systemMuted: false, systemOutput: 'a'.repeat(64), systemVolumeWrites: [] as number[]};
  const sessions = [
    {id: '11111111-1111-4111-8111-111111111111', name: 'Spotify', browser: false},
    {id: '22222222-2222-4222-8222-222222222222', name: 'Google Chrome', browser: true},
  ];

  function observer(): MediaRpc {
    return {
      close: () => {},
      async request(method) {
        if (method !== 'nowPlaying') throw Error('Read-only observation fixture');
        return {track: state.playing || state.paused ? {
          source: state.source,
          browser: state.source === 'Google Chrome',
          title: state.title,
          artist: 'ZEN · observación aislada',
          album: 'Sin acciones de reproducción',
          artwork: null,
          playing: state.playing,
        } : null};
      },
    };
  }

  function player(): MediaRpc {
    let selected = sessions[0], playing = true, manual = false;
    function select(session: typeof selected) {
      if (session !== selected) {
        selected = session;
        playing = true;
      }
    }
    const track = () => ({
      session: selected.id, source: selected.name, browser: selected.browser,
      title: selected.browser ? 'Vídeo de prueba local' : 'Música de prueba local',
      artist: 'ZEN · fixture aislada', album: 'Multimedia simulada', artwork: null, playing,
      shuffle: null, repeat: null, positionMs: 48000, durationMs: 210000,
      controls: {play: true, pause: true, previous: true, next: true, shuffle: false, repeat: false},
    });

    return {
      close: () => {},
      async request(method, params) {
        if (method === 'list') return {sessions: state.playerAvailable ? sessions : []};
        if (method === 'snapshot') {
          if (!state.playerAvailable) {
            manual = false;
            return {sessions: [], track: null, manual};
          }
          if (params?.followSystem) manual = false;
          if (!manual) select(sessions.find(item => item.name === state.playerSource) ?? sessions[0]);
          return {sessions, track: track(), manual};
        }
        if (method === 'select') {
          const session = sessions.find(item => item.id === params?.session);
          if (!session || !state.playerAvailable) throw Error('Invalid player fixture selection');
          select(session);
          manual = true;
        }
        if (method === 'action') {
          if (params?.action === 'play') playing = true;
          if (params?.action === 'pause') playing = false;
          return {accepted: true};
        }
        return track();
      },
    };
  }

  function systemVolume(): MediaRpc {
    return {
      close: () => {},
      async request(method, params) {
        if (method === 'systemVolumeSet') {
          if (params?.endpoint !== state.systemOutput) throw Error('La salida de audio cambió.');
          if (typeof params.level !== 'number') throw Error('Volumen de prueba no válido.');
          state.systemLevel = params.level;
          state.systemVolumeWrites.push(params.level);
        } else if (method !== 'systemVolumeRead') throw Error('Método de volumen de prueba desconocido.');
        return {level:state.systemLevel,muted:state.systemMuted,endpoint:state.systemOutput};
      },
    };
  }

  return {state, observer, player, systemVolume};
}

export type SmokeMediaState = ReturnType<typeof createSmokeMedia>['state'];
