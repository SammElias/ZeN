import React, {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {ArrowLeft,Copy,ExternalLink,Layers3,Maximize2,Pencil,Plus,Search,Star,Trash2,X} from 'lucide-react';
import {enterpriseTemplateArea,templateAreas} from '../shared/enterprise-template-catalog';
import {
  emptyTemplate,personalizeTemplate,templatePrompt,templateVariableLabels,templateVariables,TemplateFields,
  type TemplateDetail,type TemplateDraft,type TemplatePlatform,type TemplateReply,type TemplateRequest,type TemplateSummary,
} from '../shared/knowledge-templates';
import {interfaceAudio} from './companion-interface-audio';
import {TemplateEditor} from './TemplateEditor';
import {storedReference,TemplateReference} from './TemplateReference';
import './TemplatesWorkspace.css';

type Feedback = {text:string;error?:boolean};
type Confirmation = 'delete' | 'discard' | 'zoom';
type View = 'gallery' | 'detail' | 'editor';
const message = (error:unknown) => error instanceof Error ? error.message : 'No se pudo completar la operación.';
const clean = (text:string) => text.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('es');

async function send(action:TemplateRequest) {
  const result=await window.companion.templates(action);
  if(!result.ok)throw Error(result.error);
  return result.value;
}

async function request<K extends TemplateReply['type']>(action:TemplateRequest,type:K) {
  const result=await send(action);
  if(result.type!==type)throw Error('La operación del template no devolvió el resultado esperado.');
  return result as Extract<TemplateReply,{type:K}>;
}

function Tags({tags,max=tags.length}:{tags:string[];max?:number}) {
  return tags.length>0&&<ul className="template-tags" aria-label="Etiquetas">
    {tags.slice(0,max).map((tag,index)=><li key={index}>{tag}</li>)}
  </ul>;
}

function FavoriteButton({item,busy,onClick}:{item:TemplateSummary;busy:boolean;onClick:()=>void}) {
  return <button type="button" className="template-favorite" aria-pressed={item.favorite}
    aria-label={`Favorito · ${item.name}`} title={item.favorite?'Quitar de favoritos':'Marcar como favorito'}
    disabled={busy} onClick={onClick}><Star size={16} fill={item.favorite?'currentColor':'none'}/></button>;
}

function TemplateModal({kind,item,visible,busy,onClose,onConfirm}:{
  kind:Confirmation;item?:TemplateDetail;visible:boolean;busy:boolean;onClose:()=>void;onConfirm:()=>void;
}) {
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    const element=dialog.current,previous=document.activeElement;
    if(visible&&element&&!element.open)element.showModal();
    return ()=>{
      if(element?.open)element.close();
      if(previous instanceof HTMLElement&&previous.isConnected)previous.focus({preventScroll:true});
    };
  },[visible]);
  const zoom=kind==='zoom',deleting=kind==='delete';
  return <dialog ref={dialog} className={`hub-dialog ${zoom?'template-zoom':''}`}
    aria-label={zoom?'Referencia visual':deleting?'Eliminar template':'Descartar borrador'}
    onCancel={event=>{event.preventDefault();if(!busy)onClose();}}>
    {zoom&&item ? <>
      <header><h2>Referencia visual · {item.name}</h2><button type="button" aria-label="Cerrar imagen" onClick={onClose}><X size={17}/></button></header>
      <TemplateReference src={storedReference(item)} name={item.name}/>
    </> : <>
      <p>{deleting?`¿Eliminar «${item?.name}»?`:'Hay cambios sin guardar en este template.'}</p>
      <div className="hub-tools">
        <button type="button" autoFocus disabled={busy} onClick={onClose}>Cancelar</button>
        <button type="button" disabled={busy} onClick={onConfirm}>{deleting?'Eliminar template':'Descartar borrador'}</button>
      </div>
    </>}
  </dialog>;
}

export function TemplatesWorkspace({visible}:{visible:boolean}) {
  const [items,setItems]=useState<TemplateSummary[]>();
  const [item,setItem]=useState<TemplateDetail>();
  const [draft,setDraft]=useState<TemplateDraft>();
  const [query,setQuery]=useState('');
  const [style,setStyle]=useState('');
  const [favorites,setFavorites]=useState(false);
  const [values,setValues]=useState<Record<string,string>>({});
  const [platform,setPlatform]=useState<TemplatePlatform>('canvas');
  const [busy,setBusy]=useState(false);
  const [retry,setRetry]=useState(0);
  const [loadError,setLoadError]=useState<string>();
  const [feedback,setFeedback]=useState<Feedback>();
  const [modal,setModal]=useState<Confirmation>();
  const scroller=useRef<HTMLElement>(null);
  const detailHeading=useRef<HTMLHeadingElement>(null);
  const search=useRef<HTMLInputElement>(null);
  const opener=useRef<HTMLButtonElement>(null);
  const returnFocus=useRef(false);
  const loaded=useRef(false);
  const lock=useRef(false);
  const draftRevision=useRef(0);
  const scroll=useRef<Record<View,number>>({gallery:0,detail:0,editor:0});
  const view:View=draft?'editor':item?'detail':'gallery';

  useEffect(()=>{
    if(!visible)return;
    let active=true;
    setLoadError(undefined);
    void request({type:'list'},'list').then(result=>{
      if(!active)return;
      setItems(result.items);
      if(!loaded.current&&result.draft){
        setDraft(result.draft);
        setFeedback({text:'Borrador recuperado.'});
      }
      loaded.current=true;
    }).catch(error=>{if(active)setLoadError(message(error));});
    return ()=>{active=false;};
  },[visible,retry]);

  useLayoutEffect(()=>{
    if(!visible||!scroller.current)return;
    scroller.current.scrollTop=scroll.current[view];
    if(returnFocus.current&&view==='gallery'){
      returnFocus.current=false;
      (opener.current?.isConnected?opener.current:search.current)?.focus({preventScroll:true});
      return;
    }
    if(view==='detail')detailHeading.current?.focus({preventScroll:true});
  },[view,visible,item?.id]);

  useEffect(()=>{
    if(!visible)return;
    const shortcuts=(event:KeyboardEvent)=>{
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'&&view==='gallery'){
        event.preventDefault();search.current?.focus();
      }
    };
    document.addEventListener('keydown',shortcuts);
    return ()=>document.removeEventListener('keydown',shortcuts);
  },[visible,view]);

  async function act(run:()=>Promise<void>) {
    if(lock.current)return;
    lock.current=true;setBusy(true);setFeedback(undefined);
    try {await run();}
    catch(error){setFeedback({text:message(error),error:true});}
    finally{lock.current=false;setBusy(false);}
  }

  function rememberGalleryScroll() {
    if(view==='gallery'&&scroller.current)scroll.current.gallery=scroller.current.scrollTop;
  }

  function show(detail:TemplateDetail, resetValues = true) {
    scroll.current.detail=0;
    setItem(detail);
    if(resetValues){setValues({});setPlatform('canvas');}
  }

  function returnToGallery() {
    returnFocus.current=true;setItem(undefined);setFeedback(undefined);interfaceAudio.play('close');
  }

  function updateDraft(next:TemplateDraft, changeImage = false) {
    setDraft(next);
    const revision=++draftRevision.current;
    void request({type:'draft',draft:changeImage?next:{...next,image:undefined}},'done')
      .catch(error=>{if(revision===draftRevision.current)setFeedback({text:'No se pudo guardar el borrador. '+message(error),error:true});});
  }

  function edit() {
    if(lock.current)return;
    rememberGalleryScroll();
    const fields=item?TemplateFields.parse({
      name:item.name,description:item.description,prompt:item.prompt,reactPrompt:item.reactPrompt,tags:item.tags,
      author:item.author,sourceUrl:item.sourceUrl,features:item.features,useCases:item.useCases,
    }):emptyTemplate();
    scroll.current.editor=0;
    updateDraft({id:item?.id,expected:item?.updatedAt,fields,image:item?undefined:null},true);
    interfaceAudio.play('open');
  }

  function include(detail:TemplateSummary) {
    setItems(current=>{
      const list=current??[];
      return list.some(entry=>entry.id===detail.id)?list.map(entry=>entry.id===detail.id?detail:entry):[...list,detail];
    });
  }

  function favorite(target:TemplateSummary) {
    void act(async()=>{
      const {favorite}=await request({type:'favorite',id:target.id},'favorite');
      setItems(current=>current?.map(entry=>entry.id===target.id?{...entry,favorite}:entry));
      setItem(current=>current?.id===target.id?{...current,favorite}:current);
    });
  }

  async function confirm() {
    if(modal==='discard'){
      draftRevision.current++;
      await request({type:'draft',draft:null},'done');
      setDraft(undefined);
    }else if(item&&modal==='delete'){
      await request({type:'delete',id:item.id,expected:item.updatedAt},'done');
      setItems(current=>current?.filter(entry=>entry.id!==item.id));
      returnToGallery();
      setFeedback({text:'Template eliminado.'});
    }
    setModal(undefined);
  }

  const areas=Object.values(templateAreas).filter(area=>items?.some(entry=>enterpriseTemplateArea(entry.id)===area||entry.tags.includes(area)));
  const categories=[...new Set((items??[]).flatMap(entry=>entry.tags))].filter(tag=>!areas.some(area=>area===tag)).sort((a,b)=>a.localeCompare(b,'es'));
  const terms=clean(query.trim()).split(/\s+/).filter(Boolean);
  const results=items?.filter(entry=>{
    const area=enterpriseTemplateArea(entry.id);
    if((favorites&&!entry.favorite)||(style&&style!==area&&!entry.tags.includes(style)))return false;
    const searchable=clean([entry.name,entry.description,area,...entry.tags].join(' '));
    return terms.every(term=>searchable.includes(term));
  });
  const prompt=item?templatePrompt(item,platform)??item.prompt:'';
  const variables=templateVariables(prompt);
  const adapted=personalizeTemplate(prompt,values);
  function copyPrompt(personalized:boolean) {
    if(!item)return;
    const substitutions=personalized?Object.fromEntries(variables.map(key=>[key,values[key]??''])):{};
    void act(async()=>{
      await request({type:'copy',id:item.id,platform:item.reactPrompt?.trim()?platform:undefined,values:substitutions},'done');
      setFeedback({text:'Copiado.'});
    });
  }
  const openReference = (detail:TemplateDetail) => visible?storedReference(detail):undefined;

  return <section ref={scroller} className="templates-view" hidden={!visible} inert={!visible} aria-label="Templates"
    onScroll={event=>{if(visible)scroll.current[view]=event.currentTarget.scrollTop;}}>
    {feedback&&<div className="hub-feedback" role={feedback.error?'alert':'status'}>
      <span>{feedback.text}</span><button type="button" aria-label="Cerrar aviso" onClick={()=>setFeedback(undefined)}><X size={14}/></button>
    </div>}
    <div className="template-gallery" hidden={view!=='gallery'}>
      <div className="template-intro">
        <p>Interfaces empresariales para Power Apps Canvas y React</p>
        <button type="button" className="hub-primary" onClick={edit} disabled={!items||busy||Boolean(loadError)}><Plus size={17}/>Nuevo template</button>
      </div>
      <div className="template-filters">
        <label className="template-search"><Search size={17}/><input ref={search} type="search" aria-label="Buscar templates"
          placeholder="Buscar por nombre, descripción o etiqueta" value={query} onChange={event=>setQuery(event.target.value)}/></label>
        <select aria-label="Filtrar por categoría" value={style} onChange={event=>setStyle(event.target.value)}>
          <option value="">Todas las categorías</option>
          {style&&!areas.some(area=>area===style)&&!categories.includes(style)&&<option value={style}>{style}</option>}
          {areas.length>0&&<optgroup label="Áreas de trabajo">{areas.map(area=><option key={area} value={area}>{area}</option>)}</optgroup>}
          {categories.length>0&&<optgroup label="Etiquetas">{categories.map(tag=><option key={tag} value={tag}>{tag}</option>)}</optgroup>}
        </select>
        <button type="button" aria-pressed={favorites} onClick={()=>setFavorites(!favorites)}><Star size={16} fill={favorites?'currentColor':'none'}/>Favoritos</button>
      </div>
      {loadError?<div className="hub-panel template-empty" role="alert">
        <p>{loadError}</p><button type="button" onClick={()=>setRetry(value=>value+1)}>Volver a intentar</button>
      </div>:!results?<p role="status">Cargando templates…</p>:results.length===0?<div className="hub-panel template-empty">
        <Layers3 size={24}/>
        <p>{items?.length?'No hay templates que coincidan con estos filtros.':'La galería está vacía.'}</p>
        {!!items?.length&&<button type="button" onClick={()=>{setQuery('');setStyle('');setFavorites(false);}}>Limpiar filtros</button>}
      </div>:<ul className="template-cards" aria-label="Galería de templates">
        {results.map(entry=><li key={entry.id} className="template-card">
          <button type="button" className="template-open" aria-label={`Abrir ${entry.name}`} disabled={busy} onClick={event=>{
            opener.current=event.currentTarget;
            rememberGalleryScroll();
            void act(async()=>{
              const {item}=await request({type:'detail',id:entry.id},'detail');
              show(item);interfaceAudio.play('open');
            });
          }}>
            <span className="template-image">{visible&&view==='gallery'&&<TemplateReference src={storedReference(entry,true)} name={entry.name} thumbnail/>}</span>
            <strong>{entry.name}</strong><span className="template-description">{entry.description}</span>
          </button>
          <Tags tags={entry.tags} max={3}/><FavoriteButton item={entry} busy={busy} onClick={()=>favorite(entry)}/>
        </li>)}
      </ul>}
    </div>
    {item&&view==='detail'&&<article className="template-detail">
      <div className="template-detail-tools">
        <button type="button" onClick={returnToGallery} disabled={busy}><ArrowLeft size={16}/>Volver a Templates</button>
        <div className="hub-tools">
          <FavoriteButton item={item} busy={busy} onClick={()=>favorite(item)}/>
          <button type="button" disabled={busy} onClick={edit}><Pencil size={16}/>Editar</button>
          <button type="button" disabled={busy} onClick={()=>void act(async()=>{
            const copy=await request({type:'duplicate',id:item.id},'detail');
            include(copy.item);show(copy.item);setFeedback({text:'Template duplicado.'});
          })}><Layers3 size={16}/>Duplicar</button>
          <button type="button" disabled={busy} onClick={()=>setModal('delete')}><Trash2 size={16}/>Eliminar</button>
        </div>
      </div>
      <div className="template-copy-bar hub-panel">
        {item.reactPrompt?.trim()&&<div className="template-platforms" role="group" aria-label="Plataforma del prompt">
          <button type="button" aria-pressed={platform==='canvas'} disabled={busy} onClick={()=>setPlatform('canvas')}>Power Apps Canvas</button>
          <button type="button" aria-pressed={platform==='react'} disabled={busy} onClick={()=>setPlatform('react')}>React + TypeScript</button>
        </div>}
        <button type="button" className="hub-primary" disabled={busy} onClick={()=>copyPrompt(false)}><Copy size={16}/>Copiar prompt</button>
      </div>
      <div className="template-detail-grid">
        <figure className="template-figure hub-panel">
          <figcaption>Referencia visual</figcaption>
          {item.hasImage?<button type="button" className="template-zoom-trigger" aria-label="Ampliar referencia visual" onClick={()=>setModal('zoom')}>
            <TemplateReference src={openReference(item)} name={item.name}/><Maximize2 className="template-enlarge" size={16}/>
          </button>:<div className="template-image"><TemplateReference name={item.name}/></div>}
          {item.author&&<small>Autor · {item.author}</small>}
          {item.sourceUrl&&<button type="button" disabled={busy} onClick={()=>void act(async()=>{
            await request({type:'source',id:item.id},'done');
          })}>Abrir fuente original<ExternalLink size={14}/></button>}
        </figure>
        <div className="hub-panel template-information">
          <h2 ref={detailHeading} tabIndex={-1}>{item.name}</h2>
          <p>{item.description}</p><Tags tags={item.tags}/>
          {item.features.length>0&&<><h3>Características del diseño</h3><ul>{item.features.map((feature,index)=><li key={index}>{feature}</li>)}</ul></>}
          {item.useCases.length>0&&<><h3>Casos de uso sugeridos</h3><ul>{item.useCases.map((useCase,index)=><li key={index}>{useCase}</li>)}</ul></>}
        </div>
      </div>
      <section className="hub-panel template-prompt">
        <h3>Prompt propuesto</h3>
        <pre>{prompt}</pre>
      </section>
      {variables.length>0&&<section className="hub-panel template-adapt">
        <h3>Adaptar a mi proyecto</h3>
        <div className="template-variables template-fields">
          {variables.map(key=><label key={key}>{templateVariableLabels[key]??key}
            <input maxLength={1024} placeholder={`{{${key}}}`} value={values[key]??''} onChange={event=>setValues({...values,[key]:event.target.value})}/></label>)}
        </div>
        <details className="template-personalized"><summary>Ver prompt personalizado</summary><pre>{adapted}</pre></details>
        <button type="button" className="hub-primary" disabled={busy} onClick={()=>copyPrompt(true)}><Copy size={16}/>Copiar personalizado</button>
      </section>}
    </article>}
    {draft&&<TemplateEditor key={draft.id??'new'} draft={draft} original={items?.find(entry=>entry.id===draft.id)} busy={busy}
      visible={visible} onChange={fields=>updateDraft({...draft,fields:{...draft.fields,...fields}})}
      onImage={()=>void act(async()=>{
        const result=await send({type:'image'});
        if(result.type==='image')updateDraft({...draft,image:result.image},true);
      })}
      onRemoveImage={()=>updateDraft({...draft,image:null},true)}
      onCancel={()=>setModal('discard')}
      onSave={()=>void act(async()=>{
        const saved=await request({type:'save',draft},'detail');
        draftRevision.current++;
        setDraft(undefined);include(saved.item);show(saved.item,item?.id!==saved.item.id||!saved.item.reactPrompt?.trim());
        setFeedback({text:'Template guardado.'});
      })}/>}
    {modal&&<TemplateModal kind={modal} item={item} visible={visible} busy={busy} onClose={()=>setModal(undefined)}
      onConfirm={()=>void act(confirm)}/>}
  </section>;
}
