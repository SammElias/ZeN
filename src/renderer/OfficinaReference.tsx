import React, {Children, cloneElement, isValidElement, useState, type ReactElement, type ReactNode} from 'react';
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

type TableElement = ReactElement<{children?: ReactNode; role?: string; 'data-column'?: string}>;
const tableElements = (children: ReactNode) =>
  Children.toArray(children).filter((child): child is TableElement => isValidElement(child));

function headerText(node: ReactNode): string {
  return Children.toArray(node).map(child => typeof child === 'string' || typeof child === 'number' ? String(child) :
    isValidElement<TableElement['props']>(child) ? headerText(child.props.children) : '').join('');
}

function reportTable(children: ReactNode) {
  const sections = tableElements(children);
  const header = sections.find(section => section.type === 'thead');
  const firstRow = tableElements(header?.props.children)[0];
  const columns = tableElements(firstRow?.props.children).map(cell => headerText(cell.props.children));
  return <div className="markdown-table officina-report-table" role="region" aria-label="Tabla del informe" tabIndex={0}>
    <table role="table" data-stack={columns.length > 1 || undefined}>
      {sections.map(section => cloneElement(section, {role: 'rowgroup'},
        tableElements(section.props.children).map(row => cloneElement(row, {role: 'row'},
          tableElements(row.props.children).map((cell, index) => cloneElement(cell, {
            role: section.type === 'thead' ? 'columnheader' : 'cell',
            'data-column': section.type === 'thead' ? undefined : columns[index],
          })),
        )),
      ))}
    </table>
  </div>;
}

export function OfficinaMarkdown({text, ...scope}: Scope & {text: string}) {
  return <MarkdownPreview className="officina-response" text={text}
    renderTable={reportTable}
    renderLink={(target, children) => <OfficinaReference {...scope} target={target}>{children}</OfficinaReference>}
    renderInlineCode={target => /[\\/]|\.[a-z][a-z0-9]{0,11}(?::\d+(?::\d+)?|#L\d+)?$/i.test(target) && officinaReference(target)?.kind === 'local'
      ? <OfficinaReference {...scope} target={target}><code>{target}</code></OfficinaReference> : <code>{target}</code>}/>;
}
