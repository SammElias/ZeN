import React,{memo} from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type {MarkdownProps} from './MarkdownPreview';
export function messageLinks(text: string) {
  return [...text.matchAll(/\[([^\]\n]{1,200})\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>"\]}]+)/g)].slice(0, 8).map(match => ({ title: match[1] ?? match[3], url: (match[2] ?? match[3]).replace(/[.,;]+$/, '') }));
}
export function MessageSources({ text, notify }: { text: string; notify: (message: string) => void }) {
  const sources = messageLinks(text);
  return sources.length ? <nav className="message-sources" aria-label="Fuentes consultadas">{sources.map(({ title, url }) => <button key={url} title={url} onClick={() => void window.zen.openPage(url).then(result => { if (!result.ok) notify(result.error); })}>{title}</button>)}</nav> : null;
}
export const MarkdownText=memo(function MarkdownText({text, className, open, renderCode, renderLink, renderInlineCode}: MarkdownProps) {
  // React elements only: no raw HTML plugin, remote media loading or executable links.
  const allowed=(url:string,key:string)=>(renderLink && (key==='href' || key==='src')) || /^https?:\/\//i.test(url) ? url : '';
  return <div className={className+' markdown-text'}><Markdown remarkPlugins={[remarkGfm]} skipHtml urlTransform={allowed} components={{
    a:({href,children})=>href&&renderLink?renderLink(href,children):
      href&&open?<button type="button" className="message-link" title={href} onClick={()=>open(href)}>{children}</button>:<span title={href||undefined}>{children}</span>,
    img:({src,alt})=>typeof src==='string'&&src&&renderLink?renderLink(src,alt||'Imagen enlazada'):
      typeof src==='string'&&src&&open?<button type="button" className="message-link" title={src} onClick={()=>open(src)}>Ver imagen: {alt||'imagen enlazada'}</button>:<span>{alt}</span>,
    table:({children})=><div className="markdown-table" role="region" tabIndex={0} aria-label="Tabla desplazable"><table>{children}</table></div>,
    pre:({children})=><pre tabIndex={0}>{children}</pre>,
    code:({className,children})=>renderCode&&className?.startsWith('language-')
      ? renderCode(String(children),className.slice(9))
      : renderInlineCode&&!className&&typeof children==='string'&&!children.includes('\n')
        ? renderInlineCode(children) : <code className={className}>{children}</code>,
  }}>{text}</Markdown></div>;
});

export const MessageText=memo(function MessageText({ text, notify }: { text: string; notify: (message: string) => void }) {
  const open=(url:string)=>void window.zen.openPage(url).then(result=>{if(!result.ok)notify(result.error);});
  return <MarkdownText text={text} className="result-text" open={open}/>;
});
