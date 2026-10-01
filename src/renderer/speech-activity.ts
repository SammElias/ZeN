// Keep the speaking state across short pauses in audio, without inferring
// user turns or authorizing tasks from silence.
export class SpeechActivity {
  private active=false;
  private lastSound=0;
  constructor(private changed:(active:boolean)=>void,private releaseMs=900){}
  sample(level:number,allowed:boolean,now=performance.now()){
    if(!allowed){this.reset();return;}
    if(level>(this.active ? .003 : .008)){this.lastSound=now;this.set(true);}
    else if(this.active&&now-this.lastSound>=this.releaseMs)this.set(false);
  }
  reset(){this.set(false);this.lastSound=0;}
  private set(value:boolean){if(value!==this.active){this.active=value;this.changed(value);}}
}
