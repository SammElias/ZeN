import {clipboard,dialog,globalShortcut,shell,type BrowserWindow} from 'electron';
import {randomUUID} from 'node:crypto';
import {basename,extname} from 'node:path';
import {z} from 'zod';
import {FavoriteSchema,type SelectionContext} from '../shared/workspace';
import {native} from '../tools/windows/native';
import {ZenError} from '../shared/errors';
import type {PersonalStore} from '../storage/personal';
import type {Artifacts} from '../tools/artifacts';
import {exportResult} from './result-export';
type Deps={window:BrowserWindow;handle:(name:string,schema:z.ZodType,action:(value:any)=>unknown)=>void;personal:PersonalStore;artifacts:Artifacts;nativeDirectory:string;signal:()=>AbortSignal;observations:Map<string,{text?:string;image?:string;at:number}>;blocked:(title:string)=>boolean;invoke:()=>Promise<void>;taskControl:(action:'pause'|'resume')=>void;smoke:boolean};
export function installWorkspace(d:Deps){
  let selected:SelectionContext|undefined;const saved=new Map<string,string>();
  const offer=(text:string,source:string)=>{if(!text.trim())throw new ZenError('No hay texto seleccionado. Copia el texto y usa «Texto copiado».');const observationId=randomUUID();d.observations.set(observationId,{text:text.slice(0,4000),at:Date.now()});while(d.observations.size>5)d.observations.delete(d.observations.keys().next().value!);selected={observationId,text:text.slice(0,4000),source:source.slice(0,160)};return selected;};
  const captureSelection=async()=>{
    if(d.smoke)return null;
    const result=await native(d.nativeDirectory,'selection',z.object({text:z.string().max(4000),source:z.string(),pid:z.number(),id:z.string()}),undefined,d.signal());
    if(result.pid===process.pid||!result.text||d.blocked(result.source))return null;
    return offer(result.text,result.source);
  };
  d.handle('selection',z.undefined(),()=>selected&&d.observations.has(selected.observationId)&&Date.now()-d.observations.get(selected.observationId)!.at<120000?selected:null);
  d.handle('clipboard-context',z.undefined(),async()=>offer(await clipboard.readText(),'Texto copiado'));
  d.handle('favorites',z.undefined(),()=>d.personal.favorites());
  d.handle('save-favorites',z.array(FavoriteSchema).max(20),rows=>d.personal.saveFavorites(rows));
  d.handle('task-control',z.enum(['pause','resume']),action=>{d.taskControl(action);return true;});
  d.handle('save-result',z.union([z.object({taskId:z.string().min(1).max(100)}).strict(),z.object({artifactId:z.string().uuid()}).strict()]),async value=>{
    const signal=d.signal();let data:Buffer,title:string,extension:string,id:string;
    if('artifactId'in value){id=value.artifactId;const item=d.artifacts.get(id);data=item.data;title=item.meta.title;extension=extname(title)||({ 'image/png':'.png','image/jpeg':'.jpg','image/webp':'.webp','text/plain':'.txt'}[item.mime]??'.txt');}
    else{id=value.taskId;const task=d.personal.tasks().find(row=>row.id===id);if(!task?.message)throw new ZenError('No hay un resultado para guardar.');data=Buffer.from(task.message);title='Resultado ZEN.md';extension='.md';}
    title=basename(title).replace(/[<>:"/\\|?*\x00-\x1f]/g,'_');if(!title.toLowerCase().endsWith(extension))title+=extension;
    if(!/\.(?:png|jpe?g|webp|pdf|csv|txt|md|json|xlsx|docx)$/i.test(extension))throw new ZenError('Formato de resultado no permitido.');
    const destination=await dialog.showSaveDialog(d.window,{title:'Guardar resultado de ZEN',defaultPath:title,filters:[{name:'Resultado',extensions:[extension.slice(1)]}]});signal.throwIfAborted();
    if(destination.canceled||!destination.filePath)return{saved:false};const path=await exportResult(destination.filePath,data,extension);saved.set(id,path);return{saved:true,name:basename(path)};
  });
  d.handle('reveal-result',z.string().min(1).max(100),id=>{const path=saved.get(id);if(!path)throw new ZenError('Guarda primero el resultado.');shell.showItemInFolder(path);return true;});
  const shortcutRegistered=globalShortcut.register('Control+Alt+S',()=>{void captureSelection().then(async value=>{await d.invoke();if(value)d.window.webContents.send('zen:selection',value);else d.window.webContents.send('zen:workspace');}).catch(()=>{void d.invoke();d.window.webContents.send('zen:workspace');});});
  return{captureSelection,shortcutRegistered};
}
