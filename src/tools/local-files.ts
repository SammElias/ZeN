import {LocalLibrary} from './library';
import {localFileRequest} from '../shared/local-files';
export {localFileRequest} from '../shared/local-files';
export function localFileOperation(text:string,library:LocalLibrary,maxChars=4000) {
  const request=localFileRequest(text);if(!request)return;
  return async(signal:AbortSignal)=>{
    if(request.kind==='read'){const result=await library.readPath(request.path,text,signal,maxChars);return{localOnly:true,message:`Lectura local · ${result.path}${result.partial?' · fragmento parcial':''}\n\n${result.content}`};}
    const result=await library.search(request.query,signal);const list=result.matches.map(row=>row.path).join('\n').slice(0,6000);
    return{localOnly:true,message:`Búsqueda local · ${result.matches.length} coincidencias${result.truncated?' · recorrido parcial':''}\n\n${list||'No se encontraron coincidencias en el recorrido disponible.'}\n\nNo se ha enviado contenido de archivos al modelo.`};
  };
}
