import { Worker } from 'node:worker_threads';
import { resolve, join, basename } from 'node:path';
import { ZenError } from '../shared/errors';

export const documentTypes = new Set(['.pdf', '.docx', '.xlsx']);
export type ExtractedDocument = { text:string; partial:boolean };
let activeReaders=0;
// Only validated bytes enter a fixed parser. No paths, network, macros or generated code.
export async function extractDocument(bytes:Uint8Array, extension:string, signal:AbortSignal):Promise<ExtractedDocument> {
  signal.throwIfAborted();
  if(!documentTypes.has(extension)||bytes.length>10_000_000)throw new ZenError('Documento no compatible o superior a 10 MB.');
  if(activeReaders>=3)throw new ZenError('Ya hay tres documentos en lectura local. Espera a que terminen.');
  const directory=typeof __dirname!=='undefined'&&basename(__dirname)==='dist'?__dirname:resolve('dist');
  return new Promise((accept,reject)=>{
    const worker=new Worker(join(directory,'documents/worker.mjs'),{workerData:{bytes,extension},execArgv:[],resourceLimits:{maxOldGenerationSizeMb:128,maxYoungGenerationSizeMb:16,stackSizeMb:4},stdout:true,stderr:true});
    activeReaders++;
    // Diagnostics from documents never reach logs or renderer.
    worker.stdout.resume();worker.stderr.resume();
    let finished=false;
    const finish=(error?:Error,result?:ExtractedDocument)=>{if(finished)return;finished=true;clearTimeout(timer);signal.removeEventListener('abort',cancel);void worker.terminate().finally(()=>{activeReaders--;if(error)reject(error);else accept(result!);});};
    const cancel=()=>finish(new DOMException('Lectura detenida','AbortError'));
    const timer=setTimeout(()=>finish(new ZenError('El lector local agotó su tiempo. El documento no se ha enviado.')),8000);
    signal.addEventListener('abort',cancel,{once:true});if(signal.aborted)cancel();
    worker.once('error',()=>finish(new ZenError('No se pudo leer el documento localmente.')));
    worker.once('exit',()=>finish(new ZenError('El lector local terminó sin un resultado verificable.')));
    worker.once('message',value=>{
      if(value?.error)return finish(new ZenError(value.error==='empty'?'El documento no contiene texto extraíble. Los PDF escaneados necesitan OCR.':'Documento dañado, cifrado o fuera de los límites del lector local.'));
      if(typeof value?.text!=='string'||value.text.length>64000||typeof value.partial!=='boolean')return finish(new ZenError('Resultado del lector no verificable.'));
      finish(undefined,value);
    });
  });
}
