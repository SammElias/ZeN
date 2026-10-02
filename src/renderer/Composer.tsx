import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';
import type {FolderAttachment} from '../main/folder-context';
function AttachIcon({kind='clip'}:{kind?:'clip'|'screen'|'folder'}){const path={clip:'m8 12 6-6a3 3 0 0 1 4 4l-8 8a5 5 0 0 1-7-7l8-8',screen:'M3 4h18v13H3zM8 21h8M12 17v4',folder:'M3 7V5h6l2 2h10v13H3z'}[kind];return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path}/></svg>;}
export async function prepareInputImage(file:File){
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>12000000)throw new Error('Usa una imagen PNG, JPEG o WebP de hasta 12 MB.');
  // Production allows data: images, but deliberately disallows blob: images.
  const dataUrl=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>typeof reader.result==='string'?resolve(reader.result):reject(new Error('No se pudo leer la captura. Vuelve a copiarla o elige un archivo de imagen.'));reader.onerror=reader.onabort=()=>reject(new Error('No se pudo leer la captura. Vuelve a copiarla o elige un archivo de imagen.'));reader.readAsDataURL(file);});
    const image=new Image();image.src=dataUrl;try{await image.decode();}catch{throw new Error('No se pudo abrir esta imagen. Vuelve a copiar la captura o elige un PNG, JPEG o WebP válido.');}
    if(!image.width||!image.height||image.width>8000||image.height>8000||image.width*image.height>25000000)throw new Error('La imagen es demasiado grande.');
    const scale=Math.min(1,1920/Math.max(image.width,image.height)),canvas=document.createElement('canvas');canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);
    const context=canvas.getContext('2d');if(!context)throw new Error('No se pudo preparar la imagen.');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
    const data=canvas.toDataURL('image/jpeg',.85);if(data.length>3000000)throw new Error('La captura es demasiado grande.');return data;
}
export function Composer({send,notify,refresh,chooseFolder,folder,removeFolder,draft,clipboard,selection,region,changed,contextAttached=false,preparingContext=false}: {contextAttached?:boolean;preparingContext?:boolean;draft?:{text:string;stamp:number};clipboard?:()=>void;selection?:()=>void;region?:()=>void;changed?:(text:string)=>void;send:(text:string,image?:string)=>Promise<void>;notify:(text:string)=>void;refresh:()=>Promise<boolean>;chooseFolder:()=>Promise<void>;folder?:FolderAttachment;removeFolder:()=>void}){
  const [text,setText]=useState(''),[image,setImage]=useState<string>(),[sending,setSending]=useState(false),[preparing,setPreparing]=useState(false);
  useEffect(()=>{if(draft){setText(draft.text);changed?.(draft.text);input.current?.focus();}},[draft]);
  const picker=useRef<HTMLInputElement>(null),generation=useRef(0),sendingRef=useRef(false);
  const input=useRef<HTMLTextAreaElement>(null);
  const [menu,setMenu]=useState(false);const menuRoot=useRef<HTMLDivElement>(null),menuButton=useRef<HTMLButtonElement>(null);
  useEffect(()=>{if(!menu)return;const outside=(event:PointerEvent)=>{if(!menuRoot.current?.contains(event.target as Node))setMenu(false);};const keyboard=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setMenu(false);menuButton.current?.focus();}if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();event.stopPropagation();const items=Array.from(menuRoot.current?.querySelectorAll<HTMLButtonElement>('[role=menuitem]')??[]);const current=items.indexOf(document.activeElement as HTMLButtonElement);items[event.key==='Home'?0:event.key==='End'?items.length-1:(current+(event.key==='ArrowUp'?-1:1)+items.length)%items.length]?.focus();}};document.addEventListener('pointerdown',outside,true);document.addEventListener('keydown',keyboard,true);return()=>{document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',keyboard,true);};},[menu]);
  const option=(action:()=>void)=>{setMenu(false);action();};
  useLayoutEffect(()=>{
    const field=input.current;if(!field)return;
    const resize=()=>{
      field.style.height='36px';
      // Placeholder wrapping during the capsule's opening animation is not input.
      const naturalHeight=field.value?field.scrollHeight:36;
      field.style.height=Math.min(70,naturalHeight)+'px';
      field.style.overflowY=naturalHeight>70?'auto':'hidden';
    };
    let width=field.getBoundingClientRect().width;
    const observer=new ResizeObserver(()=>{const next=field.getBoundingClientRect().width;if(next!==width){width=next;resize();}});
    resize();observer.observe(field);return()=>observer.disconnect();
  },[text]);
  const attach=async(file:File)=>{const current=++generation.current;setPreparing(true);try{const data=await prepareInputImage(file);if(current===generation.current){setImage(data);notify('');}}catch(error){if(current===generation.current)notify((error as Error).message);}finally{if(current===generation.current)setPreparing(false);}};
  const submit=async()=>{if(sendingRef.current||preparing||preparingContext||(!text.trim()&&!image&&!contextAttached))return;sendingRef.current=true;setSending(true);try{await send(text.trim()||(contextAttached?'Ayúdame a interpretar el contexto adjunto.':'Ayúdame con lo que aparece en esta captura.'),image);setText('');setImage(undefined);}catch(error){notify((error as Error).message);}finally{sendingRef.current=false;setSending(false);}};
  return <form className="text-composer" aria-label="Escribir a ZEN" onSubmit={event=>{event.preventDefault();void submit();}} onPaste={event=>{const file=Array.from(event.clipboardData.files).find(row=>row.type.startsWith('image/'));if(file&&!sending){event.preventDefault();void attach(file);}}}>
    {image&&<div className="composer-attachment"><img src={image} alt="Captura pegada para enviar"/><span>Tu captura · se enviará con el mensaje</span><button type="button" aria-label="Quitar captura pegada" disabled={sending} onClick={()=>{++generation.current;setImage(undefined);setPreparing(false);}}>×</button></div>}
    {folder&&<div className="composer-folder" title={folder.label}><AttachIcon kind="folder"/><span><strong>{folder.name}</strong><small>Analizar en Codex del escritorio</small></span><button type="button" aria-label="Quitar carpeta del proyecto" disabled={sending} onClick={removeFolder}>×</button></div>}
    <div className="composer-row"><input ref={picker} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={event=>{const file=event.target.files?.[0];if(file)void attach(file);event.target.value='';}}/>
      <div className="attach-menu-anchor" ref={menuRoot}><button ref={menuButton} type="button" className="composer-attach" aria-label="Añadir contexto" aria-haspopup="menu" aria-expanded={menu} disabled={sending||preparing} onClick={()=>setMenu(value=>!value)}><AttachIcon/></button>
      {menu&&<div className="attach-menu" role="menu" aria-label="Añadir contexto"><span className="attach-menu-heading">Añadir</span>{selection&&<button type="button" role="menuitem" onClick={()=>option(selection)}><span>Texto seleccionado · Ctrl+Alt+S</span></button>}{clipboard&&<button type="button" role="menuitem" onClick={()=>option(clipboard)}><span>Texto copiado</span></button>}{region&&<button type="button" role="menuitem" onClick={()=>option(region)}><span>Zona de pantalla</span></button>}<button type="button" role="menuitem" onClick={()=>option(()=>void refresh())}><AttachIcon kind="screen"/><span><strong>Captura automática</strong><small>Actualizar la pantalla de ZEN</small></span></button><button type="button" role="menuitem" onClick={()=>option(()=>picker.current?.click())}><AttachIcon/><span><strong>Captura manual</strong><small>Añadir una imagen · también Ctrl+V</small></span></button><button type="button" role="menuitem" onClick={()=>option(()=>void chooseFolder())}><AttachIcon kind="folder"/><span><strong>Carpeta del proyecto</strong><small>Abrir y analizar en Codex del escritorio</small></span></button></div>}</div>
      <textarea ref={input} id="chat-input" aria-label="Mensaje para ZEN" placeholder="Escribe o pega una captura…" rows={1} maxLength={8000} value={text} disabled={sending} onChange={event=>{setText(event.target.value);changed?.(event.target.value);}} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();void submit();}}}/><button type="submit" className="composer-send" aria-label="Enviar mensaje" disabled={sending||preparing||preparingContext||(!text.trim()&&!image&&!contextAttached)}>{sending||preparing?'…':'↑'}</button></div>
  </form>;
}
