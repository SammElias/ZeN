import React,{useEffect,useRef,useState} from 'react';
import type {SystemVolumeAction,SystemVolumeState} from '../shared/companion-media';
import {CompanionIcon} from './CompanionActions';

export function SystemVolumeSlider() {
  const [volume, setVolume] = useState<SystemVolumeState>();
  const [message, setMessage] = useState('Consultando volumen…');
  const change = useRef<(level: number) => void>(undefined);

  useEffect(() => {
    let active = true;
    let pending = false;
    let current: SystemVolumeState | undefined;
    let queued: Extract<SystemVolumeAction,{type:'set'}> | undefined;

    function nextAction(): SystemVolumeAction {
      const next = queued;
      queued = undefined;
      return next ?? {type:'read'};
    }

    async function sync() {
      if (!active || pending || document.hidden) return;
      pending = true;
      try {
        do {
          const result = await window.companion.systemVolume(nextAction());
          if (!active || document.hidden) return;
          if (!result.ok) throw Error(result.error);
          current = result.value;
          if (queued && queued.endpoint !== current.endpoint) queued = undefined;
          if (!queued) setVolume(current);
          setMessage('');
        } while (queued);
      } catch (error) {
        queued = current = undefined;
        if (active && !document.hidden) {
          setVolume(undefined);
          setMessage(error instanceof Error ? error.message : 'Volumen de Windows no disponible.');
        }
      } finally {
        pending = false;
      }
    }

    change.current = level => {
      if (!current || document.hidden) return;
      queued = {type:'set',endpoint:current.endpoint,level};
      setVolume({...current,level});
      void sync();
    };
    void sync();
    const timer = setInterval(() => void sync(), 1500);
    return () => {
      active = false;
      change.current = undefined;
      clearInterval(timer);
    };
  }, []);

  return <section className="music-system-volume" aria-labelledby="system-volume-label">
    <div className="music-system-volume-heading">
      <CompanionIcon name="sound"/>
      <label id="system-volume-label" htmlFor="system-volume">Volumen del sistema</label>
      <output htmlFor="system-volume" aria-live="off">{volume ? `${volume.level} %` : '—'}</output>
    </div>
    <input id="system-volume" type="range" min={0} max={100} step={1} value={volume?.level ?? 0}
      disabled={!volume} aria-valuetext={volume ? `${volume.level} %` : undefined}
      aria-describedby={message || volume?.muted ? 'system-volume-status' : undefined}
      onChange={event => change.current?.(event.currentTarget.valueAsNumber)}/>
    {(message || volume?.muted) && <p id="system-volume-status" role="status">{message || 'Silenciado en Windows'}</p>}
  </section>;
}
