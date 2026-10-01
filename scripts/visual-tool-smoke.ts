import { app } from 'electron';
import OpenAI from 'openai';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Toolkit } from '../src/tools/toolkit';
import { Artifacts } from '../src/tools/artifacts';
import { LocalLibrary } from '../src/tools/library';
import { ReadingBrowser, visualActions } from '../src/main/visual-browser';
import { SettingsSchema } from '../src/shared/contracts';
import { Spending } from '../src/storage/spending';
void app.whenReady().then(async()=>{
 const temp=await mkdtemp(join(tmpdir(),'zen-visual-tool-')),settings=SettingsSchema.parse({}),rows:Record<string,unknown>[]=[];
 const report:Record<string,unknown>={at:new Date().toISOString(),passed:false,realApi:true,realElectronBrowser:true,scope:'isolated read-only public page',userDesktopCaptured:false,clicksOrTyping:false};
 const spending=new Spending(temp,()=>settings);
 try {
  for(const action of [{type:'click',x:1,y:1,button:'left'},{type:'type',text:'secret'},{type:'keypress',keys:['CTRL','L']},{type:'scroll',x:5000,y:2,scroll_x:0,scroll_y:20}]){let blocked=false;try{visualActions([action]);}catch{blocked=true;}if(!blocked)throw Error('Unsafe action accepted');}
  const toolkit=new Toolkit({client:()=>new OpenAI({maxRetries:0,timeout:90000}),library:new LocalLibrary(()=>[]),artifacts:new Artifacts(),settings:()=>settings,spending,log:row=>rows.push(row),browser:()=>new ReadingBrowser()});
  const request='Mira visualmente en el navegador https://example.com/ y resume el texto visible de la página en español. Utiliza una captura con Computer Use, sin clicks ni escritura.';
  const result=await toolkit.cloud({kind:'browser',url:'https://example.com/',prompt:request},request,AbortSignal.timeout(90000));
  report.result=JSON.parse(result.agentContent).result;report.items=rows.filter(row=>row.type==='cloud_response').flatMap(row=>row.items as object[]);
  report.passed=/documentaci[oó]n|ejemplos/i.test(String(report.result))&&/permiso/i.test(String(report.result))&&(report.items as {type:string}[]).some(item=>item.type==='computer_call');report.spending=spending.summary();
 }catch(error){const e=error as {status?:number;code?:string;message:string};report.error=e.status?`API ${e.status} ${e.code??''}`:e.message;report.spending=spending.summary();}
 finally{await writeFile('docs/evidence/toolkit-live-browser.json',JSON.stringify(report,null,2));await rm(temp,{recursive:true,force:true});console.log(JSON.stringify(report));app.exit(report.passed?0:1);}
});
