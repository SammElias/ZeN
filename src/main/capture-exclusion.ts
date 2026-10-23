type Window = {isDestroyed:()=>boolean;isContentProtected:()=>boolean;setContentProtection:(value:boolean)=>void};
// Concurrent or cancelled captures must not restore inclusion while another
// capture still holds a lease. Does not hide, blur or disconnect the capsule.
export class CaptureExclusion {
  private leases=0;
  private previous=new Map<Window,boolean>();
  private ready:Promise<void>=Promise.resolve();
  constructor(private windows:Window|(()=>Window[])){}
  include(window:Window){
    if(!this.leases||window.isDestroyed()||this.previous.has(window))return;
    this.previous.set(window,window.isContentProtected());window.setContentProtection(true);
  }
  async during<T>(signal:AbortSignal,operation:()=>Promise<T>):Promise<T>{
    signal.throwIfAborted();const windows=typeof this.windows==='function'?this.windows():[this.windows];
    if(!windows.some(window=>!window.isDestroyed()))throw new Error('ZEN unavailable');
    const first=this.leases++===0;
    try{windows.forEach(window=>this.include(window));
    if(first)this.ready=new Promise(resolve=>setTimeout(resolve,60));
    await this.ready;signal.throwIfAborted();const value=await operation();signal.throwIfAborted();return value;}
    finally{if(--this.leases===0){for(const [window,protectedBefore]of this.previous)if(!window.isDestroyed())window.setContentProtection(protectedBefore);this.previous.clear();}}
  }
}
