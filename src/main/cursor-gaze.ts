import type {CursorPoint} from '../shared/gaze';

/** Read-only desktop cursor, at most 20 updates/s while the overlay is visible. */
export class CursorGaze {
  private timer?:ReturnType<typeof setInterval>;
  private previous?:CursorPoint;
  constructor(private read:()=>CursorPoint,private send:(point:CursorPoint|null)=>void){}
  get active(){return this.timer!==undefined;}
  current(){return this.active?this.read():null;}
  private sample=()=>{
    const point=this.read();
    if(!Number.isFinite(point.x)||!Number.isFinite(point.y))return;
    if(this.previous?.x===point.x&&this.previous.y===point.y)return;
    this.previous=point;this.send(point);
  };
  enable(enabled:boolean){
    if(enabled===this.active)return;
    if(enabled){this.timer=setInterval(this.sample,50);this.sample();}
    else{clearInterval(this.timer);this.timer=undefined;this.previous=undefined;this.send(null);}
  }
  dispose(){this.enable(false);}
}
