/** Cooperative pause: in-flight work settles; no new step or effect starts. */
export class PauseGate{
  private paused=false;private waiting=new Set<()=>void>();
  get active(){return this.paused;}
  pause(){this.paused=true;}
  resume(){this.paused=false;for(const wake of this.waiting)wake();this.waiting.clear();}
  async wait(signal:AbortSignal){
    signal.throwIfAborted();if(!this.paused)return;
    await new Promise<void>((resolve,reject)=>{
      const cleanup=()=>{signal.removeEventListener('abort',abort);this.waiting.delete(wake);};
      const wake=()=>{cleanup();resolve();};const abort=()=>{cleanup();reject(signal.reason);};
      this.waiting.add(wake);signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();
    });signal.throwIfAborted();
  }
}
