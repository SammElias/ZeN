import React from 'react';
export function messageLinks(text: string) {
  return [...text.matchAll(/\[([^\]\n]{1,200})\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>"\]}]+)/g)].slice(0, 8).map(match => ({ title: match[1] ?? match[3], url: (match[2] ?? match[3]).replace(/[.,;]+$/, '') }));
}
export function MessageSources({ text, notify }: { text: string; notify: (message: string) => void }) {
  const sources = messageLinks(text);
  return sources.length ? <nav className="message-sources" aria-label="Fuentes consultadas">{sources.map(({ title, url }) => <button key={url} title={url} onClick={() => void window.zen.openPage(url).then(result => { if (!result.ok) notify(result.error); })}>{title}</button>)}</nav> : null;
}
export function MessageText({ text, notify }: { text: string; notify: (message: string) => void }) {
  const parts: React.ReactNode[] = []; let position = 0;
  const links = /\[([^\]\n]{1,200})\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>]+)/g;
  for (const match of text.matchAll(links)) {
    parts.push(text.slice(position, match.index));
    const url = (match[2] ?? match[3]).replace(/[.,;]+$/, '');
    const title = match[1] ?? url;
    parts.push(<button className="message-link" key={match.index} title={url} onClick={() => void window.zen.openPage(url).then(result => { if (!result.ok) notify(result.error); })}>{title}</button>);
    position = match.index! + match[0].length;
  }
  parts.push(text.slice(position));
  return <p className="result-text">{parts}</p>;
}
