import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {createServer} from 'node:net';
import WebSocket from 'ws';
const executable=resolve(process.argv[2]??'release/single-file/ZEN.exe');
const env={...process.env};delete env.OPENAI_API_KEY;delete env.ELECTRON_RUN_AS_NODE;
// NSIS does not forward the child's stdout. Observe console events on a
// loopback-only inspector for this synthetic test; the shipping EXE is unchanged.
const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const port=server.address().port;await new Promise(resolve=>server.close(resolve));
const child=spawn(executable,[`--inspect-brk=127.0.0.1:${port}`,'--zen-smoke'],{env,windowsHide:true});
let output='',errors='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>errors+=chunk);
const timer=setTimeout(()=>child.kill(),90000);
let exited=false,socket,inspectedSmoke,extractedExecutable,fixtureTimer;
const exitedPromise=new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>{exited=true;resolve(code);});});
try{
  let target;
  for(let attempt=0;attempt<240&&!exited;attempt++){
    try{const response=await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(500)});target=(await response.json())[0];if(target?.webSocketDebuggerUrl)break;}catch{}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  if(!target?.webSocketDebuggerUrl)throw Error('No se pudo observar el proceso extraído.');
  const address=new URL(target.webSocketDebuggerUrl);if(address.hostname!=='127.0.0.1'||address.port!==String(port))throw Error('Inspector fuera del proceso de prueba.');
  socket=new WebSocket(address);await new Promise((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject);});
  socket.on('message',raw=>{
    const event=JSON.parse(raw.toString());
    if(event.id===3&&typeof event.result?.result?.value==='string'){extractedExecutable=event.result.result.value;clearInterval(fixtureTimer);}
    if(event.method!=='Runtime.consoleAPICalled')return;
    for(const argument of event.params.args??[]){if(typeof argument.value!=='string'||!argument.value.startsWith('{'))continue;try{const result=JSON.parse(argument.value);if(result.bridge===true&&'shownOnTop'in result){inspectedSmoke=result;socket.close();}}catch{}}
  });
  socket.send(JSON.stringify({id:1,method:'Runtime.enable'}));
  socket.send(JSON.stringify({id:2,method:'Runtime.runIfWaitingForDebugger'}));
  // A background/occluded native test window can suspend requestAnimationFrame.
  // Keep frames running only for this isolated smoke process, including windows
  // created later. No application code or shipping window preference is changed.
  const setupFixture=()=>{if(socket.readyState===WebSocket.OPEN)socket.send(JSON.stringify({id:3,method:'Runtime.evaluate',params:{expression:"(()=>{if(typeof process==='undefined'||!process.argv.includes('--zen-smoke'))return null;const e=process.getBuiltinModule('module').createRequire(process.execPath)('electron');if(!e.BrowserWindow)return null;if(!e.app.zenSmokeFrames){e.app.zenSmokeFrames=true;e.app.on('browser-window-created',(_,w)=>w.webContents.setBackgroundThrottling(false));}e.BrowserWindow.getAllWindows().forEach(w=>w.webContents.setBackgroundThrottling(false));return process.execPath;})()",returnByValue:true}}));};
  fixtureTimer=setInterval(setupFixture,250);setupFixture();
}catch(error){errors+=error.message;socket?.close();}
const exitCode=await exitedPromise.finally(()=>{clearTimeout(timer);clearInterval(fixtureTimer);socket?.close();});
const line=output.split(/\r?\n/).find(row=>row.startsWith('{'));
const smoke=inspectedSmoke??(line?JSON.parse(line):undefined);
const remainingChecks=smoke?Object.entries(smoke).filter(([,value])=>value===false).map(([key])=>key):['no-smoke-output'];
const packagedStartupVerified=remainingChecks.length===0&&exitCode===0&&smoke?.fullscreenChatVerified===true&&smoke?.homeChatOnlyVerified===true&&smoke?.dropContextIpcVerified===true&&smoke?.workspaceIpcVerified===true&&smoke?.rendered===true&&smoke?.bridge===true&&smoke?.nodeAbsent===true&&smoke?.activityTimelineVerified===true&&smoke?.cursorGazeVerified===true&&smoke?.documentReaderVerified===true&&smoke?.folderDelegationVerified===true&&smoke?.humanConfirmationVerified===true;
const report={at:new Date().toISOString(),executable,extractedExecutable,sha256:createHash('sha256').update(await readFile(executable)).digest('hex'),exitCode,packagedStartupVerified,
  validationScope:'single-executable-extraction-and-real-Electron-smoke-synthetic-tasks',apiCalled:false,
  fullObjectiveVerified:false,remainingChecks,
  ...(smoke?{fullscreenChatVerified:smoke.fullscreenChatVerified,homeChatOnlyVerified:smoke.homeChatOnlyVerified,dropContextIpcVerified:smoke.dropContextIpcVerified,workspaceIpcVerified:smoke.workspaceIpcVerified,cursorGazeVerified:smoke.cursorGazeVerified,documentReaderVerified:smoke.documentReaderVerified,folderDelegationVerified:smoke.folderDelegationVerified,humanConfirmationVerified:smoke.humanConfirmationVerified,activityTimelineVerified:smoke.activityTimelineVerified,edgeDockingVerified:smoke.edgeDockingVerified,stableStreamingVerified:smoke.stableStreamingVerified,shownOnTop:smoke.shownOnTop}:{diagnostic:errors.slice(-2000)})};
await mkdir('docs/evidence',{recursive:true});await writeFile('docs/evidence/single-executable.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
if(!packagedStartupVerified)process.exitCode=1;
