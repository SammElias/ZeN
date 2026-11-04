import {randomUUID} from 'node:crypto';
import {openSync,closeSync,fstatSync,readSync,readFileSync,writeFileSync,renameSync,mkdirSync,existsSync} from 'node:fs';
import {basename,join} from 'node:path';
import {z} from 'zod';
import {imageSize} from 'image-size';
import {AppearanceOptions,defaultAppearance,type AppearanceState} from '../shared/companion-appearance';
const Saved=z.object({options:AppearanceOptions,image:z.object({id:z.string().uuid(),name:z.string().max(200)}).strict().optional()}).strict();
const MAX_BYTES=12*1024*1024;
export function wallpaperBytes(path:string){let fd:number|undefined;try{
 fd=openSync(path,'r');const stat=fstatSync(fd);if(!stat.isFile()||stat.size<12||stat.size>MAX_BYTES)throw Error();
 const bytes=Buffer.alloc(stat.size);let count=0;while(count<bytes.length){const n=readSync(fd,bytes,count,bytes.length-count,count);if(!n)throw Error();count+=n;}
 const after=fstatSync(fd);if(after.size!==stat.size||after.mtimeMs!==stat.mtimeMs||after.ino!==stat.ino)throw Error();
 const d=imageSize(bytes);if(!['png','jpg','webp'].includes(d.type??'')||!d.width||!d.height||d.width>8192||d.height>8192||d.width*d.height>24000000)throw Error();return bytes;
 }catch{throw Error('Elige una imagen PNG, JPG o WebP de hasta 12 MB y 24 megapíxeles.');}finally{if(fd!==undefined)closeSync(fd);}}
/** Only the picker supplies a file path. The renderer receives an opaque local image URL. */
export class CompanionAppearance{
 private saved:z.infer<typeof Saved>={options:defaultAppearance};private path:string;private folder:string;
 constructor(profile:string,private normalize:(bytes:Buffer)=>Buffer){this.path=join(profile,'companion-appearance.json');this.folder=join(profile,'appearance');try{const raw=readFileSync(this.path);if(raw.length<=4096)this.saved=Saved.parse(JSON.parse(raw.toString('utf8')));}catch{}}
 status():AppearanceState{const image=this.saved.image,available=image&&existsSync(join(this.folder,image.id+'.png'));return{...this.saved.options,...(this.saved.options.background==='image'&&!available?{background:'aurora' as const}:{}),...(available?{imageUrl:'zen-theme://background/'+image.id,imageName:image.name}:{})};}
 private persist(value:z.infer<typeof Saved>){writeFileSync(this.path+'.tmp',JSON.stringify(value));renameSync(this.path+'.tmp',this.path);this.saved=value;return this.status();}
 save(raw:unknown){const options=AppearanceOptions.parse(raw);if(options.background==='image'&&!this.status().imageUrl)throw Error('Elige primero una imagen de fondo.');return this.persist({...this.saved,options});}
 import(path:string){const bytes=wallpaperBytes(path);let normalized:Buffer;try{normalized=this.normalize(bytes);if(!normalized.length||normalized.length>MAX_BYTES||imageSize(normalized).type!=='png')throw Error();}catch{throw Error('No se pudo preparar esta imagen. Prueba con otra.');}
  mkdirSync(this.folder,{recursive:true});const id=randomUUID(),target=join(this.folder,id+'.png');writeFileSync(target+'.tmp',normalized);renameSync(target+'.tmp',target);
  return this.persist({options:{...this.saved.options,background:'image'},image:{id,name:basename(path).replace(/[\x00-\x1f]/g,'').slice(0,200)}});
 }
 image(id:string){if(!z.string().uuid().safeParse(id).success||id!==this.saved.image?.id)throw Error('Fondo no disponible.');const path=join(this.folder,id+'.png');const fd=openSync(path,'r');try{const stat=fstatSync(fd);if(!stat.isFile()||stat.size<12||stat.size>MAX_BYTES)throw Error();const bytes=Buffer.alloc(stat.size);let count=0;while(count<bytes.length){const n=readSync(fd,bytes,count,bytes.length-count,count);if(!n)throw Error();count+=n;}const after=fstatSync(fd);if(after.size!==stat.size||after.mtimeMs!==stat.mtimeMs||imageSize(bytes).type!=='png')throw Error('Fondo no disponible.');return bytes;}finally{closeSync(fd);}}
}
