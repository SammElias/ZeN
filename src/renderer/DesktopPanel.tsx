import React, { useState } from 'react';
import type { WindowInfo, MediaInfo } from '../tools/windows/native';
export function DesktopPanel({ notify, attach, contextOnly = false }: { notify: (message: string) => void; attach: (id: string) => void; contextOnly?: boolean }) {
  const [windows, setWindows] = useState<WindowInfo[]>([]); const [selected, setSelected] = useState('');
  const [media, setMedia] = useState<MediaInfo[]>([]); const [observation, setObservation] = useState<{ observationId: string; text?: string; image?: string }>();
  const [capturing, setCapturing] = useState(false);
  const [apps, setApps] = useState<{ id: string }[]>([]); const [url, setUrl] = useState('');
  const [destination, setDestination] = useState<{ grantId: string; label: string }>(); const [name, setName] = useState(''); const [content, setContent] = useState(''); const [kind, setKind] = useState<'create-folder' | 'create-file'>('create-folder');
  const observe = async (capture: boolean) => {
    setCapturing(true); setObservation(undefined);
    try { const result = await window.zen.observe({ id: selected, capture }); if (result.ok) setObservation(result.value); else notify(result.error); }
    finally { setCapturing(false); }
  };
  return <details className="advanced" open={contextOnly}><summary>{contextOnly ? 'Contexto para la petición' : 'Observar ventana y controlar medios'}</summary>
    {contextOnly && <><button onClick={async () => { const result = await window.zen.chooseDirectory(); if (result.ok && result.value) { setDestination(result.value); notify(`Carpeta autorizada: ${result.value.label}`); } else if (!result.ok) notify(result.error); }}>Elegir carpeta de destino</button>{destination && <p className="support">{destination.label}</p>}</>}
    {!contextOnly && <>
    <label>Página a abrir<input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" /></label><button disabled={!url} onClick={async () => { const result = await window.zen.openPage(url); notify(result.ok ? `Página cargada y verificada: ${result.value.url}` : result.error); }}>Abrir página</button>
    <button onClick={async () => { const result = await window.zen.openFile(); notify(result.ok ? result.value.selected ? `Archivo abierto y verificado: ${result.value.name}` : 'Selección cancelada.' : result.error); }}>Elegir y abrir archivo</button>
    <button onClick={async () => { const result = await window.zen.apps(); if (result.ok) setApps(result.value); else notify(result.error); }}>Ver aplicaciones instaladas</button>
    {apps.map(app => <button key={app.id} onClick={async () => { const result = await window.zen.openApp(app.id); notify(result.ok ? `Ventana verificada: ${app.id}` : result.error); }}>Abrir {app.id}</button>)}
    <p>Crear con revisión</p><button onClick={async () => { const result = await window.zen.chooseDirectory(); if (result.ok && result.value) setDestination(result.value); else if (!result.ok) notify(result.error); }}>Elegir carpeta de destino</button>{destination && <p className="support">{destination.label}</p>}
    <select aria-label="Tipo de creación" value={kind} onChange={e => setKind(e.target.value as typeof kind)}><option value="create-folder">Carpeta nueva</option><option value="create-file">Archivo de texto nuevo</option></select><label>Nombre<input value={name} onChange={e => setName(e.target.value)} /></label>{kind === 'create-file' && <label>Contenido<textarea maxLength={16000} value={content} onChange={e => setContent(e.target.value)} /></label>}<button disabled={!destination || !name} onClick={async () => { if (!destination) return; const result = await window.zen.prepare({ grantId: destination.grantId, kind, name, content: kind === 'create-file' ? content : '' }); if (!result.ok) notify(result.error); }}>Preparar y revisar creación</button>
    </>}
    <p className="support">Elige una ventana y revisa su contenido antes de adjuntarlo a tu petición.</p>
    <button onClick={async () => { const result = await window.zen.windows(); if (result.ok) { setWindows(result.value); setSelected(''); setObservation(undefined); } else notify(result.error); }}>Elegir ventana</button>
    <select aria-label="Ventana para observar" value={selected} onChange={e => { setSelected(e.target.value); setObservation(undefined); }}><option value="">Selecciona…</option>{windows.map(row => <option key={row.id} value={row.id}>{row.title}{row.foreground ? ' (activa)' : ''}</option>)}</select>
    <div className="card-actions"><button disabled={!selected || capturing} onClick={() => void observe(false)}>Leer texto accesible</button><button disabled={!selected || capturing} onClick={() => void observe(true)}>Capturar esta ventana</button></div>
    {capturing && <p role="status">Observando la ventana elegida… Usa Detener para cancelar.</p>}
    {observation && <><p className="support">Vista previa: revisa información sensible antes de adjuntar.</p>{observation.image ? <img className="capture-preview" src={observation.image} alt="Captura de la ventana elegida" /> : <p className="result-text">{observation.text || 'No hay texto accesible. Puedes probar una captura explícita.'}</p>}<button onClick={() => { attach(observation.observationId); setObservation(undefined); }}>Adjuntar a la siguiente petición</button><button onClick={() => setObservation(undefined)}>Descartar vista previa</button></>}
    <button onClick={async () => { const result = await window.zen.media(); if (result.ok) setMedia(result.value); else notify(result.error); }}>Ver reproductores</button>
    {media.map(row => <div key={row.id}><p>{row.title || row.id} · {row.state}</p><p className="support">{row.id}</p><button disabled={!row.canPause && row.state !== 'Paused'} onClick={async () => { const result = await window.zen.pauseMedia(row.id); if (result.ok) setMedia(prior => prior.map(item => item.id === row.id ? { ...item, state: 'Paused' } : item)); notify(result.ok ? result.value.alreadyPaused ? 'El reproductor ya estaba pausado. Estado verificado.' : 'Reproductor pausado. Estado verificado.' : result.error); }}>Pausar este reproductor</button></div>)}
    {!media.length && <p className="support">Solo aparecen sesiones multimedia registradas en Windows.</p>}
  </details>;
}
