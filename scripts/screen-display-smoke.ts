import {app,BrowserWindow,nativeImage,screen} from 'electron';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {z} from 'zod';
import {native,WindowSchema,BoundsSchema} from '../src/tools/windows/native';
import {ScreenContext} from '../src/main/screen-context';
import {CaptureExclusion} from '../src/main/capture-exclusion';
void app.whenReady().then(async()=>{
  const displays=screen.getAllDisplays(),area=displays.at(-1)!.bounds,other=displays[0].bounds;
  const options={frame:false,show:false,hasShadow:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}};
  const background=new BrowserWindow({...options,...area}),docs=new BrowserWindow({...options,...other});
  const anchor=new BrowserWindow({...options,x:area.x+100,y:area.y+10,width:440,height:200});
  const secret=new BrowserWindow({...options,x:area.x+800,y:area.y+500,width:220,height:120});
  const id=(w:BrowserWindow)=>w.getNativeWindowHandle().readBigUInt64LE().toString(),directory=join(process.cwd(),'dist/native');
  const guard=new CaptureExclusion(anchor),status:unknown[]=[];let rows:z.infer<typeof WindowSchema>[]=[];let context:ScreenContext|undefined;
  const page=(title:string,colour:string,code:string)=>'data:text/html;charset=utf-8,'+encodeURIComponent(`<title>${title}</title><body style="margin:0;background:${colour};color:white;font:56px Arial;padding:70px">${code}<p style="font-size:18px">Synthetic message: Can we discuss this opportunity?</p></body>`);
  const colours=(image:string)=>{const pixels=nativeImage.createFromDataURL(image).toBitmap();let blue=0,red=0,magenta=0,black=0;for(let i=0;i<pixels.length;i+=4){const b=pixels[i],g=pixels[i+1],r=pixels[i+2];if(b>r+60)blue++;if(r>b+60)red++;if(r>150&&b>150&&g<80)magenta++;if(r<10&&b<10&&g<10)black++;}return{blue,red,magenta,black};};
  try{
    await docs.loadURL(page('Documentación sintética','#ca2337','222222'));await background.loadURL(page('Mensaje sintético actual','#185bd1','384729'));await anchor.loadURL(page('Cápsula sintética','#dd00dd','999999'));await secret.loadURL(page('Password fixture','#ca2337','PRIVATE FIXTURE'));
    docs.setAlwaysOnTop(true);docs.showInactive();background.setAlwaysOnTop(true);background.showInactive();anchor.setAlwaysOnTop(true);anchor.showInactive();await new Promise(resolve=>setTimeout(resolve,600));
    const allowed=new Set([id(docs),id(background),id(anchor),id(secret)]);
    context=new ScreenContext({anchorId:()=>id(anchor),windows:async signal=>{rows=await native(directory,'windows',z.array(WindowSchema),id(anchor),signal);return rows.filter(row=>allowed.has(row.id));},own:row=>row.id===id(anchor),blocked:row=>row.id===id(secret),status:s=>status.push(s),capture:async(_target,signal)=>guard.during(signal,async()=>{const result=await native(directory,'capture-screen',z.object({image:z.string(),bounds:BoundsSchema,scope:z.literal('display')}),id(anchor),signal,{excludedIds:rows.filter(row=>!allowed.has(row.id)||row.id===id(secret)).map(row=>row.id)});return{...result,image:'data:image/jpeg;base64,'+nativeImage.createFromDataURL(result.image).toJPEG(85).toString('base64')};})});
    const current=await context.refresh();if(!current)throw Error('Display capture unavailable');const original=colours(current.image);if(original.blue<100000||original.magenta>100)throw Error('Visible pixels or capsule exclusion not verified');
    await mkdir('test-results',{recursive:true});await writeFile('test-results/screen-context-fixture.json',JSON.stringify(current));
    secret.setAlwaysOnTop(true);secret.showInactive();secret.moveTop();await new Promise(resolve=>setTimeout(resolve,300));
    const raw=await guard.during(new AbortController().signal,()=>native(directory,'capture-screen',z.object({image:z.string(),bounds:BoundsSchema,scope:z.literal('display')}),id(anchor),undefined,{excludedIds:rows.filter(row=>!allowed.has(row.id)).map(row=>row.id)}));const rawColours=colours(raw.image);if(rawColours.red<original.red+10000)throw Error('Sensitive fixture visibility not verified');
    const masked=await context.refresh();const maskedColours=masked?colours(masked.image):undefined;if(!masked||maskedColours!.red>original.red+200||maskedColours!.black<original.black+10000)throw Error('Sensitive fixture not masked');secret.hide();
    await background.loadURL(page('Mensaje sintético actualizado','#185bd1','739162'));await new Promise(resolve=>setTimeout(resolve,300));const updated=await context.refresh();if(!updated||updated.image===current.image||updated.sourceTitle!=='Mensaje sintético actualizado')throw Error('Updated page not captured');await writeFile('test-results/chat-image-fixture.json',JSON.stringify(updated));
    if(displays.length>1){anchor.setBounds({x:other.x+100,y:other.y+10,width:440,height:200});await new Promise(resolve=>setTimeout(resolve,300));const previous=await context.refresh();if(!previous||colours(previous.image).red<100000||previous.sourceTitle!=='Documentación sintética')throw Error('Display move not respected');await writeFile('test-results/screen-context-old-fixture.json',JSON.stringify(previous));}
    const report={at:new Date().toISOString(),passed:true,windowsReal:true,ownedFixturesOnly:true,actualScreenPixels:true,printWindowFallback:false,displays:displays.length,movedDisplayVerified:displays.length>1,capsuleExcluded:true,sensitiveVisibleRegionMasked:true,changedPageCaptured:true,scope:current.scope,initialColours:original,status,productionImagesPersisted:false};await writeFile('docs/evidence/screen-display-windows.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
  }catch(error){await writeFile('docs/evidence/screen-display-attempt.json',JSON.stringify({at:new Date().toISOString(),passed:false,error:(error as Error).message,ownedFixturesOnly:true},null,2));console.error('Display fixture failed:',(error as Error).message);process.exitCode=1;}
  finally{context?.cancel();secret.destroy();anchor.destroy();background.destroy();docs.destroy();app.quit();}
});
