import {nativeImage} from 'electron';
import {existsSync} from 'node:fs';
import {basename, join} from 'node:path';
import {imageSize} from 'image-size';
import {referenceBytes, TemplateImage, type TemplateRecord} from '../shared/knowledge-templates';
import {readHubFile} from './knowledge-hub';
import {templateImageBytes, validateTemplateImage} from './knowledge-templates';
import {templateSeeds} from './knowledge-template-seeds';

export function readTemplateImage(path:string):TemplateImage {
  let bytes:Buffer;
  try { bytes=readHubFile(path,referenceBytes); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code==='ENOENT') throw Error('El archivo de imagen ya no está disponible.');
    throw Error('No se pudo leer la referencia. Comprueba que la imagen sea de hasta 4 MB.');
  }
  const original=bytes.toString('base64');
  try {
    const format=imageSize(bytes).type;
    const mime=TemplateImage.shape.mime.parse('image/'+(format==='jpg'?'jpeg':format));
    templateImageBytes(original,mime);
    const image=nativeImage.createFromBuffer(bytes);
    const {width,height}=image.getSize();
    if(image.isEmpty()||!width||!height)throw Error();
    const scale=Math.min(1,480/Math.max(width,height));
    const thumbnail=image.resize({width:Math.max(1,Math.round(width*scale)),
      height:Math.max(1,Math.round(height*scale)),quality:'best'}).toJPEG(80).toString('base64');
    const reference=TemplateImage.parse({name:basename(path).slice(0,160),mime,original,thumbnail});
    validateTemplateImage(reference);
    return reference;
  } catch {throw Error('No se pudo decodificar la referencia. Usa una imagen PNG, JPEG o WebP válida de hasta 4 MB.');}
}

export function loadTemplateSeeds(folder:string):TemplateRecord[] {
  const createdAt=Date.now();
  return templateSeeds.map(({file,...fields})=>{
    let image:TemplateImage|undefined;
    const local=join(folder,file.replace(/\.png$/,'.jpg'));
    let author='';
    if(existsSync(local))try {
      image=readTemplateImage(local);
      author=fields.author;
    }catch { /* Use the packaged preview if the local reference is unreadable. */ }
    if(!image)try { image=readTemplateImage(join(folder,file)); }
    catch { /* An unavailable reference leaves the editorial record usable. */ }
    return {...fields,author,image,favorite:false,createdAt,updatedAt:createdAt};
  });
}

export function decodeTemplateBackupImage(image:TemplateImage) {
  if (nativeImage.createFromBuffer(Buffer.from(image.original,'base64')).isEmpty() ||
      nativeImage.createFromBuffer(Buffer.from(image.thumbnail,'base64')).isEmpty()) {
    throw Error('La copia contiene una referencia visual dañada.');
  }
}
