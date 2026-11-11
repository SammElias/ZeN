// Generate Windows icons from the supplied transparent emblem.
import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
async function writeAsset(path,value){for(let attempt=0;;attempt++)try{await writeFile(path,value);return;}catch(error){if(attempt>=4||!['UNKNOWN','EPERM','EACCES','EBUSY'].includes(error.code))throw error;await new Promise(r=>setTimeout(r,200*(attempt+1)));}}
const sizes=[16,20,24,32,40,48,64,128,256];
const emblem=await readFile(new URL('./assets/zen-emblem.png',import.meta.url),'base64');
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
  const rendered=await page.evaluate(async({emblem,sizes})=>{
    const image=new Image();
    image.src='data:image/png;base64,'+emblem;
    await image.decode();
    const source=document.createElement('canvas');
    source.width=image.naturalWidth;
    source.height=image.naturalHeight;
    const sourceContext=source.getContext('2d');
    sourceContext.drawImage(image,0,0);
    const {data}=sourceContext.getImageData(0,0,source.width,source.height);
    let left=source.width,top=source.height,right=0,bottom=0;
    for(let y=0;y<source.height;y++)for(let x=0;x<source.width;x++){
      if(data[(y*source.width+x)*4+3]<8)continue;
      left=Math.min(left,x);
      top=Math.min(top,y);
      right=Math.max(right,x+1);
      bottom=Math.max(bottom,y+1);
    }
    if(right<=left||bottom<=top)throw Error('El emblema no tiene píxeles visibles.');
    const width=right-left,height=bottom-top;
    return sizes.map(size=>{
      const canvas=document.createElement('canvas');
      canvas.width=canvas.height=size;
      const context=canvas.getContext('2d');
      context.imageSmoothingQuality='high';
      const margin=Math.max(1,Math.round(size*.05));
      const scale=(size-2*margin)/Math.max(width,height);
      const scaledWidth=width*scale,scaledHeight=height*scale;
      context.drawImage(source,left,top,width,height,(size-scaledWidth)/2,(size-scaledHeight)/2,scaledWidth,scaledHeight);
      return {png:canvas.toDataURL('image/png').split(',')[1],rgba:Array.from(context.getImageData(0,0,size,size).data)};
    });
  },{emblem,sizes});
  for(const name of ['zen','tray']){
    const frames=[];
    for(const [index,size] of sizes.entries()){
      const pixels=rendered[index];
      const png=Buffer.from(pixels.png,'base64');
      // Native DIB frames for small Windows shell/tray sizes; PNG for 256px.
      frames.push(size===256?png:bitmapIcon(pixels.rgba,size));
      await writeAsset(`public/icons/${name}-${size}.png`,png);
    }
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><image width="256" height="256" href="data:image/png;base64,${rendered.at(-1).png}"/></svg>\n`;
    await writeAsset(`public/icons/${name}.svg`,svg);
    const header=Buffer.alloc(6+sizes.length*16);header.writeUInt16LE(1,2);header.writeUInt16LE(sizes.length,4);
    let offset=header.length;
    frames.forEach((png,index)=>{const entry=6+index*16,size=sizes[index];header[entry]=header[entry+1]=size===256?0:size;header.writeUInt16LE(1,entry+4);header.writeUInt16LE(32,entry+6);header.writeUInt32LE(png.length,entry+8);header.writeUInt32LE(offset,entry+12);offset+=png.length;});
    await writeAsset(`public/icons/${name}.ico`,Buffer.concat([header,...frames]));
  }
  console.log(JSON.stringify({icons:['zen','tray'],sizes,apiCalled:false}));
}finally{await browser.close();}
