import React, {useEffect, useRef, useState, type CSSProperties} from 'react';
import {Check, Eraser, RotateCcw, Undo2} from 'lucide-react';
import {boardColors, boardLimits, brushWidths, type BoardStroke, type WhiteboardAction, type WhiteboardDocument} from '../shared/whiteboard';
import {boardPalettes, WhiteboardCanvas} from './WhiteboardCanvas';
import './Whiteboard.css';

const brushLabels = {2:'Fino',5:'Medio',12:'Grande'} as const;
const colorLabels = {ink:'Tinta',blue:'Azul',green:'Verde',amber:'Ámbar',red:'Rojo'} as const;

function request(action: WhiteboardAction) {
  try { return window.companion.whiteboard(action); }
  catch { return {ok:false} as const; }
}

export function Whiteboard({visible, dark, confirm}: {
  visible:boolean;dark:boolean;confirm:(action:{text:string;label:string;run:()=>void})=>void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const current = useRef<WhiteboardDocument>(null);
  const [board,setBoard] = useState<WhiteboardDocument>();
  const [eraser,setEraser] = useState(false);
  const [problem,setProblem] = useState('');
  const palette = dark ? boardPalettes.dark : boardPalettes.light;

  function load() {
    const result = request({type:'read'});
    if (result.ok && result.value) {
      current.current = result.value;
      setBoard(result.value);
      setProblem('');
    } else setProblem('No se pudo abrir la pizarra.');
  }

  function save(value:WhiteboardDocument) {
    current.current = value;
    setBoard(value);
    setProblem(request({type:'save',value}).ok?'':'No se pudo guardar la pizarra. El dibujo sigue disponible.');
  }

  function undo() {
    const board = current.current;
    if (!board?.strokes.length || container.current?.querySelector('[data-island-gesture]')) return;
    save({...board,strokes:board.strokes.slice(0,-1)});
  }

  useEffect(() => {
    if (visible && !current.current) load();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const shortcut = (event:KeyboardEvent) => {
      if (!event.ctrlKey || event.altKey || event.shiftKey || event.key.toLowerCase()!=='z' ||
          event.isComposing || event.defaultPrevented || container.current?.closest('.knowledge-hub')?.querySelector('dialog[open]')) return;
      event.preventDefault();
      undo();
    };
    window.addEventListener('keydown',shortcut);
    return ()=>window.removeEventListener('keydown',shortcut);
  }, [visible]);

  if (!visible) return null;
  const capacity = board && board.strokes.length<boardLimits.strokes
    ? boardLimits.points-board.strokes.reduce((total,stroke)=>total+stroke.points.length,0) : 0;
  function addStroke(stroke:BoardStroke) {
    const previous = current.current;
    if (previous) save({...previous,strokes:[...previous.strokes,stroke]});
  }

  return <div className="hub-whiteboard" ref={container} style={{'--board-paper':palette.paper} as CSSProperties}>
    {board && <>
      <div className="hub-board-tools" role="group" aria-label="Herramientas de Pizarra">
        <div className="hub-board-buttons" role="group" aria-label="Grosor del pincel">
          {brushWidths.map(width=><button key={width} type="button" title={`${brushLabels[width]} · ${width} px`}
            aria-pressed={!eraser&&board.width===width} onClick={()=>{setEraser(false);if(board.width!==width)save({...board,width});}}>
            {brushLabels[width]}
          </button>)}
        </div>
        <div className="hub-board-buttons" role="group" aria-label="Color del pincel">
          {boardColors.map(color=><button key={color} type="button" className="hub-board-color" title={colorLabels[color]}
            aria-label={colorLabels[color]} aria-pressed={!eraser&&board.color===color}
            onClick={()=>{setEraser(false);if(board.color!==color)save({...board,color});}}>
            <span style={{background:palette[color]}} aria-hidden="true">{!eraser&&board.color===color&&<Check size={12}/>}</span>
          </button>)}
        </div>
        <div className="hub-board-buttons">
          <button type="button" aria-pressed={eraser} onClick={()=>setEraser(!eraser)}><Eraser size={15}/>Goma</button>
          <button type="button" title="Deshacer (Ctrl+Z)" aria-keyshortcuts="Control+Z" disabled={!board.strokes.length} onClick={undo}>
            <Undo2 size={15}/>Deshacer
          </button>
        </div>
        <button type="button" className="hub-board-reset" disabled={!board.strokes.length} onClick={()=>{
          confirm({text:'¿Vaciar todo el dibujo de la pizarra?',label:'Reiniciar pizarra',run:()=>save({...board,strokes:[]})});
        }}><RotateCcw size={15}/>Reiniciar pizarra</button>
      </div>
      <div className="hub-board-stage">
        <WhiteboardCanvas board={board} palette={palette} eraser={eraser} capacity={capacity} onStroke={addStroke}/>
      </div>
      {!capacity && <p className="hub-feedback" role="status">La pizarra está llena. Puedes deshacer o reiniciarla.</p>}
    </>}
    {problem && <div className="hub-feedback" role="alert"><span>{problem}</span>
      <button type="button" onClick={()=>board?save(board):load()}>Volver a intentar</button>
    </div>}
  </div>;
}
