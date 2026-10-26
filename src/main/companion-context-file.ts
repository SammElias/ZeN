import {createHash} from 'node:crypto';
import {open,lstat,realpath} from 'node:fs/promises';
import {basename,resolve} from 'node:path';
/** Bounded read of exactly one user-picked regular file, with identity/version checks. */
export async function contextFile(path:string){
 try{
  const selected=resolve(path),resolved=await realpath(selected),stat=await lstat(selected);
  if(stat.isSymbolicLink()||resolved.toLowerCase()!==selected.toLowerCase()||!stat.isFile()||stat.size>32*1024*1024)throw Error();
  const file=await open(resolved,'r');
  try{const before=await file.stat();if(!before.isFile()||before.size!==stat.size||before.dev!==stat.dev||before.ino!==stat.ino)throw Error();
   const hash=createHash('sha256'),buffer=Buffer.alloc(65536);let total=0;
   for(;;){const {bytesRead}=await file.read(buffer,0,buffer.length,null);if(!bytesRead)break;total+=bytesRead;if(total>32*1024*1024)throw Error();hash.update(buffer.subarray(0,bytesRead));}
   const after=await file.stat(),current=await lstat(selected);
   if(total!==before.size||after.size!==before.size||after.mtimeMs!==before.mtimeMs||after.ctimeMs!==before.ctimeMs||current.isSymbolicLink()||current.ino!==before.ino||current.dev!==before.dev||current.mtimeMs!==before.mtimeMs)throw Error();
   return{path:resolved,name:basename(resolved),signature:hash.digest('hex')};
  }finally{await file.close();}
 }catch{throw Error('No se puede verificar el archivo. Elige un archivo local de hasta 32 MB que no esté cambiando.');}
}
