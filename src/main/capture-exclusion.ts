type Window = {isDestroyed:()=>boolean;isContentProtected:()=>boolean;setContentProtection:(value:boolean)=>void};
// Concurrent or cancelled captures must not restore inclusion while another
// capture still holds a lease. Does not hide, blur or disconnect the capsule.
export class CaptureExclusion {
  private leases=0;
  private previous=false;
  private ready:Promise<void>=Promise.resolve();
  constructor(private window:Window){}
  async during<T>(signal:AbortSignal,operation:()=>Promise<T>):Promise<T>{
    signal.throwIfAborted();if(this.window.isDestroyed())throw new Error('Capsule unavailable');
    if(this.leases===0){this.previous=this.window.isContentProtected();this.window.setContentProtection(true);this.ready=new Promise(resolve=>setTimeout(resolve,40));}this.leases++;
    try{await this.ready;signal.throwIfAborted();const value=await operation();signal.throwIfAborted();return value;}
    finally{if(--this.leases===0&&!this.window.isDestroyed())this.window.setContentProtection(this.previous);}
  }
}
