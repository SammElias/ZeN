import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {createServer} from 'node:net';
import WebSocket from 'ws';
import {companionSmokePassed,readCompanionSmokeReceipt} from './companion-smoke-runner.mjs';
const options=process.argv.slice(2);
const historical=options.includes('--historical');
const interactionsOnly=historical&&options.includes('--interactions');
const shellOnly=!historical||options.includes('--shell');
const file=options.find(option=>!option.startsWith('--'));
if((historical&&!file)||(options.includes('--interactions')&&!historical))throw Error('Indica --historical y el ejecutable de la versión histórica.');
const smokeFlag=shellOnly?'--zen-shell-smoke':interactionsOnly?'--zen-interactions-smoke':'--zen-smoke';
const executable=resolve(file??'release/single-file/ZEN.exe');
const sha256=createHash('sha256').update(await readFile(executable)).digest('hex');
const env={...process.env};delete env.OPENAI_API_KEY;delete env.ELECTRON_RUN_AS_NODE;
// NSIS does not forward the child's stdout. Observe console events on a
// loopback-only inspector for this synthetic test; the shipping EXE is unchanged.
const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const port=server.address().port;await new Promise(resolve=>server.close(resolve));
const launchedAt=Date.now();
const child=spawn(executable,[`--inspect-brk=127.0.0.1:${port}`,smokeFlag],{env,windowsHide:true});
let output='',errors='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>errors+=chunk);
const timer=setTimeout(()=>child.kill(),shellOnly?160000:90000);
let exited=false,socket,inspectedSmoke,extractedExecutable,fixtureTimer,finishTimer,lastWindows,fixtureProfile,fixturePid,packageFiles,checkingProof=false;
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
    if(event.id===3&&typeof event.result?.result?.value==='string'){try{const value=JSON.parse(event.result.result.value);extractedExecutable=value.executable;lastWindows=value.windows;fixtureProfile=value.profile;fixturePid=value.pid;packageFiles=value.files;}catch{extractedExecutable=event.result.result.value;}}
    if(event.method==='Runtime.exceptionThrown')errors+=JSON.stringify(event.params.exceptionDetails).slice(0,1800);
    if(event.method==='Runtime.consoleAPICalled'&&event.params.type==='error'){errors+=(event.params.args??[]).map(a=>a.value??a.description??'').join(' ').slice(0,1800);socket.close();}
    if(event.method!=='Runtime.consoleAPICalled')return;
    if(shellOnly)return;
    for(const argument of event.params.args??[]){if(typeof argument.value!=='string'||!argument.value.startsWith('{'))continue;try{const result=JSON.parse(argument.value);if(interactionsOnly?result.passed!==undefined&&result.quickNativeWidth!==undefined:result.bridge===true&&'shownOnTop'in result){inspectedSmoke=result;finishTimer??=setTimeout(()=>socket.close(),20000);}}catch{}}
  });
  socket.send(JSON.stringify({id:1,method:'Runtime.enable'}));
  socket.send(JSON.stringify({id:2,method:'Runtime.runIfWaitingForDebugger'}));
  // A background/occluded native test window can suspend requestAnimationFrame.
  // Keep frames running only for this isolated smoke process, including windows
  // created later. No application code or shipping window preference is changed.
  // NSIS changes cwd during extraction. Restore the test runner's directory so
  // synthetic fixtures and reports resolve identically to package-win's smoke.
  const setupFixture=()=>{if(socket.readyState===WebSocket.OPEN)socket.send(JSON.stringify({id:3,method:'Runtime.evaluate',params:{expression:`(${inspectFixture})(${JSON.stringify(process.cwd())},${!historical})`,returnByValue:true}}));};
  fixtureTimer=setInterval(()=>{setupFixture();if(shellOnly&&fixtureProfile&&fixturePid&&extractedExecutable&&!checkingProof&&!inspectedSmoke){checkingProof=true;void readCompanionSmokeReceipt(fixtureProfile,fixturePid,extractedExecutable,launchedAt).then(result=>{inspectedSmoke=result;socket?.close();}).catch(()=>{}).finally(()=>{checkingProof=false;});}},250);setupFixture();
}catch(error){errors+=error.message;socket?.close();}
const exitCode=await exitedPromise.finally(()=>{clearTimeout(timer);clearTimeout(finishTimer);clearInterval(fixtureTimer);socket?.close();});
// The child can exit between the receipt write and the next inspector poll.
if(shellOnly&&!inspectedSmoke&&fixtureProfile&&fixturePid&&extractedExecutable){
 try{inspectedSmoke=await readCompanionSmokeReceipt(fixtureProfile,fixturePid,extractedExecutable,launchedAt);}catch{}
}
const line=output.split(/\r?\n/).find(row=>row.startsWith('{'));
const smoke=inspectedSmoke??(!shellOnly&&line?JSON.parse(line):undefined);
const failedChecks=smoke?Object.entries(smoke).filter(([key,value])=>value===false&&!['apiCalled','physicalInputTested','DPIChangesTested'].includes(key)).map(([key])=>key):['no-smoke-output'];
if(!historical&&!packageFiles?.length)failedChecks.push('missing-extracted-manifest');
if(sha256!==createHash('sha256').update(await readFile(executable)).digest('hex'))failedChecks.push('executable-changed');
const packagedStartupVerified=failedChecks.length===0&&(shellOnly?exitCode===0&&companionSmokePassed(smoke):interactionsOnly?exitCode===0&&smoke?.passed===true&&smoke?.quickNativeWidth===true&&smoke?.chatNativeWidth===true&&smoke?.rendererNodeUnavailable===true&&smoke?.frozenContextAndDedup===true&&smoke?.localGuidePersisted===true&&smoke?.appearanceSaved===true:exitCode===0&&smoke?.fullscreenChatVerified===true&&smoke?.dailyWorkspaceVerified===true&&smoke?.homeChatOnlyVerified===true&&smoke?.dropContextIpcVerified===true&&smoke?.workspaceIpcVerified===true&&smoke?.rendered===true&&smoke?.bridge===true&&smoke?.nodeAbsent===true&&smoke?.activityTimelineVerified===true&&smoke?.cursorGazeVerified===true&&smoke?.documentReaderVerified===true&&smoke?.folderDelegationVerified===true&&smoke?.humanConfirmationVerified===true);
const report={at:new Date().toISOString(),executable,extractedExecutable,sha256,packageFiles,exitCode,packagedStartupVerified,
  ...(!packagedStartupVerified?{diagnostic:errors.slice(-2000),failedChecks}:{}),
  validationScope:shellOnly?'single-executable-codex-companion-native-hook-IPC':interactionsOnly?'single-executable-extraction-and-real-Electron-contextual-IPC':'single-executable-extraction-and-real-Electron-smoke-synthetic-tasks',apiCalled:false,
  fullObjectiveVerified:false,remainingChecks:shellOnly?['physical-input-and-DPI','Codex-hook-user-trust','live-Codex-hook-events','Windows-notification-delivery']:interactionsOnly?['physical-input-and-focus','multiple-monitors-and-DPI','physical-capture-exclusions','real-model-and-voice']:smoke?Object.entries(smoke).filter(([,value])=>value===false).map(([key])=>key):['no-smoke-output'],
  ...(shellOnly&&smoke?{desktopShell:smoke}:interactionsOnly&&smoke?{interactions:smoke}:smoke?{fullscreenChatVerified:smoke.fullscreenChatVerified,dailyWorkspaceVerified:smoke.dailyWorkspaceVerified,homeChatOnlyVerified:smoke.homeChatOnlyVerified,dropContextIpcVerified:smoke.dropContextIpcVerified,workspaceIpcVerified:smoke.workspaceIpcVerified,cursorGazeVerified:smoke.cursorGazeVerified,documentReaderVerified:smoke.documentReaderVerified,folderDelegationVerified:smoke.folderDelegationVerified,humanConfirmationVerified:smoke.humanConfirmationVerified,activityTimelineVerified:smoke.activityTimelineVerified,edgeDockingVerified:smoke.edgeDockingVerified,stableStreamingVerified:smoke.stableStreamingVerified,shownOnTop:smoke.shownOnTop}:{diagnostic:errors.slice(-2000),lastWindows})};
await mkdir('docs/evidence',{recursive:true});await writeFile('docs/evidence/single-executable.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
if(!packagedStartupVerified)process.exitCode=1;

function inspectFixture(cwd, measureFiles) {
  if(typeof process==='undefined'||!process.argv.some(arg=>['--zen-smoke','--zen-interactions-smoke','--zen-shell-smoke'].includes(arg)))return null;
  const electron=process.getBuiltinModule('module').createRequire(process.execPath)('electron');
  if(!electron.BrowserWindow)return null;
  if(!electron.app.zenSmokeFrames){
    process.chdir(cwd);
    electron.app.zenSmokeFrames=true;
    electron.app.on('browser-window-created',(_,window)=>window.webContents.setBackgroundThrottling(false));
    if(measureFiles){
      const fs=process.getBuiltinModule('fs'), path=process.getBuiltinModule('path'), crypto=process.getBuiltinModule('crypto');
      const collect=(directory,prefix='')=>fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
        const name=prefix+entry.name, file=path.join(directory,entry.name);
        return entry.isDirectory()?collect(file,name+'/'):[{path:name,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}];
      });
      electron.app.zenSmokePackage=collect(path.join(process.resourcesPath,'app'));
    }
  }
  const windows=electron.BrowserWindow.getAllWindows();
  windows.forEach(window=>window.webContents.setBackgroundThrottling(false));
  return JSON.stringify({executable:process.execPath,pid:process.pid,profile:electron.app.getPath('userData'),files:electron.app.zenSmokePackage,
    windows:windows.map(window=>({visible:window.isVisible(),loading:window.webContents.isLoading(),destroyed:window.isDestroyed(),bounds:window.getBounds()}))});
}
