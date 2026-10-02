import OpenAI from 'openai';
import {Spending} from '../src/storage/spending';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {app,nativeImage,screen} from 'electron';
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {z} from 'zod';
import assert from 'node:assert/strict';
import {native,WindowSchema,BoundsSchema} from '../src/tools/windows/native';
import {ComputerAgent} from '../src/agent/computer';
import {WindowsComputerSurface} from '../src/main/computer-surface';
import {SettingsSchema} from '../src/shared/contracts';
import {HumanConfirmations} from '../src/policy/human-confirmations';
import {DesktopQueue} from '../src/agent/tasks';
async function main(){
await app.whenReady();if(process.env.ZEN_LIVE_API!=='1'||!process.env.OPENAI_API_KEY)throw new Error('Explicit live test and existing key required');
const spend=new Spending(await mkdtemp(join(tmpdir(),'zen-live-computer-')),()=>SettingsSchema.parse({monthlyBudgetEur:1,taskBudgetEur:.15}));
let rounds=0;const real=new OpenAI({maxRetries:0,timeout:45000});const client={responses:{create:async(...args:Parameters<typeof real.responses.create>)=>{rounds++;return real.responses.create(...args);}}};
const server=createServer((_req,res)=>{res.end('<html><head><title>ZEN Computer Fixture</title></head><body style="margin:0;background:#222;color:white"><button id="start" style="position:absolute;left:30px;top:40px;width:120px;height:50px;background:rgb(0,255,0);border:0" onclick="document.querySelector(\'#text\').focus()">Inicio</button><input id="text" style="position:absolute;left:30px;top:120px;width:300px"/><button id="save" style="position:absolute;left:30px;top:180px" onclick="document.querySelector(\'#result\').textContent=document.querySelector(\'#text\').value">Guardar</button><p id="result" style="position:absolute;left:30px;top:230px"></p></body></html>');});
await new Promise<void>(done=>server.listen(0,'127.0.0.1',done));
const taskDisplay=screen.getAllDisplays().find(display=>display.id!==screen.getPrimaryDisplay().id)??screen.getPrimaryDisplay();
const browser=await chromium.launch({channel:'msedge',headless:false,args:[`--window-position=${taskDisplay.workArea.x+60},${taskDisplay.workArea.y+60}`,'--window-size=1000,700','--force-renderer-accessibility']});
try{
 const page=await browser.newPage({viewport:null});await page.goto(`http://127.0.0.1:${(server.address() as any).port}`);await page.bringToFront();await page.waitForTimeout(250);
 const signal=new AbortController().signal, directory=resolve('dist/native');const rows=await native(directory,'windows',z.array(WindowSchema),undefined,signal);const target=rows.find(row=>row.title.includes('ZEN Computer Fixture'));assert(target);
 const ownerPid=process.pid;
 const options={pid:target.pid,ownerPid};const captureSchema=z.object({image:z.string(),width:z.number().int(),height:z.number().int(),bounds:BoundsSchema});
 const image=await native(directory,'computer-frame',captureSchema,target.id,signal,{...options,initial:true});const bitmap=nativeImage.createFromDataURL(image.image).toBitmap();let minX=image.width,minY=image.height,maxX=0,maxY=0;
 for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++){const offset=(y*image.width+x)*4;if(bitmap[offset]<5&&bitmap[offset+1]>250&&bitmap[offset+2]<5){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}}
 assert(maxX>minX&&maxY>minY);const click={type:'click' as const,button:'left' as const,x:Math.floor((minX+maxX)/2),y:Math.floor((minY+maxY)/2)};
 const frames:number[]=[];let effects=0;const queue=new DesktopQueue();
 const surface=()=>new WindowsComputerSurface({windows:async()=>(await native(directory,'windows',z.array(WindowSchema),undefined,signal)).filter(row=>row.id===target.id),anchor:()=>'',ownerPid,blocked:()=>false,serial:(signal,run)=>queue.run(signal,run),capture:async(row,signal,initial)=>{const value=await native(directory,'computer-frame',captureSchema,row.id,signal,{...options,initial});frames.push(Date.now());return value;},action:async(row,action,bounds,signal)=>{await native(directory,'computer-action',z.object({verified:z.literal(true)}),row.id,signal,{...options,bounds,action});effects++;}});
 let approvals=0;

 const confirmations=new HumanConfirmations(()=>{});const agent=new ComputerAgent({client:()=>client as any,surface,spending:spend,settings:()=>SettingsSchema.parse({computerMaxRounds:6,computerMaxActions:12}),log:()=>{},review:async(id,label,signature,_signal,preview)=>{const proposed=JSON.parse(signature);assert.equal(proposed.target.id,target.id);for(const action of proposed.actions){assert(['click','type','keypress'].includes(action.type));if(action.type==='type')assert.equal(action.text,'Prueba ñ de ZEN');if(action.type==='keypress')assert(action.keys.every((key:string)=>['TAB','ENTER','CTRL','A'].includes(key)));if(action.type==='click')assert(action.x<500&&action.y>100&&action.y<500);}approvals++;const key=`computer:${id}`;confirmations.offer(key,label,signature,async()=>true,preview);const code=confirmations.list()[0].code;await confirmations.confirm(`confirmo ${code}`);assert.equal(confirmations.list().length,0);}});
 // Real SOL and native input. Only fixture-scoped approval input is scripted;
 // no private application, credentials or production record is sent or changed.
 const result=await spend.scope('native',.15,()=>agent.run('Controla este formulario de prueba local. Haz clic en Inicio, escribe exactamente Prueba ñ de ZEN, pulsa Guardar y verifica que el resultado aparece debajo. No navegues fuera de esta página.','native',signal,()=>{}));console.log(JSON.stringify({result,rounds,approvals,effects,usage:spend.task('native')}));assert.equal(result.needsInput,false);assert.equal(await page.locator('#result').textContent(),'Prueba ñ de ZEN');assert(effects>0);assert(approvals>0);
 await page.locator('#text').focus();await page.locator('#text').selectText();
 const selection=await native(directory,'selection',z.object({text:z.string(),source:z.string(),pid:z.number(),id:z.string()}),undefined,signal);assert.equal(selection.text,'Prueba ñ de ZEN');assert.equal(selection.pid,target.pid);
 const stale=await native(directory,'computer-frame',captureSchema,target.id,signal,{...options,initial:false});let staleBlocked=false;try{await native(directory,'computer-action',z.object({verified:z.literal(true)}),target.id,signal,{...options,pid:target.pid+1,bounds:stale.bounds,action:click});}catch{staleBlocked=true;}assert(staleBlocked);
 const report={at:new Date().toISOString(),passed:true,scope:'real-windows-synthetic-page',model:'gpt-6.1-sol',apiCalled:true,usage:spend.task('native'),voiceInput:'synthetic chat code; physical voice pending',rounds,approvals,effects,captures:frames.length,unicodeVerified:true,selectionVerified:true,staleHandleBlocked:staleBlocked,result};await writeFile('docs/evidence/computer-live.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();server.close();}
}
void main().then(()=>app.quit()).catch(async error=>{await writeFile('docs/evidence/computer-live.json',JSON.stringify({at:new Date().toISOString(),passed:false,scope:'real-windows-synthetic-page',apiCalled:true,model:'gpt-6.1-sol',reason:error.message,physicalWindowsPending:true},null,2));console.error(error.message);app.exit(1);});
