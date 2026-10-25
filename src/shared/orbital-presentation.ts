import type {CompanionStatus} from './codex-companion';
import {activeSession} from './companion-presentation';

export type OrbitalState='available'|'thinking'|'working'|'approval'|'finished'|'error'|'interrupted'|'unknown'|'paused'|'disconnected';
/** Presentation only: use received state, never infer work or permission from animation. */
export function orbitalPresentation(status:CompanionStatus){
 const session=activeSession(status);
 const state:OrbitalState=status.approvals.length?'approval':status.settings.paused?'paused':session?.state==='idle'?'available':session?.state??(status.connection?.state==='unavailable'?'disconnected':status.connection?.state==='ready'?'available':'unknown');
 const steps=Math.min(3,session?.steps.length??0);
 return {state,steps:status.settings.presentation||!['thinking','working','finished'].includes(state)?0:steps,runKey:session?.runKey};
}
