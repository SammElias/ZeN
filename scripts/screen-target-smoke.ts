import {app,BrowserWindow,nativeImage,screen} from 'electron';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {z} from 'zod';
import {native,WindowSchema} from '../src/tools/windows/native';
import {ScreenContext} from '../src/main/screen-context';
void app.whenReady().then(async()=>{
  const displays=screen.getAllDisplays(),first=displays[0].workArea,last=displays.at(-1)!.workArea;
  const multi=displays.length>1,half=Math.floor(first.width/2);
  const docs=new BrowserWindow({x:first.x+20,y:first.y+20,width:multi?720:half-30,height:460,show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
  const chart=new BrowserWindow({x:multi?last.x+20:first.x+half,y:last.y+20,width:multi?760:half-30,height:460,show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
  const box=chart.getBounds();const anchor=new BrowserWindow({x:box.x+50,y:box.y,width:300,height:48,frame:false,show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
  const id=(w:BrowserWindow)=>w.getNativeWindowHandle().readBigUInt64LE().toString();
  const directory=join(process.cwd(),'dist/native'),statuses:unknown[]=[],captureIds:string[]=[];
  let context:ScreenContext|undefined;
  const html=(title:string,color:string,code:string)=>'data:text/html;charset=utf-8,'+encodeURIComponent(`<title>${title}</title><body style="margin:0;background:${color};color:white;font:bold 54px Arial;padding:70px">${code}</body>`);
  const colours=(data:string)=>{const pixels=nativeImage.createFromDataURL(data).toBitmap();let blue=0,red=0;for(let i=0;i<pixels.length;i+=4){if(pixels[i]>pixels[i+2]+60)blue++;if(pixels[i+2]>pixels[i]+60)red++;}return{blue,red};};
  try{
    await docs.loadURL(html('Documentación de prueba','#ca2337','222222'));await chart.loadURL(html('Gráfico de prueba','#185bd1','384729'));await anchor.loadURL(html('Cápsula de prueba','#181818',''));
    docs.show();chart.showInactive();anchor.setAlwaysOnTop(true);anchor.showInactive();docs.focus();await new Promise(resolve=>setTimeout(resolve,500));
    const allowed=new Set([id(docs),id(chart),id(anchor)]);
    const firstRows=await native(directory,'windows',z.array(WindowSchema));
    context=new ScreenContext({anchorId:()=>id(anchor),windows:async signal=>(await native(directory,'windows',z.array(WindowSchema),id(anchor),signal)).filter(row=>allowed.has(row.id)),own:row=>row.id===id(anchor),blocked:()=>false,status:s=>statuses.push(s),capture:async(target,signal)=>{captureIds.push(target);return 'data:image/jpeg;base64,'+nativeImage.createFromDataURL((await native(directory,'capture',z.object({image:z.string()}),target,signal)).image).toJPEG(78).toString('base64');}});
    const current=await context.refresh();if(!current||captureIds.at(-1)!==id(chart)||colours(current.image).blue<10000)throw Error('Wrong target');
    anchor.hide();const hidden=await context.refresh();if(!hidden||captureIds.at(-1)!==id(chart))throw Error('Hidden capsule context unavailable');anchor.showInactive();
    await mkdir('test-results',{recursive:true});await writeFile('test-results/screen-context-fixture.json',JSON.stringify(current));
    docs.restore();docs.showInactive();anchor.setBounds({x:docs.getBounds().x+50,y:docs.getBounds().y,width:300,height:48});await new Promise(resolve=>setTimeout(resolve,400));
    const old=await context.refresh();if(!old||captureIds.at(-1)!==id(docs)||colours(old.image).red<10000){console.error(JSON.stringify({phase:'moved',available:!!old,source:old?.sourceTitle,target:captureIds.at(-1),expected:id(docs),visible:docs.isVisible(),minimized:docs.isMinimized(),colour:old?colours(old.image):undefined,rows:(await native(directory,'windows',z.array(WindowSchema))).filter(row=>allowed.has(row.id))}));throw Error('Moved target not refreshed');}
    await writeFile('test-results/screen-context-old-fixture.json',JSON.stringify(old));
    await chart.loadURL(html('Gráfico actualizado','#185bd1','739162'));anchor.setBounds({x:box.x+50,y:box.y,width:300,height:48});await new Promise(resolve=>setTimeout(resolve,300));
    const updated=await context.refresh();if(!updated||updated.sourceTitle!=='Gráfico actualizado'||updated.image===current.image)throw Error('Stale content');
    const report={at:new Date().toISOString(),passed:true,ownedFixtureOnly:true,windowsReal:true,displays:displays.length,foregroundOnDocsConfirmed:firstRows.some(row=>row.id===id(docs)&&row.foreground),targetChosenByCapsule:true,hiddenCapsuleCaptured:true,movedCapsuleRetargeted:true,changedPageCaptured:true,sourceTitles:[current.sourceTitle,old.sourceTitle,updated.sourceTitle],productionImagesPersisted:false,statuses};
    await writeFile('docs/evidence/screen-target-windows.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
  }catch(error){await writeFile('docs/evidence/screen-target-attempt.json',JSON.stringify({at:new Date().toISOString(),passed:false,ownedFixtureOnly:true,error:(error as Error).message},null,2));console.error('Synthetic target capture failed:',(error as Error).message);process.exitCode=1;}
  finally{context?.cancel();anchor.destroy();chart.destroy();docs.destroy();app.quit();}
});
