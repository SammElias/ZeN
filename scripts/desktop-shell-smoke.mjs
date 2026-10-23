import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
const executable=process.argv[2]?resolve(process.argv[2]):resolve('node_modules/electron/dist/electron.exe');
const args=process.argv[2]?['--zen-shell-smoke']:['.','--zen-shell-smoke'];
const env={...process.env};delete env.OPENAI_API_KEY;delete env.ELECTRON_RUN_AS_NODE;
const child=spawn(executable,args,{env,windowsHide:true,stdio:'inherit'});
const timer=setTimeout(()=>child.kill(),65000);
process.exitCode=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',code=>{clearTimeout(timer);resolve(code??1);});});
