import React, {useState} from 'react';
import {
  OfficinaActor, officinaActorName, officinaRoleNameLimit, officinaRolePromptLimit,
  type OfficinaAction, type OfficinaProject, type OfficinaRoleProfile,
} from '../shared/companion-officina';
import {officinaOutputInstructions, officinaRoleInstructions, officinaRoleProfile, officinaTurnProtocol} from '../shared/officina-instructions';

type ProfileAction = Extract<OfficinaAction, {type: 'role-profile'}>;

export function OfficinaRoleSettings({project, initialRole, act}: {
  project?: OfficinaProject; initialRole: OfficinaActor; act: (action: ProfileAction) => Promise<boolean>;
}) {
  const [role, setRole] = useState(initialRole);
  const [drafts, setDrafts] = useState<Partial<Record<OfficinaActor, OfficinaRoleProfile>>>({});
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const saved = officinaRoleProfile(role, project);
  const draft = drafts[role] ?? saved;
  const changed = draft.name.trim() !== saved.name || draft.prompt.trim() !== saved.prompt;

  function edit(fields: Partial<OfficinaRoleProfile>) {
    setNotice('');
    setDrafts({...drafts, [role]: {...draft, ...fields}});
  }

  async function save(profile: OfficinaRoleProfile | null) {
    if (!project) return;
    setSaving(true);
    try {
      if (!await act({type: 'role-profile', project: project.id, role, profile})) return;
      setDrafts(previous => {
        const next = {...previous};
        delete next[role];
        return next;
      });
      setNotice(profile ? 'Cambios guardados.' : 'Perfil predeterminado restaurado.');
    } finally {
      setSaving(false);
    }
  }

  return <form className="officina-form officina-role-settings" onSubmit={event => {
    event.preventDefault();
    void save(draft);
  }}>
    <p>{project ? role === 'observer' ? `${project.name} · Las instrucciones se aplican a las próximas revisiones de ZEN.` :
      `${project.name} · El nombre se usa en Officina y las instrucciones se aplican a los próximos encargos.` :
      'Selecciona un proyecto para personalizar los puestos.'}</p>
    <div className="officina-role-settings-fields">
      <label>Puesto<select aria-label="Puesto" value={role} disabled={saving} onChange={event => {
        setRole(OfficinaActor.parse(event.target.value));
        setNotice('');
      }} data-hold-island-open>
        {OfficinaActor.options.map(actor => <option key={actor} value={actor}>{officinaActorName(actor, project)}</option>)}
      </select></label>
      <label>Nombre visible<input value={draft.name} required maxLength={officinaRoleNameLimit} readOnly={!project || saving || role === 'observer'}
        onChange={event => edit({name: event.target.value})} data-hold-island-open/></label>
    </div>
    <label>Instrucciones del puesto<textarea value={draft.prompt} required maxLength={officinaRolePromptLimit} rows={7}
      readOnly={!project || saving} onChange={event => edit({prompt: event.target.value})} data-hold-island-open/></label>
    <div className="officina-role-settings-actions">
      <button type="submit" className="officina-accent" disabled={!project || !changed || saving ||
        !draft.name.trim() || !draft.prompt.trim()}>Guardar cambios</button>
      <button type="button" disabled={!project || saving || (!project.profiles?.[role] && !changed)}
        onClick={() => void save(null)}>Restaurar perfil predeterminado</button>
      {notice && <small role="status">{notice}</small>}
    </div>
    <details>
      <summary>Reglas fijas y formato de las respuestas</summary>
      <p>{officinaRoleInstructions(role)}</p>
      <p>{officinaTurnProtocol(role)}</p>
      <p>{officinaOutputInstructions}</p>
    </details>
  </form>;
}
