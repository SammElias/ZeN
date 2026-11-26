import React, {useEffect,useId,useLayoutEffect,useRef,useState,type CSSProperties} from 'react';
import {CircleAlert, Maximize2, Minimize2, Minus, Plus, Scan} from 'lucide-react';
import type {OfficinaActor as Role} from '../../shared/companion-officina';
import type {RoomDisplay} from '../officina3d/room-data';
import {details,planSize as portraitSize,rooms as portraitRooms,type Point,type Room} from './composition';
import {panoramaRooms, panoramaSize, panoramaHub} from './panorama';
import {officeArt} from './office-art';
import {officeNames,type OfficinaDesign} from '../../shared/officina-design';
import {GraphiteMonitor} from './GraphiteMonitor';
import {useGraphiteCamera,useGraphiteViewport} from './useGraphiteCamera';
import './graphite.css';

const roles=Object.keys(portraitRooms) as Role[];
const coordinates=(points:Point[])=>points.map(p=>p.join(',')).join(' ');
type Transfer={id:string;from:Role;to:Role;at:number};
type Props={design:OfficinaDesign;room?:Role;selected:Role;taskTitle?:string;displays:Record<Role,RoomDisplay>;transfer?:Transfer;motion:boolean;enabled:boolean;
  fullscreen:boolean; onFullscreen:()=>void; closeup:boolean; onShowWholeRoom:()=>void; onEnter:(role:Role,opener:HTMLElement)=>void};
const hitRegions=(rooms:Record<Role,Room>,planSize:Point)=>Object.fromEntries(roles.map(role=>{
  const {outline}=rooms[role];
  const xs=outline.map(p=>p[0]),ys=outline.map(p=>p[1]);
  const left=Math.min(...xs),top=Math.min(...ys),w=Math.max(...xs)-left,h=Math.max(...ys)-top;
  return [role,{left:left/planSize[0]*100+'%',top:top/planSize[1]*100+'%',width:w/planSize[0]*100+'%',height:h/planSize[1]*100+'%',
    clipPath:'polygon('+outline.map(([x,y])=>(x-left)/w*100+'% '+(y-top)/h*100+'%').join(',')+')'}];
})) as Record<Role,CSSProperties>;
const portraitHits=hitRegions(portraitRooms,portraitSize);
const panoramaHits=hitRegions(panoramaRooms,panoramaSize);

export default function GraphiteScene({design,room,selected,taskTitle,displays,transfer,motion,enabled,onEnter,fullscreen,onFullscreen,closeup,onShowWholeRoom}:Props) {
  const stage=useRef<HTMLDivElement>(null);
  const [hover,setHover]=useState<Role>();
  const viewport=useGraphiteViewport(stage);
  const panorama=fullscreen && !room && viewport.width>viewport.height;
  const rooms=panorama ? panoramaRooms : portraitRooms;
  const planSize=panorama ? panoramaSize : portraitSize;
  const hub:Point=panorama ? panoramaHub : [505,710];
  const planRoomBox=panorama ? panoramaHits : portraitHits;
  const [decoded,setDecoded]=useState<string>();
  const [failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0);
  const [trail,setTrail]=useState<Transfer>();
  const seen=useRef(transfer?.id);
  const clipId='foreground'+useId().replace(/[^a-z0-9]/gi,'');
  const plate=room ? details[room] : undefined;
  const [width,height]=plate?.size ?? planSize;
  const shown=room ?? 'plan';
  const art=officeArt(design,panorama ? 'panorama' : shown);
  const ready=!!art && decoded===art;
  useEffect(()=>{
    let current=true;
    setFailed(false);
    const image=new Image();
    image.src=art;
    image.decode().then(()=>{if(current)setDecoded(art);}).catch(()=>{if(current)setFailed(true);});
    return ()=>{current=false;};
  },[art,attempt]);
  const visibleRoles=room ? [room] : roles;
  const mode=closeup?'desk':fullscreen?'full':'window';
  const camera=useGraphiteCamera(stage,viewport,mode+':'+(panorama?'panorama':shown),
    plate?.size ?? planSize,closeup ? .32 : fullscreen ? .5 : room ? .37 : .451,fullscreen && !!room && !closeup,closeup);
  const previousMode=useRef(mode);
  useLayoutEffect(()=>{
    if(previousMode.current==='desk' && mode==='full' && room) camera.reset(true);
    previousMode.current=mode;
  },[mode,room]);
  const {scale,zoom}=camera.view;
  useLayoutEffect(()=>{setHover(undefined);},[shown]);
  useEffect(()=>{
    if(!transfer || seen.current===transfer.id) return;
    seen.current=transfer.id;
    if(room || !enabled || !motion || Date.now()-transfer.at>8500) return;
    setTrail(transfer);
    const timer=setTimeout(()=>setTrail(undefined),1650);
    return ()=>{clearTimeout(timer);setTrail(undefined);};
  },[transfer?.id,enabled,motion,room]);
  const foreground=visibleRoles.flatMap(role=>(room?details[role]:rooms[role]).foreground ?? []);
  const overview=useRef({art,rooms,size:planSize,style:camera.style});
  if(!room) overview.current={art,rooms,size:planSize,style:camera.style};
  const previousScene=useRef(shown);
  const [approaching,setApproaching]=useState(false);
  useLayoutEffect(()=>{
    setApproaching(!!room && previousScene.current==='plan' && enabled && motion);
    previousScene.current=shown;
  },[shown,enabled,motion]);
  const [originX,originY]=room ? overview.current.rooms[room].label : hub;
  return <div ref={stage} tabIndex={0} role="group" aria-label={'Cámara de '+officeNames[design]} {...camera.handlers} className="graphite-stage" data-design={design} data-ready={ready}
    data-layout={room?'room':panorama?'panorama':'portrait'} data-camera={ready?room??'overview':'loading'} data-motion={enabled && motion}>
    <div key={shown} className="graphite-frame" style={camera.style}>
      <img src={art} className="graphite-plate" draggable={false}
        alt={room?'Despacho de '+displays[room].name:'Plano de '+officeNames[design]}/>
      {ready && scale>0 && visibleRoles.map(role=>(room?details[role]:rooms[role]).screens.map((screen,i)=>
        <GraphiteMonitor key={role+i} role={role} display={displays[role]} screen={screen} scale={scale}
          animate={enabled && motion}/>))}
      {ready && foreground.length>0 && <svg viewBox={'0 0 '+width+' '+height} className="graphite-overlay" aria-hidden="true">
        <defs><clipPath id={clipId}>{foreground.map((points,i)=><polygon key={i} points={coordinates(points)}/>)}</clipPath></defs>
        <image clipPath={'url(#'+clipId+')'} href={art} width={width} height={height} preserveAspectRatio="none"/>
      </svg>}
      {!room && <>
        <svg viewBox={'0 0 '+planSize.join(' ')} className="graphite-overlay" aria-hidden="true">
          {roles.filter(role=>displays[role].state==='working').map(role=><polygon key={role} className="graphite-active-room"
            points={coordinates(rooms[role].outline)}/>)}
          {hover && <polygon className="graphite-outline" points={coordinates(rooms[hover].outline)}/>}
          {trail && enabled && motion && <circle key={trail.id} className="graphite-pulse" r="6">
            <animateMotion dur="1.6s" fill="freeze" path={'M'+rooms[trail.from].door.join(' ')+' Q'+hub.join(' ')+' '+rooms[trail.to].door.join(' ')}/>
          </circle>}
        </svg>
        {roles.map(role=>{
          const d=displays[role];
          const [x,y]=rooms[role].label;
          const {left,top}=camera.view;
          // Keep a badge on the visible part of its own room when a wide viewport crops the walls.
          const points=rooms[role].outline;
          const bounds=(axis:0|1,offset:number,span:number)=>{
            const values=points.map(p=>p[axis]*scale+offset);
            return [Math.max(0,Math.min(...values)),Math.min(span,Math.max(...values))] as const;
          };
          const [x1,x2]=bounds(0,left,camera.viewport.width),[y1,y2]=bounds(1,top,camera.viewport.height);
          const labelWidth=Math.min(fullscreen?210:143,Math.max(0,x2-x1-6));
          const half=labelWidth/2;
          const lx=Math.min(x2-half,Math.max(x1+half,x*scale+left))-left;
          const ly=Math.min(y2-21,Math.max(y1+21,y*scale+top))-top;
          return <React.Fragment key={role}>
            <button type="button" data-role={role} className="graphite-room" style={planRoomBox[role]}
              aria-label={'Abrir despacho de '+d.name+' · '+d.status+(d.decision?' · '+d.decision.action:'')}
              onMouseEnter={()=>setHover(role)} onMouseLeave={()=>setHover(undefined)}
              onFocus={e=>{setHover(role);if(e.currentTarget.matches(':focus-visible')) camera.keepInView(rooms[role].label);}} onBlur={()=>setHover(undefined)}
              onClick={e=>onEnter(role,e.currentTarget)}/>
            {labelWidth>44 && y2-y1>42 && <span className="graphite-label" aria-hidden="true"
              data-agent={role} data-state={d.state} data-selected={selected===role} data-action={!!d.decision}
              style={{left:lx,top:ly,maxWidth:labelWidth}}>
              <strong>{d.name}</strong>
              <span className="graphite-status">{d.decision ? <CircleAlert/> : <i/>}{d.decision?.action ?? d.status}</span>
              {role==='coordinator' && taskTitle && <small>{taskTitle}</small>}
            </span>}
          </React.Fragment>;
        })}
      </>}
    </div>
    {room && approaching && enabled && motion && !failed && <div key={'enter-'+room} className="graphite-crossfade" data-loaded={ready} aria-hidden="true"
      onAnimationEnd={e=>{if(e.target===e.currentTarget) setApproaching(false);}}>
      <img src={overview.current.art} alt="" className="graphite-approach-plate" style={{...overview.current.style,transformOrigin:originX/overview.current.size[0]*100+'% '+originY/overview.current.size[1]*100+'%'}}/>
    </div>}
    {failed && <div role="alert" className="graphite-retry">No se pudo cargar la ilustración.
      <button type="button" onClick={()=>{setFailed(false);setAttempt(a=>a+1);}}>Reintentar</button></div>}
    <div className="graphite-tools" role="group" aria-label="Encuadre y zoom">
      <button type="button" aria-label="Alejar" title="Alejar (−)" disabled={zoom<=camera.fit+.001} onClick={()=>camera.zoomBy(.8)}><Minus/></button>
      <button type="button" className="graphite-percent" aria-label="Restablecer encuadre" title="Llenar el espacio (0)" onClick={()=>camera.reset()}>{Math.round(zoom*100)}%</button>
      <button type="button" aria-label="Acercar" title="Acercar (+)" disabled={zoom>=3.999} onClick={()=>camera.zoomBy(1.25)}><Plus/></button>
      <button type="button" aria-label="Ver todo" title="Ver la escena completa" onClick={()=>closeup ? onShowWholeRoom() : camera.reset(true)}><Scan/></button>
      <button type="button" aria-label={fullscreen?'Salir de pantalla completa':'Ver a pantalla completa'} title={fullscreen?'Salir de pantalla completa':'Pantalla completa'}
        onClick={onFullscreen}>
        {fullscreen?<Minimize2/>:<Maximize2/>}</button>
    </div>
  </div>;
}
