import {edgeContourDepth, edgeShoulder, type IslandSide} from '../shared/island';
import {neonVisual} from '../shared/companion-neon';

type Point = {x: number; y: number};
export type NeonShape = {side?: IslandSide; compact?: boolean; attached?: boolean; radius: number};

export function neonContour(width: number, height: number, shape: NeonShape, extension: number): Point[] {
  const {inset, maximumExtension}=neonVisual;
  if(width<=inset*2||height<=inset*2)return [];
  if(shape.side){
    const top=shape.side==='top',length=top?width:height,span=top?height:width;
    const shoulder=edgeShoulder(length,shape.compact===true);
    const trim=Math.min(maximumExtension-extension,shoulder*.7);
    const start=Math.max(.5,trim),end=length-start;
    const count=Math.max(1,Math.ceil((end-start)/3));
    return Array.from({length:count+1},(_,index)=>{
      const along=start+(end-start)*index/count;
      const depth=1+(span-1)*edgeContourDepth(along,length,shoulder);
      const cross=shape.attached?span-depth+inset:depth-inset;
      const safe=Math.max(.5,Math.min(span-.5,cross));
      return top?{x:along,y:safe}:{x:shape.side==='right'?span-safe:safe,y:along};
    });
  }

  const radius=Math.max(.1,Math.min(shape.radius,width/2,height/2)-inset);
  const near=inset+radius,farX=width-near,farY=height-near;
  return [{x:farX,y:near},{x:farX,y:farY},{x:near,y:farY},{x:near,y:near}].flatMap(({x,y},corner)=>
    Array.from({length:13},(_,step)=>{
      const angle=(corner-1+step/12)*Math.PI/2;
      return {x:x+radius*Math.cos(angle),y:y+radius*Math.sin(angle)};
    }));
}

export function measureContour(points: readonly Point[], closed: boolean) {
  const list=closed?[...points,points[0]]:points;
  let distance=0;
  return list.map((point,index)=>{
    if(index){const previous=list[index-1];distance+=Math.hypot(point.x-previous.x,point.y-previous.y);}
    return {...point,distance};
  });
}

type Track = ReturnType<typeof measureContour>;

export function traceContour(ctx: CanvasRenderingContext2D, track: Track, from: number, to: number) {
  function nextIndex(distance: number) {
    let low=1,high=track.length-1;
    while(low<high){const mid=(low+high)>>1;if(track[mid].distance<=distance)low=mid+1;else high=mid;}
    return low;
  }
  function at(distance: number, index: number) {
    const a=track[index-1],b=track[index];
    const scale=(distance-a.distance)/(b.distance-a.distance||1);
    return {x:a.x+scale*(b.x-a.x),y:a.y+scale*(b.y-a.y)};
  }
  const first=nextIndex(from),last=nextIndex(to),start=at(from,first),end=at(to,last);
  ctx.moveTo(start.x,start.y);
  for(let index=first;index<last;index++)ctx.lineTo(track[index].x,track[index].y);
  ctx.lineTo(end.x,end.y);
}
