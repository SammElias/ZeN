import {spawn} from 'node:child_process';
import electron from 'electron';
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.OPENAI_API_KEY;
const child=spawn(electron,['.','--zen-pet-smoke',...(process.argv.includes('--keep-open')?['--keep-open']:[])],{env,windowsHide:true,stdio:'inherit'});
child.on('exit',code=>process.exit(code??1));
