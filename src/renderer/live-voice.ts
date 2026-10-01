import type { Utterance, ZenBridge } from '../shared/contracts';
import type { VoiceStatus } from './voice';
import { LiveTranscript } from '../shared/live-transcript';
import { SpeechActivity } from './speech-activity';
export class LiveVoiceClient {
  private pc?:RTCPeerConnection;
  private stream?:MediaStream;
  private audio=new Audio();
  private sessionId?:string;
  private generation=0;
  private starting=false;
  private closing?:Promise<void>;
  private context?:AudioContext;
  private analyser?:AnalyserNode;
  private meter?:ReturnType<typeof setInterval>;
  private muted=false;
  private allowed=true;
  private ready=false;
  private cancelStart?:()=>void;
  private activity:SpeechActivity;
  constructor(private bridge:ZenBridge,private state:(status:VoiceStatus,microphone:boolean)=>void,private message:(text:string)=>void,private speaking:(value:boolean)=>void=()=>{},private transcript:(event:Utterance)=>void=()=>{}){this.audio.autoplay=true;this.activity=new SpeechActivity(speaking);}
  get active(){return this.starting||!!this.pc||!!this.closing;}
  level(){if(!this.analyser||this.muted)return 0;const data=new Uint8Array(this.analyser.fftSize);this.analyser.getByteTimeDomainData(data);return Math.min(1,Math.sqrt(data.reduce((sum,v)=>sum+((v-128)/128)**2,0)/data.length)*5);}
  setMicrophoneEnabled(enabled:boolean){this.muted=!enabled;this.stream?.getAudioTracks().forEach(t=>{t.enabled=enabled&&this.ready&&!this.closing;});if(this.ready)this.state('connected',enabled);}
  mute(){this.setMicrophoneEnabled(this.muted);}
  setAudible(allowed:boolean){this.allowed=allowed;this.audio.muted=!allowed;if(!allowed)this.activity.reset();}
  async interrupt(){this.audio.muted=true;this.activity.reset();await this.bridge.voiceInterrupt();}
  async start(startMuted=false){
    if(this.active)return;this.starting=true;const generation=++this.generation;this.state('connecting',false);
    let started=false;let signalStarted!:()=>void;let rejectStarted!:(error:Error)=>void;
    const startup=new Promise<void>((resolve,reject)=>{signalStarted=resolve;rejectStarted=reject;});void startup.catch(()=>{});
    this.cancelStart=()=>rejectStarted(new Error('Conexión cancelada.'));
    const timer=setTimeout(()=>rejectStarted(new Error('GPT-Live no confirmó session.started.')),20000);
    const timeline=new LiveTranscript();
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
      if(generation!==this.generation){stream.getTracks().forEach(t=>t.stop());return;}
      this.stream=stream;this.muted=startMuted;stream.getAudioTracks().forEach(t=>{t.enabled=false;});
      this.context=new AudioContext();this.analyser=this.context.createAnalyser();this.analyser.fftSize=256;this.context.createMediaStreamSource(stream).connect(this.analyser);
      const pc=new RTCPeerConnection();this.pc=pc;const dc=pc.createDataChannel('oai-events');
      pc.ontrack=event=>{
        this.audio.srcObject=event.streams[0];this.audio.muted=!this.allowed;
        void this.audio.play().catch(()=>this.message('No se pudo reproducir audio. Revisa el dispositivo de salida.'));
        const analyser=this.context!.createAnalyser();analyser.fftSize=256;this.context!.createMediaStreamSource(event.streams[0]).connect(analyser);
        clearInterval(this.meter);this.activity.reset();this.meter=setInterval(()=>{const data=new Uint8Array(analyser.fftSize);analyser.getByteTimeDomainData(data);this.activity.sample(Math.sqrt(data.reduce((sum,v)=>sum+((v-128)/128)**2,0)/data.length),this.allowed&&!this.audio.muted);},100);
      };
      pc.onconnectionstatechange=()=>{if(['failed','disconnected'].includes(pc.connectionState)){this.message('Conexión Live interrumpida; finalización incompleta.');rejectStarted(new Error('Conexión Live interrumpida.'));void this.stop(true);}};
      dc.onclose=()=>{if(generation===this.generation&&this.pc===pc&&!this.closing){rejectStarted(new Error('Canal Live cerrado antes de confirmar la sesión.'));this.message('Canal Live cerrado; finalización incompleta.');void this.stop(true);}};
      dc.onmessage=event=>{
        if(generation!==this.generation)return;
        try{
          const e=JSON.parse(event.data);
          if(e.type==='session.started'){started=true;signalStarted();}
          if(e.type==='session.closed'){if(!this.closing)void this.stop(e.reason==='connection_lost');return;}
          const fragment=timeline.consume(e);if(fragment?.utterance)this.transcript(fragment.utterance);
          if(e.type==='error')this.message('GPT-Live rechazó un evento. No se ha cambiado la configuración.');
        }catch{this.message('Evento Live ilegible.');void this.stop(true);}
      };
      pc.addTrack(stream.getAudioTracks()[0],stream);
      const offer=await pc.createOffer();await pc.setLocalDescription(offer);
      // Gather the complete local SDP. No secret or startup configuration reaches renderer.
      if(pc.iceGatheringState!=='complete')await new Promise<void>((resolve,reject)=>{
        const iceTimer=setTimeout(()=>{pc.removeEventListener('icegatheringstatechange',gathered);reject(new Error('No se pudo preparar la conexión de audio.'));},8000);
        const gathered=()=>{if(pc.iceGatheringState==='complete'){clearTimeout(iceTimer);pc.removeEventListener('icegatheringstatechange',gathered);resolve();}};
        pc.addEventListener('icegatheringstatechange',gathered);gathered();
      });
      if(generation!==this.generation)return;
      const response=await this.bridge.voiceStart(pc.localDescription?.sdp??offer.sdp!);if(!response.ok)throw new Error(response.error);
      if(generation!==this.generation){await this.bridge.liveEnd(response.value.sessionId);return;}
      this.sessionId=response.value.sessionId;await pc.setRemoteDescription({type:'answer',sdp:response.value.sdp});
      if(!started)await startup;
      if(generation!==this.generation)return;
      const ready=await this.bridge.liveReady(response.value.sessionId);if(!ready.ok)throw new Error(ready.error);
      if(generation!==this.generation)return;
      this.ready=true;stream.getAudioTracks().forEach(t=>{t.enabled=!this.muted;});this.state('connected',!this.muted);
    }catch(error){if(generation===this.generation){const e=error as Error;this.message(e.name==='NotAllowedError'?'Micrófono denegado. Revisa el consentimiento y los permisos de Windows.':e.name==='NotFoundError'?'No hay micrófono disponible.':e.message||'No se pudo conectar GPT-Live.');await this.stop(true);}}
    finally{clearTimeout(timer);this.cancelStart=undefined;this.starting=false;}
  }
  stop(incomplete=false):Promise<void>{
    if(this.closing)return this.closing;
    this.ready=false;this.stream?.getAudioTracks().forEach(t=>{t.enabled=false;});this.cancelStart?.();
    this.state('closing',false);
    if(incomplete)this.audio.muted=true;
    const id=this.sessionId;
    this.closing=(async()=>{
      // Keep remote audio, data channel and peer alive during server finalization.
      if(id){try{const result=await this.bridge.liveEnd(id);if(!result.ok||!result.value.finalized)this.message('Finalización GPT-Live incompleta; cierre no confirmado.');}catch{this.message('Finalización GPT-Live incompleta; no se pudo verificar el cierre.');}}
      ++this.generation;this.sessionId=undefined;const pc=this.pc;this.pc=undefined;if(pc){pc.onconnectionstatechange=null;pc.close();}
      clearInterval(this.meter);this.stream?.getTracks().forEach(t=>t.stop());this.stream=undefined;this.audio.pause();this.audio.srcObject=null;this.activity.reset();this.analyser=undefined;void this.context?.close();this.context=undefined;this.state('disconnected',false);
    })();
    const pending=this.closing;void pending.finally(()=>{if(this.closing===pending)this.closing=undefined;});return pending;
  }
}
