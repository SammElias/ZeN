import type {CompanionStatus,CompanionSession,CompanionConnection,CompanionSettings,CompanionTarget,CompanionNotice} from './codex-companion';

export const phaseNames={idle:'Disponible',thinking:'Pensando',working:'Usando herramientas',approval:'Necesita tu permiso',finished:'Turno terminado',error:'Revisar error',interrupted:'Interrumpido',unknown:'Revisa Codex'} as const;
export function activeSession(status:Pick<CompanionStatus,'sessions'|'approvals'|'target'>):CompanionSession|undefined{
 if(status.target)return status.sessions.find(s=>matchesTarget(status.target!,s.id,s.cwd));
 const requested=status.approvals[0]?.session;
 return status.sessions.find(s=>s.id===requested)??status.sessions.find(s=>['thinking','working'].includes(s.state))??status.sessions.find(s=>s.state==='error')??status.sessions[0];
}
export function matchesTarget(target:CompanionTarget,session:string,cwd:string){
 const normalize=(v:string)=>v.replace(/\//g,'\\').replace(/\\+$/,'').toLowerCase();
 return target.session===session&&normalize(target.cwd)===normalize(cwd);
}
export function currentChat(status:Pick<CompanionStatus,'sessions'|'approvals'|'target'|'targetError'>){return status.targetError?undefined:status.target?.session??activeSession(status)?.id;}
export function codexChatUrl(status:Pick<CompanionStatus,'sessions'|'approvals'|'target'|'targetError'>,requested?:string){
 if(status.targetError)throw Error(status.targetError);
 const id=requested??currentChat(status);
 if(id&&(status.target?id!==status.target.session:!status.sessions.some(s=>s.id===id)))throw Error('Este chat no pertenece al seguimiento de ZEN.');
 return id?'codex://threads/'+encodeURIComponent(id):'codex://';
}
export function noticeChatUrl(status:Pick<CompanionStatus,'sessions'|'approvals'|'target'|'targetError'>,notice:CompanionNotice){return codexChatUrl(status,notice.session);}
export function isSilenced(settings:Pick<CompanionSettings,'silencedUntil'>,now=Date.now()){return settings.silencedUntil>now;}
export function lastSignalLabel(at?:number,now=Date.now()){
 if(at===undefined)return 'Sin señales de este chat todavía';
 const seconds=Math.max(0,Math.floor((now-at)/1000));
 if(seconds<60)return 'Última señal hace '+seconds+' s';
 const minutes=Math.floor(seconds/60);if(minutes<60)return 'Última señal hace '+minutes+' min';
 return 'Última señal hace '+Math.floor(minutes/60)+' h';
}
export function completionDetail(session:CompanionSession){
 const o=session.observation;if(session.state!=='finished'||!o||o.endedAt===undefined)return undefined;
 const count=o.actions+' '+(o.actions===1?'acción observada':'acciones observadas');
 if(o.startedAt===undefined)return count+' · Inicio no observado';
 const seconds=Math.max(0,Math.floor((o.endedAt-o.startedAt)/1000));
 const duration=seconds<60?seconds+' s':Math.floor(seconds/60)+' min '+seconds%60+' s';
 return count+' · '+duration+' desde el inicio recibido';
}
export function toolActivity(tool?:string){
 if(!tool)return 'Codex';
 if(/cua_repl|computer_use/i.test(tool))return 'Control visual';
 if(/browser|chrome|playwright/i.test(tool))return 'Navegador';
 if(/apply_patch|^edit$|^write$/i.test(tool))return 'Edición de archivos';
 if(/^bash$|exec_command/i.test(tool))return 'Comando';
 return tool.length>55?tool.slice(0,52)+'…':tool;
}
export function connectionLabel(status:Pick<CompanionStatus,'settings'|'connection'|'lastEventAt'>,now=Date.now()){
 if(status.settings.paused)return 'Avisos en pausa';
 const state=status.connection?.state;
 if(state==='unavailable')return 'Codex no disponible';
 if(state==='missing')return 'Integración sin preparar';
 if(state==='review')return 'Revisión pendiente en Codex';
 if(state==='disabled')return 'Hooks desactivados';
 if(status.lastEventAt&&now-status.lastEventAt<120000)return 'Eventos recibidos';
 if(state==='ready')return 'Esperando eventos de Codex';
 if(status.lastEventAt)return 'Sin actividad reciente';
 return 'Comprobar conexión';
}
/** Only exact command definitions reported by Codex; never infer trust from a file. */
export function hookConnection(result:unknown,command:string,expected:number,now=Date.now()):CompanionConnection{
 const rows=(result as {data?:unknown[]})?.data;
 if(!Array.isArray(rows))throw Error('Respuesta de hooks no reconocida.');
 const own=new Map<string,any>();
 for(const row of rows){const hooks=(row as any)?.hooks;if(!Array.isArray(hooks))continue;for(const h of hooks)if(h?.handlerType==='command'&&h.command===command)own.set(h.key??h.eventName,h);}
 const hooks=[...own.values()],total=hooks.length,trusted=hooks.filter(h=>h.trustStatus==='trusted'||h.trustStatus==='managed').length,enabled=hooks.filter(h=>h.enabled===true).length;
 const state=total<expected?'missing':trusted<total?'review':enabled<total?'disabled':'ready';
 return{state,total,trusted,enabled,checkedAt:now};
}
