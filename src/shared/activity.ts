export type TaskActivity='reading'|'searching'|'project'|'verifying'|'writing';
export const activityLabels:Record<TaskActivity,string>={reading:'Leyendo',searching:'Buscando',project:'Preparando proyecto',verifying:'Verificando',writing:'Redactando'};
// Only fixed backend progress messages are classified; response/document text is excluded.
export function progressActivity(message:string,stream?:string):TaskActivity|undefined{
  if(stream)return 'writing';
  if(message==='Consultando fuentes web…')return 'searching';
  if(message==='Consultando archivos localmente…')return 'reading';
  if(message==='Verificando la operación Windows solicitada…'||message.startsWith('Abriendo Bloc de notas y verificando'))return 'verifying';
  return undefined;
}
