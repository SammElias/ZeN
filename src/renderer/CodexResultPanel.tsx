import React, {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {MarkdownPreview as CodexReplyText} from './MarkdownPreview';
import {parseCodexResultDocument, type CodexReferenceSelection, type CodexResultDocument} from '../shared/codex-result-document';
import type {CodexResult} from '../shared/companion-codex-result';
import {codexDocumentFormats} from './codex-document-formats';

function Reference({selection, path, line, excerpt}: {
  selection: CodexReferenceSelection;
  path: string;
  line: number;
  excerpt?: string;
}) {
  const [local, setLocal] = useState<string>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const active = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);

  async function showLine() {
    setBusy(true);
    setError('');
    try {
      const response = await window.companion.contextSource(selection);
      if (!active.current || document.hidden) return;
      if (response.ok) setLocal(response.value);
      else setError(response.error);
    } catch {
      if (active.current) setError('No se pudo abrir la línea local.');
    } finally {
      if (active.current) setBusy(false);
    }
  }

  return <details className="codex-reference">
    <summary>Referencia · <code>{path}:{line}</code></summary>
    <div>
      {local !== undefined ? <><small>Línea {line} del archivo local</small><pre>{local || ' '}</pre></> : <>
        {excerpt && <><small>Extracto devuelto por Codex</small><pre>{excerpt}</pre></>}
        <button className="codex-source-open" disabled={busy} onClick={() => void showLine()}>
          {busy ? 'Abriendo…' : 'Ver línea del archivo'}
        </button>
      </>}
      {error && <p role="alert">{error}</p>}
    </div>
  </details>;
}

function ResultDocument({result, id}: {result: CodexResultDocument; id: string}) {
  return <>
    <header className="codex-document-heading">
      <span>{codexDocumentFormats[result.type]}</span>
      <h3>{result.title}</h3>
      <p>{result.summary}</p>
    </header>
    {result.type === 'report' && <ul className="codex-document-list">
      {result.findings.map((finding, index) => <li key={index}>
        <h4>{finding.title}</h4>
        <p>{finding.detail}</p>
        {finding.sources?.map((source, sourceIndex) => <Reference key={sourceIndex} {...source}
          selection={{id, finding: index, source: sourceIndex}}/>)}
      </li>)}
    </ul>}
    {result.type === 'plan' && <ol className="codex-document-list">
      {result.steps.map((step, index) => <li key={index}><h4>{step.title}</h4><p>{step.detail}</p></li>)}
    </ol>}
    {result.type === 'comparison' && <div className="codex-comparison" tabIndex={0} role="region" aria-label="Tabla de comparación">
      <table>
        <thead><tr>{result.columns.map((column, index) => <th key={index} scope="col">{column}</th>)}</tr></thead>
        <tbody>{result.rows.map((row, index) => <tr key={index}>{row.map((cell, column) => <td key={column}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>}
  </>;
}

export function CodexResultPanel({revision, empty}: {
  revision: number;
  empty: React.ReactNode;
}) {
  const [result, setResult] = useState<CodexResult>();
  const [waiting, setWaiting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState(false);
  const pollControls = useRef<{refresh: () => void; reset: () => void}>(null);
  const lastRevision = useRef(revision);
  const copyEpoch = useRef(0);
  const documentResult = useMemo(() => result && parseCodexResultDocument(result.text), [result]);

  useLayoutEffect(() => {
    let live = true;
    let epoch = 0;
    let inFlight = false;
    let nextPoll: boolean | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function clearResult() {
      copyEpoch.current++;
      setResult(undefined);
      setCopied(false);
    }

    async function poll(explicit = false) {
      if (!live || document.hidden) return;
      if (inFlight) {
        nextPoll = Boolean(nextPoll || explicit);
        if (explicit) setBusy(true);
        return;
      }
      clearTimeout(timer);
      inFlight = true;
      const attempt = epoch;
      if (explicit) setBusy(true);
      let retry = false;
      try {
        const response = await window.companion.contextResult();
        if (!live || attempt !== epoch || document.hidden) return;
        if (!response.ok) {
          clearResult();
          setWaiting(false);
          if (explicit) setNotice(response.error);
          return;
        }
        const value = response.value;
        retry = value.state === 'waiting';
        setWaiting(retry);
        if (value.state === 'ready') {
          setResult(current => current?.id === value.result.id ? current : value.result);
          setNotice('');
        } else {
          clearResult();
          if (value.state === 'changed') setNotice('El contenido cambió. Prepara una petición nueva.');
          else if (value.state === 'expired') setNotice('La petición caducó. Puedes preparar otra.');
          else setNotice('');
        }
      } catch {
        if (live && attempt === epoch && explicit) setNotice('No se pudo actualizar. Inténtalo de nuevo.');
      } finally {
        inFlight = false;
        if (live && nextPoll !== undefined) {
          const explicit = nextPoll;
          nextPoll = undefined;
          void poll(explicit);
        } else if (live && attempt === epoch) {
          setBusy(false);
          if (retry && !document.hidden) timer = setTimeout(() => void poll(), 4000);
        }
      }
    }

    function resetAndPoll() {
      clearTimeout(timer);
      nextPoll = undefined;
      epoch++;
      clearResult();
      setWaiting(false);
      setBusy(false);
      setNotice('');
      void poll();
    }

    pollControls.current = {refresh: () => void poll(true), reset: resetAndPoll};
    void poll();
    document.addEventListener('visibilitychange', resetAndPoll);
    return () => {
      live = false;
      pollControls.current = null;
      copyEpoch.current++;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', resetAndPoll);
    };
  }, []);

  useLayoutEffect(() => {
    if (lastRevision.current === revision) return;
    lastRevision.current = revision;
    pollControls.current?.reset();
  }, [revision]);

  if (!result && !waiting && !notice) return <>{empty}</>;

  async function copy() {
    if (!result || document.hidden) return;
    const attempt = copyEpoch.current;
    try {
      const response = await window.companion.copy(result.text);
      if (attempt !== copyEpoch.current) return;
      if (response.ok) setCopied(true);
      else setNotice(response.error);
    } catch {
      if (attempt === copyEpoch.current) setNotice('No se pudo copiar el resultado.');
    }
  }

  return <section className="codex-output" aria-label="Respuesta de Codex" aria-busy={busy}>
    <header className="codex-output-toolbar">
      <div><h2>Resultado</h2>{result && <small>{result.label}</small>}</div>
      <button className="codex-result-fetch" disabled={busy} onClick={() => pollControls.current?.refresh()}>
        {busy ? 'Buscando…' : 'Actualizar'}
      </button>
    </header>
    {waiting && <p className="codex-result-waiting" role="status">
      Esperando la respuesta de Codex.
    </p>}
    {result && <div className="codex-result-content codex-result-arrival" key={result.id}>
      {documentResult
        ? <ResultDocument result={documentResult} id={result.id}/>
        : <CodexReplyText className="codex-result-text" text={result.text}/>}
      <div className="codex-result-actions">
        <button onClick={() => void copy()}>{copied ? 'Copiado' : documentResult ? 'Copiar datos' : 'Copiar'}</button>
        <button onClick={() => void window.companion.openCodex()}>Abrir Codex</button>
      </div>
    </div>}
    {notice && <p className="codex-result-waiting" role="status">{notice}</p>}
  </section>;
}
