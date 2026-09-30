import React, { useEffect, useState } from 'react';
import type { PublicSettings } from '../shared/contracts';
import { SettingsPanel } from './components';
import './capsule.css';

// Separate window, opened explicitly from the tray. Never part of the execution island.
export function Preferences() {
  const [config, setConfig] = useState<PublicSettings>();
  const [notice, setNotice] = useState('');
  const [locked, setLocked] = useState(false);
  useEffect(() => {
    void window.zen.settings().then(result => result.ok ? setConfig(result.value) : setNotice(result.error));
    void window.zen.tasks().then(result => { if (result.ok) setLocked(result.value.some(row => ['queued', 'thinking', 'executing', 'awaiting_approval'].includes(row.state))); });
    const off = window.zen.onTask(() => { void window.zen.tasks().then(result => { if (result.ok) setLocked(result.value.some(row => ['queued', 'thinking', 'executing', 'awaiting_approval'].includes(row.state))); }); });
    return off;
  }, []);
  return <main className="preferences-window" aria-label="Preferencias de ZEN"><header><strong>ZEN · Preferencias</strong><span>Acceso desde la bandeja de Windows</span></header>{notice && <p className="notice" role="status">{notice}</p>}{config ? <SettingsPanel config={config} update={setConfig} notify={setNotice} locked={locked} /> : <p className="support">Cargando preferencias…</p>}</main>;
}
