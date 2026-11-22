import {randomUUID} from 'node:crypto';
import {OfficinaActor, type OfficinaProject, type OfficinaTeam} from '../shared/companion-officina';
import type {CompanionLastReply, CompanionTarget} from '../shared/codex-companion';

export function makeOfficinaSmokeTeam() {
  const replies = new Map<string, CompanionLastReply>();
  const browserTurns = new Map<string, {run: string; ready: number}>();
  const threads = Object.fromEntries(OfficinaActor.options.map(role => [role, randomUUID()]));
  return {
    verify: async () => true,
    verifyProject: async () => true,
    provision: async (project: OfficinaProject, checkpoint: (team: OfficinaTeam) => void, authorize: () => void) => {
      authorize();
      checkpoint({projectId: project.id, cwd: 'C:\\fixture', threads});
    },
    queue: async (thread: string, prompt: string, verify: () => Promise<void>, browser?: {id: string; name?: string}) => {
      await verify();
      const input = JSON.parse(prompt.split('\n').at(-1)!);
      const result = input.identity.role === 'coordinator' ? input.phase === 'plan'
        ? {kind: 'plan', text: 'Arquitectura revisará el objetivo de prueba.',
          steps: [{role: 'architect', instruction: 'Explica la regla de aprobación.'}]}
        : {kind: 'complete', text: 'Objetivo de prueba completado.'}
        : browser?.name === 'Chrome' && input.identity.role === 'analyst'
          ? input.task.objective.includes('sin pestañas')
            ? {kind: 'blocker', text: 'El navegador de prueba devolvió una lista vacía de pestañas.'}
            : {kind: 'progress', text: 'Pestañas sintéticas de Chrome revisadas.'}
          : {kind: 'decision', text: 'Nadie puede aprobar su propio gasto.'};
      replies.set(thread, {source: 'local', turn: randomUUID(), at: Date.now(), truncated: false,
        text: '<zen_officina>' + JSON.stringify({...input.identity, result}) + '</zen_officina>'});
      if (browser && input.identity.role === 'analyst') browserTurns.set(thread, {run: input.identity.run, ready: Date.now() + 6500});
    },
    read: async (target: CompanionTarget) => {
      const turn = browserTurns.get(target.session);
      return !turn || Date.now() >= turn.ready ? replies.get(target.session) : undefined;
    },
    readTurn: async (target: CompanionTarget, identity: {run: string}, since: number) => {
      const turn = browserTurns.get(target.session);
      return turn?.run === identity.run ? {turn: replies.get(target.session)!.turn!, state: 'working' as const, at: since} : undefined;
    },
  };
}
