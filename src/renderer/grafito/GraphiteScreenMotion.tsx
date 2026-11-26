import React from 'react';
import type {OfficinaActor} from '../../shared/companion-officina';

// Instrument illustrations are ambient. Project outcomes and approvals come from RoomDisplay.
const codeRows = [[6,20,14],[14,26,10],[21,12,20],[13,16,25],[7,28,9],[14,11,22]];
function CodePage({y}:{y:number}) {
  return <g transform={`translate(0 ${y})`}>{codeRows.map(([indent,a,b],i)=><g key={i} transform={`translate(${indent} ${8+i*9})`}>
    <path d={`M0 0h${a}`} stroke={i%2?'#a5c6e1':'#72cec8'}/>
    <path d={`M${a+4} 0h${b}`} stroke={i%2?'#b29bcb':'#c8b799'}/>
  </g>)}</g>;
}
export function GraphiteScreenMotion({role,secondary}:{role:OfficinaActor;secondary?:boolean}) {
  let drawing:React.ReactNode;
  switch(role) {
    case 'developer': drawing=<g className="graphite-code-roll"><CodePage y={0}/><CodePage y={54}/><CodePage y={108}/></g>;break;
    case 'architect':
    case 'coordinator': {
      const coordination=role==='coordinator';
      const path=coordination?'M16 32 H38 V13 H70 M38 32 H82 M38 32 V52 H70':'M12 15 H44 V46 H80 M44 25 H76';
      drawing=<><path className="graphite-wire" d={path}/><path className="graphite-signal" pathLength="100" d={path}/>
        {(coordination?[[16,32],[70,13],[82,32],[70,52]]:[[12,15],[80,46],[76,25]]).map(([x,y])=>coordination?
          <circle className="graphite-node" key={y} cx={x} cy={y} r="5"/>:<rect className="graphite-node" key={y} x={x-8} y={y-5} width="16" height="10" rx="2"/>)}</>;break;
    }
    case 'analyst':
    case 'tester': drawing=<>{[13,31,49].map((y,i)=><g key={y} opacity=".62"><rect x="8" y={y-4} width="8" height="8" rx="2"/>
      <path d={`M24 ${y}h${[39,55,46][i]}`}/></g>)}
      <g className="graphite-row-focus">{role==='tester'?<><circle cx="71" cy="12" r="6"/><path d="m75 17 5 5"/></>:
        <path d="M83 9 77 13 83 17Z" fill="currentColor"/>}<path d="M24 17h32" opacity=".5"/></g></>;break;
    case 'alm': drawing=secondary?<><path className="graphite-wire" d="M12 30h69"/><path className="graphite-signal" d="M12 30h69" pathLength="100"/>
      {[12,46,81].map(x=><rect key={x} x={x-5} y="25" width="10" height="10" rx="2"/>)}</>:<><path d="M6 48h72" className="graphite-wire"/><path d="M6 48h72" className="graphite-signal" pathLength="100"/>
      <g transform="translate(32 4)"><path d="M5 27C11 14 20 8 34 5c-2 12-10 23-23 29l-6-7Zm4-6-9 1 4-6 12-3m6 15-2 10-6 4 1-10"/>
      <circle cx="23" cy="16" r="3"/><path className="graphite-exhaust" d="m5 32-7 8m11-5-5 8"/></g></>;break;
    case 'observer': drawing=<><path className="graphite-wire" d="M5 16h81M5 33h81M5 51h81"/>
      <path d="M5 35h10l6-9 6 16 8-25 10 29 7-12h10l5-8 6 11 7-4h6"/>
      <path className="graphite-sweep" d="M8 9v45"/></>;break;
  }
  return <svg viewBox="0 0 94 62" preserveAspectRatio="xMidYMid meet" className="graphite-instrument" data-role={role}
    aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">{drawing}</svg>;
}
