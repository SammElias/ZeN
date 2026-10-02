import {open,realpath,lstat} from 'node:fs/promises';
import {dirname,basename,join,extname} from 'node:path';
import {ZenError} from '../shared/errors';
/** Native save dialog grants one new file, never overwrite or execute a result. */
export async function exportResult(destination:string,bytes:Buffer,extension:string){
  if(bytes.length>10000000)throw new ZenError('El resultado supera 10 MB.');
  if(extname(destination).toLowerCase()!==extension.toLowerCase())throw new ZenError(`Conserva la extensión ${extension} del resultado.`);
  const parent=await realpath(dirname(destination));if(!(await lstat(parent)).isDirectory())throw new ZenError('Destino inválido.');
  const path=join(parent,basename(destination));let file;
  try{file=await open(path,'wx',0o600);await file.writeFile(bytes);await file.sync();}catch(error){if((error as NodeJS.ErrnoException).code==='EEXIST')throw new ZenError('Ya existe ese archivo. Elige otro nombre para conservar ambos.');throw error;}finally{await file?.close();}
  return path;
}
