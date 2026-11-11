import React, {useCallback, useEffect, useRef, useState} from 'react';
import type {CodexDocumentFormat} from '../shared/codex-result-document';
import type {ContextFile, ContextInput, ContextPreview} from '../shared/companion-context';
import {codexDocumentFormats} from './codex-document-formats';
import {CodexResultPanel} from './CodexResultPanel';
import './CodexContext.css';

const sourceTypes = [
  {id: 'file', label: 'Archivo'},
  {id: 'page', label: 'Página'},
  {id: 'text', label: 'Texto'},
] as const;

type SourceKind = typeof sourceTypes[number]['id'];

export function CodexContext({disabled, targetTitle, children}: {
  disabled: boolean;
  targetTitle?: string;
  children: React.ReactNode;
}) {
  const [sourceOpen, setSourceOpen] = useState(false);
  const [kind, setKind] = useState<SourceKind>('file');
  const [format, setFormat] = useState<CodexDocumentFormat>('report');
  const [file, setFile] = useState<ContextFile | null>(null);
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [instruction, setInstruction] = useState('');
  const [review, setReview] = useState<ContextPreview>();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [resultRevision, setResultRevision] = useState(0);
  const instructionField = useRef<HTMLTextAreaElement>(null);
  const live = useRef(false);
  const sequence = useRef(0);
  const pending = useRef<ContextPreview | undefined>(undefined);
  const flight = useRef(false);

  const cancelReview = useCallback(() => {
    sequence.current++;
    const old = pending.current;
    pending.current = undefined;
    setReview(undefined);
    if (old) void window.companion.contextCancel(old.id).catch(() => {});
  }, []);

  useEffect(() => {
    live.current = true;
    const refreshFile = () => {
      const attempt = sequence.current;
      if (disabled || !targetTitle || document.hidden) return;
      void window.companion.contextStatus().then(response => {
        if (live.current && sequence.current === attempt && response.ok && !document.hidden) setFile(response.value);
      }).catch(() => {});
    };
    const visibility = () => {
      if (!document.hidden) {
        refreshFile();
        return;
      }
      cancelReview();
      setSourceOpen(false);
      setFile(null);
      setUrl('');
      setText('');
      setInstruction('');
      setNotice('');
      setError('');
    };
    refreshFile();
    document.addEventListener('visibilitychange', visibility);
    return () => {
      live.current = false;
      cancelReview();
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [cancelReview, disabled, targetTitle]);

  useEffect(() => {
    if (!review) return;
    const timer = setTimeout(() => {
      cancelReview();
      setError('La revisión caducó. Revisa la petición de nuevo.');
    }, Math.max(0, review.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [review, cancelReview]);

  function edit() {
    cancelReview();
    setError('');
  }

  async function run<T>(operation: () => Promise<T>, receive: (value: T) => void, discard?: (value: T) => void) {
    if (disabled || flight.current) return;
    edit();
    const attempt = sequence.current;
    flight.current = true;
    setBusy(true);
    try {
      const response = await operation();
      if (live.current && attempt === sequence.current && !document.hidden) receive(response);
      else discard?.(response);
    } catch {
      if (live.current && attempt === sequence.current) {
        setNotice('');
        setError('No se pudo completar la acción. Revisa Codex antes de reintentar.');
      }
    } finally {
      flight.current = false;
      if (live.current) setBusy(false);
    }
  }

  function choose() {
    const previous = file?.id;
    void run(() => window.companion.contextChoose(), response => {
      if (!response.ok) {
        setError(response.error);
        return;
      }
      setFile(response.value);
      if (response.value?.id !== previous) setResultRevision(revision => revision + 1);
    });
  }

  function prepare() {
    setNotice('');
    const input: ContextInput = {kind: sourceOpen ? kind : 'request', instruction, format};
    if (sourceOpen) {
      if (kind === 'file') input.file = file?.id;
      else input.text = text;
      if (kind === 'page') input.url = url;
    }
    void run(() => window.companion.contextPrepare(input), response => {
      if (!response.ok) {
        setError(response.error);
        return;
      }
      pending.current = response.value;
      setReview(response.value);
    }, response => {
      if (response.ok) void window.companion.contextCancel(response.value.id).catch(() => {});
    });
  }

  function handoff() {
    if (!review || flight.current || disabled) return;
    const {id} = review;
    // The main process consumes the review when it accepts the handoff.
    pending.current = undefined;
    setNotice('Enviando a Codex…');
    void run(() => window.companion.contextHandoff(id), response => {
      if (!response.ok) {
        setNotice('');
        setError(response.error);
        return;
      }
      setResultRevision(revision => revision + 1);
      setNotice('En cola en el chat fijado de Codex.');
    });
  }

  if (disabled) return <>{children}</>;

  const missingSource = sourceOpen && (kind === 'file' && !file || kind === 'page' && !url.trim() || kind === 'text' && !text.trim());
  return <div className="codex-context">
    <section className="context-analysis" aria-labelledby="codex-request-heading" onKeyDown={event => {
      if (event.key === 'Escape' && (review || sourceOpen)) {
        event.preventDefault();
        event.stopPropagation();
        if (review) cancelReview();
        else setSourceOpen(false);
      }
    }}>
      <header className="codex-request-heading">
        <h2 id="codex-request-heading">Nueva petición</h2>
        {targetTitle
          ? <small>Chat fijado · <strong>{targetTitle}</strong></small>
          : <button onClick={() => void window.companion.navigate('settings')}>Configurar el chat de Codex</button>}
      </header>
      <div className="context-analysis-panel">
        <div className="context-analysis-actions" aria-label="Atajos de petición">
          <button className="context-analysis-toggle" disabled={busy || !targetTitle} aria-expanded={sourceOpen} onClick={() => {
            edit();
            setSourceOpen(!sourceOpen);
          }}>{sourceOpen ? 'Quitar contexto' : 'Añadir contexto'}</button>
          <button aria-pressed={format === 'plan'} disabled={busy || !targetTitle} onClick={() => {
            edit();
            setFormat('plan');
            instructionField.current?.focus();
          }}>Preparar un plan</button>
        </div>
        <label>Qué necesitas
          <textarea ref={instructionField} aria-label="Indicación para Codex" value={instruction}
            maxLength={2000} disabled={busy || !targetTitle} onChange={event => {edit(); setInstruction(event.target.value);}}
            placeholder={format === 'plan' ? 'Describe el objetivo y qué debe tener en cuenta Codex.' : 'Describe lo que quieres que Codex analice.'}/>
        </label>
        {sourceOpen && <div className="codex-source-picker">
          <div className="context-analysis-actions" aria-label="Tipo de contexto">
            {sourceTypes.map(source => <button key={source.id} aria-pressed={source.id === kind} disabled={busy}
              onClick={() => {edit(); setKind(source.id);}}>{source.label}</button>)}
          </div>
          {kind === 'file' ? <button disabled={busy} onClick={choose}>{file?.name ?? 'Elegir archivo'}</button> : <>
            {kind === 'page' && <label>Dirección web
              <input aria-label="Página para analizar" value={url} maxLength={2048} disabled={busy}
                onChange={event => {edit(); setUrl(event.target.value);}} placeholder="https://…"/>
            </label>}
            <label>{kind === 'page' ? 'Texto seleccionado (opcional)' : 'Texto'}
              <textarea aria-label="Texto para analizar" value={text} maxLength={24000} disabled={busy}
                onChange={event => {edit(); setText(event.target.value);}}/>
            </label>
          </>}
        </div>}
        <label>Formato de respuesta
          <select value={format} disabled={busy || !targetTitle} onChange={event => {
            edit();
            setFormat(event.target.value as CodexDocumentFormat);
          }}>
            {Object.entries(codexDocumentFormats).map(([value, label]) =>
              <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        {review ? <div className="context-analysis-review">
          <strong>{review.label}</strong>
          <small>Destino · {review.targetTitle}</small>
          <pre tabIndex={0}>{review.prompt}</pre>
          <div className="context-analysis-buttons">
            <button disabled={busy} onClick={cancelReview}>Cancelar</button>
            <button className="primary context-handoff" disabled={busy} onClick={handoff}>Enviar a Codex</button>
          </div>
        </div> : <button className="primary context-prepare" disabled={busy || !targetTitle || !instruction.trim() || missingSource}
          onClick={prepare}>Revisar petición</button>}
        {notice && <div className="context-analysis-buttons">
          <small className="context-notice" role="status">{notice}</small>
          {!busy && <button onClick={async () => {
            try {
              const response = await window.companion.openCodex();
              if (response.ok) return;
            } catch {/* Keep the confirmed queue receipt visible. */}
            setError('No se pudo abrir el chat fijado en Codex.');
          }}>Abrir chat</button>}
        </div>}
        {error && <small className="context-error" role="alert">{error}</small>}
      </div>
    </section>
    <div className="codex-response-column">
      {targetTitle ? <CodexResultPanel revision={resultRevision} empty={children}/> : children}
    </div>
  </div>;
}
