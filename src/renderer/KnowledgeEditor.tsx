import React, {useState} from 'react';
import {ArrowLeft, ArrowUpRight, Check, Code2, Copy, Download, FilePlus2, ImagePlus, List, ListChecks, Pencil, Sparkles, Star, Table, Trash2, Undo2} from 'lucide-react';
import {noteLimits} from '../shared/companion-notes';
import {languages, singularLabels, technicalTemplate, variables, type HubData, type HubDraft, type HubEntry, type HubFields} from '../shared/knowledge-hub';
import {formatNoteMarkdown} from './note-markdown';
import {KnowledgeCode} from './KnowledgeCode';
import {MarkdownPreview} from './MarkdownPreview';

const dateLabel = new Intl.DateTimeFormat('es', {day:'numeric', month:'short', year:'numeric'});
const statusLabels = {planned:'Planeado', active:'En curso', done:'Completado', paused:'En pausa'};
type Props = {
  data: HubData; draft: HubDraft; saved?: HubEntry; mode: 'read' | 'edit' | 'preview';
  busy: boolean; dirty: boolean; valid: boolean; backup: boolean;
  back: () => void;
  update: (patch: Partial<HubFields>) => void; setMode: (mode: Props['mode']) => void; save: () => void;
  favorite: () => void; duplicate: () => void; remove: () => void; exportMarkdown: () => void;
  attach: () => void; copy: (values: Record<string, string>) => void; openUrl: (url: string) => void;
  openEntry: (entry: HubEntry) => void;
};
const renderCode = (text: string, language: string) => <KnowledgeCode text={text} language={language}/>;
const tagsFrom = (value: string) => [...new Set(value.split(',').map(item => item.trim().slice(0,48)).filter(Boolean))].slice(0,16);

export function KnowledgeEditor(props: Props) {
  const {data, draft, saved, mode, busy, dirty, valid, backup, update, setMode, save} = props;
  const fields = draft.fields;
  const {kind, title, description, code, related, images, tags, language} = fields;
  const isPrompt = kind === 'prompt';
  const [beforeFormat, setBeforeFormat] = useState<string>();
  const [substitutions, setSubstitutions] = useState<Record<string,string>>({});
  const reading = mode !== 'edit';
  const codeKeys = kind === 'note' ? [] : variables(code).slice(0,32);
  const relatedEntries = data.entries.filter(item => kind === 'project'
    ? ['note','snippet','resource'].includes(item.kind) : kind === 'resource' && item.kind === 'note');
  const references = relatedEntries.filter(item => related.includes(item.id));
  const folder = data.folders.find(item => item.id === fields.folderId);
  const folderField = <label>Carpeta<select value={fields.folderId ?? ''} onChange={event => update({folderId:event.target.value || null})}>
    <option value="">Sin carpeta</option>{data.folders.map(item => <option key={item.id} value={item.id}>
      {item.name}{item.group==='technology'?' · Tecnología':item.group==='ai'?' · IA':''}
    </option>)}
  </select></label>;
  const tagsField = <label>Etiquetas<input defaultValue={tags.join(', ')}
    placeholder="mcp, arquitectura" maxLength={850} onChange={event => update({tags:tagsFrom(event.target.value)})}/></label>;

  function format() {
    const formatted = formatNoteMarkdown(description);
    if (formatted.length > noteLimits.description) return;
    if (formatted !== description) {
      setBeforeFormat(description);
      update({description:formatted});
    }
    setMode('preview');
  }

  function insert(value: string) {
    const area = document.getElementById('notes-description') as HTMLTextAreaElement | null;
    if (!area) return;
    const start = area.selectionStart;
    const end = area.selectionEnd;
    const changed = description.slice(0,start) + value + description.slice(end);
    if (changed.length > noteLimits.description) return;
    update({description:changed});
    setBeforeFormat(undefined);
    requestAnimationFrame(() => {
      area.focus();
      area.setSelectionRange(start+value.length,start+value.length);
    });
  }

  return <form className="notes-editor hub-paper" onSubmit={event => {event.preventDefault(); if (valid && dirty && !busy) save();}}>
    <header className="notes-editor-heading">
      <div>
        <span className="hub-breadcrumb">{folder?.name ?? 'Biblioteca'} <span aria-hidden="true">/</span> {singularLabels[kind]}</span>
        <h2>{title.trim() || 'Nuevo ' + singularLabels[kind].toLowerCase()}</h2>
        {saved && reading && <p className="hub-dates">
          Creado el {dateLabel.format(saved.createdAt)} · Editado el {dateLabel.format(saved.updatedAt)}
        </p>}
      </div>
      <div className="hub-tools">
        <button type="button" className="hub-reader-back" aria-label="Volver a la lista" title="Volver a la lista" onClick={props.back}><ArrowLeft size={16}/></button>
        {saved && <button type="button" title="Favorito" aria-label="Favorito" aria-pressed={saved.favorite}
          disabled={busy || dirty} onClick={props.favorite}><Star size={16} fill={saved.favorite?'currentColor':'none'}/></button>}
        <button type="button" onClick={() => setMode(reading?'edit':'preview')} disabled={busy}>
          {reading?<Pencil size={15}/>:<Code2 size={15}/>} {reading?'Editar':isPrompt?'Vista previa':'Vista Markdown'}
        </button>
        {saved && <details className="hub-menu">
          <summary aria-label="Acciones del elemento" title="Acciones del elemento">···</summary>
          <div>
            <button type="button" disabled={busy || dirty} onClick={props.duplicate}><Copy size={15}/>Duplicar</button>
            <button type="button" disabled={busy || dirty} onClick={props.exportMarkdown}><Download size={15}/>Exportar Markdown</button>
            <button type="button" disabled={busy || dirty} onClick={props.remove}><Trash2 size={15}/>Eliminar</button>
          </div>
        </details>}
      </div>
    </header>

    {reading ? <div className="hub-document" data-kind={kind}>
      {tags.length > 0 && <div className="hub-tags">{tags.map(tag => <span key={tag}>{tag}</span>)}</div>}
      {kind === 'project' && <p className="hub-meta"><strong>{statusLabels[fields.status]}</strong>{fields.technologies.length>0 && ' · '+fields.technologies.join(' · ')}</p>}
      {kind === 'prompt' && fields.model && <p className="hub-meta">{fields.model}</p>}
      {description.trim() && <MarkdownPreview text={description} className="notes-markdown" open={props.openUrl} renderCode={renderCode}/>}
      {kind === 'resource' && fields.url && <button type="button" className="hub-resource" onClick={() => props.openUrl(fields.url)}>
        <ArrowUpRight size={16}/><span>{fields.url}</span>
      </button>}
      {code.trim() && <>
        <div className="notes-code-heading">
          <strong>{kind === 'prompt'?'Prompt':language || 'Comandos o código'}</strong>
          <button type="button" disabled={busy || kind!=='note' && (!saved || dirty)} onClick={() => {
            props.copy(Object.fromEntries(codeKeys.filter(key => Object.hasOwn(substitutions,key)).map(key => [key,substitutions[key]])));
          }}><Copy size={15}/>Copiar</button>
        </div>
        <pre className="notes-code-preview" tabIndex={0}><KnowledgeCode text={code} language={language}/></pre>
        {codeKeys.length>0 && <div className="hub-fields">{codeKeys.map(key => <label key={key}>{key}
          <input value={substitutions[key] ?? ''} maxLength={1024} placeholder={'{{'+key+'}}'}
            onChange={event => {
              const value = event.target.value;
              setSubstitutions(current => {
                const next = {...current};
                if (value) next[key] = value;
                else delete next[key];
                return next;
              });
            }}/>
        </label>)}</div>}
      </>}
      {([['Explicación',fields.explanation], ['Requisitos',fields.requirements], ['Advertencias',fields.warnings], ['Ejemplo',fields.example]] as const)
        .filter(([,value]) => value.trim()).map(([label,value]) => <section className="hub-detail" key={label}>
          <h3>{label}</h3><MarkdownPreview text={value} className="notes-markdown" open={props.openUrl} renderCode={renderCode}/>
        </section>)}
      {images.length>0 && <div className="hub-images">{images.map(image => <figure key={image.id}>
        <img src={image.data} alt={image.name}/><figcaption>{image.name}</figcaption>
      </figure>)}</div>}
      {references.length>0 && <section className="hub-detail">
        <h3>Elementos relacionados</h3>
        <div className="hub-related">{references.map(item => <button type="button" key={item.id}
          onClick={() => props.openEntry(item)}>{item.title}<ArrowUpRight size={14}/></button>)}</div>
      </section>}
      {dirty && beforeFormat !== undefined && <button type="button" className="hub-undo" onClick={() => {
        update({description:beforeFormat});setBeforeFormat(undefined);setMode('edit');
      }}><Undo2 size={15}/>Deshacer formato</button>}
    </div> : <fieldset className="hub-edit" data-kind={kind} disabled={busy}>
      <div className="hub-fields">
        <label htmlFor="notes-title-field">Título<input id="notes-title-field" required maxLength={noteLimits.title}
          value={title} placeholder="Título del elemento" onChange={event => update({title:event.target.value})}/></label>
        {!isPrompt && folderField}
      </div>
      {isPrompt ? <>
        <div className="notes-code-heading">
          <label className="hub-field" htmlFor="notes-code">Contenido del prompt</label>
          <button type="button" disabled={!code.trim()} onClick={()=>props.copy({})}><Copy size={15}/>Copiar</button>
        </div>
        <textarea id="notes-code" className="notes-code" rows={7} spellCheck={false} required
          maxLength={noteLimits.code} value={code} placeholder="Escribe o pega aquí el prompt"
          onChange={event => update({code:event.target.value})}/>
        <details className="hub-details">
          <summary>Datos opcionales</summary>
          <label className="hub-field">Objetivo<textarea rows={2} maxLength={noteLimits.description} value={description}
            onChange={event => update({description:event.target.value})}/></label>
          <div className="hub-fields">
            {tagsField}
            <label>Modelo o proveedor<input maxLength={160} value={fields.model}
              onChange={event => update({model:event.target.value})}/></label>
            {folderField}
          </div>
          <label className="hub-field">Ejemplo de salida<textarea rows={3} maxLength={4000} value={fields.example}
            onChange={event => update({example:event.target.value})}/></label>
        </details>
      </> : <>
      <label className="hub-field" htmlFor="notes-description">{kind==='project'?'Descripción y documentación':'Descripción'}</label>
      <div className="hub-markdown-tools" aria-label="Herramientas Markdown">
        <button type="button" onClick={() => insert('\n# Título\n')}>H1</button>
        <button type="button" onClick={() => insert('\n## Subtítulo\n')}>H2</button>
        <button type="button" onClick={() => insert('\n### Sección\n')}>H3</button>
        <button type="button" aria-label="Insertar lista" title="Lista" onClick={() => insert('\n- ')}><List size={16}/></button>
        <button type="button" aria-label="Insertar checklist" title="Checklist" onClick={() => insert('\n- [ ] ')}><ListChecks size={16}/></button>
        <button type="button" aria-label="Insertar tabla" title="Tabla" onClick={() => insert('\n| Campo | Detalle |\n| --- | --- |\n| | |\n')}><Table size={16}/></button>
        <button type="button" aria-label="Insertar bloque de código" title="Bloque de código" onClick={() => insert('\n```\n\n```\n')}><Code2 size={16}/></button>
        <button type="button" aria-label="Insertar enlace" title="Enlace" onClick={() => insert('[Texto](https://)')}><ArrowUpRight size={16}/></button>
        {kind==='note' && <button type="button" aria-label="Insertar plantilla técnica" title="Plantilla técnica"
          onClick={() => insert('\n'+technicalTemplate)}><FilePlus2 size={16}/></button>}
        <button className="notes-format" type="button" disabled={!description.trim()} onClick={format}><Sparkles size={15}/>Dar formato</button>
      </div>
      <textarea id="notes-description" rows={kind==='note'||kind==='project'?7:3} required={kind==='note'}
        maxLength={noteLimits.description} value={description} placeholder="Escribe en Markdown…"
        onChange={event => {update({description:event.target.value});setBeforeFormat(undefined);}}/>
      {kind !== 'resource' && kind !== 'project' && <>
        <div className="notes-code-heading">
          <label htmlFor="notes-code">Comandos o código</label>
          <div className="hub-tools"><select aria-label="Lenguaje" value={language} onChange={event => update({language:event.target.value as HubFields['language']})}>
            <option value="">Texto plano</option>{languages.map(value => <option key={value}>{value}</option>)}
          </select><button type="button" disabled={!code.trim()} onClick={()=>props.copy({})}><Copy size={15}/>Copiar</button></div>
        </div>
        <textarea id="notes-code" className="notes-code" rows={4} spellCheck={false} maxLength={noteLimits.code}
          required={kind!=='note'} value={code} placeholder={kind==='note'?'Fragmento opcional':'Usa {{VARIABLE}} para valores reemplazables'}
          onChange={event => update({code:event.target.value})}/>
      </>}
      <div className="hub-fields">
        {tagsField}
        {kind==='resource' && <label>URL<input type="url" required maxLength={2048} value={fields.url}
          onChange={event => update({url:event.target.value})}/></label>}
        {kind==='project' && <>
          <label>Tecnologías<input defaultValue={fields.technologies.join(', ')} maxLength={850} placeholder="Python, Azure AI"
            onChange={event => update({technologies:tagsFrom(event.target.value)})}/></label>
          <label>Estado<select value={fields.status} onChange={event => update({status:event.target.value as HubFields['status']})}>
            {Object.entries(statusLabels).map(([value,label]) => <option value={value} key={value}>{label}</option>)}
          </select></label>
        </>}
      </div>
      {kind==='snippet' && <details className="hub-details">
        <summary>Explicación, requisitos y advertencias</summary>
        <div className="hub-fields">{([['explanation','Explicación'], ['requirements','Requisitos'], ['warnings','Advertencias'], ['example','Ejemplo de uso']] as const)
          .map(([key,label]) => <label key={key}>{label}<textarea rows={3} maxLength={4000} value={fields[key]}
            onChange={event => update({[key]:event.target.value})}/></label>)}</div>
      </details>}
      {(kind==='project'||kind==='resource') && <details className="hub-details" open={related.length>0 || undefined}>
        <summary>Elementos relacionados {related.length>0 && '('+related.length+')'}</summary>
        {relatedEntries.length===0 ? <p>No hay elementos disponibles para vincular.</p> : <div className="hub-related-options">
          {relatedEntries.map(item => <label key={item.id}><input type="checkbox" checked={related.includes(item.id)}
            disabled={!related.includes(item.id) && related.length>=100}
            onChange={event => update({related:event.target.checked?[...related,item.id]:related.filter(id=>id!==item.id)})}/>
            {item.title} <small>{singularLabels[item.kind]}</small>
          </label>)}
        </div>}
      </details>}
      {kind==='note' && <div className="hub-attachments">
        <button type="button" disabled={images.length>=4} onClick={props.attach}><ImagePlus size={16}/>Adjuntar imagen</button>
        {images.map(image => <div key={image.id}><span>{image.name}</span>
          <button type="button" aria-label={'Quitar '+image.name} onClick={() => update({images:images.filter(item=>item.id!==image.id)})}><Trash2 size={14}/></button>
        </div>)}
      </div>}
      </>}
    </fieldset>}
    {(mode!=='read' || dirty) && <footer className="hub-save">
      <span role="status">{busy?'Guardando…':isPrompt&&!valid
        ?(!title.trim()?'Escribe un título.':'Escribe o pega el contenido del prompt.')
        :dirty?(backup?'Borrador recuperable':'Cambios sin guardar'):saved?'Guardado':'Nuevo elemento'}</span>
      <button type="submit" className="hub-primary" disabled={busy || !valid || !dirty}><Check size={15}/>Guardar {singularLabels[kind].toLowerCase()}</button>
    </footer>}
  </form>;
}
