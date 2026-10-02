/** Local presentation metadata. Never model narration, permissions or tool input. */
export type Activity = 'queued' | 'processing' | 'thinking' | 'searching' | 'opening_web' | 'opening_codex' | 'opening_app' | 'observing' | 'executing' | 'writing' | 'structuring' | 'verifying' | 'approval' | 'input' | 'completed' | 'failed' | 'cancelled';
export const activityLabels: Record<Activity, {label:string; short:string; icon:string}> = {
  queued: {label:'En cola',short:'En cola',icon:'dots'},
  processing: {label:'Procesando',short:'Procesando',icon:'ring'},
  thinking: {label:'Pensando',short:'Pensando',icon:'dots'},
  searching: {label:'Consultando la web',short:'Consultando web',icon:'search'},
  opening_web: {label:'Abriendo web',short:'Abriendo web',icon:'web'},
  opening_codex: {label:'Abriendo Codex',short:'Abriendo Codex',icon:'codex'},
  opening_app: {label:'Abriendo aplicación',short:'Abriendo app',icon:'app'},
  observing: {label:'Observando la pantalla',short:'Observando',icon:'search'},
  executing: {label:'Ejecutando',short:'Ejecutando',icon:'ring'},
  writing: {label:'Escribiendo',short:'Escribiendo',icon:'writing'},
  structuring: {label:'Estructurando respuesta',short:'Estructurando',icon:'structure'},
  verifying: {label:'Comprobando resultado',short:'Comprobando',icon:'search'},
  approval: {label:'Esperando tu confirmación',short:'Tu confirmación',icon:'pause'},
  input: {label:'Necesito tu respuesta',short:'Tu respuesta',icon:'pause'},
  completed: {label:'Completado',short:'Listo',icon:'check'},
  failed: {label:'No se pudo completar',short:'Revisar error',icon:'error'},
  cancelled: {label:'Tarea detenida',short:'Detenido',icon:'pause'}
};
