/** Ephemeral presentation coordinates. Never screenshot context or model input. */
export type CursorPoint = {x:number;y:number};
export type GazeBounds = CursorPoint & {width:number;height:number};
export function windowCursor(point:CursorPoint,origin:CursorPoint,zoom=1):CursorPoint {
  return {x:(point.x-origin.x)/zoom,y:(point.y-origin.y)/zoom};
}
export function gazeOffset(point:CursorPoint|null,box:GazeBounds):CursorPoint {
  if(!point||![point.x,point.y,box.x,box.y,box.width,box.height].every(Number.isFinite)||box.width<=0||box.height<=0)return{x:0,y:0};
  const x=(point.x-box.x-box.width/2)/140,y=(point.y-box.y-box.height/2)/140;
  const distance=Math.sqrt(1+x*x+y*y);
  return {x:6*x/distance,y:4*y/distance};
}
