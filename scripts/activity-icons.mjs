// Code-native ZEN glyphs, inspired by the circle/dots/line language in
// Downloads/descarga (15).jpg. No pixels are extracted from the reference.
// Exports animated GIFs and static SVGs without an API call or new dependency.
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const directory='public/activity';
await mkdir(directory,{recursive:true});
const names=['ring','dots','search','web','codex','app','writing','structure'];
const turn=(t)=>`rotate(${t*360} 24 24)`;
const body=(name,t)=>{
  const wave=(offset=0)=>.35+.65*(1+Math.sin(t*Math.PI*2-offset))/2;
  switch(name){
    case 'ring':return `<circle cx="24" cy="24" r="13" opacity=".18"/><path d="M24 11a13 13 0 1 1-12.7 15.8" transform="${turn(t)}"/>`;
    case 'dots':return [0,1,2].map(n=>`<circle cx="${13+n*11}" cy="24" r="3" fill="currentColor" stroke="none" opacity="${wave(n*1.2)}"/>`).join('');
    case 'search':return `<g transform="translate(${Math.sin(t*Math.PI*2)*1.5} ${Math.cos(t*Math.PI*2)*1.5})"><circle cx="21" cy="21" r="9"/><path d="m28 28 8 8"/></g>`;
    case 'web':return `<circle cx="24" cy="24" r="13"/><ellipse cx="24" cy="24" rx="${4+5*wave()}" ry="13"/><path d="M11 24h26M14 16h20M14 32h20" opacity=".6"/>`;
    case 'codex':return `<path d="m18 15-9 9 9 9m12-18 9 9-9 9"/><path d="m27 12-6 24" opacity="${wave()}"/>`;
    case 'app':return `<rect x="10" y="12" width="28" height="25" rx="5"/><path d="M10 19h28" opacity=".55"/><path d="M18 28h12m-4-4 4 4-4 4" transform="translate(${wave()*2-1} 0)"/>`;
    case 'writing':return `<path d="M12 36h24" opacity=".35"/><g transform="translate(${Math.sin(t*Math.PI*2)*2} 0)"><path d="m15 29 2-7L31 8l7 7-14 14-9 2Zm13-18 7 7M17 22l7 7"/></g>`;
    case 'structure':return [0,1,2].map(n=>`<path d="M12 ${15+n*9}h${12+10*wave(n*1.5)}" opacity="${wave(n*1.5)}"/>`).join('');
    case 'check':return '<path d="m13 24 8 8 15-16"/>';
    case 'error':return '<circle cx="24" cy="24" r="14"/><path d="M24 16v10m0 6v.1"/>';
    default:return '<path d="M19 14v20m10-20v20"/>';
  }
};
const svg=(name,t=0)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="color:#c7b6ff">${body(name,t)}</svg>`;
// Fixed four-bit palette. Frequent clear codes keep the GIF LZW stream at
// five bits; small glyphs do not need a quantizer or a compression dependency.
function gif(width,height,frames){
  const output=[];const bytes=(...values)=>output.push(...values);const word=n=>bytes(n&255,n>>8);
  bytes(...Buffer.from('GIF89a'));word(width);word(height);bytes(0xf3,0,0);
  for(let n=0;n<16;n++)for(const color of [199,182,255])bytes(Math.round(16+(color-16)*n/15));
  bytes(0x21,0xff,11,...Buffer.from('NETSCAPE2.0'),3,1,0,0,0);
  for(const frame of frames){
    bytes(0x21,0xf9,4,9,8,0,0,0,0x2c);word(0);word(0);word(width);word(height);bytes(0,4);
    const data=[];let bits=0,count=0;const code=n=>{bits|=n<<count;count+=5;while(count>=8){data.push(bits&255);bits>>>=8;count-=8;}};
    for(let i=0;i<frame.length;i+=12){code(16);for(let j=i;j<Math.min(i+12,frame.length);j++)code(frame[j]);}code(17);if(count)data.push(bits&255);
    for(let i=0;i<data.length;i+=255){const chunk=data.slice(i,i+255);bytes(chunk.length,...chunk);}bytes(0);
  }
  bytes(0x3b);return Buffer.from(output);
}
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
  const page=await browser.newPage();const gallery=Array.from({length:24},()=>new Uint8Array(192*96));
  for(const [index,name] of names.entries()){
    await writeFile(`${directory}/${name}.svg`,svg(name));
    const frames=[];
    for(let frame=0;frame<24;frame++){
      const pixels=await page.evaluate(async markup=>{
        const image=new Image();image.src='data:image/svg+xml;base64,'+btoa(markup);await image.decode();
        const canvas=document.createElement('canvas');canvas.width=canvas.height=48;const context=canvas.getContext('2d');context.drawImage(image,0,0);
        const rgba=context.getImageData(0,0,48,48).data;return Array.from({length:48*48},(_,n)=>rgba[n*4+3]<20?0:Math.max(1,Math.round(rgba[n*4+3]/255*15)));
      },svg(name,frame/24));
      frames.push(pixels);
      for(let y=0;y<48;y++)for(let x=0;x<48;x++)gallery[frame][(Math.floor(index/4)*48+y)*192+(index%4)*48+x]=pixels[y*48+x];
    }
    await writeFile(`${directory}/${name}.gif`,gif(48,48,frames));
  }
  for(const name of ['check','error','pause'])await writeFile(`${directory}/${name}.svg`,svg(name));
  await writeFile(`${directory}/iconos.gif`,gif(192,96,gallery));
  console.log('8 GIF animados, 11 SVG estáticos e iconos.gif generados localmente.');
}finally{await browser.close();}
