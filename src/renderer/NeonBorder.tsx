import React, {memo, useEffect, useRef} from 'react';
import {neonPalettes, neonVisual, type NeonOptions} from '../shared/companion-neon';
import {measureContour, neonContour, traceContour, type NeonShape} from './neon-contour';
import type {NeonAnimation} from './useNeonAnimation';
import './neon-border.css';

const fade=(distance: number, width: number)=>Math.max(0,Math.min(1,distance/width));

export const NeonBorder = memo(function NeonBorder({options,shape,visible,animation}: {
  options: NeonOptions; shape: NeonShape; visible: boolean; animation: NeonAnimation;
}) {
  const canvas=useRef<HTMLCanvasElement>(null);
  const {enabled,palette,intensity,extension}=options;
  const {side,attached,compact,radius}=shape;

  useEffect(()=>{
    const layer=canvas.current;
    const ctx=layer?.getContext('2d');
    if(!enabled||!visible||!layer||!ctx)return;
    const backing=document.createElement('canvas');
    const base=backing.getContext('2d');
    if(!base)return;
    const {line,halo,segment}=neonVisual;
    const {color,core}=neonPalettes[palette],strength=intensity/100;
    let width=0,height=0,pixelRatio=0;
    let track: ReturnType<typeof measureContour>=[],length=0;
    let previouslyPainted=false;

    function paint(phase: number | null, resized = false) {
      if(!length)return;
      const running=String(phase!==null);
      if(layer!.dataset.running!==running)layer!.dataset.running=running;
      if(phase===null&&!previouslyPainted&&!resized)return;
      ctx!.clearRect(0,0,width,height);
      ctx!.drawImage(backing,0,0,width,height);
      previouslyPainted=phase!==null;
      if(phase===null)return;
      const trail=length*segment,steps=20;
      const head=phase*(side?length+trail:length);
      const draw=(from:number,to:number,alpha:number)=>{
        ctx!.beginPath();
        if(side)traceContour(ctx!,track,Math.max(0,from),Math.min(length,to));
        else {
          const start=(from+length)%length,end=start+to-from;
          traceContour(ctx!,track,start,Math.min(length,end));
          if(end>length)traceContour(ctx!,track,0,end-length);
        }
        ctx!.strokeStyle=color;
        ctx!.lineWidth=halo;
        ctx!.globalAlpha=alpha*.18;
        ctx!.stroke();
        ctx!.lineWidth=line;
        ctx!.strokeStyle=core;
        ctx!.globalAlpha=alpha*.9;
        ctx!.stroke();
      };
      for(let index=0;index<steps;index++){
        const progress=(index+.5)/steps;
        const from=head-trail+trail*index/steps,to=from+trail/steps;
        if(side&&(to<=0||from>=length))continue;
        const middle=(from+to)/2;
        const ends=side?fade(Math.min(middle,length-middle),Math.max(8,extension)):1;
        const alpha=progress**2*fade(1-progress,.27)*ends*strength;
        if(alpha>.005)draw(from,to,alpha);
      }
      ctx!.globalAlpha=1;
    }

    const fit=new ResizeObserver(([entry])=>{
      const {width:nextWidth,height:nextHeight}=entry.contentRect;
      const scale=window.devicePixelRatio||1;
      if(width===nextWidth&&height===nextHeight&&scale===pixelRatio)return;
      width=nextWidth;height=nextHeight;pixelRatio=scale;
      layer.width=backing.width=Math.ceil(width*scale);
      layer.height=backing.height=Math.ceil(height*scale);
      const points=neonContour(width,height,{side,attached,compact,radius},extension);
      track=points.length>1?measureContour(points,!side):[];
      length=track.at(-1)?.distance??0;
      if(length){
        base.setTransform(scale,0,0,scale,0,0);
        ctx.setTransform(scale,0,0,scale,0,0);
        ctx.lineJoin=ctx.lineCap='round';
        base.lineJoin=base.lineCap='round';
        const path=new Path2D();
        path.moveTo(points[0].x,points[0].y);
        for(const point of points.slice(1))path.lineTo(point.x,point.y);
        if(!side)path.closePath();
        let stroke: string|CanvasGradient=color;
        if(side){
          const top=side==='top',axis=top?width:height;
          const start=top?points[0].x:points[0].y;
          const ramp=Math.min(.20,(Math.max(7,extension)+start)/axis);
          const gradient=base.createLinearGradient(0,0,top?width:0,top?0:height);
          gradient.addColorStop(start/axis,color+'00');
          gradient.addColorStop(ramp,color);
          gradient.addColorStop(1-ramp,color);
          gradient.addColorStop(1-start/axis,color+'00');
          stroke=gradient;
        }
        base.strokeStyle=stroke;
        for(const [width,opacity] of [[halo*2,.06],[halo,.13],[line,.60]]){
          base.lineWidth=width;
          base.globalAlpha=opacity*strength;
          base.stroke(path);
        }
      }
      paint(animation.running?animation.phase:null,true);
    });
    fit.observe(layer,{box:'device-pixel-content-box'});
    animation.listeners.add(paint);
    return ()=>{
      fit.disconnect();
      animation.listeners.delete(paint);
      layer.dataset.running='false';
    };
  },[enabled,visible,animation,side,attached,compact,radius,palette,intensity,extension]);

  return enabled&&visible?<canvas className="neon-border" ref={canvas} data-palette={palette} aria-hidden="true"/>:null;
});
