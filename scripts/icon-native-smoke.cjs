const {app,nativeImage}=require('electron');
const {join,resolve}=require('node:path');
const {mkdirSync,writeFileSync}=require('node:fs');
app.setPath('userData',join(app.getPath('temp'),'zen-icon-smoke'));
app.whenReady().then(async()=>{
  const sizes=[16,20,24,32,40,48,64,128,256],checks=[];
  for(const name of ['zen','tray'])for(const size of sizes){
    const icon=nativeImage.createFromPath(resolve(`public/icons/${name}-${size}.png`));
    const bitmap=icon.toBitmap();let visible=0,transparent=0,white=0;
    for(let i=0;i<bitmap.length;i+=4){
      const alpha=bitmap[i+3];
      if(alpha===0)transparent++;
      if(alpha<128)continue;
      visible++;
      if(Math.min(bitmap[i],bitmap[i+1],bitmap[i+2])>=alpha*.88)white++;
    }
    const corners=[0,size-1,size*(size-1),size*size-1];
    const passed=!icon.isEmpty()&&icon.getSize().width===size&&icon.getSize().height===size&&
      visible>size*size*.12&&white>=visible*.95&&transparent>size*size*.25&&
      corners.every(pixel=>bitmap[pixel*4+3]===0);
    checks.push({name,size,passed});
  }
  const icoLoads=['zen','tray'].every(name=>!nativeImage.createFromPath(resolve(`public/icons/${name}.ico`)).isEmpty());
  const legacy=nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAFUlEQVQ4T2Nk+P//PwMlgImBQjDwHAAA2n4DHd9rF1gAAAAASUVORK5CYII=');
  const shellIcon=await app.getFileIcon(resolve(process.argv[2]),{size:'large'});
  const actual=shellIcon.toBitmap(),expected=nativeImage.createFromPath(resolve(`public/icons/zen-${shellIcon.getSize().width}.png`)).toBitmap();
  const pixelDifference=actual.length===expected.length?actual.reduce((sum,value,i)=>sum+Math.abs(value-expected[i]),0)/actual.length:255;
  mkdirSync('docs/evidence',{recursive:true});writeFileSync('docs/evidence/zen-shell-icon.png',shellIcon.toPNG());
  const report={at:new Date().toISOString(),legacyTrayImageEmpty:legacy.isEmpty(),icoLoads,checks,shellIconNonEmpty:!shellIcon.isEmpty(),shellIconSize:shellIcon.getSize(),shellIconMatchesZen:pixelDifference<10,pixelDifference,apiCalled:false};
  writeFileSync('docs/evidence/windows-icons.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
  app.exit(icoLoads&&report.shellIconMatchesZen&&checks.every(row=>row.passed)?0:1);
}).catch(error=>{console.error(error.message);app.exit(1);});
