import {app,BrowserWindow,nativeImage} from 'electron';
import {readFile,writeFile} from 'node:fs/promises';
void app.whenReady().then(async()=>{
  const source=await readFile('index.html','utf8'),policy=source.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)![1];
  const window=new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
  try{
    await window.loadURL('data:text/html,'+encodeURIComponent(`<meta http-equiv="Content-Security-Policy" content="${policy}"><body>Fixture de imagen</body>`));
    const fixture='data:image/png;base64,'+nativeImage.createFromBitmap(Buffer.alloc(64*32*4,255),{width:64,height:32}).toPNG().toString('base64');
    const report=await window.webContents.executeJavaScript(`(async()=>{const raw=atob('${fixture}'.split(',')[1]);const file=new File([Uint8Array.from(raw,c=>c.charCodeAt(0))],'captura.png',{type:'image/png'});const url=URL.createObjectURL(file);const old=new Image();old.src=url;let oldError;try{await old.decode();}catch(error){oldError=error.message;}finally{URL.revokeObjectURL(url);}const data=await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(file);});const fresh=new Image();fresh.src=data;await fresh.decode();return{blobImageBlocked:!!oldError,oldError,dataImageDecoded:fresh.width===64&&fresh.height===32};})()`);
    const result={at:new Date().toISOString(),realElectron:true,productionImagePolicy:policy.match(/img-src[^;]+/)?.[0],syntheticImage:true,...report,passed:report.blobImageBlocked&&report.dataImageDecoded};await writeFile('docs/evidence/image-decoding-policy.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
  }finally{window.destroy();app.quit();}
});
