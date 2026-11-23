import {randomUUID} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {OfficinaActor, type OfficinaProject, type OfficinaTeam} from '../shared/companion-officina';
import type {CompanionLastReply, CompanionTarget} from '../shared/codex-companion';

export function makeOfficinaSmokeTeam(profile: string) {
  const replies = new Map<string, CompanionLastReply>();
  const activeTurns = new Map<string, {run: string; ready: number}>();
  const threads = Object.fromEntries(OfficinaActor.options.map(role => [role, randomUUID()]));
  const folder = join(profile, 'Proyecto sintético');
  const nested = join('src', 'recursos');
  const file = join(profile, 'Referencia de prueba.txt');
  return {
    verify: async () => true,
    verifyProject: async () => true,
    pickContext: async (kind: 'folder' | 'file') => {
      if (kind === 'folder') {
        await mkdir(join(folder, nested), {recursive: true});
        await writeFile(join(folder, nested, 'guía.txt'), 'Evidencia de subcarpeta');
        return [folder];
      }
      await writeFile(file, 'Evidencia del archivo adjunto');
      return [file];
    },
    provision: async (project: OfficinaProject, checkpoint: (team: OfficinaTeam) => void, authorize: () => void,
      _repair?: unknown, observer = false) => {
      authorize();
      const {observer: zen, ...workers} = threads;
      checkpoint({projectId: project.id, cwd: project.folder?.path ?? 'C:\\fixture',
        threads: observer ? {...project.team?.threads, observer: zen} : {...project.team?.threads, ...workers}});
    },
    queue: async (thread: string, prompt: string, verify: () => Promise<void>, browser?: {id: string; name?: string},
      images?: {id: string; paths: string[]}) => {
      await verify();
      const input = JSON.parse(prompt.split('\n').at(-1)!);
      if (input.identity.role === 'observer') {
        const evidence = JSON.parse(await readFile(input.evidence, 'utf8'));
        if (input.improvement) {
          if (browser || input.improvement.title !== evidence.proposal?.title || input.improvement.approvalTime === undefined) {
            throw Error('El seguimiento no recibió la propuesta aprobada.');
          }
          replies.set(thread, {source: 'local', turn: randomUUID(), at: Date.now(), truncated: false,
            text: '<zen_officina>' + JSON.stringify({...input.identity, result: {kind: 'followup', outcome: 'done',
              text: 'Comprobación independiente preparada.',
              markdown: '## Resultado de seguimiento\n\nZEN documentó el recorrido para repetir la comprobación.'}}) + '</zen_officina>'});
          activeTurns.set(thread, {run: input.identity.run, ready: Date.now() + 6500});
          return;
        }
        if (!evidence.tasks.some((entry: {task: {title: string}}) => entry.task.title === 'Analiza el proyecto y dime qué opinas.') || browser) {
          throw Error('La revisión no recibió el historial esperado.');
        }
        replies.set(thread, {source: 'local', turn: randomUUID(), at: Date.now(), truncated: false,
          text: '<zen_officina>' + JSON.stringify({...input.identity, result: {kind: 'observation', text: 'ZEN encontró dos mejoras.',
            markdown: '## Observaciones\n\nEl equipo entregó el análisis. Dos ajustes facilitarían verificar los resultados.',
            proposals: [{kind: 'prompt', role: 'analyst', title: 'Añadir evidencias al análisis',
              evidence: 'En el análisis de ZeN, el informe propuso medir el puente sin localizar la prueba.',
              validation: 'Comprueba que el próximo informe incluya la ruta del archivo que respalda cada hallazgo.',
              prompt: 'Relaciona cada hallazgo con una evidencia verificable. Incluye la ruta del archivo y el siguiente paso.'},
            {kind: 'process', title: 'Conservar la versión en los traspasos',
              evidence: 'Coordinación cerró el objetivo sin identificar la versión examinada.',
              validation: 'Comprueba que el próximo traspaso mencione un identificador comprobable.',
              recommendation: 'Pide a Coordinación que identifique la versión en cada traspaso.'}]}}) + '</zen_officina>'});
        activeTurns.set(thread, {run: input.identity.run, ready: Date.now() + 6500});
        return;
      }
      const source = input.localContext?.folder && input.localContext?.files?.length === 1 &&
        `${await readFile(join(input.localContext.folder, nested, 'guía.txt'), 'utf8')} / ${await readFile(input.localContext.files[0], 'utf8')}`;
      const review = input.task.objective === 'Analiza el proyecto y dime qué opinas.';
      const incident = input.task.objective === 'Verifica el traspaso de laboratorio.';
      const imageCheck = input.task.objective === 'Revisa la captura.\nComprueba el segundo punto.' ||
        input.task.objective === 'Analiza las imágenes adjuntas.';
      if (imageCheck && (images?.id !== input.identity.run || images?.paths.length !== 1 ||
          (await readFile(images.paths[0])).subarray(0, 3).toString('hex') !== 'ffd8ff')) {
        throw Error('El turno no recibió la captura adjunta.');
      }
      const result = imageCheck ? {kind: 'progress', text: 'Captura recibida por Tester.'} : incident ? input.identity.role === 'developer' ? {
        kind: 'handoff', to: 'tester', act: true, text: 'Entrega de laboratorio lista.',
        artifact: {version: 'v2', link: 'docs/ejemplo.html', next: 'Prueba la interacción.'},
      } : {kind: 'blocker', replyTo: input.event.id, text: 'La interacción quedó pendiente.'}
        : input.identity.role === 'coordinator' ? input.phase === 'plan'
        ? review ? {kind: 'plan', text: 'El Analista funcional revisará el proyecto de prueba.',
          steps: [{role: 'analyst', instruction: 'Revisa los puntos fuertes del proyecto.'}]} :
          {kind: 'plan', text: 'Arquitectura revisará el objetivo de prueba.',
            steps: [{role: 'architect', instruction: 'Explica la regla de aprobación.'}]}
        : {kind: 'complete', text: source || (review ? 'Conclusión independiente de Coordinación.' : 'Objetivo de prueba completado.'),
          markdown: source ? `${source}\n\n- [Guía del proyecto](src/recursos/gu%C3%ADa.txt:1:1)\n- [Referencia web](https://example.invalid/guia)` :
            input.task.objective.startsWith('Define la regla')
            ? ['### Resumen', 'Objetivo de prueba completado.', '1. Aplica la regla a las solicitudes.\n2. Verifica cada caso.',
              '| Comprobación | Estado | Prioridad | Evidencia |\n| --- | --- | --- | --- |\n' +
              '| Ejemplo sintético | Revisado | Alta | [Reglas del proyecto](docs/reglas-de-aprobaciones.md:15) |'].join('\n\n') : undefined}
        : browser?.name === 'Chrome' && input.identity.role === 'analyst'
          ? input.task.objective.includes('sin pestañas')
            ? {kind: 'blocker', text: 'El navegador de prueba devolvió una lista vacía de pestañas.'}
            : {kind: 'progress', text: 'Pestañas sintéticas de Chrome revisadas.'}
          : review && input.identity.role === 'analyst' ? {kind: 'progress', text: 'Informe del Analista funcional.',
            markdown: '### Opinión del Analista\n\nLa separación entre el puente y la interfaz facilita probar el flujo.\n\n- Revisé la arquitectura y el recorrido de prueba.\n- El siguiente paso es medir la cobertura del puente.'} :
            input.identity.role === 'tester' ? {kind: 'progress', text: 'Comprobación recibida en el puesto de pruebas.',
              markdown: `## Resumen\n\n${input.roleProfile.name} recibió la solicitud de prueba.\n\n- Destino confirmado.\n\n| Caso | Estado | Evidencia |\n| --- | --- | --- |\n| Envío directo | Correcto | Chat del puesto |`} :
            {kind: 'decision', text: 'Nadie puede aprobar su propio gasto.',
            markdown: '### Hallazgo\n\n- Aplica la regla en `fixtures/aprobaciones.json`.\n- Conserva el resultado de la revisión.'};
      replies.set(thread, {source: 'local', turn: randomUUID(), at: Date.now(), truncated: false,
        text: '<zen_officina>' + JSON.stringify({...input.identity, result}) + '</zen_officina>'});
      if (browser && input.identity.role === 'analyst') activeTurns.set(thread, {run: input.identity.run, ready: Date.now() + 6500});
    },
    read: async (target: CompanionTarget) => {
      const turn = activeTurns.get(target.session);
      return !turn || Date.now() >= turn.ready ? replies.get(target.session) : undefined;
    },
    readTurn: async (target: CompanionTarget, identity: {run: string}, since: number) => {
      const turn = activeTurns.get(target.session);
      return turn?.run === identity.run ? {turn: replies.get(target.session)!.turn!, state: 'working' as const, at: since} : undefined;
    },
  };
}
