import React, {useEffect, useRef, useState} from 'react';
import {ArrowRight, BookOpen, BrainCircuit, Code2, FolderKanban, House, Link2, MessageSquareText, Search, X} from 'lucide-react';
import {kindLabels, kinds, languages, singularLabels, type HubData, type HubEntry} from '../shared/knowledge-hub';

export const entryIcons = {note:BookOpen, snippet:Code2, project:FolderKanban, resource:Link2, prompt:MessageSquareText};
export const sectionIcons = {dashboard:House, all:BookOpen, prompt:MessageSquareText, ai:BrainCircuit};
export type HubSection = keyof typeof sectionIcons | 'settings' | 'backup';
export type HubLocation = {section: HubSection; folderId?: string};
export const sectionLabels: Record<HubSection,string> = {
  dashboard:'Inicio', all:'Todos los apuntes', prompt:'Biblioteca de prompts', ai:'Conocimiento de IA',
  settings:'Configuración', backup:'Respaldo y exportación',
};

export const aiFolderName = 'AI ENGINER';
export function findAiFolder(folders: HubData['folders']) {
  const matches=folders.filter(folder=>folder.name.trim().toUpperCase()===aiFolderName);
  return matches.find(folder=>folder.group==='folder') ?? matches[0];
}

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

export function HubSearch({data, close, choose}: {data:HubData; close:()=>void; choose:(entry:HubEntry)=>void}) {
  const [query,setQuery] = useState('');
  const [kind,setKind] = useState('');
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
    dialog?.showModal();
    search.current?.focus();
    return ()=>{if(dialog?.open) dialog.close();};
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

export function HubDashboard({data, navigate, open, list}: {
  data:HubData; navigate:(location:HubLocation)=>void; open:(entry:HubEntry)=>void; list:boolean;
}) {
  const {entries,folders}=data;
  const notes=entries.filter(entry=>entry.kind==='note');
  const aiFolder=findAiFolder(folders);
  const cards = [
    {section:'all', title:sectionLabels.all, description:'Notas y carpetas', count:notes.length},
    {section:'prompt', title:sectionLabels.prompt, description:'Plantillas reutilizables', count:entries.filter(entry=>entry.kind==='prompt').length},
    {section:'ai', title:sectionLabels.ai, description:aiFolderName, count:notes.filter(entry=>entry.folderId===aiFolder?.id).length},
  ] as const;
  const recent=notes.sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,4);
  return <div className="hub-dashboard">
    <div className={'hub-cards'+(list?' hub-list-view':'')}>
      {cards.map(card=>{
        const Icon=sectionIcons[card.section];
        return <button type="button" className="hub-card" key={card.section} onClick={()=>navigate({section:card.section})}>
          <span className="hub-card-icon"><Icon size={19}/></span><span><strong>{card.title}</strong><small>{card.description}</small></span>
          <span className="hub-count">{card.count}</span>
        </button>;
      })}
    </div>
    <div className="hub-activity">
      <section>
        <h2>Apuntes recientes</h2>
        {recent.length?recent.map(entry=><button type="button" key={entry.id} onClick={()=>open(entry)} title={singularLabels.note}>
          <BookOpen size={15}/><span>{entry.title}</span>
        </button>):<p className="hub-muted">Aparecerán los apuntes que edites.</p>}
      </section>
    </div>
  </div>;
}
