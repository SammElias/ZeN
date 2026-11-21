import {spawn} from 'node:child_process';

export function copyVaultText(helper:string,text:string):Promise<void> {
 return new Promise((resolve,reject)=>{
  const child=spawn(helper,[],{windowsHide:true,stdio:['pipe','pipe','ignore']});
  const fail=()=>{clearTimeout(timer);reject(Error('No se pudo copiar de forma privada. Inténtalo de nuevo.'));};
  const timer=setTimeout(()=>{child.kill();fail();},5000);
  child.once('error',fail);child.stdin.on('error',fail);
  child.stdout.once('data',bytes=>{
   clearTimeout(timer);
   if(!bytes.toString().includes('"ok":true')){fail();return;}
   // The helper retains its own expiry timer if ZEN quits in the meantime.
   child.stdout.destroy();child.unref();resolve();
  });
  child.once('exit',code=>{if(code!==0)fail();});
  child.stdin.end(JSON.stringify({text})+'\n');
 });
}
