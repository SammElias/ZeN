import {randomUUID} from 'node:crypto';
import {openSync,closeSync,fstatSync,readSync,readFileSync,writeFileSync,renameSync,mkdirSync,existsSync,unlinkSync} from 'node:fs';
import {basename,join} from 'node:path';
import {z} from 'zod';
import {imageSize} from 'image-size';
import {AppearanceOptions,defaultAppearance,glassOpacity,type AppearanceState} from '../shared/companion-appearance';
import type {PortableAppearance} from '../shared/companion-backup';
const SavedOptions=AppearanceOptions.extend({
 opacity:z.number().min(.28).max(glassOpacity.maximum)
  .transform(value=>Math.max(value,glassOpacity.minimum)).default(glassOpacity.initial),
});
const Saved=z.object({options:SavedOptions,image:z.object({id:z.string().uuid(),name:z.string().max(200)}).strict().optional()}).strict();
const MAX_BYTES=12*1024*1024;
function readStableImage(path:string){
 const fd=openSync(path,'r');
 try{
  const before=fstatSync(fd);
  if(!before.isFile()||before.size<12||before.size>MAX_BYTES)throw Error();
  const bytes=Buffer.alloc(before.size);
  let offset=0;
  while(offset<bytes.length){
   const read=readSync(fd,bytes,offset,bytes.length-offset,offset);
   if(!read)throw Error();
   offset+=read;
  }
  const after=fstatSync(fd);
  if(after.size!==before.size||after.mtimeMs!==before.mtimeMs||after.ino!==before.ino)throw Error();
  return {bytes,format:imageSize(bytes)};
 }finally{closeSync(fd);}
}

export function wallpaperBytes(path:string){
 try{
  const {bytes,format:{type,width,height}}=readStableImage(path);
  if(!['png','jpg','webp'].includes(type??'')||!width||!height||width>8192||height>8192||width*height>24000000)throw Error();
  return bytes;
 }catch{throw Error('Elige una imagen PNG, JPG o WebP de hasta 12 MB y 24 megapíxeles.');}
}
/** Only the picker supplies a file path. The renderer receives an opaque local image URL. */
export class CompanionAppearance{
 private saved:z.infer<typeof Saved>={options:defaultAppearance};private path:string;private folder:string;
 constructor(profile:string,private normalize:(bytes:Buffer)=>Buffer){this.path=join(profile,'companion-appearance.json');this.folder=join(profile,'appearance');try{const raw=readFileSync(this.path);if(raw.length<=4096)this.saved=Saved.parse(JSON.parse(raw.toString('utf8')));}catch{}}
 status():AppearanceState{const image=this.saved.image,available=image&&existsSync(join(this.folder,image.id+'.png'));return{...this.saved.options,...(this.saved.options.background==='image'&&!available?{background:'aurora' as const}:{}),...(available?{imageUrl:'zen-theme://background/'+image.id,imageName:image.name}:{})};}
 private persist(value:z.infer<typeof Saved>){writeFileSync(this.path+'.tmp',JSON.stringify(value));renameSync(this.path+'.tmp',this.path);this.saved=value;return this.status();}
 save(raw:unknown){const options=AppearanceOptions.parse(raw);if(options.background==='image'&&!this.status().imageUrl)throw Error('Elige primero una imagen de fondo.');return this.persist({...this.saved,options});}
 import(path:string){
  return this.storeImage({...this.saved.options,background:'image'},basename(path),wallpaperBytes(path));
 }
 backup():PortableAppearance{
  const {imageName,imageUrl,...options}=this.status();
  return {options,wallpaper:imageName&&imageUrl?{name:imageName,png:this.image(imageUrl.split('/').at(-1)!).toString('base64')}:undefined};
 }
 restoreBackup({options,wallpaper}:PortableAppearance):()=>void{
  const previous=this.saved;
  if(options.background==='image'&&!wallpaper)throw Error('El respaldo no incluye su imagen de fondo.');
  if(wallpaper){
   const bytes=Buffer.from(wallpaper.png,'base64');
   const {width,height,type}=imageSize(bytes);
   if(bytes.toString('base64')!==wallpaper.png||bytes.length>MAX_BYTES||
      type!=='png'||!width||!height||width>2560||height>2560)throw Error('La imagen de fondo del respaldo no es válida.');
   this.storeImage(options,wallpaper.name,bytes);
  }else this.persist({options});
  const restoredImage=this.saved.image;
  return ()=>{
   this.persist(previous);
   if(restoredImage)unlinkSync(join(this.folder,restoredImage.id+'.png'));
  };
 }
 private storeImage(options:AppearanceOptions,name:string,bytes:Buffer){
  let normalized:Buffer;
  try{normalized=this.normalize(bytes);if(!normalized.length||normalized.length>MAX_BYTES||imageSize(normalized).type!=='png')throw Error();}catch{throw Error('No se pudo preparar esta imagen. Prueba con otra.');}
  mkdirSync(this.folder,{recursive:true});
  const id=randomUUID(),target=join(this.folder,id+'.png');
  const image={id,name:name.replace(/[\x00-\x1f]/g,'').slice(0,200)||'Fondo de ZEN'};
  try{
   writeFileSync(target+'.tmp',normalized);
   renameSync(target+'.tmp',target);
   return this.persist({options,image});
  }catch(error){
   for(const file of [target,target+'.tmp']){
    try{unlinkSync(file);}catch{/* The original failure determines the result. */}
   }
   throw error;
  }
 }
 image(id:string){
  try{
   if(id!==this.saved.image?.id)throw Error();
   const {bytes,format}=readStableImage(join(this.folder,id+'.png'));
   if(format.type!=='png')throw Error();
   return bytes;
  }catch{throw Error('Fondo no disponible.');}
 }
}
