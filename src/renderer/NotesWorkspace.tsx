import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {ArrowDown, ArrowUp, BookOpen, Download, FolderPlus, Menu, Plus, Search, Star, Upload, X} from 'lucide-react';
import {noteLimits} from '../shared/companion-notes';
import {hubName} from '../shared/companion-navigation';
import type {AppearanceState} from '../shared/companion-appearance';
import {singularLabels, hubContentError, libraryFolderLabel, libraryFolders, newFields, type HubAction, type HubData, type HubDraft, type HubEntry, type HubFields, type HubFileAction, type HubFolder} from '../shared/knowledge-hub';
import {appearanceVars} from './AppearanceSettings';
import {KnowledgeEditor} from './KnowledgeEditor';
import {QuickNotesEditor} from './QuickNotesEditor';
import {Whiteboard} from './Whiteboard';
import {TemplatesWorkspace} from './TemplatesWorkspace';
import {TranslatorWorkspace} from './TranslatorWorkspace';
import {PasswordVault,concealVaultView} from './PasswordVault';
import {motion,navigationHoverDelay} from '../shared/companion-motion';
import {canAnimate,positionNoteMenu,startCubeTurn,visibleRect} from './companion-motion';
import {interfaceAudio} from './companion-interface-audio';
import {entryIcons, excerpt, HubSearch, matchText, sectionIcons, sectionLabels, type HubSection} from './KnowledgeNavigation';
import './NotesWorkspace.css';

type Mode = 'read' | 'edit' | 'preview';
type Confirmation = {text: string; label: string; run: () => void};
const sidebarGroups: readonly {title:string;sections:readonly (keyof typeof sectionIcons)[]}[] = [
  {title:'Espacio de trabajo',sections:['prompt','passwords','templates','translator']},
  {title:'Sistema',sections:['settings','backup']},
  {title:'Bloc personal',sections:['quickNotes','whiteboard']},
];
const sidebarSections = sidebarGroups.flatMap(group=>group.sections);
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

export function NotesWorkspace({appearance,visible,surfaceVisible,animate,hoverEnabled}: {
  appearance:AppearanceState;visible:boolean;surfaceVisible:boolean;animate:boolean;hoverEnabled:boolean;
}) {
  const [data,setData] = useState<HubData>();
  const [section,setSection] = useState<HubSection>('prompt');
  const [templatesOpened,setTemplatesOpened] = useState(false);
  const [libraryRevision,setLibraryRevision] = useState(0);
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
  const [query,setQuery] = useState('');
  const [order,setOrder] = useState('recent');
  const [editorKey,setEditorKey] = useState(0);
  const lock = useRef(false);
  const draftWrite = useRef(0);
  const confirmRef = useRef<HTMLDialogElement>(null);
  const main = useRef<HTMLElement>(null);
  const cube = useRef<{next:HubSection;turn?:ReturnType<typeof startCubeTurn>}>(undefined);
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const hoverSelection = useRef<(next:HubSection)=>void>(undefined);
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
        setSection(recovered.fields.kind==='prompt'?'prompt':'entry');
        setFeedback({text:'Borrador recuperado.'});
      }
    }).catch(()=>{
      if(!active)return;
      setFeedback({text:'No se pudo abrir la biblioteca.',error:true});
    });
    return ()=>{active=false;};
  },[retry,visible]);

  useEffect(()=>{
    const dialog=confirmRef.current;
    const opener=document.activeElement;
    if (confirmation && visible && dialog && !dialog.open) dialog.showModal();
    return ()=>{
      if(dialog?.open)dialog.close();
      if(dialog&&opener instanceof HTMLElement&&opener.isConnected)opener.focus({preventScroll:true});
    };
  },[confirmation,visible]);

  function cancelHover() {
    clearTimeout(hoverTimer.current);
    hoverTimer.current=undefined;
  }

  function cancelCube() {
    const previous=cube.current;
    cube.current=undefined;
    previous?.turn?.cancel();
  }

  useLayoutEffect(()=>{
    if(!visible||!surfaceVisible||!hoverEnabled)cancelHover();
    if(!visible||!surfaceVisible)cancelCube();
    else if(!animate)cube.current?.turn?.cancel();
  },[visible,surfaceVisible,animate,hoverEnabled]);

  useEffect(()=>{
    window.addEventListener('blur',cancelHover);
    return ()=>{
      window.removeEventListener('blur',cancelHover);
      cancelHover();
      cancelCube();
    };
  },[]);

  function error(message: string) {setFeedback({text:message,error:true});}
  const saved=data?.entries.find(item=>item.id===draft?.id);
  const valid=validDraft(draft);

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
    if(section==='entry'){goto('prompt');return;}
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

  function showLocation(next: HubSection) {
    if(next==='templates')setTemplatesOpened(true);
    listScroll.current=0;
    setSection(next);
    setDraft(undefined);
    setQuery('');
    setShowNav(false);
    setShowSearch(false);
    setReaderOpen(false);
    setFolderForm(undefined);
  }
  function goto(next: HubSection) {
    cancelHover();
    if(cube.current?.next===next)return;
    cancelCube();
    if(next===section)return;
    guard(()=>{
      if(section==='passwords')concealVaultView();
      const commit=()=>{showLocation(next);interfaceAudio.play('navigate');};
      const pane=main.current;
      const from=sidebarSections.indexOf(section==='entry'?'prompt':section);
      const to=sidebarSections.indexOf(next==='entry'?'prompt':next);
      if(animate&&pane&&from!==to&&canAnimate(pane)&&!pane.parentElement?.closest('[hidden],[inert],[data-cube-direction]')){
        const pending:NonNullable<typeof cube.current>={next};
        cube.current=pending;
        const turn=startCubeTurn(pane,to>from?'bottom':'top',()=>{
          if(cube.current===pending)flushSync(commit);
        });
        if(turn){
          pending.turn=turn;
          const clean=()=>{if(cube.current===pending)cube.current=undefined;};
          void turn.view.finished.then(clean,clean);
          return;
        }
        cube.current=undefined;
      }
      commit();
    });
  }

  hoverSelection.current=next=>{
    const pane=main.current;
    const focus=document.activeElement;
    if(!hoverEnabled||!visible||!surfaceVisible||document.hidden||dirty||lock.current||confirmation||showSearch||folderForm||
      !pane||pane.querySelector('dialog[open],.hub-menu[open],[data-island-gesture]')||
      (pane.contains(focus)&&focus?.matches(':read-write,select')))return;
    goto(next);
  };

  function sidebarAction(next:HubSection) {
    return {
      onPointerEnter:(event:React.PointerEvent<HTMLButtonElement>)=>{
        if(!hoverEnabled||event.pointerType!=='mouse'||event.buttons)return;
        cancelHover();
        const button=event.currentTarget;
        hoverTimer.current=setTimeout(()=>{
          hoverTimer.current=undefined;
          if(button.matches(':hover'))hoverSelection.current?.(next);
        },navigationHoverDelay);
      },
      onPointerLeave:cancelHover,
      onPointerDown:cancelHover,
      onClick:()=>goto(next),
    };
  }

  function toggleSearch(open: boolean) {
    if(showSearch===open)return;
    setShowSearch(open);
    interfaceAudio.play(open?'open':'close');
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
      if (fromSearch) {
        setSection(entry.kind==='prompt'?'prompt':'entry');
        setQuery('');
      }
      openEditor(editing(entry),'read');
      interfaceAudio.play('open');
    });
  }

  function create(kind: typeof creatable[number]) {
    guard(()=>{
      const folderId=kind==='note'&&section==='entry'?draft?.fields.folderId ?? null:null;
      showLocation(kind==='note'?'entry':'prompt');
      openEditor({fields:newFields(kind,folderId)},'edit');
      interfaceAudio.play('open');
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

  const independentSection = section==='quickNotes' || section==='whiteboard';
  const showLibraryTools = !independentSection && section!=='templates' && section!=='passwords' && section!=='translator';
  useEffect(()=>{
    if(!visible)return;
    function shortcuts(event:KeyboardEvent) {
      const key=event.key.toLowerCase();
      if(!showLibraryTools&&key!=='escape')return;
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
        setLibraryRevision(value=>value+1);
        setData(result.value.data);setDirty(false);showLocation('prompt');
        setFeedback({text:'Biblioteca restaurada.'});
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
  const items=section==='prompt'?(data?.entries ?? []).filter(entry=>entry.kind==='prompt'&&matchText(entry,query))
    .sort((a,b)=>order==='name'?a.title.localeCompare(b.title,'es'):b.updatedAt-a.updatedAt):[];
  const subheading=section==='entry'&&draft?singularLabels[draft.fields.kind]:sectionLabels[section];
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
  return <section className="notes-workspace knowledge-hub" data-hub-theme={appearance.theme==='dark'?'dark':'light'} aria-labelledby="notes-title">
    <div className="hub-shell">
      <aside className="hub-sidebar" data-mobile-open={showNav} aria-label={`Navegación de ${hubName}`}>
          <div className="hub-brand">
          <span><BookOpen size={18}/></span><strong>{hubName}</strong>
        </div>
        <nav>
          {sidebarGroups.map(({title,sections})=><React.Fragment key={title}>
            <h2>{title}</h2>
            {sections.map(key=>{
              const Icon=sectionIcons[key];
              return <button type="button" key={key} aria-current={section===key?'page':undefined} {...sidebarAction(key)}>
                <Icon size={16}/><span>{sectionLabels[key]}</span>
              </button>;
            })}
          </React.Fragment>)}
        </nav>
      </aside>
      <main ref={main} className="hub-main" data-local-sheet={independentSection || undefined}>
        <header className="hub-top">
          <button type="button" className="hub-mobile-toggle" aria-label="Navegación" aria-expanded={showNav}
            onClick={()=>{setShowNav(!showNav);interfaceAudio.play(showNav?'close':'open');}}><Menu size={18}/></button>
          {showLibraryTools && <><button type="button" className="hub-search-launch" disabled={!data} onClick={()=>toggleSearch(true)}>
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
          </details></>}
        </header>

        <div className="hub-heading">
          <h1 id="notes-title">{subheading}</h1>
        </div>

        {!independentSection && feedback && <div className="hub-feedback" role={feedback.error?'alert':'status'}>
          <span>{feedback.text}</span><button type="button" aria-label="Cerrar aviso" onClick={()=>setFeedback(undefined)}><X size={14}/></button>
        </div>}
        {!independentSection && !data && (feedback?.error?<button type="button" onClick={()=>{setFeedback(undefined);setRetry(value=>value+1);}}>Volver a intentar</button>:
          <div className="hub-skeleton" role="status" aria-label="Abriendo la biblioteca"><i/><i/><i/></div>)}

        {data && folderForm && <form className="hub-panel notes-folder-form" onSubmit={event=>{
          event.preventDefault();
          void mutate({type:'folder',...folderForm},()=>{
            setFolderForm(undefined);
            setFeedback({text:'Carpeta guardada.'});
          });
        }}>
          <div className="hub-fields">
            {data.folders.length>0&&<label>Carpeta<select disabled={busy} value={folderForm.id??''} onChange={event=>{
              const folder=data.folders.find(item=>item.id===event.target.value);
              setFolderForm(folder??{name:'',group:'folder'});
            }}>
              <option value="">Nueva carpeta</option>
              {libraryFolders(data,'note',folderForm.id).map(folder=><option key={folder.id} value={folder.id}>{libraryFolderLabel(folder)}</option>)}
            </select></label>}
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
                  void mutate({type:'removeFolder',id},()=>setFolderForm(undefined));
                }}));
              }}>Eliminar carpeta</button>
            </>}
            <button type="button" onClick={()=>setFolderForm(undefined)}>Cancelar</button>
            <button type="submit" className="hub-primary" disabled={busy || !folderForm.name.trim()}>Guardar carpeta</button>
          </div>
        </form>}

        {templatesOpened&&<TemplatesWorkspace key={`templates-${libraryRevision}`} visible={visible&&section==='templates'}/>}
        <QuickNotesEditor visible={visible&&surfaceVisible&&section==='quickNotes'}/>
        <Whiteboard visible={visible&&surfaceVisible&&section==='whiteboard'} dark={appearance.theme==='dark'} confirm={setConfirmation}/>
        {visible&&section==='passwords'&&<PasswordVault/>}
        {visible&&surfaceVisible&&section==='translator'&&<TranslatorWorkspace/>}
        {data && section==='settings' && <div className="hub-panel">
          <h2>Tema del lector</h2>
          <p>El lector conserva su contraste claro u oscuro. La navegación y Templates usan la apariencia general de ZEN.</p>
          <div className="hub-switch" aria-label="Tema del lector">
            {(['light','dark'] as const).map(theme=><button type="button" key={theme} aria-pressed={data.theme===theme}
              disabled={busy} onClick={()=>void mutate({type:'theme',theme})}>{theme==='light'?'Claro':'Oscuro'}</button>)}
          </div>
        </div>}
        {data && section==='backup' && <div className="hub-panel">
          <h2>Biblioteca local</h2>
          <p>Exporta la biblioteca o restáurala desde un respaldo del {hubName} o una copia completa de ZEN.</p>
          <div className="hub-tools">
            <button type="button" disabled={busy} onClick={()=>void files({type:'export'})}><Download size={16}/>Exportar JSON</button>
            <button type="button" disabled={busy} onClick={()=>void files({type:'import'})}><Upload size={16}/>Restaurar biblioteca</button>
          </div>
        </div>}

        {data && (section==='prompt'||section==='entry') &&
          <div ref={library} className="hub-library" data-reader-open={readerOpen && Boolean(draft)} data-entry={section==='entry'}>
            {section==='prompt'&&<aside className="hub-items" aria-label="Elementos de la sección">
              <div className="hub-toolbar">
                <span>{items.length} {items.length===1?'elemento':'elementos'}</span>
                <button type="button" aria-label="Crear prompt" title="Crear prompt" disabled={busy} onClick={()=>create('prompt')}><Plus size={17}/></button>
              </div>
              <div className="hub-list-filters">
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
            </aside>}
            {draft && <div className="hub-reader" data-reader-theme={theme} style={appearanceVars({...appearance,theme:glassTheme})}>
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
                  void mutate({type:'remove',id:saved.id},()=>{
                    if(section==='entry')showLocation('prompt');
                    else {setDraft(undefined);setReaderOpen(false);}
                    setFeedback({text:'Elemento eliminado.'});
                  });
                }})}
                exportMarkdown={()=>saved&&void files({type:'markdown',id:saved.id})}
                attach={()=>void files({type:'image'})}
                copy={copy}
                openUrl={url=>void files({type:'url',url})} openEntry={entry=>choose(entry,true)}
              />
            </div>}
          </div>
        }
      </main>
    </div>
    {visible && data && showSearch && <HubSearch data={data}
      close={()=>toggleSearch(false)} choose={entry=>choose(entry,true)}/>}
    {visible && confirmation && <dialog ref={confirmRef} className="hub-dialog hub-confirm" aria-label="Confirmación"
      onCancel={event=>{event.preventDefault();setConfirmation(undefined);}}>
      <p>{confirmation.text}</p>
      <div className="hub-tools"><button type="button" autoFocus onClick={()=>setConfirmation(undefined)}>Cancelar</button>
        <button type="button" className="hub-primary" onClick={()=>{setConfirmation(undefined);confirmation.run();}}>{confirmation.label}</button></div>
    </dialog>}
  </section>;
}
