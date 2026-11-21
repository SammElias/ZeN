import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import type {QuickNotes, QuickNotesAction} from '../shared/quick-notes';

function request(action: QuickNotesAction) {
  try { return window.companion.quickNotes(action); }
  catch { return {ok:false} as const; }
}

export function QuickNotesEditor({visible}: {visible:boolean}) {
  const editor = useRef<HTMLTextAreaElement>(null);
  const saved = useRef<QuickNotes>(null);
  const current = useRef<QuickNotes>(null);
  const [loaded, setLoaded] = useState(false);
  const [problem, setProblem] = useState('');

  function load() {
    const result = request({type:'read'});
    if (result.ok) {
      saved.current = current.current = result.value;
      setLoaded(true);
      setProblem('');
    } else {
      setProblem('No se pudieron abrir los apuntes.');
    }
  }

  useEffect(() => {
    if (visible && !loaded) load();
  }, [visible, loaded]);

  useLayoutEffect(() => {
    const input = editor.current;
    const position = current.current;
    if (!visible || !input || !position) return;
    input.setSelectionRange(position.selectionStart, position.selectionEnd, position.selectionDirection);
    input.scrollTop = position.scrollTop;
  }, [visible, loaded]);

  function save(input: HTMLTextAreaElement) {
    const value = {
      text:input.value,
      selectionStart:input.selectionStart,
      selectionEnd:input.selectionEnd,
      selectionDirection:input.selectionDirection,
      scrollTop:input.scrollTop,
    };
    current.current = value;
    const prior = saved.current;
    if (prior && value.text===prior.text && value.selectionStart===prior.selectionStart &&
        value.selectionEnd===prior.selectionEnd && value.selectionDirection===prior.selectionDirection &&
        value.scrollTop===prior.scrollTop) {
      setProblem('');
      return;
    }
    if (request({type:'save',value}).ok) {
      saved.current = value;
      setProblem('');
    } else {
      setProblem('No se pudieron guardar los apuntes. El texto sigue en el editor.');
    }
  }

  if (!visible) return null;
  return <div className="hub-quick-notes">
    {loaded && <textarea ref={editor} aria-labelledby="notes-title" placeholder="Escribe aquí…"
      data-hold-island-open defaultValue={current.current?.text}
      onChange={event=>save(event.currentTarget)} onSelect={event=>save(event.currentTarget)}
      onScroll={event=>save(event.currentTarget)}/>}
    {problem && <div className="hub-feedback" role="alert">
      <span>{problem}</span>
      <button type="button" onClick={()=>editor.current?save(editor.current):load()}>Volver a intentar</button>
    </div>}
  </div>;
}
