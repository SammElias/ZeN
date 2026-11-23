import React, {useRef, useState, type ClipboardEvent, type FormEvent, type ReactNode} from 'react';
import {FileText, FolderOpen, Paperclip, Send, X} from 'lucide-react';
import {
  OfficinaParticipant, officinaActorName, officinaMessageLimit, officinaPasteLimit, officinaPasteTitle,
  type OfficinaAction, type OfficinaProject, type OfficinaView,
} from '../shared/companion-officina';

export function OfficinaComposer({project, context, act, ready, hidden, recipient, recipientIcon, selectRecipient}: {
  project?: OfficinaProject; context?: OfficinaView['context']; act: (action: OfficinaAction) => Promise<boolean>; ready: boolean;
  hidden?: boolean; recipient: OfficinaParticipant; recipientIcon: ReactNode; selectRecipient?: (role: OfficinaParticipant) => void;
}) {
  const requestId = useRef(crypto.randomUUID());
  const field = useRef<HTMLTextAreaElement>(null);
  const [message, setMessage] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [editingPaste, setEditingPaste] = useState(false);
  const [pasteError, setPasteError] = useState('');
  const folder = context?.folder ?? project?.folder;
  const files = context?.files ?? [];
  const name = officinaActorName(recipient, project);
  const destination = context?.folderProject ?? project?.name;
  const combinePaste = (value: string) => [pastedText, value].filter(part => part.trim()).join('\n\n');
  const limitMessage = 'El texto pegado admite hasta 32.000 caracteres. El borrador sigue disponible.';
  function paste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const incoming = event.clipboardData.getData('text/plain');
    const {value, selectionStart, selectionEnd} = event.currentTarget;
    const remaining = value.slice(0, selectionStart) + value.slice(selectionEnd);
    const total = remaining.length + incoming.length;
    setPasteError('');
    if (!incoming.trim() || total <= (editingPaste ? officinaPasteLimit : officinaMessageLimit)) return;
    event.preventDefault();
    const combined = editingPaste ? '' : combinePaste(incoming);
    if (editingPaste || combined.length > officinaPasteLimit) {
      setPasteError(limitMessage);
      return;
    }
    setMessage(remaining);
    setPastedText(combined);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget, fields = new FormData(form);
    const target = destination ?? String(fields.get('projectName') ?? '');
    const short = message.trim();
    const attachment = short.length > officinaMessageLimit ? combinePaste(message) : pastedText;
    if (attachment.length > officinaPasteLimit) {setPasteError(limitMessage); return;}
    if (!short && !attachment.trim()) return;
    if (!await act({type: 'chat', id: requestId.current, project: project?.id ?? null, role: recipient,
      name: target, message: short.length <= officinaMessageLimit ? short || undefined : undefined,
      pastedText: attachment.trim() ? attachment : undefined})) return;
    requestId.current = crypto.randomUUID();
    setMessage('');
    setPastedText('');
    setEditingPaste(false);
    setPasteError('');
    form.reset();
  }
  return <form className="officina-chat-compose" hidden={hidden} aria-label="Escribir en Chat global" onSubmit={submit}>
    <div className="officina-compose-context">
      <div className="officina-recipient" id="officina-recipient">{recipientIcon}
        {selectRecipient ? <label className="officina-chat-destination"><strong>Para</strong>
          <select aria-label="Destinatario del encargo" value={recipient} onChange={event => selectRecipient(OfficinaParticipant.parse(event.target.value))}>
            {OfficinaParticipant.options.map(role => <option value={role} key={role}>{officinaActorName(role, project)}</option>)}
          </select>
        </label> : <strong>Para {name}</strong>}
        {destination && <span title={destination}>· {destination}</span>}
      </div>
      {(folder || files.length > 0) && <div className="officina-context-items" role="group" aria-label="Contexto local del encargo">
      {folder && <span className="officina-context-item" title={folder.path}>
        <FolderOpen aria-hidden="true"/><span>{context?.folder ? 'Carpeta elegida' : 'Carpeta de trabajo'} · {folder.name}</span>
        {context?.folder && <button type="button" aria-label={`Quitar carpeta ${folder.name}`}
          onClick={() => void act({type: 'remove-context', id: folder.id})}><X aria-hidden="true"/></button>}
      </span>}
      {files.map(file => <span key={file.id} className="officina-context-item" title={file.path}>
        <Paperclip aria-hidden="true"/><span>{file.name}</span>
        <button type="button" aria-label={`Quitar ${file.name}`} onClick={() => void act({type: 'remove-context', id: file.id})}>
          <X aria-hidden="true"/>
        </button>
      </span>)}
      </div>}
    </div>
    {(pastedText.trim() || editingPaste) && <div className="officina-paste-card" role="group" aria-label="Texto pegado">
      <FileText aria-hidden="true"/>
      <strong title={officinaPasteTitle(pastedText)}>{officinaPasteTitle(pastedText)}</strong>
      <button type="button" aria-expanded={editingPaste} onClick={() => {
        setEditingPaste(!editingPaste);
        field.current?.focus();
      }}>{editingPaste ? 'Plegar texto' : 'Mostrar en el campo de texto'}</button>
      <button type="button" aria-label="Quitar texto pegado" onClick={() => {
        setPastedText('');
        setEditingPaste(false);
        setPasteError('');
      }}><X aria-hidden="true"/></button>
    </div>}
    {pasteError && <p className="officina-paste-error" role="alert">{pasteError}</p>}
    {!project && !context?.folder && ready && <input aria-label="Proyecto en Codex" required maxLength={120} name="projectName"
      placeholder="Nombre del proyecto" data-hold-island-open/>}
    <button type="button" title="Elegir carpeta de trabajo" aria-label="Elegir carpeta de trabajo" disabled={!ready}
      onClick={() => void act({type: 'pick-context', kind: 'folder'})}><FolderOpen aria-hidden="true"/></button>
    <button type="button" title="Adjuntar archivos" aria-label="Adjuntar archivos" disabled={!ready}
      onClick={() => void act({type: 'pick-context', kind: 'file'})}><Paperclip aria-hidden="true"/></button>
    <textarea ref={field} aria-label={editingPaste ? 'Editar texto pegado' : 'Objetivo'} aria-describedby="officina-recipient"
      required={!editingPaste && !pastedText.trim()} maxLength={officinaPasteLimit} rows={editingPaste ? 4 : 1}
      value={editingPaste ? pastedText : message} data-editing-paste={editingPaste || undefined}
      onChange={event => {
        setPasteError('');
        (editingPaste ? setPastedText : setMessage)(event.target.value);
      }} onPaste={paste} placeholder={editingPaste ? 'Edita el texto pegado' : 'Describe lo que quieres'}
      disabled={!ready} data-hold-island-open/>
    <button className="officina-accent" aria-label={`Enviar a ${name}`} type="submit" disabled={!ready}>
      <Send aria-hidden="true"/><span>Enviar</span>
    </button>
  </form>;
}
