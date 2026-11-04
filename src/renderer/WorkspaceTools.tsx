import React,{useEffect,useRef,useState} from 'react';

export const searchText=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es');
export function SearchField({value,onChange,label,placeholder}:{value:string;onChange:(value:string)=>void;label:string;placeholder?:string}){
 return <div className="view-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/></svg><input type="search" aria-label={label} placeholder={placeholder??label} maxLength={240} value={value} onChange={e=>onChange(e.target.value)}/>{value&&<button type="button" aria-label={'Limpiar '+label.toLocaleLowerCase('es')} onClick={()=>onChange('')}>×</button>}</div>;
}
export function Segments<T extends string>({label,value,items,onChange}:{label:string;value:T;items:readonly {value:T;label:string}[];onChange:(value:T)=>void}){
 return <div className="view-segments" role="group" aria-label={label}>{items.map(item=><button type="button" key={item.value} aria-pressed={value===item.value} onClick={()=>onChange(item.value)}>{item.label}</button>)}</div>;
}
/** Explicit clipboard action on content already visible in this mounted view. */
export function CopyVisible({text,label='Copiar'}:{text:string;label?:string}){
 const [result,setResult]=useState(''),live=useRef(true),epoch=useRef(0);
 useEffect(()=>{live.current=true;epoch.current++;setResult('');return()=>{live.current=false;epoch.current++;};},[text]);
 return <span className="copy-visible"><button disabled={!text} onClick={async()=>{const n=epoch.current;try{const r=await window.companion.copy(text);if(live.current&&n===epoch.current)setResult(r.ok?'Copiado':r.error);}catch{if(live.current&&n===epoch.current)setResult('No se pudo copiar');}}}>{result==='Copiado'?'Copiado ✓':label}</button>{result&&result!=='Copiado'&&<small role="status">{result}</small>}</span>;
}
