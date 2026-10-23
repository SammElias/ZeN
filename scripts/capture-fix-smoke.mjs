import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
const env={...process.env};delete env.OPENAI_API_KEY;delete env.ELECTRON_RUN_AS_NODE;
const child=spawn(resolve('node_modules/electron/dist/electron.exe'),['.','--zen-shell-smoke','--capture-fixture'],{env,windowsHide:true,stdio:'inherit'});
const timer=setTimeout(()=>child.kill(),120000);
process.exitCode=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',code=>{clearTimeout(timer);resolve(code??1);});});
