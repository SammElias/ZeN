import React, {useState} from 'react';
import {ImageOff} from 'lucide-react';
import type {TemplateDraft, TemplateSummary} from '../shared/knowledge-templates';

export function storedReference(item: TemplateSummary, thumbnail = false) {
  return item.hasImage ? `zen-theme://template/${item.id}/${thumbnail?'thumbnail':'reference'}?v=${item.updatedAt}` : undefined;
}

export function draftReference(draft: TemplateDraft, original?:TemplateSummary) {
  if (draft.image===null) return;
  if (draft.image) return 'data:image/jpeg;base64,'+draft.image.thumbnail;
  if (original) return storedReference(original,true);
}

export function TemplateReference({src,name,thumbnail=false}:{src?:string;name:string;thumbnail?:boolean}) {
  const [failed,setFailed]=useState<string>();
  return src&&failed!==src
    ? <img src={src} alt={thumbnail?'':`Referencia visual de ${name}`} loading={thumbnail?'lazy':'eager'} decoding="async" onError={()=>setFailed(src)}/>
    : <span className="template-image-unavailable"><ImageOff size={22} aria-hidden="true"/>{src?'Imagen no disponible':'Sin referencia visual'}</span>;
}
