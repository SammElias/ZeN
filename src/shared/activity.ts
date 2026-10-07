/** Local presentation metadata. Never model narration, permissions or tool input. */
export type Activity = 'reading' | 'searching_files' | 'project' | 'queued' | 'processing' | 'thinking' | 'searching' | 'opening_web' | 'opening_codex' | 'codex_external' | 'opening_app' | 'observing' | 'executing' | 'writing' | 'structuring' | 'verifying' | 'approval' | 'input' | 'completed' | 'failed' | 'cancelled';
export const activityLabels: Record<Activity, {label:string; short:string; icon:string}> = {
  reading: {label:'Leyendo documentos',short:'Leyendo',icon:'search'},
  searching_files: {label:'Buscando archivos locales',short:'Buscando archivos',icon:'search'},
  project: {label:'Preparando proyecto',short:'Preparando',icon:'codex'},
  queued: {label:'En cola',short:'En cola',icon:'dots'},
  processing: {label:'Procesando',short:'Procesando',icon:'ring'},
  thinking: {label:'Pensando',short:'Pensando',icon:'dots'},
  searching: {label:'Consultando la web',short:'Consultando web',icon:'search'},
  opening_web: {label:'Abriendo web',short:'Abriendo web',icon:'web'},
  opening_codex: {label:'Abriendo Codex',short:'Abriendo Codex',icon:'codex'},
  codex_external: {label:'Continúa en Codex',short:'En Codex',icon:'codex'},
  opening_app: {label:'Abriendo aplicación',short:'Abriendo app',icon:'app'},
  observing: {label:'Analizando captura',short:'Analizando captura',icon:'search'},
  executing: {label:'Ejecutando',short:'Ejecutando',icon:'ring'},
  writing: {label:'Escribiendo',short:'Escribiendo',icon:'writing'},
  structuring: {label:'Estructurando respuesta',short:'Estructurando',icon:'structure'},
  verifying: {label:'Comprobando resultado',short:'Comprobando',icon:'search'},
  approval: {label:'Esperando tu permiso',short:'Esperando tu permiso',icon:'pause'},
  input: {label:'Necesito tu respuesta',short:'Tu respuesta',icon:'pause'},
  completed: {label:'Tarea completada',short:'Tarea completada',icon:'check'},
  failed: {label:'No se pudo completar',short:'Revisar error',icon:'error'},
  cancelled: {label:'Tarea detenida',short:'Detenido',icon:'pause'}
};

// Only fixed backend progress messages are classified; response/document text is excluded.
export function progressActivity(message:string,stream?:string):Activity|undefined{
  if(stream)return 'writing';
  if(message==='Consultando fuentes web…')return 'searching';
  if(message==='Consultando archivos localmente…')return 'reading';
  if(message==='Verificando la operación Windows solicitada…'||message.startsWith('Abriendo Bloc de notas y verificando'))return 'verifying';
  return undefined;
}
