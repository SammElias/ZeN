import React from 'react';
import {responseMarks,type VisualReference} from '../shared/interactions';
export function VisualExplanation({image,reference,text}:{image:string;reference:VisualReference;text:string}){
  const marks=responseMarks(text,reference);
  if(!marks.length)return null;
  return <figure className="visual-explanation"><div><img src={image} alt="Referencia compartida con las indicaciones de ZEN"/><svg viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">{marks.map((mark,i)=>{const [a,b]=mark.points,angle=Math.atan2(b.y-a.y,b.x-a.x);return <g key={i} stroke="#a5eed6" fill="none" strokeWidth="5" vectorEffect="non-scaling-stroke">{mark.type==='circle'?<ellipse cx={(a.x+b.x)*500} cy={(a.y+b.y)*500} rx={Math.abs(a.x-b.x)*500} ry={Math.abs(a.y-b.y)*500}/>:<polyline points={mark.points.map(p=>`${p.x*1000},${p.y*1000}`).join(' ')}/>}{mark.type==='arrow'&&<polyline points={(b.x*1000-Math.cos(angle-.5)*24)+','+(b.y*1000-Math.sin(angle-.5)*24)+' '+b.x*1000+','+b.y*1000+' '+(b.x*1000-Math.cos(angle+.5)*24)+','+(b.y*1000-Math.sin(angle+.5)*24)}/>}<text x={a.x*1000} y={Math.max(24,a.y*1000)} fill="#fff" stroke="#20202c" strokeWidth="1" fontSize="36">{i+1}</text></g>;})}</svg></div><figcaption>{marks.map((mark,i)=><p key={i}>{i+1}. {mark.explanation}</p>)}</figcaption></figure>;
}
