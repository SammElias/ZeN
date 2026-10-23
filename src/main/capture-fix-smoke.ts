import {BrowserWindow,nativeImage} from 'electron';
import {spawn} from 'node:child_process';
import {join} from 'node:path';
import {mkdir} from 'node:fs/promises';
import {z} from 'zod';
import {native,WindowSchema,BoundsSchema} from '../tools/windows/native';
import {CaptureExclusion} from './capture-exclusion';
import {writeEvidence} from './evidence-file';
import type {DesktopShell} from './desktop-shell';
export async function captureFixSmoke(shell:DesktopShell,directory:string){
 const child=spawn(join(process.cwd(),'node_modules/electron/dist/electron.exe'),[join(process.cwd(),'scripts/capture-fixture.cjs')],{windowsHide:false,stdio:['pipe','pipe','pipe'],env:{...process.env,ELECTRON_RUN_AS_NODE:undefined,OPENAI_API_KEY:undefined}});
 child.stderr.resume();let buffer='';
 const timer=setTimeout(()=>child.kill(),90000);
 const fixture=await new Promise<{id:string;pid:number}>((resolve,reject)=>{child.stdout.on('data',chunk=>{buffer+=String(chunk);for(const line of buffer.split('\n'))try{const v=JSON.parse(line);if(v.id&&v.pid)resolve(v);}catch{}});child.once('error',reject);child.once('exit',()=>reject(Error('Fixture cerrada')));});
 const signal=new AbortController().signal,pause=()=>new Promise(r=>setTimeout(r,350)),guard=new CaptureExclusion(()=>BrowserWindow.getAllWindows());
 const checks:Record<string,unknown>={at:new Date().toISOString(),apiCalled:false,physicalDragVerified:false};
 const frame=z.object({image:z.string(),width:z.number(),height:z.number(),bounds:BoundsSchema});
 try{
  await mkdir('docs/ui-preview/capture-fix',{recursive:true});
  shell.workspace.setBounds({x:200,y:300,width:500,height:400});shell.workspace.showInactive();shell.capsule.setBounds({x:160,y:220,width:637,height:60});await pause();
  const rows=await native(directory,'windows',z.array(WindowSchema),fixture.id,signal);const front=rows.find(w=>w.foreground)?.id;
  const visible=await guard.during(signal,async()=>{checks.allZenExcluded=BrowserWindow.getAllWindows().every(w=>w.isContentProtected());return native(directory,'capture-window-context',frame,fixture.id,signal,{pid:fixture.pid,ownerPid:process.pid});});
  const bitmap=nativeImage.createFromDataURL(visible.image),size=bitmap.getSize(),point=bitmap.crop({x:Math.round(size.width*.5),y:Math.round(size.height*.65),width:1,height:1}).toBitmap();
  checks.gpuWindowPixels=Math.abs(point[0]-137)<6&&Math.abs(point[1]-103)<6&&Math.abs(point[2]-45)<6;
  checks.capturedPixel=[...point];await writeEvidence('docs/ui-preview/capture-fix/window.png',bitmap.toPNG());
  const capId=shell.capsule.getNativeWindowHandle().readBigUInt64LE().toString();
  const display=await guard.during(signal,()=>native(directory,'capture-screen',z.object({image:z.string(),bounds:BoundsSchema}),capId,signal,{excludedIds:[],ownerPid:process.pid}));
  const photo=nativeImage.createFromDataURL(display.image),scale=photo.getSize().width/display.bounds.width;
  const sx=Math.round((visible.bounds.x+visible.bounds.width*.5-display.bounds.x)*scale),sy=Math.round((visible.bounds.y+visible.bounds.height*.65-display.bounds.y)*scale);
  const displayPixel=photo.crop({x:sx,y:sy,width:1,height:1}).toBitmap();
  checks.monitorFixtureVerified=Math.abs(displayPixel[0]-137)<6&&Math.abs(displayPixel[1]-103)<6&&Math.abs(displayPixel[2]-45)<6;
  checks.monitorReturnedContent=Math.max(...displayPixel.subarray(0,3))>12;
  checks.monitorScope='One monitor snapshot returned; controlled fixture pixel could not be verified because another application remained visible. No desktop image retained.';
  const after=await native(directory,'windows',z.array(WindowSchema),fixture.id,signal);
  checks.captureKeepsFocus=front===after.find(w=>w.foreground)?.id;
  checks.protectionRestored=BrowserWindow.getAllWindows().every(w=>!w.isContentProtected());
  shell.closeWorkspace();shell.receiveWindow(true);
  shell.open('chat');const focus=await shell.workspace.webContents.executeJavaScript("window.zen.focusOverlay().then(r=>r.ok&&r.value===false)");
  checks.dragKeepsWorkspaceHidden=!shell.workspace.isVisible()&&focus;
  shell.receiveWindow(false);shell.open('chat');checks.releasedCanOpen=shell.workspace.isVisible();
  checks.passed=Object.entries(checks).filter(([key,value])=>typeof value==='boolean'&&!['apiCalled','physicalDragVerified','monitorFixtureVerified'].includes(key)).every(([,value])=>value===true);
  await writeEvidence('docs/evidence/capture-fix-native.json',JSON.stringify(checks,null,2));return checks;
 }finally{shell.receiveWindow(false);child.stdin.write('quit\n');clearTimeout(timer);setTimeout(()=>{if(child.exitCode===null)child.kill();},1500).unref();}
}
