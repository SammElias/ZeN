import React, {useState, type ReactNode} from 'react';
import {ChevronDown, FolderOpen, SquareArrowOutUpRight} from 'lucide-react';
import {officinaReference} from '../shared/officina-reference';
import type {OfficinaAction} from '../shared/companion-officina';
import {MarkdownPreview} from './MarkdownPreview';

type Scope = {project: string; task?: string; act: (action: OfficinaAction) => Promise<boolean>};

export function OfficinaReference({target, children, project, task, act}: Scope & {target: string; children: ReactNode}) {
  const [expanded, setExpanded] = useState(false);
  const reference = officinaReference(target);
  if (!reference) return <>{children}</>;
  const open = async (mode: 'browser' | 'editor' | 'explorer') => {
    if (await act({type: 'open-reference', project, task, target, mode})) setExpanded(false);
  };
  if (reference.kind === 'web') return <button className="message-link" type="button" title={target} onClick={() => void open('browser')}>
    {children}
  </button>;
  return <span className="officina-reference" onKeyDown={event => {
    if (expanded && event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setExpanded(false);
    }
  }}>
    <button className="message-link officina-reference-trigger" type="button" title={target} aria-expanded={expanded}
      onClick={() => setExpanded(value => !value)}>{children}<ChevronDown aria-hidden="true"/></button>
    {expanded && <span className="officina-reference-actions" role="group" aria-label="Abrir archivo o carpeta">
      <button type="button" onClick={() => void open('editor')}><SquareArrowOutUpRight aria-hidden="true"/>Abrir en VS Code</button>
      <button type="button" onClick={() => void open('explorer')}><FolderOpen aria-hidden="true"/>Mostrar en el Explorador</button>
    </span>}
  </span>;
}

export function OfficinaMarkdown({text, ...scope}: Scope & {text: string}) {
  return <MarkdownPreview className="officina-response" text={text}
    renderLink={(target, children) => <OfficinaReference {...scope} target={target}>{children}</OfficinaReference>}
    renderInlineCode={target => /[\\/]|\.[a-z][a-z0-9]{0,11}(?::\d+(?::\d+)?|#L\d+)?$/i.test(target) && officinaReference(target)?.kind === 'local'
      ? <OfficinaReference {...scope} target={target}><code>{target}</code></OfficinaReference> : <code>{target}</code>}/>;
}
