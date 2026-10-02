// Export the existing ZEN companion as native Windows icons, without an API.
import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
const sizes=[16,20,24,32,40,48,64,128,256];
function bitmapIcon(rgba,size){
  const stride=Math.ceil(size/32)*4,pixels=size*size*4;
  const bitmap=Buffer.alloc(40+pixels+stride*size);
  bitmap.writeUInt32LE(40,0);bitmap.writeInt32LE(size,4);bitmap.writeInt32LE(size*2,8);
  bitmap.writeUInt16LE(1,12);bitmap.writeUInt16LE(32,14);bitmap.writeUInt32LE(pixels,20);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const from=(y*size+x)*4,to=40+((size-y-1)*size+x)*4;
    bitmap[to]=rgba[from+2];bitmap[to+1]=rgba[from+1];bitmap[to+2]=rgba[from];bitmap[to+3]=rgba[from+3];
    if(rgba[from+3]===0)bitmap[40+pixels+(size-y-1)*stride+(x>>3)]|=1<<(7-x%8);
  }
  return bitmap;
}
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
  const page=await browser.newPage();
  for(const name of ['zen','tray']){
    const svg=await readFile(`public/icons/${name}.svg`,'utf8');
    const frames=[];
    for(const size of sizes){
      const pixels=await page.evaluate(async({svg,size})=>{
        const img=new Image();img.src='data:image/svg+xml;base64,'+btoa(svg);await img.decode();
        const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
        const context=canvas.getContext('2d');context.drawImage(img,0,0,size,size);
        return {png:canvas.toDataURL('image/png').split(',')[1],rgba:Array.from(context.getImageData(0,0,size,size).data)};
      },{svg,size});
      const png=Buffer.from(pixels.png,'base64');
      // Native DIB frames for small Windows shell/tray sizes; PNG for 256px.
      frames.push(size===256?png:bitmapIcon(pixels.rgba,size));
      await writeFile(`public/icons/${name}-${size}.png`,png);
    }
    const header=Buffer.alloc(6+sizes.length*16);header.writeUInt16LE(1,2);header.writeUInt16LE(sizes.length,4);
    let offset=header.length;
    frames.forEach((png,index)=>{const entry=6+index*16,size=sizes[index];header[entry]=header[entry+1]=size===256?0:size;header.writeUInt16LE(1,entry+4);header.writeUInt16LE(32,entry+6);header.writeUInt32LE(png.length,entry+8);header.writeUInt32LE(offset,entry+12);offset+=png.length;});
    await writeFile(`public/icons/${name}.ico`,Buffer.concat([header,...frames]));
  }
  console.log(JSON.stringify({icons:['zen','tray'],sizes,apiCalled:false}));
}finally{await browser.close();}
