import {afterEach,describe,expect,it,vi} from 'vitest';
import {LiveVoiceClient} from '../src/renderer/live-voice';
import type {ZenBridge} from '../src/shared/contracts';
function fixture(){
  const channel={readyState:'open',onmessage:null as any,onclose:null as any};const track={enabled:true,stop:vi.fn()};const stream={getAudioTracks:()=>[track],getTracks:()=>[track]};const close=vi.fn();let audio:any,peer:any;
  vi.stubGlobal('navigator',{mediaDevices:{getUserMedia:async()=>stream}});
  vi.stubGlobal('Audio',class{constructor(){audio=this;}autoplay=false;muted=false;srcObject=null;play=async()=>{};pause(){}});
  vi.stubGlobal('AudioContext',class{createAnalyser(){return{fftSize:256,getByteTimeDomainData:(bytes:Uint8Array)=>bytes.fill(150)};}createMediaStreamSource(){return{connect(){}};}async close(){}});
  vi.stubGlobal('RTCPeerConnection',class{constructor(){peer=this;}iceGatheringState='complete';connectionState='connected';ontrack=null;onconnectionstatechange=null;addTrack(){}createDataChannel(){return channel;}async createOffer(){return{sdp:'v=0\r\n'};}async setLocalDescription(){}async setRemoteDescription(){}close(){close();channel.onclose?.();}});
  let end!: (value:any)=>void;const ending=new Promise(resolve=>end=resolve);
  const bridge={voiceStart:vi.fn(async()=>({ok:true,value:{sessionId:'opaque',sdp:'v=0\r\n'}})),liveReady:vi.fn(async()=>({ok:true,value:true})),liveEnd:vi.fn(()=>ending),voiceInterrupt:vi.fn(async()=>({ok:true,value:true}))} as unknown as ZenBridge;
  const state=vi.fn(),message=vi.fn(),transcript=vi.fn();const client=new LiveVoiceClient(bridge,state,message,vi.fn(),transcript);
  return{client,track,close,bridge,state,message,transcript,audio:()=>audio,remote:()=>peer.ontrack?.({streams:[stream]}),event:(event:unknown)=>channel.onmessage?.({data:JSON.stringify(event)}),finish:(finalized=true)=>end({ok:true,value:{finalized}})};
}
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
describe('Live browser lifecycle',()=>{
  it('interrupts playback once on authenticated input, resumes fresh output and retains transport/work',async()=>{
    const f=fixture();const starting=f.client.start();await vi.waitFor(()=>expect(f.bridge.voiceStart).toHaveBeenCalled());f.event({type:'session.started'});await starting;expect(f.client.level()).toBeGreaterThan(0);
    vi.useFakeTimers();f.remote();await vi.advanceTimersByTimeAsync(110);
    f.event({type:'session.input_transcript.delta',event_id:'user-a',delta:'Espera ',start_ms:100,end_ms:300});expect(f.audio().muted).toBe(true);expect(f.bridge.voiceInterrupt).toHaveBeenCalledOnce();
    f.event({type:'session.input_transcript.delta',event_id:'user-b',delta:'otra pregunta',start_ms:300,end_ms:700});expect(f.bridge.voiceInterrupt).toHaveBeenCalledOnce();expect(f.track.enabled).toBe(true);expect(f.close).not.toHaveBeenCalled();expect(f.bridge.liveEnd).not.toHaveBeenCalled();
    f.event({type:'session.output_transcript.delta',event_id:'old',delta:'buffer viejo',start_ms:100,end_ms:650});expect(f.audio().muted).toBe(true);
    f.event({type:'session.output_transcript.delta',event_id:'new',delta:'Te escucho',start_ms:710,end_ms:900});expect(f.audio().muted).toBe(false);
    f.client.setAudible(false);f.event({type:'session.output_transcript.delta',event_id:'meeting',delta:'texto',start_ms:900,end_ms:1200});expect(f.audio().muted).toBe(true);
    const closing=f.client.stop();expect(f.client.level()).toBe(0);f.finish();await closing;
  });
  it('keeps microphone disabled until session.started and preserves transport until finalization',async()=>{
    const f=fixture();const starting=f.client.start();await vi.waitFor(()=>expect(f.bridge.voiceStart).toHaveBeenCalled());expect(f.track.enabled).toBe(false);expect(f.bridge.liveReady).not.toHaveBeenCalled();f.event({type:'session.started'});await starting;expect(f.track.enabled).toBe(true);
    const closing=f.client.stop();expect(f.track.enabled).toBe(false);expect(f.track.stop).not.toHaveBeenCalled();expect(f.close).not.toHaveBeenCalled();f.event({type:'session.output_transcript.delta',event_id:'tail',delta:' cola exacta ',start_ms:100,end_ms:200});expect(f.transcript.mock.calls.at(-1)![0].text).toBe(' cola exacta ');f.finish();await closing;expect(f.close).toHaveBeenCalledOnce();expect(f.track.stop).toHaveBeenCalledOnce();expect(f.message).not.toHaveBeenCalled();
  });
  it('starts muted, shows exact timeline deltas and rejects events after close',async()=>{
    const f=fixture();const starting=f.client.start(true);await vi.waitFor(()=>expect(f.bridge.voiceStart).toHaveBeenCalled());f.event({type:'session.started'});await starting;expect(f.track.enabled).toBe(false);
    const event={type:'session.input_transcript.delta',event_id:'a',delta:' hola hola ',start_ms:0,end_ms:300};f.event(event);f.event(event);expect(f.transcript).toHaveBeenCalledOnce();expect(f.transcript.mock.calls[0][0].text).toBe(' hola hola ');
    const closing=f.client.stop();f.finish();await closing;f.event({...event,event_id:'late',delta:'late'});expect(f.transcript).toHaveBeenCalledOnce();
  });
  it('reports incomplete finalization without claiming a graceful disconnect',async()=>{
    const f=fixture();const starting=f.client.start();await vi.waitFor(()=>expect(f.bridge.voiceStart).toHaveBeenCalled());f.event({type:'session.started'});await starting;const closing=f.client.stop();f.finish(false);await closing;expect(f.message).toHaveBeenCalledWith(expect.stringContaining('incompleta'));expect(f.state).toHaveBeenLastCalledWith('disconnected',false);
  });
});
