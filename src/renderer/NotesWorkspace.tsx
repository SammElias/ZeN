import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {ArrowDown, ArrowUp, BookOpen, Download, FolderPlus, Grid2X2, HardDrive, List, Menu, Plus, Search, Settings2, Star, Upload, X} from 'lucide-react';
import {noteLimits} from '../shared/companion-notes';
import type {AppearanceState} from '../shared/companion-appearance';
import {singularLabels, hubContentError, newFields, type HubAction, type HubData, type HubDraft, type HubEntry, type HubFields, type HubFileAction, type HubFolder} from '../shared/knowledge-hub';
import {appearanceVars} from './AppearanceSettings';
import {KnowledgeEditor} from './KnowledgeEditor';
import {motion} from '../shared/companion-motion';
import {canAnimate,positionNoteMenu,visibleRect} from './companion-motion';
import {interfaceAudio} from './companion-interface-audio';
import {aiFolderName, entryIcons, excerpt, findAiFolder, HubDashboard, HubSearch, matchText, sectionIcons, sectionLabels, type HubLocation} from './KnowledgeNavigation';
import './NotesWorkspace.css';

type Mode = 'read' | 'edit' | 'preview';
type Confirmation = {text: string; label: string; run: () => void};
const workspace = ['dashboard','all','prompt','ai'] as const;
const creatable = ['note','prompt'] as const;

function editing(entry: HubEntry): HubDraft {
  const {id, createdAt, updatedAt, copiedAt, ...fields} = entry;
  return {id, expected:updatedAt, fields};
}

function validDraft(draft: HubDraft | undefined) {
  if (!draft?.fields.title.trim() || hubContentError(draft.fields)) return false;
  const {kind, url} = draft.fields;
  return kind !== 'resource' || /^https?:\/\//i.test(url) && URL.canParse(url);
}

export type HubDestination = 'all' | 'new' | {noteId: string};

export function NotesWorkspace({appearance, destination, visible, animate}: {appearance: AppearanceState; destination?: HubDestination; visible:boolean;animate:boolean}) {
  const [data,setData] = useState<HubData>();
  const [location,setLocation] = useState<HubLocation>({section:'dashboard'});
  const [draft,setDraft] = useState<HubDraft>();
  const [mode,setMode] = useState<Mode>('read');
  const [dirty,setDirty] = useState(false);
  const [draftBackedUp,setDraftBackedUp] = useState(false);
  const [retry,setRetry] = useState(0);
  const [busy,setBusy] = useState(false);
  const [autoBlocked,setAutoBlocked] = useState(false);
  const [feedback,setFeedback] = useState<{text:string; error?:boolean}>();
  const [folderForm,setFolderForm] = useState<{id?:string; name:string; group:HubFolder['group']}>();
  const [confirmation,setConfirmation] = useState<Confirmation>();
  const [showSearch,setShowSearch] = useState(false);
  const [showNav,setShowNav] = useState(false);
  const [readerOpen,setReaderOpen] = useState(false);
  const [list,setList] = useState(false);
  const [query,setQuery] = useState('');
  const [order,setOrder] = useState('recent');
  const [editorKey,setEditorKey] = useState(0);
  const lock = useRef(false);
  const draftWrite = useRef(0);
  const confirmRef = useRef<HTMLDialogElement>(null);
  const library = useRef<HTMLDivElement>(null);
  const listScroll = useRef(0);
  const origin = useRef<{card:DOMRect;title?:DOMRect}|undefined>(undefined);
  const returning = useRef<{id:string;title?:DOMRect}|undefined>(undefined);
  const listChange = useRef<{rows:Map<string,DOMRect>;inserted?:string}|undefined>(undefined);
  const noteEffects = useRef<Animation[]>([]);
  const newEditor=useRef(-1);

  function runMotion(element:Element, keyframes:Keyframe[],duration:number) {
    noteEffects.current=noteEffects.current.filter(item=>item.playState==='running');
    const animation=element.animate(keyframes,{duration,easing:motion.enterEase});
    noteEffects.current.push(animation);
    return animation;
  }
  const handledDestination = useRef<HubDestination|undefined>(undefined);
  const stateAtRead=useRef({data,draft,dirty});
  stateAtRead.current={data,draft,dirty};

  useEffect(() => {
    if(!visible)return;
    let active=true;
    void window.companion.notesRead().then(result=>{
      if (!active) return;
      if (!result.ok) {setFeedback({text:result.error,error:true});return;}
      setData(result.value.data);
      const recovered=result.value.draft;
      if (recovered&&!stateAtRead.current.data&&!stateAtRead.current.draft&&!stateAtRead.current.dirty) {
        setDraft(recovered);
        setDirty(true);
        setDraftBackedUp(true);
        setAutoBlocked(true);
        setMode('edit');
        setReaderOpen(true);
        setLocation(recovered.fields.kind==='prompt'?{section:'prompt'}:{
          section:'all', folderId:recovered.fields.kind==='note'?recovered.fields.folderId ?? undefined:undefined,
        });
        setFeedback({text:'Borrador recuperado.'});
      }
    }).catch(()=>{if(active)setFeedback({text:'No se pudo abrir la biblioteca.',error:true});});
    return ()=>{active=false;};
  },[retry,visible]);

  useEffect(()=>{
    if(!destination){handledDestination.current=undefined;return;}
    if(!data||!visible||handledDestination.current===destination)return;
    handledDestination.current=destination;
    guard(()=>openDestination(destination,data));
  },[destination,data,visible]);

  useEffect(()=>{
    const dialog=confirmRef.current;
    const opener=document.activeElement;
    if (confirmation && visible && dialog && !dialog.open) dialog.showModal();
    return ()=>{
      if(dialog?.open)dialog.close();
      if(dialog&&opener instanceof HTMLElement&&opener.isConnected)opener.focus({preventScroll:true});
    };
  },[confirmation,visible]);

  function error(message: string) {setFeedback({text:message,error:true});}
  const saved=data?.entries.find(item=>item.id===draft?.id);
  const valid=validDraft(draft);
  const section=location.section;
  const aiFolder=data && findAiFolder(data.folders);
  const activeFolder=section==='ai'?aiFolder:data?.folders.find(folder=>folder.id===location.folderId);

  function storeDraft(value: HubDraft | null) {
    const version=++draftWrite.current;
    setDraftBackedUp(false);
    return window.companion.notesDraft(value).then(result=>{
      if (version!==draftWrite.current) return result.ok;
      if (!result.ok) error(result.error);
      else setDraftBackedUp(Boolean(value));
      return result.ok;
    }).catch(()=>{
      if(version===draftWrite.current) error('No se pudo guardar el borrador.');
      return false;
    });
  }

  function guard(run: () => void) {
    if (lock.current) return;
    if (!dirty) {run();return;}
    confirmDiscard(run);
  }
  function confirmDiscard(run: () => void) {
    setConfirmation({text:'Hay cambios sin guardar en este elemento.',label:'Descartar borrador',run:()=>{
      lock.current=true;setBusy(true);
      void storeDraft(null).then(ok=>{
        lock.current=false;setBusy(false);
        if (!ok) return;
        setDirty(false);setAutoBlocked(false);run();
      });
    }});
  }

  function openEditor(next: HubDraft, state: Mode) {
    setEditorKey(value=>value+1);
    setDraft(next);
    setMode(state);
    setDirty(false);
    setAutoBlocked(false);
    setDraftBackedUp(false);
    setReaderOpen(true);
  }

  function rowRects() {
    const root=library.current;
    const rows=new Map<string,DOMRect>();
    if(root&&canAnimate(root)){
      root.querySelectorAll<HTMLElement>('[data-note-id]').forEach(row=>{
        const rect=visibleRect(row);
        if(rect)rows.set(row.dataset.noteId!,rect);
      });
    }
    return rows;
  }

  function closeReader() {
    if(draft?.id)returning.current={id:draft.id,title:visibleRect(library.current?.querySelector('.notes-editor-heading h2')??null)};
    setReaderOpen(false);
    if(readerOpen)interfaceAudio.play('close');
  }

  function fadeRemovedCard(id:string, rows:Map<string,DOMRect>) {
    const root=library.current;
    const card=root?.querySelector(`[data-note-id="${CSS.escape(id)}"]`);
    const rect=rows.get(id);
    if(!root||!card||!rect)return;
    const ghost=card.cloneNode(true) as HTMLElement;
    ghost.inert=true;
    ghost.setAttribute('aria-hidden','true');
    ghost.className='hub-removed-card';
    Object.assign(ghost.style,{position:'fixed',left:`${rect.left}px`,top:`${rect.top}px`,width:`${rect.width}px`,height:`${rect.height}px`,pointerEvents:'none',zIndex:'1',listStyle:'none'});
    root.append(ghost);
    void runMotion(ghost,[{opacity:.8},{opacity:0}],motion.exit).finished.then(()=>ghost.remove(),()=>ghost.remove());
  }

  useLayoutEffect(()=>{
    const root=library.current;
    if(!root||!visible)return;
    const resume=returning.current,change=listChange.current;
    returning.current=undefined;
    listChange.current=undefined;
    const opener=origin.current;
    origin.current=undefined;
    if(resume){
      const list=root.querySelector('.notes-list');
      if(list)list.scrollTop=listScroll.current;
      const row=root.querySelector<HTMLButtonElement>(`[data-note-id="${CSS.escape(resume.id)}"] button`);
      if(row&&visibleRect(row)){
        row.focus({preventScroll:true});
        if(canAnimate(root)){
          const title=row.querySelector('strong'),target=visibleRect(title);
          runMotion(row,[{backgroundColor:'var(--hub-soft)'},{backgroundColor:'transparent'}],motion.note);
          if(title&&target&&resume.title)runMotion(title,[
            {translate:`${Math.max(-28,Math.min(28,resume.title.x-target.x))}px ${Math.max(-15,Math.min(15,resume.title.y-target.y))}px`,opacity:.6},
            {translate:'0 0',opacity:1}],motion.exit);
        }
      }
    }
    if(!canAnimate(root))return;
    if(change){
      for(const row of root.querySelectorAll<HTMLElement>('[data-note-id]')){
        const before=change.rows.get(row.dataset.noteId!),after=visibleRect(row);
        if(!after)continue;
        if(before&&(before.y!==after.y||before.x!==after.x)){
          runMotion(row,[{translate:`${before.x-after.x}px ${before.y-after.y}px`},{translate:'0 0'}],motion.navigation);
        }else if(row.dataset.noteId===change.inserted){
          runMotion(row,[{opacity:.25,translate:'0 8px'},{opacity:1,translate:'0 0'}],motion.navigation);
        }
      }
    }
    if(readerOpen&&(opener||newEditor.current!==editorKey)){
      const reader=root.querySelector<HTMLElement>('.hub-reader');
      const rect=visibleRect(reader??null);
      if(reader&&rect){
        const x=opener?Math.max(-36,Math.min(36,opener.card.x-rect.x)):motion.shift;
        const y=opener?Math.max(-24,Math.min(24,opener.card.y-rect.y)):0;
        reader.getAnimations().forEach(animation=>animation.cancel());
        runMotion(reader,[{translate:`${x}px ${y}px`,opacity:.5},
          {translate:'0 0',opacity:1}],motion.note);
        const heading=reader.querySelector('.notes-editor-heading h2');
        const title=visibleRect(heading);
        if(heading&&title&&opener?.title){
          runMotion(heading,[{translate:`${Math.max(-28,Math.min(28,opener.title.x-title.x-x))}px 0`,opacity:.65},{translate:'0 0',opacity:1}],motion.note);
        }
      }
    }
    newEditor.current=editorKey;
  },[readerOpen,editorKey,data,visible]);
  useEffect(()=>{
    return ()=>{noteEffects.current.forEach(animation=>animation.cancel());noteEffects.current=[];};
  },[visible,animate]);

  function showLocation(next: HubLocation) {
    listScroll.current=0;
    setLocation(next);
    setDraft(undefined);
    setQuery('');
    setShowNav(false);
    setReaderOpen(false);
    setFolderForm(undefined);
  }
  function goto(next: HubLocation) {
    guard(()=>{
      const changed=location.section!==next.section||location.folderId!==next.folderId;
      showLocation(next);
      if(changed)interfaceAudio.play('navigate');
    });
  }

  function toggleSearch(open: boolean) {
    if(showSearch===open)return;
    setShowSearch(open);
    interfaceAudio.play(open?'open':'close');
  }

  function openDestination(target: HubDestination, library: HubData) {
    setFeedback(undefined);
    showLocation({section:'all'});
    if (target==='all') return;
    if (target==='new') {
      create('note',false);
      return;
    }
    const entry=library.entries.find(item=>item.id===target.noteId && item.kind==='note');
    if (entry) openEditor(editing(entry),'read');
    else error('El apunte ya no está disponible.');
  }

  function choose(entry: HubEntry, fromSearch=false, card?:HTMLElement) {
    if (fromSearch) setShowSearch(false);
    const markOrigin=()=>{
      const rect=visibleRect(card??null);
      origin.current=rect?{card:rect,title:visibleRect(card?.querySelector('strong')??null)}:undefined;
    };
    if (entry.id===draft?.id) {
      if(!readerOpen){markOrigin();setReaderOpen(true);interfaceAudio.play('open');}
      else if(fromSearch&&showSearch)interfaceAudio.play('close');
      return;
    }
    guard(()=>{
      markOrigin();
      if (fromSearch || ['dashboard','backup','settings'].includes(section)) {
        setLocation({section:entry.kind==='prompt'?'prompt':'all'});
        setQuery('');
      }
      openEditor(editing(entry),'read');
      interfaceAudio.play('open');
    });
  }

  function create(kind: typeof creatable[number], audible=true) {
    guard(()=>{
      const folderId=kind==='note'?activeFolder?.id ?? null:null;
      if (!folderId) setLocation({section:kind==='note'?'all':'prompt'});
      setQuery('');
      setShowNav(false);
      openEditor({fields:newFields(kind,folderId)},'edit');
      if(audible)interfaceAudio.play('open');
    });
  }

  function update(patch: Partial<HubFields>) {
    if (!draft || lock.current) return;
    const next={...draft,fields:{...draft.fields,...patch}};
    setDraft(next);
    setDirty(true);
    setAutoBlocked(false);
    setFeedback(undefined);
    void storeDraft(next);
  }

  async function mutate(action: HubAction, done?: (data:HubData,id?:string)=>void, audible=true) {
    if(lock.current) return;
    lock.current=true;
    setBusy(true);
    setFeedback(undefined);
    try {
      const result=await window.companion.notesChange(action);
      if(!result.ok) {if(audible)interfaceAudio.play('error');error(result.error);return;}
      if(action.type==='remove'||action.type==='duplicate'||(action.type==='save'&&!action.id)){
        listChange.current={rows:rowRects(),inserted:action.type==='remove'?undefined:result.value.id};
        if(action.type==='remove')fadeRemovedCard(action.id,listChange.current.rows);
      }
      setData(result.value.data);
      done?.(result.value.data,result.value.id);
      if(audible)interfaceAudio.play('success');
    } catch {if(audible)interfaceAudio.play('error');error('No se pudo guardar el cambio.');}
    finally {lock.current=false;setBusy(false);}
  }

  async function save(manual: boolean) {
    if (!draft || !valid || !dirty || lock.current) return;
    const input = !manual && document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    setAutoBlocked(true);
    await mutate({type:'save',...draft},(next,id)=>{
      const entry=next.entries.find(item=>item.id===id);
      if (!entry) return;
      draftWrite.current++;
      setDraft(editing(entry));
      setDirty(false);
      setDraftBackedUp(false);
      setAutoBlocked(false);
      if (manual) setMode('read');
    },manual);
    if (input && input.closest('.notes-editor')) requestAnimationFrame(()=>{
      if (input.isConnected && document.activeElement===document.body) input.focus();
    });
  }

  useEffect(()=>{
    if (!visible || !dirty || !valid || mode!=='edit' || busy || autoBlocked || !draftBackedUp || confirmation) return;
    const timer=setTimeout(()=>void save(false),1500);
    return ()=>clearTimeout(timer);
  },[draft, dirty, valid, mode, busy, autoBlocked, draftBackedUp, confirmation, visible]);

  useEffect(()=>{
    if(!visible)return;
    function shortcuts(event:KeyboardEvent) {
      const key=event.key.toLowerCase();
      if ((event.ctrlKey||event.metaKey) && key==='k' && data) {
        event.preventDefault();toggleSearch(!showSearch);return;
      }
      if ((event.ctrlKey||event.metaKey) && key==='s' && draft && !showSearch && !confirmation) {
        event.preventDefault();void save(true);return;
      }
      if (key==='escape' && !showSearch && !confirmation) {
        if(document.activeElement?.closest('.hub-menu[open]'))return;
        if(folderForm)setFolderForm(undefined);
        else if(showNav)setShowNav(false);
        else if(mode==='preview')setMode('edit');
        else if(readerOpen&&mode==='read')closeReader();
        else return;
        event.preventDefault();
      }
    }
    document.addEventListener('keydown',shortcuts);
    return ()=>document.removeEventListener('keydown',shortcuts);
  });

  async function files(action: HubFileAction) {
    if (lock.current) return;
    lock.current=true;
    setBusy(true);
    setFeedback(undefined);
    let image: HubFields['images'][number] | undefined;
    try {
      const result=await window.companion.notesFile(action);
      if (!result.ok) {error(result.error);return;}
      if (result.value.type==='import') {
        setData(result.value.data);setDraft(undefined);setDirty(false);setLocation({section:'dashboard'});
        setFeedback({text:'Respaldo restaurado.'});
      } else if (result.value.type==='image') image=result.value.image;
      else if (result.value.type==='done' && action.type!=='url') setFeedback({text:'Archivo exportado.'});
    } catch {error('No se pudo completar la operación de archivo.');}
    finally {lock.current=false;setBusy(false);}
    if (image && draft) update({images:[...draft.fields.images,image]});
  }

  const counts=data?.entries.reduce((map, entry)=>{
    if(entry.folderId)map.set(entry.folderId,(map.get(entry.folderId)??0)+1);
    return map;
  },new Map<string,number>());
  const items=(data?.entries ?? []).filter(entry=>{
    if(section==='prompt') return entry.kind==='prompt';
    if(entry.kind!=='note') return false;
    if(section==='ai') return entry.folderId===aiFolder?.id;
    return section==='all' && (!activeFolder || entry.folderId===activeFolder.id);
  }).filter(entry=>matchText(entry,query)).sort((a,b)=>order==='name'?a.title.localeCompare(b.title,'es'):b.updatedAt-a.updatedAt);
  const showLibrary=!['dashboard','settings','backup'].includes(section);
  const defaultKind=section==='prompt'?'prompt':'note';
  const subheading=section==='ai'?aiFolderName:activeFolder?.name ?? sectionLabels[section];
  const noteFolderIds=new Set(data?.entries.filter(entry=>entry.kind==='note').map(entry=>entry.folderId));
  const noteFolders=data?.folders.filter(folder=>folder.group==='folder'||noteFolderIds.has(folder.id)) ?? [];
  const sameGroup=data?.folders.filter(folder=>folder.group===folderForm?.group) ?? [];
  const folderIndex=sameGroup.findIndex(folder=>folder.id===folderForm?.id);

  function copy(values: Record<string,string>) {
    if (!draft?.fields.code.trim() || lock.current) return;
    if (saved && !dirty) {
      void mutate({type:'copy',id:saved.id,values},()=>setFeedback({text:'Texto copiado.'}));
      return;
    }
    void window.companion.copy(draft.fields.code).then(result=>{
      if (result.ok) setFeedback({text:'Texto copiado.'});
      else error(result.error);
    }).catch(()=>error('No se pudo copiar el texto.'));
  }

  const theme = data?.theme ?? 'light';
  const glassTheme = theme === 'light' && appearance.theme === 'monochrome' ? 'monochrome' : theme;
  return <section className="notes-workspace knowledge-hub" data-hub-theme={theme}
    style={appearanceVars({...appearance, theme:glassTheme})} aria-labelledby="notes-title">
    <div className="hub-shell">
      <aside className="hub-sidebar" data-mobile-open={showNav} aria-label="Navegación de Knowledge Hub">
          <button type="button" className="hub-brand" onClick={()=>{if(section!=='dashboard')goto({section:'dashboard'});}}>
          <span><BookOpen size={18}/></span><strong>Knowledge Hub</strong>
        </button>
        <nav>
          <h2>Espacio de trabajo</h2>
          {workspace.map(key=>{
            const Icon=sectionIcons[key];
            return <button type="button" key={key} aria-current={section===key?'page':undefined} onClick={()=>{if(section!==key||location.folderId)goto({section:key});}}>
              <Icon size={16}/><span>{sectionLabels[key]}</span>
            </button>;
          })}
          <h2>Sistema</h2>
          <button type="button" aria-current={section==='settings'?'page':undefined} onClick={()=>goto({section:'settings'})}><Settings2 size={16}/>Configuración</button>
          <button type="button" aria-current={section==='backup'?'page':undefined} onClick={()=>goto({section:'backup'})}><HardDrive size={16}/>Respaldo y exportación</button>
        </nav>
      </aside>
      <main className="hub-main">
        <header className="hub-top">
          <button type="button" className="hub-mobile-toggle" aria-label="Navegación" aria-expanded={showNav}
            onClick={()=>{setShowNav(!showNav);interfaceAudio.play(showNav?'close':'open');}}><Menu size={18}/></button>
          <button type="button" className="hub-search-launch" disabled={!data} onClick={()=>toggleSearch(true)}>
            <Search size={17}/><span>Buscar en la biblioteca…</span><kbd>Ctrl K</kbd>
          </button>
            <details className="hub-menu hub-create" onToggle={event=>positionNoteMenu(event.currentTarget)}>
            <summary className="hub-primary"><Plus size={17}/>Nuevo</summary>
            <div>{creatable.map(kind=>{
              const Icon=entryIcons[kind];
              return <button type="button" disabled={!data} key={kind} onClick={event=>{
                event.currentTarget.closest('details')?.removeAttribute('open');create(kind);
              }}><Icon size={16}/>{singularLabels[kind]}</button>;
            })}<button type="button" className="notes-new-folder" disabled={!data} onClick={event=>{
              event.currentTarget.closest('details')?.removeAttribute('open');setFolderForm({name:'',group:'folder'});interfaceAudio.play('open');
            }}><FolderPlus size={16}/>Carpeta</button></div>
          </details>
        </header>

        <div className="hub-heading">
          <h1 id="notes-title">{section==='dashboard'?'Knowledge Hub':subheading}</h1>
          {section==='dashboard' && <div className="hub-tools">
            <div className="hub-switch" aria-label="Vista de biblioteca">
              <button type="button" aria-label="Vista de tarjetas" title="Tarjetas" aria-pressed={!list} onClick={()=>setList(false)}><Grid2X2 size={16}/></button>
              <button type="button" aria-label="Vista de lista" title="Lista" aria-pressed={list} onClick={()=>setList(true)}><List size={16}/></button>
            </div>
            <button type="button" aria-label="Configuración" title="Configuración" onClick={()=>goto({section:'settings'})}><Settings2 size={16}/></button>
          </div>}
          {section==='all' && activeFolder && <button type="button" onClick={()=>setFolderForm(activeFolder)}><Settings2 size={16}/>Editar carpeta</button>}
        </div>

        {feedback && <div className="hub-feedback" role={feedback.error?'alert':'status'}>
          <span>{feedback.text}</span><button type="button" aria-label="Cerrar aviso" onClick={()=>setFeedback(undefined)}><X size={14}/></button>
        </div>}
        {!data && (feedback?.error?<button type="button" onClick={()=>{setFeedback(undefined);setRetry(value=>value+1);}}>Volver a intentar</button>:
          <div className="hub-skeleton" role="status" aria-label="Abriendo la biblioteca"><i/><i/><i/></div>)}

        {data && folderForm && <form className="hub-panel notes-folder-form" onSubmit={event=>{
          event.preventDefault();
          void mutate({type:'folder',...folderForm},(_,id)=>{
            setFolderForm(undefined);
            if(id && !folderForm.id && !dirty) showLocation({section:'all',folderId:id});
            setFeedback({text:'Carpeta guardada.'});
          });
        }}>
          <div className="hub-fields">
            <label>Nombre<input id="notes-folder-name" autoFocus maxLength={noteLimits.folder} required value={folderForm.name}
              onChange={event=>setFolderForm({...folderForm,name:event.target.value})}/></label>
          </div>
          <div className="hub-tools">
            {folderForm.id && <>
              <button type="button" title="Mover arriba" aria-label="Mover arriba" disabled={busy || folderIndex<=0}
                onClick={()=>void mutate({type:'reorder',id:folderForm.id!,direction:'up'})}><ArrowUp size={16}/></button>
              <button type="button" title="Mover abajo" aria-label="Mover abajo" disabled={busy || folderIndex<0 || folderIndex>=sameGroup.length-1}
                onClick={()=>void mutate({type:'reorder',id:folderForm.id!,direction:'down'})}><ArrowDown size={16}/></button>
              <button type="button" disabled={busy || Boolean(counts?.get(folderForm.id))} onClick={()=>{
                const id=folderForm.id!;
                guard(()=>setConfirmation({text:'¿Eliminar «'+folderForm.name+'»?',label:'Eliminar carpeta',run:()=>{
                  void mutate({type:'removeFolder',id},()=>showLocation({section:'dashboard'}));
                }}));
              }}>Eliminar carpeta</button>
            </>}
            <button type="button" onClick={()=>setFolderForm(undefined)}>Cancelar</button>
            <button type="submit" className="hub-primary" disabled={busy || !folderForm.name.trim()}>Guardar carpeta</button>
          </div>
        </form>}

        {data && section==='dashboard' && <HubDashboard data={data} navigate={goto} open={choose} list={list}/>}
        {data && section==='settings' && <div className="hub-panel">
          <h2>Apariencia de Apuntes</h2>
          <div className="hub-switch" aria-label="Tema">
            {(['light','dark'] as const).map(theme=><button type="button" key={theme} aria-pressed={data.theme===theme}
              disabled={busy} onClick={()=>void mutate({type:'theme',theme})}>{theme==='light'?'Claro':'Oscuro'}</button>)}
          </div>
        </div>}
        {data && section==='backup' && <div className="hub-panel">
          <h2>Biblioteca local</h2>
          <p>Exporta todos los elementos, carpetas e imágenes en un archivo JSON.</p>
          <div className="hub-tools">
            <button type="button" disabled={busy} onClick={()=>void files({type:'export'})}><Download size={16}/>Exportar JSON</button>
            <button type="button" disabled={busy} onClick={()=>setConfirmation({
              text:'Restaurar el respaldo sustituirá la biblioteca actual. Puedes exportarla primero.',
              label:'Elegir respaldo',run:()=>void files({type:'import'}),
            })}><Upload size={16}/>Restaurar JSON</button>
          </div>
        </div>}

        {data && section==='ai' && !aiFolder && <div className="hub-panel">
          <p>Esta sección muestra los apuntes de la carpeta {aiFolderName}.</p>
          <button type="button" disabled={busy} onClick={()=>void mutate({type:'folder',name:aiFolderName,group:'folder'})}>
            <FolderPlus size={16}/>Crear carpeta {aiFolderName}
          </button>
        </div>}
        {data && showLibrary && (section!=='ai'||aiFolder) && <>
          <div ref={library} className="hub-library" data-reader-open={readerOpen && Boolean(draft)}>
            <aside className="hub-items" aria-label="Elementos de la sección">
              <div className="hub-toolbar">
                <span>{items.length} {items.length===1?'elemento':'elementos'}</span>
                <button type="button" aria-label={'Crear '+singularLabels[defaultKind].toLowerCase()} title={'Crear '+singularLabels[defaultKind].toLowerCase()}
                  disabled={busy} onClick={()=>create(defaultKind)}><Plus size={17}/></button>
              </div>
              <div className="hub-list-filters">
                {section==='all' && noteFolders.length>0 && <select className="hub-folder-filter" aria-label="Filtrar por carpeta"
                  value={activeFolder?.id ?? ''} onChange={event=>goto({section:'all',folderId:event.target.value || undefined})}>
                  <option value="">Todas las carpetas</option>
                  {noteFolders.map(folder=><option key={folder.id} value={folder.id}>{folder.name}</option>)}
                </select>}
                <input type="search" aria-label="Filtrar sección" value={query} placeholder="Filtrar…" onChange={event=>setQuery(event.target.value)}/>
                <select aria-label="Orden" value={order} onChange={event=>setOrder(event.target.value)}>
                  <option value="recent">Recientes</option><option value="name">A–Z</option>
                </select>
              </div>
              <ul className="notes-list" onScroll={event=>{if(event.currentTarget.clientHeight)listScroll.current=event.currentTarget.scrollTop;}}>{items.map(entry=>{
                const Icon=entryIcons[entry.kind];
                return <li key={entry.id} data-note-id={entry.id}><button type="button" className="notes-list-item" aria-current={draft?.id===entry.id?'true':undefined}
                  disabled={busy} onClick={event=>choose(entry,false,event.currentTarget)}>
                  <Icon size={17}/><span><strong>{entry.title}</strong><small>{excerpt(entry.description||entry.code||entry.url)}</small></span>
                  {entry.favorite && <Star className="hub-item-star" size={13} fill="currentColor"/>}
                </button></li>;
              })}</ul>
              {!items.length && <p className="hub-muted">{query?'No hay coincidencias.':'Todavía no hay elementos.'}</p>}
            </aside>
            {draft && <div className="hub-reader">
              <KnowledgeEditor key={editorKey} data={data} draft={draft} saved={saved} mode={mode} busy={busy}
                back={closeReader}
                dirty={dirty} valid={valid} backup={draftBackedUp} update={update} setMode={setMode} save={()=>void save(true)}
                favorite={()=>saved&&void mutate({type:'favorite',id:saved.id},next=>{
                  const entry=next.entries.find(item=>item.id===saved.id);if(entry)setDraft(editing(entry));
                })}
                duplicate={()=>saved&&void mutate({type:'duplicate',id:saved.id},(next,id)=>{
                  const entry=next.entries.find(item=>item.id===id);if(entry)openEditor(editing(entry),'read');
                })}
                remove={()=>saved&&setConfirmation({text:'¿Eliminar «'+saved.title+'»?',label:'Eliminar',run:()=>{
                  void mutate({type:'remove',id:saved.id},()=>{setDraft(undefined);setReaderOpen(false);setFeedback({text:'Elemento eliminado.'});});
                }})}
                exportMarkdown={()=>saved&&void files({type:'markdown',id:saved.id})}
                attach={()=>void files({type:'image'})}
                copy={copy}
                openUrl={url=>void files({type:'url',url})} openEntry={entry=>choose(entry,true)}
              />
            </div>}
          </div>
        </>}
      </main>
    </div>
    {visible && data && showSearch && <HubSearch data={data} close={()=>toggleSearch(false)} choose={entry=>choose(entry,true)}/>}
    {visible && confirmation && <dialog ref={confirmRef} className="hub-dialog hub-confirm" aria-label="Confirmación"
      onCancel={event=>{event.preventDefault();setConfirmation(undefined);}}>
      <p>{confirmation.text}</p>
      <div className="hub-tools"><button type="button" autoFocus onClick={()=>setConfirmation(undefined)}>Cancelar</button>
        <button type="button" className="hub-primary" onClick={()=>{setConfirmation(undefined);confirmation.run();}}>{confirmation.label}</button></div>
    </dialog>}
  </section>;
}
