import {spawn} from 'node:child_process';
for (const [project,out] of [['Zen.Windows','native'],['Zen.CodexHook','hook']]) {
 const child=spawn('dotnet',['publish',`native/${project}/${project}.csproj`,'--configuration','Release','--output',`dist/${out}`,'--nologo','--self-contained','false'],{stdio:'inherit',windowsHide:true});
 const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',resolve);});
 if(code!==0){process.exitCode=code??1;break;}
}