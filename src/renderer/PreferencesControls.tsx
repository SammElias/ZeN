import React, {useId} from 'react';

export type PreferenceFeedback = {text:string;error?:boolean};

export function PreferenceRow({title,description,controlId,children}:{title:string;description?:string;controlId?:string;children:React.ReactNode}) {
 return <div className="preference-row">
  <div className="preference-label">
   {controlId?<label htmlFor={controlId}>{title}</label>:<strong>{title}</strong>}
   {description&&<p>{description}</p>}
  </div>
  <div className="preference-control">{children}</div>
 </div>;
}

export function PreferenceSwitch({title,description,checked,disabled,onChange}:{title:string;description?:string;checked:boolean;disabled?:boolean;onChange:(checked:boolean)=>void}) {
 const id=useId();
 return <PreferenceRow title={title} controlId={id} description={description}>
  <input className="preference-switch" id={id} type="checkbox" role="switch" checked={checked} disabled={disabled}
   onChange={event=>onChange(event.currentTarget.checked)}/>
 </PreferenceRow>;
}

export function PreferenceSave({name='Guardar',dirty,busy,feedback,onSave,onDiscard}:{name?:string;dirty:boolean;busy:boolean;feedback?:PreferenceFeedback;onSave:()=>void;onDiscard:()=>void}) {
 return <div className="preference-save">
  <div className="preference-save-message">
   <span className="preference-save-state" data-pending={dirty}>{dirty?'Cambios pendientes':'Sin cambios pendientes'}</span>
   {feedback&&<p role={feedback.error?'alert':'status'}>{feedback.text}</p>}
  </div>
  <div className="preference-actions">
   <button type="button" disabled={busy||!dirty} onClick={onDiscard}>Descartar</button>
   <button type="button" className="primary" disabled={busy||!dirty} onClick={onSave}>{busy?'Guardando…':name}</button>
  </div>
 </div>;
}
