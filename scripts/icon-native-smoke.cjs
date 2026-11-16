const {app,nativeImage}=require('electron');
const {join,resolve}=require('node:path');
const {existsSync,mkdirSync,readFileSync,writeFileSync}=require('node:fs');
app.setPath('userData',join(app.getPath('temp'),'zen-icon-smoke'));
app.whenReady().then(async()=>{
  const sizes=[16,20,24,32,40,48,64,128,256],checks=[];
  const icoPath=resolve('public/icons/zen.ico');
  const ico=readFileSync(icoPath);
  for(let index=0;index<ico.readUInt16LE(4);index++){
    const entry=6+16*index,size=ico[entry]||256;
    const offset=ico.readUInt32LE(entry+12),length=ico.readUInt32LE(entry+8);
    const frame=ico.subarray(offset,offset+length);
    const bitmap=frame[0]===0x89?nativeImage.createFromBuffer(frame).toBitmap():frame.subarray(40,40+size*size*4);
    let visible=0,transparent=0,white=0,partial=0,innerGaps=0;
    for(let i=0;i<bitmap.length;i+=4){
      const alpha=bitmap[i+3];
      if(alpha===0)transparent++;
      // Below 32 px the smallest gaps can share a pixel with a softened stroke.
      if(alpha<=(size<32?16:0)){
        const x=i/4%size,y=Math.floor(i/(4*size));
        if(x>=size/4&&x<3*size/4&&y>=size/4&&y<3*size/4)innerGaps++;
      }
      if(alpha>1&&alpha<240)partial++;
      if(alpha<128)continue;
      visible++;
      if(Math.min(bitmap[i],bitmap[i+1],bitmap[i+2])>=alpha*.88)white++;
    }
    const corners=[0,size-1,size*(size-1),size*size-1];
    const passed=bitmap.length===size*size*4&&visible>size*size*.075&&white>=visible*.95&&
      transparent>size*size*.25&&innerGaps>0&&partial>0&&corners.every(pixel=>bitmap[pixel*4+3]===0);
    checks.push({size,passed});
  }
  const icoLoads=!nativeImage.createFromPath(icoPath).isEmpty()&&checks.map(row=>row.size).join()===sizes.join();
  mkdirSync('docs/evidence',{recursive:true});
  const shellIcons=[];
  for(const size of ['small','normal','large']){
    const shellIcon=await app.getFileIcon(resolve(process.argv[2]),{size});
    const {width,height}=shellIcon.getSize(),actual=shellIcon.toBitmap();
    const reference=resolve(`public/icons/zen-${width}.png`);
    const expected=(existsSync(reference)?nativeImage.createFromPath(reference):
      nativeImage.createFromPath(resolve('public/icons/zen-256.png')).resize({width,height,quality:'best'})).toBitmap();
    const pixelDifference=actual.length>0&&actual.length===expected.length
      ?actual.reduce((sum,value,i)=>sum+Math.abs(value-expected[i]),0)/actual.length:255;
    shellIcons.push({size,width,height,pixelDifference,passed:pixelDifference<10});
    if(size==='large')writeFileSync('docs/evidence/zen-shell-icon.png',shellIcon.toPNG());
  }
  const report={at:new Date().toISOString(),icoLoads,checks,shellIcons,shellIconMatchesZen:shellIcons.every(icon=>icon.passed),apiCalled:false};
  writeFileSync('docs/evidence/windows-icons.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
  app.exit(icoLoads&&report.shellIconMatchesZen&&checks.every(row=>row.passed)?0:1);
}).catch(error=>{console.error(error.message);app.exit(1);});
