import { humanCommand } from './command';
// Only original human text, never captions supplied by the model or screen content.
export function projectCreationRequest(text:string){
  const command=humanCommand(text).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const object=command.search(/\b(?:proyectos?|carpetas?|directorios?)\b/),informational=command.search(/\b(?:lista|resumen|explicacion|imagen|foto|dibujo|respuesta|comparacion|ejemplo|plan)\b/);
  if(informational>=0&&informational<object)return false;
  const standaloneFile=command.search(/\b(?:archivo|documento)\b/);
  if(standaloneFile>=0&&standaloneFile<object)return false;
  return /^(?:(?:quiero|necesito|me gustaria)\s+(?:que\s+)?(?:me\s+)?|ayudame\s+a\s+)?(?:crea(?:r|me)?|haz(?:me)?|construye|monta|genera(?:r)?|prepara(?:r)?|inicia(?:r)?)\b/.test(command)&&/\b(?:proyectos?|carpetas?|directorios?)\b/.test(command);
}
