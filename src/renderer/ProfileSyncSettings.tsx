import React, {useEffect, useRef, useState} from 'react';
import type {ProfileSyncAction, ProfileSyncStatus} from '../shared/profile-sync';
import {PreferenceRow} from './PreferencesControls';

export function ProfileSyncSettings({disabled, onApplied}: {disabled: boolean; onApplied: () => void}) {
  const [status, setStatus] = useState<ProfileSyncStatus>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{error?: boolean; text: string}>();
  const input = useRef<HTMLInputElement>(null);
  const actionRunning = useRef(false);

  useEffect(() => {
    if (disabled) {setStatus(undefined); setMessage(undefined); return;}
    let active = true;
    const refresh = async () => {
      try {
        const reply = await window.companion.profileSync({type: 'status'});
        if (active && !actionRunning.current && reply.ok) setStatus(reply.value);
      } catch {}
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 12_000);
    return () => {active = false; clearInterval(timer);};
  }, [disabled]);

  async function run(action: ProfileSyncAction) {
    if (disabled || actionRunning.current) return;
    actionRunning.current = true;
    setBusy(true);
    setMessage(undefined);
    try {
      const reply = await window.companion.profileSync(action);
      if (!reply.ok) {setMessage({error: true, text: reply.error}); return;}
      setStatus(reply.value);
      if (reply.value.error) return;
      if (action.type === 'copyCode') setMessage({text: 'Código copiado. Pégalo en el otro ZEN o guárdalo en tu gestor de contraseñas.'});
      if (reply.value.linked && ['join', 'resolve', 'sync'].includes(action.type)) onApplied();
    } catch {
      setMessage({error: true, text: 'No se pudo completar la sincronización.'});
    } finally {
      actionRunning.current = false;
      setBusy(false);
    }
  }

  const locked = disabled || busy || !status;
  return <section className="settings-backup" aria-labelledby="profile-sync-title">
    <h3 id="profile-sync-title">Sincronización entre equipos</h3>
    {disabled ? <p>Desactiva Pausa o Presentación para vincular equipos.</p> : <>
      {status?.linked ? <>
        <PreferenceRow title="Perfil vinculado" description={status.lastSync
          ? 'Última revisión local a las ' + new Date(status.lastSync).toLocaleTimeString('es-ES', {hour: '2-digit', minute: '2-digit'}) +
            ' · ' + status.peers + ' equipos adicionales con datos.'
          : 'ZEN revisará los archivos de sincronización.'}>
          <button type="button" onClick={() => void run({type: 'sync'})} disabled={locked}>Sincronizar ahora</button>
        </PreferenceRow>
        <PreferenceRow title="Otro equipo">
          <button type="button" onClick={() => void run({type: 'copyCode'})} disabled={locked}>Copiar código</button>
        </PreferenceRow>
        <PreferenceRow title="Bóveda de contraseñas" description="Comparte la bóveda cifrada. ZEN combina cambios al desbloquearla con tu maestra o con Windows Hello de este equipo.">
          <button type="button" onClick={() => void run({type: 'vault', enabled: !status.vault})} disabled={locked}>
            {status.vault ? 'Pausar bóveda' : 'Sincronizar bóveda'}
          </button>
        </PreferenceRow>
        {status.vaultError && <p role="alert">{status.vaultError}</p>}
        {status.conflicts.map(conflict => <div key={conflict.record}>
          <p><strong>{conflict.label}</strong> · Hay versiones simultáneas</p>
          {conflict.choices.map(choice => <PreferenceRow key={choice.id} title={choice.device} description={choice.preview}>
            <button type="button" onClick={() => void run({type: 'resolve', record: conflict.record, candidate: choice.id})}
              disabled={locked}>Usar versión</button>
          </PreferenceRow>)}
        </div>)}
        <PreferenceRow title="Desvincular este equipo" description="Conserva los datos locales y deja de intercambiar cambios.">
          <button type="button" onClick={() => void run({type: 'disconnect'})} disabled={locked}>Desvincular</button>
        </PreferenceRow>
      </> : <>
        <PreferenceRow title="Primer equipo" description="Comparte la apariencia, las preferencias portables, la biblioteca y los templates en una carpeta de Syncthing.">
          <button type="button" onClick={() => void run({type: 'create'})} disabled={locked}>Crear perfil compartido</button>
        </PreferenceRow>
        <form onSubmit={event => {
          event.preventDefault();
          const code = input.current?.value ?? '';
          if (input.current) input.current.value = '';
          void run({type: 'join', code});
        }}>
          <PreferenceRow title="Código de otro equipo" controlId="profile-sync-code">
            <input id="profile-sync-code" ref={input} type="password" autoComplete="off" spellCheck={false}
              pattern="[0-9A-Fa-f]{64}" maxLength={64} required disabled={locked}/>
            <button type="submit" disabled={locked}>Vincular</button>
          </PreferenceRow>
        </form>
      </>}
      {status?.error && <p role="alert">{status.error}</p>}
      {message && <p role={message.error ? 'alert' : 'status'}>{message.text}</p>}
    </>}
  </section>;
}
