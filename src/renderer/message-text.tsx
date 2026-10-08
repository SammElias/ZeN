import React,{memo} from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
export function messageLinks(text: string) {
  return [...text.matchAll(/\[([^\]\n]{1,200})\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>"\]}]+)/g)].slice(0, 8).map(match => ({ title: match[1] ?? match[3], url: (match[2] ?? match[3]).replace(/[.,;]+$/, '') }));
}
export function MessageSources({ text, notify }: { text: string; notify: (message: string) => void }) {
  const sources = messageLinks(text);
  return sources.length ? <nav className="message-sources" aria-label="Fuentes consultadas">{sources.map(({ title, url }) => <button key={url} title={url} onClick={() => void window.zen.openPage(url).then(result => { if (!result.ok) notify(result.error); })}>{title}</button>)}</nav> : null;
}
export const MessageText=memo(function MessageText({ text, notify }: { text: string; notify: (message: string) => void }) {
  // React elements only: no raw HTML plugin, remote media loading or executable links.
  const allowed=(url:string)=>/^https?:\/\//i.test(url)?url:'';
  const open=(url:string)=>void window.zen.openPage(url).then(result=>{if(!result.ok)notify(result.error);});
  return <div className="result-text markdown-text"><Markdown remarkPlugins={[remarkGfm]} skipHtml urlTransform={allowed} components={{
    a:({href,children})=>href?<button className="message-link" title={href} onClick={()=>open(href)}>{children}</button>:<span>{children}</span>,
    img:({src,alt})=>src?<button className="message-link" title={src} onClick={()=>open(src)}>Ver imagen: {alt||'imagen enlazada'}</button>:<span>{alt}</span>,
    table:({children})=><div className="markdown-table" tabIndex={0} aria-label="Tabla desplazable"><table>{children}</table></div>,
    pre:({children})=><pre tabIndex={0}>{children}</pre>,
  }}>{text}</Markdown></div>;
});
