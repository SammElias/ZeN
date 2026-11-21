import React, {useEffect,useRef,useState} from 'react';
import {ImagePlus,Save} from 'lucide-react';
import {TemplateFields,type TemplateDraft,type TemplateSummary} from '../shared/knowledge-templates';
import {draftReference,TemplateReference} from './TemplateReference';

type Props = {
  draft:TemplateDraft; original?:TemplateSummary; busy:boolean; visible:boolean;
  onChange:(update:Partial<TemplateFields>)=>void; onImage:()=>void; onRemoveImage:()=>void;
  onSave:()=>void; onCancel:()=>void;
};

function ListField({label,values,separator,limit,onChange}:{label:string;values:string[];separator:string;limit:number;onChange:(values:string[])=>void}) {
  const [text,setText]=useState(values.join(separator==='\n'?'\n':', '));
  return <label>{label}<textarea rows={separator==='\n'?3:2} maxLength={separator==='\n'?2800:620} value={text} onChange={event=>{
    const next=event.target.value;
    setText(next);
    const parts=next.split(separator).map(part=>part.trim()).filter(Boolean);
    onChange([...new Set(parts.map(part=>part.slice(0,limit)))].slice(0,12));
  }}/></label>;
}

export function TemplateEditor({draft,original,busy,visible,onChange,onImage,onRemoveImage,onSave,onCancel}:Props) {
  const {fields}=draft;
  const name=useRef<HTMLInputElement>(null);
  const valid=TemplateFields.safeParse(fields).success;
  const source=draftReference(draft,original);
  useEffect(()=>{name.current?.focus();},[]);
  return <form className="template-editor" onSubmit={event=>{event.preventDefault();if(valid&&!busy)onSave();}}>
    <h2>{draft.id?'Editar template':'Nuevo template'}</h2>
    <div className="template-detail-grid">
      <div className="template-editor-image hub-panel">
        <h3>Referencia visual</h3>
        <div className="template-image">{visible&&<TemplateReference src={source} name={fields.name}/>}</div>
        <small>PNG, JPEG o WebP de hasta 4 MB</small>
        <div className="hub-tools">
          <button type="button" disabled={busy} onClick={onImage}><ImagePlus size={16}/>{source?'Sustituir imagen':'Añadir imagen'}</button>
          {source&&<button type="button" disabled={busy} onClick={onRemoveImage}>Quitar imagen</button>}
        </div>
      </div>
      <div className="hub-panel template-fields">
        <label>Nombre<input ref={name} required maxLength={120} value={fields.name} onChange={e=>onChange({name:e.target.value})}/></label>
        <label>Descripción<textarea required rows={3} maxLength={1200} value={fields.description} onChange={e=>onChange({description:e.target.value})}/></label>
        <ListField label="Etiquetas separadas por comas" separator="," limit={48} values={fields.tags} onChange={tags=>onChange({tags})}/>
        <label>Autor (opcional)<input maxLength={120} value={fields.author} onChange={e=>onChange({author:e.target.value})}/></label>
        <label>URL de origen (opcional)<input type="url" maxLength={2048} value={fields.sourceUrl} onChange={e=>onChange({sourceUrl:e.target.value})}/></label>
      </div>
    </div>
    <div className="hub-panel template-fields">
      <ListField label="Características del diseño · una por línea" separator="\n" limit={240} values={fields.features} onChange={features=>onChange({features})}/>
      <ListField label="Casos de uso · uno por línea" separator="\n" limit={240} values={fields.useCases} onChange={useCases=>onChange({useCases})}/>
      <label>{fields.reactPrompt?.trim()?'Prompt para Power Apps Canvas':'Prompt propuesto'}<textarea className="template-prompt-input" required rows={12} maxLength={48000} value={fields.prompt} onChange={e=>onChange({prompt:e.target.value})}/></label>
      <details className="template-personalized">
        <summary>Variante para React</summary>
        <label>Prompt para React + TypeScript<textarea rows={10} maxLength={48000} value={fields.reactPrompt??''} onChange={e=>onChange({reactPrompt:e.target.value})}/></label>
      </details>
      <div className="hub-tools">
        <button type="button" disabled={busy} onClick={onCancel}>Cancelar edición</button>
        <button type="submit" className="hub-primary" disabled={busy||!valid}><Save size={16}/>Guardar template</button>
      </div>
    </div>
  </form>;
}
