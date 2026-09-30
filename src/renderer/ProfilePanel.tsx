import React, { useEffect, useState } from 'react';
import { ProfileSchema, type Profile, type Memory } from '../shared/personal';
const fields: Record<Memory['field'], string> = { name: 'Nombre', language: 'Idioma', professional: 'Contexto profesional', goals: 'Objetivos', projects: 'Proyectos', communication: 'Comunicación', restrictions: 'Restricciones' };
export function ProfilePanel({ notify }: { notify: (text: string) => void }) {
  const [profile, setProfile] = useState<Profile>([]);
  const [draft, setDraft] = useState(''); const [query, setQuery] = useState(''); const [preview, setPreview] = useState(false);
  const [field, setField] = useState<Memory['field']>('goals'); const [kind, setKind] = useState<Memory['kind']>('fact');
  useEffect(() => { void window.zen.profile().then(result => { if (result.ok) setProfile(result.value); else notify(result.error); }); }, []);
  const save = async (next: Profile) => {
    const result = await window.zen.saveProfile(next);
    if (result.ok) { setProfile(result.value); notify('Perfil guardado localmente.'); } else notify(result.error);
  };
  const correct = (id: string) => save(profile.map(row => row.id === id ? { ...row, updatedAt: new Date().toISOString(), source: 'Corrección explícita del usuario' } : row));
  const importFile = async (file?: File) => {
    if (!file) return;
    if (file.size > 128000) { notify('Archivo demasiado grande (máximo 128 KB).'); return; }
    const text = await file.text();
    if (file.name.endsWith('.json')) {
      try { setDraft(JSON.stringify(ProfileSchema.parse(JSON.parse(text)), null, 2)); setPreview(true); }
      catch { notify('JSON de perfil inválido.'); }
    } else { setDraft(text.slice(0, 4000)); setPreview(false); }
  };
  const commit = async () => {
    let imported: Profile;
    try { imported = ProfileSchema.parse(JSON.parse(draft)); }
    catch { imported = [{ id: crypto.randomUUID(), field, kind, content: draft, source: 'Importación explícita del usuario', updatedAt: new Date().toISOString() }]; }
    await save([...profile, ...imported.map(item => ({ ...item, id: crypto.randomUUID() }))]);
    setPreview(false); setDraft('');
  };
  const exportProfile = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(profile, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'zen-profile.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <details className="advanced">
    <summary>Tu perfil y memoria</summary>
    <p className="support">Empieza vacío. Solo guarda información que tú añadas; no importa memoria de ChatGPT. Revisa y corrige antes de guardar.</p>
    <label>Buscar<input value={query} onChange={e => setQuery(e.target.value)} /></label>
    {profile.filter(item => `${fields[item.field]} ${item.content} ${item.source}`.toLowerCase().includes(query.toLowerCase())).map(item => <fieldset key={item.id}>
      <legend>{fields[item.field]} · {item.kind}</legend>
      <textarea aria-label={`Editar ${fields[item.field]}`} value={item.content} onChange={e => setProfile(previous => previous.map(row => row.id === item.id ? { ...row, content: e.target.value } : row))} />
      <p className="support">{item.source} · {new Date(item.updatedAt).toLocaleDateString('es-ES')}</p>
      <button onClick={() => void correct(item.id)}>Guardar corrección</button>
      <button onClick={() => void save(profile.filter(row => row.id !== item.id))}>Borrar dato</button>
    </fieldset>)}
    <label>Campo<select value={field} onChange={e => setField(e.target.value as Memory['field'])}>{Object.entries(fields).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label>Tipo<select value={kind} onChange={e => setKind(e.target.value as Memory['kind'])}><option value="fact">Hecho explícito</option><option value="preference">Preferencia</option><option value="tentative">Observación tentativa</option></select></label>
    <label>Resumen aportado por ti<textarea value={draft} maxLength={4000} onChange={e => { setDraft(e.target.value); setPreview(false); }} /></label>
    <label>Importar texto o JSON de perfil<input type="file" accept=".txt,.md,.json" onChange={e => void importFile(e.target.files?.[0])} /></label>
    <button disabled={!draft.trim()} onClick={() => setPreview(true)}>Revisar importación</button>
    {preview && <><p className="support">Vista previa editable. Guardar añade datos; no ejecuta instrucciones del archivo.</p><textarea aria-label="Vista previa editable" value={draft} onChange={e => setDraft(e.target.value)} /><button onClick={() => void commit()}>Guardar importación</button></>}
    <div className="card-actions"><button onClick={exportProfile}>Exportar perfil</button><button onClick={() => void save([])}>Borrar perfil completo</button></div>
  </details>;
}
