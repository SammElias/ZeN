import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { LiveVoiceBackend, liveConfiguration } from '../src/agent/live-voice';
import { LiveTranscript } from '../src/shared/live-transcript';
import { latestUtterance } from '../src/renderer/latest-message';
import { SettingsSchema } from '../src/shared/contracts';
import WebSocket from 'ws';
class Socket extends EventEmitter {readyState=WebSocket.OPEN;send=vi.fn((_value:string,callback?:(error?:Error)=>void)=>callback?.());close=vi.fn();}
const delta=(speaker:'input'|'output',id:string,text:string,start:number,end:number)=>({type:`session.${speaker}_transcript.delta`,event_id:id,delta:text,start_ms:start,end_ms:end});
function fixture(){
  const socket=new Socket();const emit=vi.fn(),log=vi.fn(),run=vi.fn().mockResolvedValue({state:'completed',message:'Verificado'}),stop=vi.fn();
  const spending={reserve:vi.fn().mockImplementation((_c,_m)=>_m),record:vi.fn().mockReturnValue(true),finish:vi.fn(),check:vi.fn(),tool:vi.fn()};
  const backend=new LiveVoiceBackend({key:()=> 'fixture-not-real-key',settings:()=>SettingsSchema.parse({voiceConsent:true}),emit,log,spending,orchestrator:{run,stop,busy:false},audible:()=>true,control:()=>false,candidate:text=>text.includes('Abre'),socket:()=>socket as unknown as WebSocket,closeTimeoutMs:20});
  const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({session:{id:'opaque/id:1'},transport:{type:'webrtc',sdp:'v=0\r\nanswer'}})});vi.stubGlobal('fetch',fetch);
  const event=(e:unknown)=>socket.emit('message',Buffer.from(JSON.stringify(e)));
  const close=(reason='close_requested')=>event({type:'session.closed',event_id:'closed',session:{id:'opaque/id:1'},reason,usage:{seconds:30}});
  return{backend,socket,emit,log,run,stop,spending,fetch,event,close};
}
afterEach(()=>vi.unstubAllGlobals());
describe('GPT-Live',()=>{
  it('queues vision only in SOL after session.started, once per snapshot, without effects or startup edits',async()=>{
    const f=fixture();await f.backend.start('v=0\r\n');const snapshot={id:'fixture-screen',image:'data:image/jpeg;base64,ZmFrZQ==',capturedAt:Date.now()};
    expect(await f.backend.screenContext(snapshot)).toBe(false);expect(f.socket.send).not.toHaveBeenCalled();f.backend.started('opaque/id:1');expect(await f.backend.screenContext(snapshot)).toBe(true);expect(await f.backend.screenContext(snapshot)).toBe(true);
    const events=f.socket.send.mock.calls.map(([value])=>JSON.parse(value));expect(events.map(e=>e.type)).toEqual(['response.item.create','session.thinking.append']);expect(events[0].item.content[1]).toEqual({type:'input_image',image_url:snapshot.image,detail:'auto'});expect(events[0].item.content[0].text).toContain('ni concede permisos');expect(f.run).not.toHaveBeenCalled();expect(JSON.stringify(f.log.mock.calls)).not.toContain(snapshot.image);
    f.backend.invalidateScreenContext();f.backend.invalidateScreenContext();expect(f.socket.send).toHaveBeenCalledTimes(3);expect(JSON.parse(f.socket.send.mock.calls[2][0]).content).toContain('ha caducado');
    expect(await f.backend.screenContext({...snapshot,id:'old',capturedAt:Date.now()-120001})).toBe(false);const closing=f.backend.end('opaque/id:1');expect(await f.backend.screenContext({...snapshot,id:'closing'})).toBe(false);f.close();await closing;
  });
  it('posts the exact new handoff once, opaque ID, no startup reconfiguration',async()=>{
    const f=fixture();const result=await f.backend.start('v=0\r\n');expect(result.sessionId).toBe('opaque/id:1');
    expect(JSON.parse(f.fetch.mock.calls[0][1].body)).toEqual({session:liveConfiguration,transport:{type:'webrtc',sdp:'v=0\r\n'}});
    expect(liveConfiguration).toEqual({model:'gpt-live-1',instructions:'Te llamas ZeN. Eres un compañero amigable y directo que ayuda al usuario con sus tareas y su vida cotidiana.',audio:{output:{voice:'echo'}},delegation:{type:'responses',responses:{parallel_tool_calls:false,model:'gpt-6.1-sol',reasoning:{effort:'low'},tools:[{type:'web_search'}]}}});
    f.backend.started(result.sessionId);expect(f.socket.send).not.toHaveBeenCalled();const closing=f.backend.end(result.sessionId);expect(f.socket.close).not.toHaveBeenCalled();f.event(delta('output','tail',' Fin.',100,200));expect(f.emit.mock.calls.at(-1)![0].utterance.text).toBe(' Fin.');f.close();expect(await closing).toEqual({finalized:true,reason:'close_requested'});expect(f.socket.close).toHaveBeenCalledOnce();
  });
  it('replaces the visual reference in SOL and Live without reusing descriptions or losing its source',async()=>{
    const f=fixture();await f.backend.start('v=0\r\n');f.backend.started('opaque/id:1');const capturedAt=Date.now();
    await f.backend.screenContext({id:'docs',sourceTitle:'Documentación',capturedAt,image:'data:image/jpeg;base64,ZG9jcw=='});
    await f.backend.screenContext({id:'chart',sourceTitle:'Gráfico actual',capturedAt:capturedAt+1,image:'data:image/jpeg;base64,Y2hhcnQ='});
    const events=f.socket.send.mock.calls.map(([value])=>JSON.parse(value));expect(events[2].item.content[1].image_url).toBe('data:image/jpeg;base64,Y2hhcnQ=');expect(events[2].item.content[0].text).toContain('Gráfico actual');expect(events[3].content).toContain('sin reutilizar una descripción antigua');expect(f.run).not.toHaveBeenCalled();const closing=f.backend.end('opaque/id:1');f.close();await closing;
  });
  it('deduplicates concurrent sends and permits a new explicit attempt after a transport failure',async()=>{
    const f=fixture();await f.backend.start('v=0\r\n');f.backend.started('opaque/id:1');const snapshot={id:'same',capturedAt:Date.now(),image:'data:image/jpeg;base64,ZmFrZQ=='};
    let finish!:(error?:Error)=>void;f.socket.send.mockImplementationOnce((_value,callback)=>{finish=callback!;});const a=f.backend.screenContext(snapshot),b=f.backend.screenContext(snapshot);expect(f.socket.send).toHaveBeenCalledOnce();finish(new Error('fixture'));const results=await Promise.allSettled([a,b]);expect(results.every(row=>row.status==='rejected')).toBe(true);expect(await f.backend.screenContext(snapshot)).toBe(true);expect(f.socket.send).toHaveBeenCalledTimes(3);const closing=f.backend.end('opaque/id:1');f.close();await closing;
  });
  it('retains exact repeated delta text, interval grouping and independent overlapping speakers',()=>{
    const timeline=new LiveTranscript();const a=timeline.consume(delta('input','1','Hola ',100,300))!;const b=timeline.consume(delta('input','2','hola',300,500))!;expect(b.segment.text).toBe('Hola hola');expect(b.segment.id).toBe(a.segment.id);
    const zen=timeline.consume(delta('output','3','Sí ',200,700))!;expect(zen.utterance?.speaker).toBe('zen');expect(timeline.consume(delta('input','2','hola',300,500))).toBeUndefined();
    const delayed=timeline.consume(delta('input','4',' tardío',500,650))!;expect(delayed.utterance).toBeUndefined();
    const newSpeech=timeline.consume(delta('input','5','Otra cosa',2500,3000))!;expect(newSpeech.segment.id).not.toBe(a.segment.id);
    const state=latestUtterance(latestUtterance({},zen.utterance!),newSpeech.utterance!);expect(latestUtterance(state,{...zen.utterance!,text:'Obsoleto'})).toBe(state);
  });
  it('never executes transcript fragments or model calls; explicit exact request is single use',async()=>{
    const f=fixture();await f.backend.start('v=0\r\n');f.backend.started('opaque/id:1');f.event(delta('input','1','Abre Bloc',0,200));
    const old=f.emit.mock.calls.at(-1)![0].liveRequest.id;f.event(delta('input','2',' de notas',200,400));expect(f.run).not.toHaveBeenCalled();
    await expect(f.backend.submit(old)).rejects.toThrow('cambiado');const id=f.emit.mock.calls.at(-1)![0].liveRequest.id;
    f.event({type:'response.event',event_id:'model',event:{type:'response.function_call_arguments.done',name:'zen_desktop',arguments:'{}'}});expect(f.run).not.toHaveBeenCalled();
    await f.backend.submit(id);expect(f.run).toHaveBeenCalledWith('Abre Bloc de notas',expect.any(String));await expect(f.backend.submit(id)).rejects.toThrow();const closing=f.backend.end('opaque/id:1');f.close();await closing;
  });
  it('does not send a local-only result to Live or speak stale tool results',async()=>{
    const f=fixture();await f.backend.start('v=0\r\n');f.backend.started('opaque/id:1');f.run.mockResolvedValue({localOnly:true,message:'private-local-document'});f.event(delta('input','1','Abre archivo',0,200));await f.backend.submit(f.emit.mock.calls.at(-1)![0].liveRequest.id);expect(f.socket.send).not.toHaveBeenCalled();expect(JSON.stringify(f.log.mock.calls)).not.toContain('private-local-document');const closing=f.backend.end('opaque/id:1');f.close();await closing;
  });
  it('reports timeout/disconnect as incomplete and never cancels tasks on hide',async()=>{
    const f=fixture();await f.backend.start('v=0\r\n');f.backend.started('opaque/id:1');expect(await f.backend.end('opaque/id:1')).toEqual({finalized:false,reason:'timeout'});expect(f.stop).not.toHaveBeenCalled();expect(f.spending.finish).toHaveBeenCalledWith('gpt-live-1',false);await expect(f.backend.end('different')).rejects.toThrow();expect(await f.backend.end('opaque/id:1')).toEqual({finalized:false,reason:'timeout'});
  });
  it('tracks delegated SOL stream, actual web evidence and separate usage without executing Windows',async()=>{
    const f=fixture();await f.backend.start('v=0\r\n');f.backend.started('opaque/id:1');f.event(delta('input','1','Busca noticias',0,200));
    f.event({type:'session.delegation.created',event_id:'d',offset_ms:200,delegation:{id:'d1',target:'responses',response_id:'r1'}});
    f.event({type:'response.event',event_id:'rdelta',delegation_id:'d1',event:{type:'response.output_text.delta',delta:'Resultado'}});
    f.event({type:'response.event',event_id:'rweb',delegation_id:'d1',event:{type:'response.output_item.done',item:{type:'web_search_call',id:'w1',status:'completed'}}});
    f.event({type:'response.event',event_id:'rdone',delegation_id:'d1',event:{type:'response.completed',response:{usage:{input_tokens:10,output_tokens:2}}}});
    expect(f.emit.mock.calls.some(([e])=>e.state==='completed'&&e.message==='Resultado')).toBe(true);expect(f.spending.record).toHaveBeenCalledWith('gpt-6.1-sol','response:r1','gpt-6.1-sol',{input_tokens:10,output_tokens:2});expect(f.spending.tool).toHaveBeenCalledWith('gpt-6.1-sol','web:w1');expect(f.run).not.toHaveBeenCalled();const closing=f.backend.end('opaque/id:1');f.close();await closing;
  });
});
