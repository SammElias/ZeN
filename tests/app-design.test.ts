import {describe,it,expect} from 'vitest';
import {mkdtempSync,writeFileSync,readFileSync,rmSync,mkdirSync,readdirSync} from 'node:fs';
import {join} from 'node:path';import {tmpdir} from 'node:os';
import {capsuleExtensionBounds} from '../src/main/companion-placement';
import {CompanionAppearance,wallpaperBytes} from '../src/main/companion-appearance';
const area={x:0,y:0,width:1920,height:1040},png=readFileSync('public/icons/zen-16.png');
function fixture(){const root=mkdtempSync(join(tmpdir(),'zen-design-'));return{root,dispose:()=>rmSync(root,{recursive:true,force:true})};}
describe('extension of the anchored capsule',()=>{
 it('uses the full work area height on a normal display',()=>{
  const capsule={x:550,y:0,width:820,height:68};
  expect(capsuleExtensionBounds(area,capsule)).toEqual({...capsule,height:1040});
 });
 it('extends from the top of the work area at a side anchor',()=>{
  const capsule={x:1100,y:500,width:820,height:68};
  expect(capsuleExtensionBounds(area,capsule)).toEqual({...capsule,y:0,height:1040});
 });
 it('uses the work area origin on a secondary monitor',()=>{
  const work={x:-1920,y:-100,width:1920,height:1040};
  expect(capsuleExtensionBounds(work,{x:-1920,y:850,width:820,height:68})).toEqual({x:-1920,y:-100,width:820,height:1040});
 });
 it('fits a short monitor without changing the capsule width',()=>{
  const work={x:0,y:0,width:390,height:310};
  expect(capsuleExtensionBounds(work,{x:0,y:0,width:390,height:68})).toEqual(work);
 });
});
describe('local glass appearance and bounded wallpapers',()=>{
 it('persists glass settings across restarts separately from account files',()=>{const f=fixture();try{writeFileSync(join(f.root,'gmail-oauth.bin'),'ENCRYPTED_ACCOUNT');const s=new CompanionAppearance(f.root,b=>b),options={theme:'light',accent:'amber',opacity:.83,blur:17,background:'dusk'};s.save(options);expect(new CompanionAppearance(f.root,b=>b).status()).toEqual(options);expect(readFileSync(join(f.root,'gmail-oauth.bin'),'utf8')).toBe('ENCRYPTED_ACCOUNT');}finally{f.dispose();}});
 it('normalizes a picker-selected raster and exposes only its opaque URL and basename',()=>{const f=fixture();try{const input=join(f.root,'wallpaper.png');writeFileSync(input,png);let normalized=false;const s=new CompanionAppearance(f.root,b=>{normalized=true;expect(b).toEqual(png);return png;}),r=s.import(input);expect(normalized).toBe(true);expect(r).toMatchObject({background:'image',imageName:'wallpaper.png'});expect(r.imageUrl).toMatch(/^zen-theme:\/\/background\/[a-f0-9-]{36}$/);expect(JSON.stringify(r)).not.toContain(f.root);expect(s.image(r.imageUrl!.split('/').at(-1)!)).toEqual(png);expect(new CompanionAppearance(f.root,b=>b).status()).toEqual(r);}finally{f.dispose();}});
 it('serves only the current owned image and rejects traversal, URLs or guessed paths',()=>{const f=fixture();try{const p=join(f.root,'image.png');writeFileSync(p,png);const s=new CompanionAppearance(f.root,b=>b);const a=s.import(p),b=s.import(p);expect(()=>s.image(a.imageUrl!.split('/').at(-1)!)).toThrow();for(const id of ['../../gmail-oauth.bin','file:///private','https://example.test','00000000-0000-4000-8000-000000000000'])expect(()=>s.image(id)).toThrow();expect(s.image(b.imageUrl!.split('/').at(-1)!)).toEqual(png);}finally{f.dispose();}});
 it('rejects active content, directories, oversized files and decompression-heavy rasters before normalizing',()=>{const f=fixture();try{const s=new CompanionAppearance(f.root,()=>{throw Error('Should not normalize');});const p=join(f.root,'image.png');for(const b of [Buffer.from('<svg><script>PRIVATE</script></svg>'),Buffer.alloc(12*1024*1024+1),Buffer.from('PRIVATE_CONFIG_JSON')]){writeFileSync(p,b);expect(()=>s.import(p)).toThrow('PNG, JPG');}const huge=Buffer.from(png);huge.writeUInt32BE(100000,16);writeFileSync(p,huge);expect(()=>wallpaperBytes(p)).toThrow();expect(()=>wallpaperBytes(f.root)).toThrow();}finally{f.dispose();}});
 it('keeps previous appearance if decoding fails and does not allow a renderer image path',()=>{const f=fixture();try{const p=join(f.root,'image.png');writeFileSync(p,png);const s=new CompanionAppearance(f.root,()=>{throw Error('PRIVATE_NATIVE_DETAILS');}),before=s.status();expect(()=>s.import(p)).toThrow('No se pudo preparar');expect(s.status()).toEqual(before);expect(()=>s.save({...before,imageUrl:'file:///private'})).toThrow();expect(()=>s.save({...before,background:'image'})).toThrow('Elige primero');}finally{f.dispose();}});
 it('keeps the previous wallpaper and removes the new copy when preferences cannot be saved',()=>{
  const f=fixture();
  try{
   const input=join(f.root,'image.png');
   writeFileSync(input,png);
   const appearance=new CompanionAppearance(f.root,bytes=>bytes);
   const before=appearance.import(input);
   const imageId=before.imageUrl!.split('/').at(-1)!;
   mkdirSync(join(f.root,'companion-appearance.json.tmp'));
   expect(()=>appearance.import(input)).toThrow();
   expect(appearance.status()).toEqual(before);
   expect(appearance.image(imageId)).toEqual(png);
   expect(readdirSync(join(f.root,'appearance'))).toEqual([imageId+'.png']);
  }finally{f.dispose();}
 });
 it('rejects invalid opacity, blur and corrupt stored filenames with a safe default',()=>{const f=fixture();try{const s=new CompanionAppearance(f.root,b=>b),before=s.status();for(const change of [{opacity:0},{opacity:1.1},{blur:100},{blur:NaN},{theme:'script'}])expect(()=>s.save({...before,...change})).toThrow();writeFileSync(join(f.root,'companion-appearance.json'),JSON.stringify({options:before,image:{id:'../../gmail-oauth.bin',name:'x'}}));expect(new CompanionAppearance(f.root,b=>b).status()).toEqual(before);}finally{f.dispose();}});
});
