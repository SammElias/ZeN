import React, {useLayoutEffect, useRef} from 'react';
import type {OfficinaActor} from '../../shared/companion-officina';
import {roomScreenTitles, type RoomDisplay} from '../officina3d/room-data';
import {GraphiteScreenMotion} from './GraphiteScreenMotion';
import type {Screen, Quad} from './composition';

// Map the four corners of a unit square to the photographed display glass.
// CSS applies the projective divide so rows of text follow both vanishing lines.
function projection(corners: Quad, scale: number, width:number, height:number) {
  const [[x0,y0],[x1,y1],[x2,y2],[x3,y3]]=corners.map(([x,y])=>[x*scale,y*scale]);
  const dx1=x1-x2,dx2=x3-x2,dx3=x0-x1+x2-x3;
  const dy1=y1-y2,dy2=y3-y2,dy3=y0-y1+y2-y3;
  const denominator=dx1*dy2-dx2*dy1;
  if (!denominator) return undefined;
  const u=(dx3*dy2-dx2*dy3)/denominator, v=(dx1*dy3-dx3*dy1)/denominator;
  return 'matrix3d('+[(x1-x0+u*x1)/width,(y1-y0+u*y1)/width,0,u/width,
    (x3-x0+v*x3)/height,(y3-y0+v*y3)/height,0,v/height,0,0,1,0,x0,y0,0,1].join(',')+')';
}

export function GraphiteMonitor({role,display,screen,scale,animate}:{
  role:OfficinaActor; display:RoomDisplay; screen:Screen; scale:number; animate:boolean;
}) {
  const ref=useRef<HTMLCanvasElement>(null);
  const portrait=screen.side && role==='alm';
  const width=portrait ? 360 : 800, height=portrait ? 500 : 390;
  const [a,b,c,d]=screen.corners;
  const sampling=scale*(window.devicePixelRatio||1)*1.5;
  const pixelsX=Math.max(32,Math.min(width,Math.ceil(Math.max(Math.hypot(a[0]-b[0],a[1]-b[1]),Math.hypot(c[0]-d[0],c[1]-d[1]))*sampling)));
  const pixelsY=Math.max(24,Math.min(height,Math.ceil(Math.max(Math.hypot(a[0]-d[0],a[1]-d[1]),Math.hypot(b[0]-c[0],b[1]-c[1]))*sampling)));
  const color=display.decision ? '#e9b878' : '#a0c4ba';
  // The board polls even while its content is unchanged. Only repaint the bitmap on a real change.
  const displayKey=JSON.stringify([display.name,display.task,display.status,display.decision,display.diagram,display.lines,display.release]);
  useLayoutEffect(()=>{
    const canvas=ref.current;
    if (!canvas) return;
    const pen=canvas.getContext('2d');
    if (!pen) return;
    pen.setTransform(pixelsX/width,0,0,pixelsY/height,0,0);
    const board=screen.board;
    const surface=pen.createLinearGradient(0,0,width,height);
    if(board) {
      surface.addColorStop(0,'#aaa18e');surface.addColorStop(.47,'#d0c7b4');surface.addColorStop(1,'#aaa597');
    } else {
      surface.addColorStop(0,'#293032');surface.addColorStop(.55,'#1a2227');surface.addColorStop(1,'#12191e');
    }
    pen.fillStyle=surface;
    pen.fillRect(0,0,width,height);
    const contentWidth=portrait ? width : width*.65;
    if(portrait) pen.scale(1,.73);
    const margin=portrait ? 18 : 32;
    function line(text:string,y:number,size:number,ink:string,heavy=false) {
      if(!pen) return;
      pen.font=(heavy?'650 ':'400 ')+size+'px Segoe UI, sans-serif';
      const space=contentWidth-margin*2;
      let value=text.replace(/\s+/g,' ').trim();
      if(pen.measureText(value).width>space) {
        while(value.length && pen.measureText(value+'…').width>space) value=value.slice(0,-1);
        value+='…';
      }
      pen.fillStyle=ink;pen.fillText(value,margin,y);
    }
    const ink=board?'#393b36':'#d7deda', accent=board?'#4a534c':color;
    if(role==='alm' && !screen.side) {
      line(display.release?.version?'Versión registrada':roomScreenTitles.alm,68,45,accent,true);
      pen.fillStyle='#53625e';pen.fillRect(margin,89,contentWidth-2*margin,3);
      line(display.release?.version ?? (display.task ? display.status : 'Sin encargo activo'),205,82,ink,true);
      if(display.task) line(display.task,280,42,ink);
      const qa=display.release?.stages.find(s=>s.label==='Validación');
      if(qa) line(qa.text,351,42,accent,true);
      return;
    }
    line(screen.side ? (role==='alm'?'Traspasos':'Actividad') : roomScreenTitles[role],62,portrait?34:48,accent,true);
    pen.fillStyle=board?'#898a7f':'#596861';pen.fillRect(margin,89,contentWidth-2*margin,3);
    if(board && display.diagram?.nodes.length) {
      const nodes=display.diagram.nodes.slice(0,6);
      const column=(contentWidth-margin*2)/3;
      const nodeWidth=column*.82;
      const positions=nodes.map((_,i)=>({x:margin+(i%3)*column,y:122+Math.floor(i/3)*112}));
      pen.strokeStyle='#666b60';pen.lineWidth=4;
      for(const [from,to] of display.diagram.edges) {
        const a=positions[nodes.indexOf(from)],b=positions[nodes.indexOf(to)];
        if(a && b) {pen.beginPath();pen.moveTo(a.x+nodeWidth/2,a.y+32);pen.lineTo(b.x+nodeWidth/2,b.y+32);pen.stroke();}
      }
      nodes.forEach((name,i)=>{
        const {x,y}=positions[i];
        pen.fillStyle='#dad7c9';pen.fillRect(x,y,nodeWidth,68);pen.strokeRect(x,y,nodeWidth,68);
        pen.fillStyle=ink;pen.font='600 28px Segoe UI,sans-serif';pen.fillText(name,x+12,y+44,nodeWidth-20);
      });
      if(display.decision) line(display.decision.question,364,35,ink);
      return;
    }
    if(role==='alm' && screen.side) {
      const rows=display.release?.stages ?? [];
      if(!rows.length) line('Sin registros',175,44,ink);
      rows.slice(-3).forEach((row,i)=>{
        line(row.label,156+106*i,36,accent,true);
        line(row.text,200+106*i,42,ink);
      });
      return;
    }
    const title=screen.side ? display.status : display.release?.version ?? display.decision?.action ?? display.status;
    line(display.task ? title : 'Sin encargo activo',154,portrait?32:46,ink,true);
    const rows=screen.side && display.release ? display.release.stages : display.lines;
    if(rows.length) {
      rows.slice(0,portrait?3:2).forEach((row,i)=>{
        line(row.label,215+i*93,portrait?26:30,accent,true);
        line(row.text,253+i*93,portrait?29:37,ink);
      });
    } else if(display.task) line(display.decision?.question ?? display.task,226,34,ink);
  },[role,displayKey,screen,width,height,color,pixelsX,pixelsY]);
  return <div className="graphite-screen" data-monitor={role} data-board={!!screen.board} data-ambient={!!screen.ambientOnly}
    data-animate={animate} data-busy={['working','checking'].includes(display.state)} data-source={screen.side?'secondary':'main'}
    data-value={display.release?.version ?? display.decision?.question ?? display.task ?? 'Sin encargo activo'}
    style={{width,height,transform:projection(screen.corners,scale,width,height)}} aria-hidden="true">
    {!screen.ambientOnly && <canvas ref={ref} width={pixelsX} height={pixelsY}/>}
    <GraphiteScreenMotion role={role} secondary={screen.side}/>
  </div>;
}
