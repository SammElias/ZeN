import React, {useLayoutEffect, useRef, type PointerEvent} from 'react';
import {boardSize, type BoardClip, type BoardPoint, type BoardStroke, type WhiteboardDocument} from '../shared/whiteboard';
import {boardView, limitBoardCoordinate, originalBoard} from './whiteboard-view';

export const boardPalettes = {
  dark:{paper:'#151821',ink:'#f3f5fa',blue:'#73b6ff',green:'#65d99a',amber:'#ffc36b',red:'#ff8791'},
  light:{paper:'#f6f8fc',ink:'#162033',blue:'#1558b4',green:'#08704b',amber:'#905208',red:'#b0233e'},
};
type Palette = typeof boardPalettes.light;
type Gesture = {pointerId:number;stroke:BoardStroke;limit:number};

function paint(context:CanvasRenderingContext2D, stroke:BoardStroke, palette:Palette, start=0) {
  const erase = stroke.tool==='eraser';
  const width = erase ? 24 : stroke.width;
  const {left,top,right,bottom} = stroke.clip ?? originalBoard;
  context.save();
  context.beginPath();
  context.rect(left,top,right-left,bottom-top);
  context.clip();
  context.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
  context.fillStyle = context.strokeStyle = erase ? '#000' : palette[stroke.color];
  context.lineWidth = width;
  context.lineCap = context.lineJoin = 'round';
  const [x,y] = stroke.points[start];
  context.beginPath();
  if (stroke.points.length===1) {
    context.arc(x,y,width/2,0,Math.PI*2);
    context.fill();
  } else {
    context.moveTo(x,y);
    for (let index=start+1;index<stroke.points.length;index++) context.lineTo(...stroke.points[index]);
    context.stroke();
  }
  context.restore();
}

function boardPoint(event: {clientX:number;clientY:number}, rect:DOMRect, area:BoardClip): BoardPoint {
  const coordinate = (value:number, origin:number, size:number, start:number, end:number) =>
    limitBoardCoordinate(Math.round((start+(value-origin)*(end-start)/size)*10)/10);
  return [coordinate(event.clientX,rect.left,rect.width,area.left,area.right),
    coordinate(event.clientY,rect.top,rect.height,area.top,area.bottom)];
}

export function WhiteboardCanvas({board, palette, eraser, capacity, onStroke}: {
  board:WhiteboardDocument;palette:Palette;eraser:boolean;capacity:number;onStroke:(stroke:BoardStroke)=>void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const gesture = useRef<Gesture>(null);
  const view = useRef<BoardClip>(originalBoard);

  useLayoutEffect(() => {
    const target = canvas.current;
    const context = target?.getContext('2d');
    if (!target || !context) return;
    const render = () => {
      const cssWidth = target.clientWidth, cssHeight = target.clientHeight;
      if (!cssWidth || !cssHeight) return;
      const ratio = Math.min(3,window.devicePixelRatio);
      const width = Math.max(1,Math.round(cssWidth*ratio));
      const height = Math.max(1,Math.round(cssHeight*ratio));
      if (target.width!==width || target.height!==height) {
        target.width=width;
        target.height=height;
      }
      const {scale,area} = boardView(board.strokes,cssWidth,cssHeight);
      view.current = area;
      const scaleX = scale*width/cssWidth, scaleY = scale*height/cssHeight;
      context.resetTransform();
      context.clearRect(0,0,width,height);
      context.setTransform(scaleX,0,0,scaleY,-area.left*scaleX,-area.top*scaleY);
      for (const stroke of board.strokes) paint(context,stroke,palette);
      if (gesture.current) paint(context,gesture.current.stroke,palette);
    };
    const resize = new ResizeObserver(render);
    resize.observe(target);
    window.addEventListener('resize',render);
    render();
    return () => {
      resize.disconnect();
      window.removeEventListener('resize',render);
    };
  }, [board.strokes,palette]);

  function start(event: PointerEvent<HTMLCanvasElement>) {
    if (event.button!==0 || gesture.current || capacity<1) return;
    const target = event.currentTarget;
    const context = target.getContext('2d');
    const rect = target.getBoundingClientRect();
    if (!context || !rect.width || !rect.height) return;
    target.focus({preventScroll:true});
    target.setPointerCapture(event.pointerId);
    target.setAttribute('data-island-gesture','');
    const area = view.current;
    const clip = {left:limitBoardCoordinate(area.left),top:limitBoardCoordinate(area.top),
      right:limitBoardCoordinate(area.right),bottom:limitBoardCoordinate(area.bottom)};
    const points = [boardPoint(event,rect,area)];
    const stroke: BoardStroke = eraser ? {tool:'eraser',points,clip} : {tool:'brush',width:board.width,color:board.color,points,clip};
    gesture.current = {pointerId:event.pointerId,stroke,limit:capacity};
    paint(context,stroke,palette);
  }

  function extend(event: PointerEvent<HTMLCanvasElement>) {
    const current = gesture.current;
    if (current?.pointerId!==event.pointerId) return;
    const target = event.currentTarget;
    const rect = target.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const {stroke,limit} = current;
    const start = stroke.points.length-1;
    const coalesced = event.nativeEvent.getCoalescedEvents?.() ?? [];
    for (const sample of coalesced.length ? coalesced : [event]) {
      if (stroke.points.length>=limit) break;
      const point = boardPoint(sample,rect,view.current);
      const previous = stroke.points[stroke.points.length-1];
      if (point[0]!==previous[0] || point[1]!==previous[1]) stroke.points.push(point);
    }
    const context = target.getContext('2d');
    if (context && stroke.points.length>start+1) paint(context,stroke,palette,start);
  }

  function finish(target:HTMLCanvasElement, pointerId:number) {
    const current = gesture.current;
    if (current?.pointerId!==pointerId) return;
    gesture.current = null;
    if (target.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId);
    try { onStroke(current.stroke); }
    finally { target.removeAttribute('data-island-gesture'); }
  }

  return <canvas ref={canvas} className="hub-board-canvas" aria-label="Lienzo de Pizarra" tabIndex={0}
    width={boardSize.width} height={boardSize.height} data-tool={eraser?'eraser':'brush'}
    onPointerDown={start} onPointerMove={extend} onPointerUp={event=>{extend(event);finish(event.currentTarget,event.pointerId);}}
    onPointerCancel={event=>finish(event.currentTarget,event.pointerId)}
    onLostPointerCapture={event=>finish(event.currentTarget,event.pointerId)}
    onKeyDown={event=>{if (event.key==='Escape' && gesture.current) finish(event.currentTarget,gesture.current.pointerId);}}
    onContextMenu={event=>event.preventDefault()}/>;
}
