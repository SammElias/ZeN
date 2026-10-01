import { humanCommand } from '../policy/command';
import { LocalLibrary } from './library';
import { ZenError } from '../shared/errors';
export function localFileRequest(text:string) {
  const command=humanCommand(text);
  const search=command.match(/^(?:busca(?:r|me)?|búscame|encuentra|localiza)\s+localmente\s+(.+?)\s+en\s+(?:mis|las)\s+(?:archivos|carpetas|documentos)(?:\s+sin\s+(?:usar\s+)?(?:la\s+)?API)?[.!?]?$/i);
  if(search)return {kind:'search' as const,query:search[1].replace(/^['"«]|['"»]$/g,'').trim()};
  const read=command.match(/^(?:lee(?:r|me)?|léeme)\s+localmente\s+(.+?)(?:\s+sin\s+(?:usar\s+)?(?:la\s+)?API)?[.!?]?$/i);
  if(read){const path=read[1].replace(/^['"«]|['"»]$/g,'').trim();if(!/^(?:[A-Za-z]:\\|\/)/.test(path))throw new ZenError('Para leer localmente, indica la ruta completa del archivo.');return{kind:'read' as const,path};}
}
export function localFileOperation(text:string,library:LocalLibrary,maxChars=4000) {
  const request=localFileRequest(text);if(!request)return;
  return async(signal:AbortSignal)=>{
    if(request.kind==='read'){const result=await library.readPath(request.path,text,signal,maxChars);return{localOnly:true,message:`Lectura local · ${result.path}${result.partial?' · fragmento parcial':''}\n\n${result.content}`};}
    const result=await library.search(request.query,signal);const list=result.matches.map(row=>row.path).join('\n').slice(0,6000);
    return{localOnly:true,message:`Búsqueda local · ${result.matches.length} coincidencias${result.truncated?' · recorrido parcial':''}\n\n${list||'No se encontraron coincidencias en el recorrido disponible.'}\n\nNo se ha enviado contenido de archivos al modelo.`};
  };
}
