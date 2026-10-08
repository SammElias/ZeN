import {spawn} from 'node:child_process';
import electron from 'electron';
import {readFile,writeFile} from 'node:fs/promises';
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.OPENAI_API_KEY;
const child=spawn(electron,['.','--zen-interactions-smoke'],{env,windowsHide:true,stdio:'inherit'});
let timedOut=false;
const timer=setTimeout(()=>{timedOut=true;child.kill();console.error('Native interaction check timed out');},45000);
child.on('exit',async code=>{clearTimeout(timer);for(const path of ['docs/evidence/compact-native.json','docs/evidence/interactions-native.json','docs/evidence/head-capsule-native.json']){try{const report=JSON.parse(await readFile(path,'utf8'));report.nativeProcessExited=!timedOut&&code===0;report.passed=report.passed&&report.nativeProcessExited;await writeFile(path,JSON.stringify(report,null,2));}catch{}}process.exit(timedOut?1:code??1);});
