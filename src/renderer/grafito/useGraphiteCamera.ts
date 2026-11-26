import {useCallback, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject} from 'react';
import type {Point} from './composition';

type Pose = {zoom:number; x:number; y:number; fit?:boolean};
type ImageView = {width:number; height:number; scale:number; left:number; top:number; zoom:number};
const clamp = (value:number, low:number, high:number) => Math.max(low, Math.min(value,high));
const isControl = (target:EventTarget | null) => target instanceof Element && !!target.closest('.graphite-tools');

export function useGraphiteViewport(stage:RefObject<HTMLDivElement|null>) {
  const [viewport,setViewport] = useState({width:0,height:0});
  useLayoutEffect(()=>{
    const el=stage.current;
    if(!el) return;
    const measure=()=>{const width=el.clientWidth,height=el.clientHeight;
      if(width && height) setViewport(old=>old.width===width && old.height===height ? old : {width,height});
    };
    measure();
    const observer=new ResizeObserver(measure);
    observer.observe(el);
    return ()=>observer.disconnect();
  },[stage]);
  return viewport;
}

export function useGraphiteCamera(stage:RefObject<HTMLDivElement|null>, viewport:ReturnType<typeof useGraphiteViewport>,
  scene:string, size:Point, centerY:number, fitOnEntry:boolean, fillOnly:boolean) {
  const [poses,setPoses] = useState<Record<string,Pose>>({});
  const gesture = useRef<{id:number; x:number; y:number; dragged:boolean}|undefined>(undefined);
  const suppressClick = useRef(false);
  const [imageWidth,imageHeight] = size;
  const {width,height} = viewport;
  const cover = Math.max(width/imageWidth,height/imageHeight) || 1;
  const fit = fillOnly ? 1 : Math.min(width/imageWidth,height/imageHeight)/cover || 1;
  const initial:Pose = {zoom:1,x:.5,y:centerY,fit:fitOnEntry};
  const remembered = poses[scene] ?? initial;
  function layout(pose:Pose):ImageView {
    const zoom = pose.fit ? fit : clamp(pose.zoom,fit,4);
    const scale = cover*zoom, w = imageWidth*scale, h = imageHeight*scale;
    const offset = (span:number,box:number,center:number) => span<=box ? (box-span)/2 : clamp(box/2-span*center,box-span,0);
    return {width:w,height:h,scale,left:offset(w,width,pose.x),top:offset(h,height,pose.y),zoom};
  }
  const view = layout(remembered);
  useLayoutEffect(()=>{gesture.current=undefined;suppressClick.current=false;},[scene]);
  function change(update:(v:ImageView)=>Pose) {
    setPoses(prev=>({...prev,[scene]:update(layout(prev[scene] ?? initial))}));
  }
  function zoomBy(factor:number,x=width/2,y=height/2) {
    change(v=>{
      const zoom=clamp(v.zoom*factor,fit,4), ratio=zoom/v.zoom;
      return {zoom,x:(x-v.left+(width/2-x)/ratio)/v.width,y:(y-v.top+(height/2-y)/ratio)/v.height};
    });
  }
  function pan(dx:number,dy:number) {
    change(v=>({zoom:v.zoom,x:(width/2-v.left-dx)/v.width,y:(height/2-v.top-dy)/v.height}));
  }
  function reset(full=false) {
    change(()=>full ? {zoom:fit,x:.5,y:.5,fit:true} : initial);
  }
  const wheel=useRef<((event:WheelEvent)=>void)|undefined>(undefined);
  wheel.current=event=>{
    if(isControl(event.target)) return;
    event.preventDefault();
    const el=stage.current!;
    const box=el.getBoundingClientRect();
    const delta=event.deltaY*(event.deltaMode===1 ? 16 : event.deltaMode===2 ? height : 1);
    zoomBy(Math.exp(-clamp(delta,-250,250)*.002),event.clientX-box.left-el.clientLeft,event.clientY-box.top-el.clientTop);
  };
  useLayoutEffect(()=>{
    const el=stage.current;
    if(!el) return;
    const onWheel=(event:WheelEvent)=>wheel.current?.(event);
    el.addEventListener('wheel',onWheel,{passive:false});
    return ()=>el.removeEventListener('wheel',onWheel);
  },[stage]);
  const endDrag=useCallback((event:PointerEvent<HTMLDivElement>)=>{
    if(gesture.current?.id!==event.pointerId) return;
    gesture.current=undefined;
    const el=event.currentTarget;
    delete el.dataset.dragging;
    if(el.hasPointerCapture(event.pointerId)) el.releasePointerCapture(event.pointerId);
  },[]);
  function keepInView([x,y]:Point) {
    const px=view.left+x*view.scale,py=view.top+y*view.scale;
    if(px<12 || px>width-12 || py<12 || py>height-12) change(v=>({zoom:v.zoom,x:x/imageWidth,y:y/imageHeight}));
  }
  return {view,viewport,fit,reset,zoomBy,keepInView,style:{left:view.left,top:view.top,width:view.width,height:view.height},
    handlers:{
      onPointerDown:(e:PointerEvent<HTMLDivElement>)=>{
        if(e.button!==0 || !e.isPrimary || isControl(e.target)) return;
        suppressClick.current=false;
        gesture.current={id:e.pointerId,x:e.clientX,y:e.clientY,dragged:false};
      },
      onPointerMove:(e:PointerEvent<HTMLDivElement>)=>{
        const g=gesture.current;
        if(!g || g.id!==e.pointerId || !(e.buttons&1)) return;
        const dx=e.clientX-g.x,dy=e.clientY-g.y;
        if(!g.dragged && Math.hypot(dx,dy)<5) return;
        if(!g.dragged) {
          g.dragged=true;suppressClick.current=true;
          e.currentTarget.setPointerCapture(e.pointerId);
          e.currentTarget.dataset.dragging='true';
        }
        pan(dx,dy);g.x=e.clientX;g.y=e.clientY;
      },
      onPointerUp:endDrag,onPointerCancel:endDrag,onLostPointerCapture:endDrag,
      onClickCapture:(e:React.MouseEvent)=>{
        if(suppressClick.current && e.detail && !isControl(e.target)) {e.preventDefault();e.stopPropagation();suppressClick.current=false;}
      },
      onKeyDown:(e:KeyboardEvent)=>{
        if(isControl(e.target) || e.altKey || e.metaKey || e.ctrlKey) return;
        switch(e.key) {
          case '+': case '=': zoomBy(1.25);break;
          case '-': zoomBy(.8);break;
          case '0': reset();break;
          case 'ArrowLeft': pan(64,0);break;
          case 'ArrowRight': pan(-64,0);break;
          case 'ArrowUp': pan(0,64);break;
          case 'ArrowDown': pan(0,-64);break;
          default:return;
        }
        e.preventDefault();e.stopPropagation();
      },
    }};
}
