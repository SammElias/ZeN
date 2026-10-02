import React,{useCallback,useEffect,useRef,useState} from 'react';
import {prepareInputImage} from './Composer';
import type {ContextAttachment,WindowDropEvent} from '../shared/drop-context';
import type {FolderAttachment} from '../main/folder-context';
import './drop-context.css';

export function useDropContext({notify,expand,folder,onFolder,onAttach}:{notify:(message:string)=>void;expand:()=>void;folder?:FolderAttachment;onFolder:(folder:FolderAttachment)=>void;onAttach:()=>void}){
  const [items,setItems]=useState<ContextAttachment[]>([]),[hover,setHover]=useState(false),[preparing,setPreparing]=useState(false),[windowEvent,setWindowEvent]=useState<WindowDropEvent>();
  const current=useRef(items),depth=useRef(0),generation=useRef(0),busy=useRef(false),options=useRef({notify,expand,folder,onFolder,onAttach});current.current=items;options.current={notify,expand,folder,onFolder,onAttach};
  const add=useCallback((added:ContextAttachment[])=>{
    const next=[...current.current,...added];
    const error=next.length>8?'Máximo 8 adjuntos por petición.':next.filter(item=>['image','window'].includes(item.kind)).length>1?'Añade una imagen o ventana por petición; puedes combinarla con documentos y texto.':undefined;
    if(error){added.forEach(item=>void window.zen.removeContextAttachment(item.id));throw new Error(error);}
    current.current=next;setItems(next);options.current.onAttach();options.current.expand();
  },[]);
  useEffect(()=>{void window.zen.activeContextAttachments(items.map(item=>item.id)).then(result=>{if(!result.ok&&items.length)options.current.notify(result.error);});},[items]);
  useEffect(()=>window.zen.onWindowDrop(event=>{
    setWindowEvent(event);
    if(event.state==='ready'&&event.item){setWindowEvent(undefined);if(options.current.folder){void window.zen.removeContextAttachment(event.item.id);return options.current.notify('Quita la carpeta antes de añadir una ventana.');}try{add([event.item]);}catch(error){options.current.notify((error as Error).message);}}
    if(event.state==='error')options.current.notify(event.error??'No se pudo adjuntar la ventana.');
  }),[add]);
  const remove=(id:string)=>{void window.zen.removeContextAttachment(id);setItems(rows=>rows.filter(item=>item.id!==id));};
  const clear=()=>{++generation.current;current.current.forEach(item=>void window.zen.removeContextAttachment(item.id));current.current=[];setItems([]);setHover(false);setWindowEvent(undefined);};
  const receive=async(event:React.DragEvent)=>{
    event.preventDefault();event.stopPropagation();depth.current=0;setHover(false);if(busy.current)return;
    // Snapshot synchronously: DataTransfer becomes protected after dispatch.
    const files=Array.from(event.dataTransfer.files),uri=event.dataTransfer.getData('text/uri-list').split(/\r?\n/).find(line=>line.trim()&&!line.startsWith('#'))?.trim(),plain=event.dataTransfer.getData('text/plain'),html=event.dataTransfer.getData('text/html');
    const text=plain||(!uri&&html?html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' '):'');
    const stamp=++generation.current;busy.current=true;setPreparing(true);const added:ContextAttachment[]=[];
    try{
      if(options.current.folder)throw new Error('Quita la carpeta antes de añadir otro contexto.');
      if(files.length){
        if(files.length+current.current.length>8)throw new Error('Máximo 8 adjuntos por petición.');
        const images=files.filter(file=>file.type.startsWith('image/')),local=files.filter(file=>!file.type.startsWith('image/'));
        if(local.length){const r=await window.zen.dropFiles(local);if(!r.ok)throw new Error(r.error);if(r.value.folder){if(images.length||current.current.length) {await window.zen.removeContextFolder(r.value.folder.id);throw new Error('Arrastra la carpeta sola para analizarla en Codex.');}if(stamp!==generation.current){await window.zen.removeContextFolder(r.value.folder.id);return;}options.current.onFolder(r.value.folder);options.current.onAttach();options.current.expand();return;}added.push(...r.value.items??[]);}
        for(const file of images){const r=await window.zen.dropImage(await prepareInputImage(file));if(!r.ok)throw new Error(r.error);added.push(r.value);}
      }else{
        if(!uri&&!text.trim())throw new Error('Este elemento no ofrece archivo, imagen, enlace ni texto. Prueba desde el Explorador o copia su contenido.');
        const r=await window.zen.dropText({text:uri||text,link:!!uri});if(!r.ok)throw new Error(r.error);added.push(r.value);
      }
      if(stamp!==generation.current){added.forEach(item=>void window.zen.removeContextAttachment(item.id));return;}
      add(added);
    }catch(error){added.forEach(item=>void window.zen.removeContextAttachment(item.id));if(stamp===generation.current)options.current.notify((error as Error).message);}
    finally{busy.current=false;setPreparing(false);}
  };
  const active=hover||windowEvent?.state==='hover'||windowEvent?.state==='preparing'||preparing;
  const label=preparing||windowEvent?.state==='preparing'?'Preparando contexto…':windowEvent?.state==='hover'?'Suelta la ventana para adjuntarla':'Suelta para añadir contexto';
  return{items,clear,cancel:()=>{++generation.current;depth.current=0;setHover(false);setWindowEvent(undefined);},preparing:preparing||windowEvent?.state==='preparing',active,label,handlers:{onDragEnter:(event:React.DragEvent)=>{event.preventDefault();if(++depth.current===1)setHover(true);},onDragOver:(event:React.DragEvent)=>{event.preventDefault();event.dataTransfer.dropEffect='copy';},onDragLeave:(event:React.DragEvent)=>{event.preventDefault();if(--depth.current<=0){depth.current=0;setHover(false);}},onDrop:receive},content:items.length>0&&<section className="drop-attachments" aria-label="Contexto adjunto"><span className="drop-local-note">Solo se envía al pedirlo · {items.length}/8</span>{items.map(item=><div className="drop-attachment" key={item.id}><span aria-hidden="true">{item.kind==='window'?'▣':item.kind==='link'?'↗':'▤'}</span><div><strong>{item.name}</strong><small>{item.detail}</small>{item.preview&&<details><summary>Ver referencia</summary>{item.preview.startsWith('data:image/')?<img src={item.preview} alt={`Referencia: ${item.name}`}/>:<pre>{item.preview}</pre>}</details>}</div><button aria-label={`Quitar adjunto ${item.name}`} onClick={()=>remove(item.id)}>×</button></div>)}</section>};
}
