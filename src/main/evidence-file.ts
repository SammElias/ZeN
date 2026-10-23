import {writeFile as write,rename,unlink} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';

/** Test artifacts only: readers may briefly hold the previous Windows file.
 * Publish a complete sibling file without rerunning the application scenario. */
export async function writeEvidence(path:string,data:string|Uint8Array){
 const temporary=path+'.'+randomUUID()+'.tmp';
 await write(temporary,data);
 try{
  for(let attempt=0;;attempt++){
   try{await rename(temporary,path);return;}
   catch(error){if(attempt>=4||!['EPERM','EACCES','EBUSY','UNKNOWN'].includes((error as NodeJS.ErrnoException).code??''))throw error;await new Promise(r=>setTimeout(r,200*(attempt+1)));}
  }
 }finally{await unlink(temporary).catch(()=>{});}
}
