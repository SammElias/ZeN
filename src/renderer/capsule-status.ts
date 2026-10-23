import type {ShellAction,ShellStatus} from '../shared/desktop-shell';

/** Presentation of observed events only; never infers progress or permission. */
export function capsuleStatus(status:ShellStatus){
 const needsInput=status.state==='awaiting_input'&&!status.external;
 const action:ShellAction=status.permission?'permissions':needsInput?'chat':'activity';
 const kind=status.permission?'permission':status.state==='failed'?'error':status.paused?'paused':status.external?'external':needsInput?'input':status.busy?'working':status.speaking?'speaking':status.microphone?'listening':status.state==='completed'?'complete':status.state==='cancelled'?'stopped':'idle';
 const detail=status.permission?'Revisar propuesta':status.state==='failed'?'Ver qué ha ocurrido':status.paused?'Trabajo en pausa':status.external?'Continuar en Codex':needsInput?'Continuar en Chat':status.busy?'Ver actividad':status.speaking?'Reproduciendo voz':status.microphone?'Micrófono activo':status.contextReady?'Contexto preparado':'Listo para ayudarte';
 return {kind,action,detail,label:status.label,animate:status.busy&&!status.paused&&!status.permission&&!status.external&&['queued','thinking','executing'].includes(status.state)};
}
