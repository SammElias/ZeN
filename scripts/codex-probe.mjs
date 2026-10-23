import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
const env={...process.env};for(const k of Object.keys(env))if(/API_KEY|ACCESS_TOKEN|AUTH_TOKEN|CODEX_API|OPENAI_BASE_URL/.test(k))delete env[k];
const child=spawn(process.argv[2]||'codex.exe',['app-server','--stdio'],{windowsHide:true,env,stdio:['pipe','pipe','pipe']});
const pending=new Map();let id=0;const rpc=(method,params)=>new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});child.stdin.write(JSON.stringify({id,method,params})+'\n');});
createInterface({input:child.stdout}).on('line',line=>{try{const m=JSON.parse(line);const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result);}}catch{}});
child.stderr.resume();const timer=setTimeout(()=>{child.kill();process.exitCode=1;},20000);
try{const init=await rpc('initialize',{clientInfo:{name:'zen_local',title:'ZEN',version:'0.1.0'},capabilities:{experimentalApi:false}});child.stdin.write(JSON.stringify({method:'initialized',params:{}})+'\n');const {account}=await rpc('account/read',{refreshToken:false});console.log(JSON.stringify({server:init.userAgent,accountType:account?.type??null,plan:account?.planType??null}));}finally{clearTimeout(timer);child.stdin.end();child.kill();}
