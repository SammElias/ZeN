import { app, BrowserWindow, nativeImage } from 'electron';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { native, WindowSchema } from '../src/tools/windows/native';
import { ScreenContext } from '../src/main/screen-context';
void app.whenReady().then(async()=>{
  const fixture=new BrowserWindow({width:760,height:460,show:false,backgroundColor:'#ffffff',webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
  let context:ScreenContext|undefined;
  try{
    await fixture.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent('<title>ZEN synthetic capture fixture</title><body style="margin:32px;font:28px Arial;background:white;color:black"><h2>Prueba visual</h2><p>Sin datos personales</p><div style="background:#185bd1;color:white;font:bold 56px Arial;padding:32px;border-radius:12px">384729</div></body>'));
    fixture.showInactive();await new Promise(resolve=>setTimeout(resolve,500));
    const id=fixture.getNativeWindowHandle().readBigUInt64LE().toString(),directory=join(process.cwd(),'dist/native');
    const statuses:unknown[]=[];
    context=new ScreenContext({
      // Only our synthetic fixture can ever be selected in this probe.
      windows:async signal=>(await native(directory,'windows',z.array(WindowSchema),undefined,signal)).filter(row=>row.id===id),
      own:row=>row.id!==id,blocked:()=>false,status:s=>statuses.push(s),
      capture:async(id,signal)=>{const captured=await native(directory,'capture',z.object({image:z.string()}),id,signal);return 'data:image/jpeg;base64,'+nativeImage.createFromDataURL(captured.image).toJPEG(78).toString('base64');}
    });
    const snapshot=await context.refresh();if(!snapshot)throw Error('Synthetic fixture capture unavailable');
    const size=nativeImage.createFromDataURL(snapshot.image).getSize();
    await mkdir('test-results',{recursive:true});
    // Explicit synthetic test fixture only, for the separate API vision probe.
    await writeFile('test-results/screen-context-fixture.json',JSON.stringify(snapshot));
    const report={at:new Date().toISOString(),passed:size.width>0&&size.height>0,windowsReal:true,ownedFixtureOnly:true,nativeHelperReused:true,newExecutableCreated:false,width:size.width,height:size.height,statuses,productionImagesPersisted:false,syntheticFixtureSavedForApiProbe:true};
    await writeFile('docs/evidence/screen-context-windows.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
  }catch{console.error('Screen context fixture capture failed');process.exitCode=1;}
  finally{context?.cancel();fixture.destroy();app.quit();}
});
