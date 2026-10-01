import { build } from 'esbuild';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
const replacement=process.argv.includes('--screen-replacement');
const visual=replacement||process.argv.includes('--screen-context');
const evidence=replacement?'docs/evidence/screen-replacement-live.json':visual?'docs/evidence/screen-context-live.json':'docs/evidence/live-webrtc.json';
const screenFixture=visual?JSON.parse(await readFile('test-results/screen-context-fixture.json','utf8')):undefined;
const oldScreenFixture=replacement?JSON.parse(await readFile('test-results/screen-context-old-fixture.json','utf8')):undefined;
let imageQueued=false;
import { pathToFileURL } from 'node:url';
import OpenAI from 'openai';
if(!process.env.OPENAI_API_KEY)throw new Error('Falta la clave de entorno autorizada.');
const directory=resolve('test-results/live-webrtc-'+Date.now());await mkdir(directory,{recursive:true});
await build({entryPoints:['src/agent/live-voice.ts','src/storage/spending.ts'],bundle:true,platform:'node',format:'esm',outdir:directory,outExtension:{'.js':'.mjs'},packages:'external'});
await build({entryPoints:['src/renderer/live-voice.ts'],bundle:true,platform:'browser',format:'iife',globalName:'ZENLiveTest',outfile:directory+'/client.js'});
const {LiveVoiceBackend,liveConfiguration}=await import(pathToFileURL(directory+'/agent/live-voice.mjs').href);
const {Spending}=await import(pathToFileURL(directory+'/storage/spending.mjs').href);
const secret=randomUUID();const events=[],logs=[];
const settings=()=>({voiceConsent:true,monthlyBudgetEur:100,eurPerUsd:1});const spending=new Spending(directory,settings);
const backend=new LiveVoiceBackend({key:()=>process.env.OPENAI_API_KEY,settings,spending,emit:e=>events.push(e),log:e=>logs.push(e),audible:()=>true,control:()=>false,candidate:()=>false,orchestrator:{run:async()=>{throw new Error('No local actions in this probe');},stop:()=>{},busy:false}});
let audio;
const html=`<!doctype html><meta charset="utf-8"><button id="start">Probar voz sintética</button><script src="/client.js"></script><script>
window.report={states:[],captions:[],messages:[],outputSoundDetected:false};
let inputContext,source;
navigator.mediaDevices.getUserMedia=async()=>{inputContext=new AudioContext();const output=inputContext.createMediaStreamDestination();const clock=inputContext.createOscillator();const gain=inputContext.createGain();gain.gain.value=0;clock.connect(gain).connect(output);clock.start();window.testInput=output;return output.stream;};
const invoke=async(path,value)=>{const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','X-Zen-Test':'${secret}'},body:JSON.stringify(value)});return r.json();};
const bridge={voiceStart:sdp=>invoke('/start',sdp),liveReady:id=>invoke('/ready',id),liveEnd:id=>invoke('/end',id),voiceInterrupt:async()=>({ok:true,value:true})};
window.voice=new ZENLiveTest.LiveVoiceClient(bridge,(status,microphone)=>report.states.push({status,microphone}),message=>report.messages.push(message),speaking=>{if(speaking)report.outputSoundDetected=true;},caption=>report.captions.push(caption));
document.querySelector('#start').onclick=()=>voice.start();
window.speakFixture=async()=>{const data=await (await fetch('/fixture.wav',{headers:{'X-Zen-Test':'${secret}'}})).arrayBuffer();const buffer=await inputContext.decodeAudioData(data);source=inputContext.createBufferSource();source.buffer=buffer;source.connect(testInput);await inputContext.resume();source.start();};
window.closeFixture=async()=>{await voice.stop();report.remoteAudio=!!document.querySelector('audio');return report;};
</script>`;
const server=createServer(async(request,response)=>{
  try{
    if(request.url==='/'){response.setHeader('Content-Type','text/html;charset=utf-8');return response.end(html);}
    if(request.url==='/client.js'){response.setHeader('Content-Type','application/javascript');return response.end(await readFile(directory+'/client.js'));}
    if(request.headers['x-zen-test']!==secret){response.writeHead(403);return response.end();}
    if(request.url==='/fixture.wav'&&request.method==='GET'){response.setHeader('Content-Type','audio/wav');return response.end(audio);}
    if(request.method!=='POST')throw new Error('Method');
    let body='';for await(const chunk of request){body+=chunk;if(body.length>65536)throw new Error('Size');}const value=JSON.parse(body);
    let result;
    if(request.url==='/start')result=await backend.start(value);
    else if(request.url==='/ready'){result=backend.started(value);if(screenFixture)imageQueued=await backend.screenContext({...oldScreenFixture??screenFixture,capturedAt:Date.now()});}
    else if(request.url==='/renew'&&replacement)result=await backend.screenContext({...screenFixture,capturedAt:Date.now()});
    else if(request.url==='/end')result=await backend.end(value);
    else throw new Error('Path');
    response.setHeader('Content-Type','application/json');response.end(JSON.stringify({ok:true,value:result}));
  }catch(error){response.setHeader('Content-Type','application/json');response.end(JSON.stringify({ok:false,error:typeof error?.status==='number'?`OpenAI HTTP ${error.status}`:error?.message==='Ya hay una sesión o tarea activa.'?error.message:'No se pudo completar el protocolo Live.'}));}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage();
const report={at:new Date().toISOString(),realApi:true,realWebRTC:true,syntheticAudio:true,physicalMicrophone:false,exactSession:liveConfiguration,passed:false,visualFixture:visual,ownedFixtureOnly:visual};
try{
  await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.click('#start');
  await page.waitForFunction(()=>report.states.some(e=>e.status==='connected')||report.messages.length,undefined,{timeout:30000});
  let frontend=await page.evaluate(()=>report);if(!frontend.states.some(e=>e.status==='connected'))throw new Error(frontend.messages.join(' · '));
  console.log('GPT-Live: session.started y WebRTC confirmados.');
  const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY,maxRetries:0});
  const response=await client.audio.speech.create({model:'gpt-4o-mini-tts',voice:'coral',response_format:'wav',input:replacement?'Consulta con SOL la nueva captura de mi ventana actual y dime el código de seis cifras que aparece. No uses una descripción anterior.':visual?'Consulta con SOL la captura de mi ventana y dime el código de seis cifras que aparece en el recuadro azul.':'Busca en la web una noticia positiva reciente sobre ciencia y dime el titular con su fuente.'});
  audio=Buffer.from(await response.arrayBuffer());await page.evaluate(()=>speakFixture());
  if(replacement){
    await page.waitForFunction(()=>report.captions.some(e=>e.speaker==='zen'&&/222\s*222|doscientos veintidós mil doscientos veintidós|dos.*dos.*dos.*dos.*dos.*dos/i.test(e.text)),undefined,{timeout:60000});
    report.previousVisionVerified=true;await page.waitForTimeout(1500);
    const renewed=await page.evaluate(()=>invoke('/renew',null));if(!renewed.ok||!renewed.value)throw new Error('No se renovó la captura');
    report.visualReferenceReplaced=true;await page.evaluate(()=>speakFixture());
  }
  await page.waitForFunction(()=>report.captions.some(e=>e.speaker==='user')&&report.captions.some(e=>e.speaker==='zen'),undefined,{timeout:60000});
  const deadline=Date.now()+60000;while(Date.now()<deadline&&!logs.some(e=>e.type==='live_delegation'&&e.state==='completed'))await new Promise(resolve=>setTimeout(resolve,1000));
  if(visual)await page.waitForFunction(()=>report.captions.some(e=>e.speaker==='zen'&&/384\s*729|trescientos ochenta y cuatro|tres.*ocho.*cuatro.*siete.*dos.*nueve/i.test(e.text)),undefined,{timeout:40000});
  else await page.waitForFunction(()=>report.captions.some(e=>e.speaker==='zen'&&e.text.trim().split(/\s+/).length>=20),undefined,{timeout:40000});
  report.spokenResultObserved=true;
  report.remoteAudioReceived=await page.evaluate(async()=>{const stats=await voice.pc.getStats();return [...stats.values()].some(e=>e.type==='inbound-rtp'&&e.kind==='audio'&&e.bytesReceived>0);});
  await page.evaluate(()=>voice.stop());await page.waitForTimeout(200);frontend=await page.evaluate(()=>report);
  report.sessionStarted=frontend.states.some(e=>e.status==='connected');report.captions=frontend.captions;report.messages=frontend.messages;report.delegations=logs.filter(e=>e.type==='live_delegation');report.finalization=logs.filter(e=>e.type==='voice_session').at(-1);report.spending=spending.summary();
  report.webCompleted=logs.some(e=>e.type==='live_web'&&e.status==='completed');report.outputSoundDetected=frontend.outputSoundDetected;
  report.imageQueued=imageQueued;report.solVisionVerified=visual&&events.some(e=>e.state==='completed'&&/384\s*729/.test(e.message));
  report.passed=report.sessionStarted&&report.captions.some(e=>e.speaker==='user')&&report.captions.some(e=>e.speaker==='zen')&&report.delegations.some(e=>e.state==='completed')&&(visual?report.imageQueued&&report.solVisionVerified:report.webCompleted)&&report.remoteAudioReceived&&report.outputSoundDetected&&report.finalization?.state==='closed'&&!report.messages.some(e=>/incompleta/i.test(e));
}catch(error){report.error=error?.message||'Prueba incompleta';}
finally{await backend.stop(false);const finalFrontend=await page.evaluate(()=>report).catch(()=>({captions:[],messages:[],states:[]}));report.states=finalFrontend.states;report.captions=finalFrontend.captions;report.messages=finalFrontend.messages;report.delegations=logs.filter(e=>e.type==='live_delegation');report.finalization=logs.filter(e=>e.type==='voice_session').at(-1);report.spending=spending.summary();report.imageQueued=imageQueued;report.solVisionVerified=visual&&events.some(e=>e.state==='completed'&&/384\s*729/.test(e.message));await browser.close();server.close();await mkdir('docs/evidence',{recursive:true});await writeFile(evidence,JSON.stringify(report,null,2));}
console.log(JSON.stringify({passed:report.passed,sessionStarted:report.sessionStarted,error:report.error,evidence}));if(!report.passed)process.exitCode=1;
