import {humanCommand} from '../policy/command';
import {ZenError} from './errors';
export function localFileRequest(text:string) {
  const command=humanCommand(text);
  const search=command.match(/^(?:busca(?:r|me)?|búscame|encuentra|localiza)\s+localmente\s+(.+?)\s+en\s+(?:mis|las)\s+(?:archivos|carpetas|documentos)(?:\s+sin\s+(?:usar\s+)?(?:la\s+)?API)?[.!?]?$/i);
  if(search)return {kind:'search' as const,query:search[1].replace(/^['"«]|['"»]$/g,'').trim()};
  const read=command.match(/^(?:lee(?:r|me)?|léeme)\s+localmente\s+(.+?)(?:\s+sin\s+(?:usar\s+)?(?:la\s+)?API)?[.!?]?$/i);
  if(read){const path=read[1].replace(/^['"«]|['"»]$/g,'').trim();if(!/^(?:[A-Za-z]:\\|\/)/.test(path))throw new ZenError('Para leer localmente, indica la ruta completa del archivo.');return{kind:'read' as const,path};}
}
