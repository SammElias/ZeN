import type {CursorPoint} from '../shared/gaze';

/** Read-only desktop cursor, at most 20 updates/s while the overlay is visible. */
export class CursorGaze {
  private timer?:ReturnType<typeof setTimeout>;
  private enabled=false;
  private previous?:CursorPoint;
  constructor(private read:()=>CursorPoint,private send:(point:CursorPoint|null)=>void,private near:(point:CursorPoint)=>boolean=()=>true){}
  get active(){return this.enabled;}
  current(){return this.active?this.read():null;}
  private sample=()=>{
    const point=this.read();
    const near=Number.isFinite(point.x)&&Number.isFinite(point.y)&&this.near(point);
    if(near){if(this.previous?.x!==point.x||this.previous.y!==point.y){this.previous=point;this.send(point);}}
    else if(this.previous){this.previous=undefined;this.send(null);}
    if(this.enabled)this.timer=setTimeout(this.sample,near?50:400);
  };
  enable(enabled:boolean){
    if(enabled===this.active)return;
    this.enabled=enabled;
    if(enabled)this.sample();
    else{clearTimeout(this.timer);this.timer=undefined;this.previous=undefined;this.send(null);}
  }
  dispose(){this.enable(false);}
}
