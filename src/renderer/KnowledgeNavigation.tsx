import React, {useEffect, useRef, useState} from 'react';
import {ArrowRight, BookOpen, ClipboardList, Code2, FolderKanban, HardDrive, KeyRound, Languages, Layers3, Link2, MessageSquareText, NotebookPen, Search, Settings2, SquarePen, X} from 'lucide-react';
import {kindLabels, kinds, languages, type HubData, type HubEntry} from '../shared/knowledge-hub';

export const entryIcons = {note:BookOpen, snippet:Code2, project:FolderKanban, resource:Link2, prompt:MessageSquareText};
export const sectionIcons = {
  prompt:MessageSquareText, passwords:KeyRound, templates:Layers3, discovery:ClipboardList, translator:Languages,
  settings:Settings2, backup:HardDrive, quickNotes:NotebookPen, whiteboard:SquarePen,
};
export type HubSection = keyof typeof sectionIcons | 'entry';
export const sectionLabels: Record<HubSection,string> = {
  prompt:'Biblioteca de prompts', quickNotes:'Apuntes', whiteboard:'Pizarra', passwords:'Contraseñas', templates:'Templates', discovery:'Descubrimiento de apps', translator:'Traductor',
  settings:'Configuración', backup:'Respaldo y exportación', entry:'Apunte',
};

const normalize = (text: string) => text.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('es');
export const matchText = (entry: HubEntry, query: string, folderName = '') => {
  const terms = normalize(query.trim()).split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const haystack = normalize([entry.title, entry.description, entry.code, entry.language, entry.tags.join(' '), entry.technologies.join(' '),
    entry.explanation, entry.requirements, entry.warnings, entry.example, entry.model, entry.url, folderName].join(' '));
  return terms.every(term => haystack.includes(term));
};

export function excerpt(text: string) {
  return text.replace(/^\s*(?:#{1,6}\s+|[-*+]\s+|>\s*)/gm,'').replace(/[*`]/g,'').trim().replace(/\s+/g,' ');
}

export function HubSearch({data, close, choose, initialKind}: {
  data:HubData; close:()=>void; choose:(entry:HubEntry)=>void; initialKind?:'note';
}) {
  const [query,setQuery] = useState('');
  const [kind,setKind] = useState<string>(initialKind??'');
  const [language,setLanguage] = useState('');
  const [active,setActive] = useState(0);
  const modal = useRef<HTMLDialogElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const availableKinds=new Set(data.entries.map(entry=>entry.kind));
  const searchableKinds=kinds.filter(key=>key==='note'||key==='prompt'||availableKinds.has(key));
  const availableLanguages=new Set(data.entries.map(entry=>entry.language));
  const searchableLanguages=languages.filter(key=>availableLanguages.has(key));
  const groups = searchableKinds.filter(key=>!kind || key===kind).map(key=>({
    key, entries:data.entries.filter(entry=>entry.kind===key && (!language||entry.language===language) &&
      matchText(entry,query,data.folders.find(folder=>folder.id===entry.folderId)?.name))
      .sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,30),
  })).filter(group=>group.entries.length>0);
  const results = groups.flatMap(group=>group.entries);
  const activeEntry = results[active];
  useEffect(()=>{
    const dialog=modal.current;
    const opener=document.activeElement;
    dialog?.showModal();
    search.current?.focus();
    return ()=>{
      if(dialog?.open)dialog.close();
      if(opener instanceof HTMLElement&&opener.isConnected)opener.focus({preventScroll:true});
    };
  },[]);
  useEffect(()=>{if(activeEntry) document.getElementById('hub-result-'+activeEntry.id)?.scrollIntoView({block:'nearest'});},[activeEntry]);

  return <dialog className="hub-dialog hub-search" ref={modal} aria-label="Buscar en la biblioteca"
    onCancel={event=>{event.preventDefault();close();}}
    onKeyDown={event=>{
      if (event.target instanceof HTMLSelectElement) return;
      if(event.key==='ArrowDown'||event.key==='ArrowUp'){
        event.preventDefault();
        setActive(index=>results.length?(index+(event.key==='ArrowDown'?1:-1)+results.length)%results.length:0);
        search.current?.focus();
      }
      if(event.key==='Enter'&&event.target===search.current&&activeEntry){event.preventDefault();choose(activeEntry);}
    }}>
    <header><Search size={20}/><input ref={search} type="search" placeholder="Buscar en la biblioteca…"
      aria-label="Texto de búsqueda" value={query} onChange={event=>{setQuery(event.target.value);setActive(0);}}/>
      <button type="button" aria-label="Cerrar búsqueda" onClick={close}><X size={18}/></button></header>
    <div className="hub-search-filters">
      <select aria-label="Tipo de resultado" value={kind} onChange={event=>{setKind(event.target.value);setActive(0);}}>
        <option value="">Todos los tipos</option>{searchableKinds.map(key=><option key={key} value={key}>{kindLabels[key]}</option>)}
      </select>
      {searchableLanguages.length>0&&<select aria-label="Filtrar por lenguaje" value={language} onChange={event=>{setLanguage(event.target.value);setActive(0);}}>
        <option value="">Todos los lenguajes</option>{searchableLanguages.map(key=><option key={key}>{key}</option>)}
      </select>}
    </div>
    <div className="hub-results">
      {groups.map(group=><section key={group.key}><h3>{kindLabels[group.key]}</h3>{group.entries.map(entry=>{
        const Icon=entryIcons[entry.kind];
        return <button type="button" key={entry.id} id={'hub-result-'+entry.id} data-active={activeEntry?.id===entry.id} onClick={()=>choose(entry)}>
          <Icon size={16}/><span><strong>{entry.title}</strong><small>{excerpt(entry.description || entry.code || entry.url)}</small></span><ArrowRight size={15}/>
        </button>;
      })}</section>)}
      {!results.length&&<p className="hub-muted">No hay resultados.</p>}
    </div>
  </dialog>;
}
