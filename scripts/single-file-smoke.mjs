import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {createServer} from 'node:net';
import WebSocket from 'ws';
const interactionsOnly=process.argv.includes('--interactions');
const shellOnly=process.argv.includes('--shell');
const smokeFlag=shellOnly?'--zen-shell-smoke':interactionsOnly?'--zen-interactions-smoke':'--zen-smoke';
const executable=resolve(process.argv[2]??'release/single-file/ZEN.exe');
const env={...process.env};delete env.OPENAI_API_KEY;delete env.ELECTRON_RUN_AS_NODE;
// NSIS does not forward the child's stdout. Observe console events on a
// loopback-only inspector for this synthetic test; the shipping EXE is unchanged.
const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const port=server.address().port;await new Promise(resolve=>server.close(resolve));
const child=spawn(executable,[`--inspect-brk=127.0.0.1:${port}`,smokeFlag],{env,windowsHide:true});
let output='',errors='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>errors+=chunk);
const timer=setTimeout(()=>child.kill(),shellOnly?120000:90000);
let exited=false,socket,inspectedSmoke,extractedExecutable,fixtureTimer,finishTimer,lastWindows,fixtureProfile,fixturePid,checkingProof=false;
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
    if(event.id===3&&typeof event.result?.result?.value==='string'){try{const value=JSON.parse(event.result.result.value);extractedExecutable=value.executable;lastWindows=value.windows;fixtureProfile=value.profile;fixturePid=value.pid;}catch{extractedExecutable=event.result.result.value;}}
    if(event.method==='Runtime.exceptionThrown')errors+=JSON.stringify(event.params.exceptionDetails).slice(0,1800);
    if(event.method==='Runtime.consoleAPICalled'&&event.params.type==='error'){errors+=(event.params.args??[]).map(a=>a.value??a.description??'').join(' ').slice(0,1800);socket.close();}
    if(event.method!=='Runtime.consoleAPICalled')return;
    for(const argument of event.params.args??[]){if(typeof argument.value!=='string'||!argument.value.startsWith('{'))continue;try{const result=JSON.parse(argument.value);if((shellOnly?result.passed!==undefined&&result.capsuleSize!==undefined:interactionsOnly?result.passed!==undefined&&result.quickNativeWidth!==undefined:result.bridge===true&&'shownOnTop'in result)){inspectedSmoke=result;finishTimer??=setTimeout(()=>socket.close(),20000);}}catch{}}
  });
  socket.send(JSON.stringify({id:1,method:'Runtime.enable'}));
  socket.send(JSON.stringify({id:2,method:'Runtime.runIfWaitingForDebugger'}));
  // A background/occluded native test window can suspend requestAnimationFrame.
  // Keep frames running only for this isolated smoke process, including windows
  // created later. No application code or shipping window preference is changed.
  // NSIS changes cwd during extraction. Restore the test runner's directory so
  // synthetic fixtures and reports resolve identically to package-win's smoke.
  const setupFixture=()=>{if(socket.readyState===WebSocket.OPEN)socket.send(JSON.stringify({id:3,method:'Runtime.evaluate',params:{expression:`(()=>{if(typeof process==='undefined'||!process.argv.some(a=>['--zen-smoke','--zen-interactions-smoke','--zen-shell-smoke'].includes(a)))return null;const e=process.getBuiltinModule('module').createRequire(process.execPath)('electron');if(!e.BrowserWindow)return null;if(!e.app.zenSmokeFrames){process.chdir(${JSON.stringify(process.cwd())});e.app.zenSmokeFrames=true;e.app.on('browser-window-created',(_,w)=>w.webContents.setBackgroundThrottling(false));}e.BrowserWindow.getAllWindows().forEach(w=>w.webContents.setBackgroundThrottling(false));return JSON.stringify({executable:process.execPath,pid:process.pid,profile:e.app.getPath('userData'),windows:e.BrowserWindow.getAllWindows().map(w=>({visible:w.isVisible(),loading:w.webContents.isLoading(),destroyed:w.isDestroyed(),bounds:w.getBounds()}))});})()`,returnByValue:true}}));};
  fixtureTimer=setInterval(()=>{setupFixture();if(shellOnly&&fixtureProfile&&fixturePid&&!checkingProof&&!inspectedSmoke){checkingProof=true;void readFile(join(fixtureProfile,'smoke-result.json'),'utf8').then(raw=>{const value=JSON.parse(raw);if(value.pid!==fixturePid||resolve(value.executable)!==resolve(extractedExecutable))throw Error('Unexpected synthetic proof owner');inspectedSmoke=value.result;socket?.close();}).catch(()=>{}).finally(()=>{checkingProof=false;});}},250);setupFixture();
}catch(error){errors+=error.message;socket?.close();}
const exitCode=await exitedPromise.finally(()=>{clearTimeout(timer);clearTimeout(finishTimer);clearInterval(fixtureTimer);socket?.close();});
const line=output.split(/\r?\n/).find(row=>row.startsWith('{'));
const smoke=inspectedSmoke??(line?JSON.parse(line):undefined);
const failedChecks=smoke?Object.entries(smoke).filter(([key,value])=>value===false&&!['apiCalled','physicalInputTested','DPIChangesTested'].includes(key)).map(([key])=>key):['no-smoke-output'];
const packagedStartupVerified=failedChecks.length===0&&(shellOnly?exitCode===0&&smoke?.passed===true&&smoke?.companionOnly===true:interactionsOnly?exitCode===0&&smoke?.passed===true&&smoke?.quickNativeWidth===true&&smoke?.chatNativeWidth===true&&smoke?.rendererNodeUnavailable===true&&smoke?.frozenContextAndDedup===true&&smoke?.localGuidePersisted===true&&smoke?.appearanceSaved===true:exitCode===0&&smoke?.fullscreenChatVerified===true&&smoke?.dailyWorkspaceVerified===true&&smoke?.homeChatOnlyVerified===true&&smoke?.dropContextIpcVerified===true&&smoke?.workspaceIpcVerified===true&&smoke?.rendered===true&&smoke?.bridge===true&&smoke?.nodeAbsent===true&&smoke?.activityTimelineVerified===true&&smoke?.cursorGazeVerified===true&&smoke?.documentReaderVerified===true&&smoke?.folderDelegationVerified===true&&smoke?.humanConfirmationVerified===true);
const report={at:new Date().toISOString(),executable,extractedExecutable,sha256:createHash('sha256').update(await readFile(executable)).digest('hex'),exitCode,packagedStartupVerified,
  ...(!packagedStartupVerified?{diagnostic:errors.slice(-2000),failedChecks}:{}),
  validationScope:shellOnly?'single-executable-codex-companion-native-hook-IPC':interactionsOnly?'single-executable-extraction-and-real-Electron-contextual-IPC':'single-executable-extraction-and-real-Electron-smoke-synthetic-tasks',apiCalled:false,
  fullObjectiveVerified:false,remainingChecks:shellOnly?['physical-input-and-DPI','Codex-hook-user-trust','live-Codex-hook-events','Windows-notification-delivery']:interactionsOnly?['physical-input-and-focus','multiple-monitors-and-DPI','physical-capture-exclusions','real-model-and-voice']:smoke?Object.entries(smoke).filter(([,value])=>value===false).map(([key])=>key):['no-smoke-output'],
  ...(shellOnly&&smoke?{desktopShell:smoke}:interactionsOnly&&smoke?{interactions:smoke}:smoke?{fullscreenChatVerified:smoke.fullscreenChatVerified,dailyWorkspaceVerified:smoke.dailyWorkspaceVerified,homeChatOnlyVerified:smoke.homeChatOnlyVerified,dropContextIpcVerified:smoke.dropContextIpcVerified,workspaceIpcVerified:smoke.workspaceIpcVerified,cursorGazeVerified:smoke.cursorGazeVerified,documentReaderVerified:smoke.documentReaderVerified,folderDelegationVerified:smoke.folderDelegationVerified,humanConfirmationVerified:smoke.humanConfirmationVerified,activityTimelineVerified:smoke.activityTimelineVerified,edgeDockingVerified:smoke.edgeDockingVerified,stableStreamingVerified:smoke.stableStreamingVerified,shownOnTop:smoke.shownOnTop}:{diagnostic:errors.slice(-2000),lastWindows})};
await mkdir('docs/evidence',{recursive:true});await writeFile('docs/evidence/single-executable.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
if(!packagedStartupVerified)process.exitCode=1;
