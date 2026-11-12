import {spawn} from 'node:child_process';
import helpers from '../config/native-helpers.json' with { type: 'json' };

for (const {project, output} of Object.values(helpers)) {
 const child=spawn('dotnet',[
  'publish',`native/${project}/${project}.csproj`,'--configuration','Release','--output',`dist/${output}`,
  '--nologo','--self-contained','false','-p:DebugType=None','-p:DebugSymbols=false',
 ],{stdio:'inherit',windowsHide:true});
 const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',resolve);});
 if(code!==0){process.exitCode=code??1;break;}
}
