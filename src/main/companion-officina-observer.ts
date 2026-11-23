import {createHash, randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {OfficinaParticipant, officinaActorName, type OfficinaObserverReview, type OfficinaProject, type OfficinaRun} from '../shared/companion-officina';
import {CodexRequest} from '../shared/companion-request';
import {officinaRoleInstructions, officinaRoleProfile, officinaOutputInstructions, officinaTurnProtocol} from '../shared/officina-instructions';
import {officinaApprovedImprovement, officinaObservationTaskLimit, officinaObservationTasks} from '../shared/officina-observer';

export function officinaObserveTurn(project: OfficinaProject, review: OfficinaObserverReview, run: OfficinaRun, directory: string) {
  const identity = {project: project.id, task: run.task, run: run.id, role: 'observer'};
  const available = officinaObservationTasks(project);
  const tasks = review.scope ? available.filter(task => task.id === review.scope) : available.slice(0, officinaObservationTaskLimit);
  if (!tasks.length || !review.baseline) return;
  const evidence = JSON.stringify({
    identity, project: project.name, availableTasks: available.length,
    profiles: OfficinaParticipant.options.map(role => ({role, name: officinaRoleProfile(role, project).name, prompt: review.baseline?.[role]})),
    tasks: tasks.map(task => {
      const goal = project.goals?.find(item => item.task === task.id);
      const events = project.events.filter(event => event.task === task.id);
      const runs = project.runs.filter(item => item.task === task.id);
      return {task, outcome: goal?.outcome, steps: goal?.steps, pending: goal?.question,
        history: goal?.history.slice(-12), historyCount: goal?.history.length,
        events: events.slice(-16).map(({id, from, at, source, data}) => ({id, from, at, source,
          kind: data.kind, summary: data.text, report: data.markdown,
          ...('replyTo' in data && {replyTo: data.replyTo}),
          ...('to' in data && {to: data.to}),
          ...(data.kind === 'handoff' && {version: data.artifact.version, next: data.artifact.next}),
          ...(data.kind === 'qa' && {passed: data.passed, evidence: data.evidence})})),
        eventCount: events.length,
        runs: runs.slice(-24).map(({id, role, state, step, event, issue}) => ({id, role, state, step, event, issue})),
        runCount: runs.length};
    }),
  });
  const digest = createHash('sha256').update(evidence).digest('hex');
  const path = join(directory, `${run.id}-${digest.slice(0, 20)}.json`);
  const prompt = [officinaRoleInstructions('observer'), officinaTurnProtocol('observer'), officinaOutputInstructions,
    'Lee exclusivamente evidence. Comprueba su identity y usa los recuentos para reconocer cuándo la muestra es parcial.',
    JSON.stringify({identity, roleProfile: officinaRoleProfile('observer', project), evidence: path})].join('\n');
  if (CodexRequest.safeParse(prompt).success) return {prompt, evidence: {path, text: evidence}};
}

export function officinaFollowupTurn(project: OfficinaProject, run: OfficinaRun, directory: string) {
  if (!run.followup) return;
  const improvement = officinaApprovedImprovement(project, run.followup);
  if (!improvement) return;
  const {review, proposal, approved} = improvement;
  const identity = {project: project.id, task: run.task, run: run.id, role: 'observer'};
  const scope = project.tasks.find(task => task.id === review.scope);
  const history = scope ? project.events.filter(event => event.task === scope.id).slice(-12) : [];
  const evidence = JSON.stringify({identity, project: project.name, scope, proposal,
    observation: review.report?.text, history});
  const path = join(directory, `${run.id}-${createHash('sha256').update(evidence).digest('hex').slice(0, 20)}.json`);
  const prompt = [
    officinaRoleInstructions('observer'),
    'Este turno es el seguimiento de una recomendación que el usuario aprobó en Officina. Actúa ahora dentro de la recomendación guardada. Usa la evidencia y la carpeta del proyecto únicamente para ese trabajo.',
    'Si la mejora es una comprobación, ejecuta las pruebas de lectura disponibles y registra versión, comandos o recorrido y evidencia. Si pide cambiar procesos, instrucciones o archivos, prepara el texto concreto o un plan reproducible para revisión humana. Conserva el QA y los informes originales. Distingue las pruebas que ejecutaste de las que quedan pendientes. Respeta el sandbox y las aprobaciones vigentes.',
    'Devuelve solo <zen_officina>JSON</zen_officina>. Copia project, task, run y role de identity. Devuelve result={kind:"followup",outcome:"done" o "limited",text:"resumen",markdown:"resultado detallado"}. Usa limited si una comprobación necesaria quedó sin ejecutar. No incluyas una lista de nuevas propuestas.',
    officinaOutputInstructions,
    JSON.stringify({identity, evidence: path, improvement: {title: proposal.title, recommendation: proposal.recommendation,
      approvalTime: approved.at}, ...(scope && {scope: scope.title})}),
  ].join('\n');
  if (CodexRequest.safeParse(prompt).success) return {prompt, evidence: {path, text: evidence}};
}

export function queueOfficinaFollowup(project: OfficinaProject, review: string, index: number) {
  const followup = {review, index};
  if (!officinaApprovedImprovement(project, followup)) throw Error('La recomendación no tiene una aprobación disponible.');
  const saved = project.runs.find(run => run.role === 'observer' && run.followup?.review === review && run.followup.index === index);
  if (saved) {
    if (saved.state !== 'waiting' && (saved.state !== 'review' || saved.sentAt !== undefined)) return;
    saved.state = 'waiting';
    saved.issue = undefined;
    return saved.id;
  }
  const id = randomUUID();
  project.runs.push({id, task: id, role: 'observer', depth: 0, state: 'waiting', followup});
  return id;
}

export function decideOfficinaObservation(project: OfficinaProject, review: OfficinaObserverReview | undefined,
  index: number, status: 'approved' | 'rejected', at: number) {
  const proposal = review?.report?.proposals[index];
  if (!review || !proposal || review.decisions?.some(decision => decision.index === index)) {
    throw Error('La propuesta ya no está pendiente.');
  }
  if (status === 'approved' && proposal.kind === 'prompt') {
    const current = officinaRoleProfile(proposal.role, project);
    if (current.prompt !== review.baseline?.[proposal.role]) {
      throw Error('El prompt cambió desde la revisión. Solicita otra revisión antes de aplicar un cambio.');
    }
    project.profiles = {...project.profiles, [proposal.role]: {...current, prompt: proposal.prompt}};
  }
  review.decisions = [...(review.decisions ?? []), {index, status, at}];
}

export function recordOfficinaIncident(project: OfficinaProject, run: OfficinaRun, at: number, limitation?: string) {
  if (run.role === 'observer' || project.reviews?.some(review => review.id === run.id) ||
    !project.tasks.some(task => task.id === run.task)) return;
  const role = officinaActorName(run.role, project);
  const text = limitation ? `${role} dejó una comprobación pendiente de la entrega.` :
    `Codex terminó el turno de ${role}. Officina no pudo registrar la respuesta con el formato del encargo.`;
  const proposal = limitation ? {
    title: 'Preparar una comprobación independiente de la entrega',
    evidence: limitation.slice(0, 500).replace(/[\uD800-\uDBFF]$/u, ''),
    recommendation: 'Incluye en el siguiente encargo un método disponible para repetir la prueba y conserva la comprobación como pendiente hasta tener evidencia.',
    validation: 'El informe identifica la misma versión, el recorrido probado y la evidencia obtenida.',
  } : {
    title: 'Validar el formato antes de entregar la respuesta',
    evidence: 'La conversación y el turno coinciden con el encargo. El resultado final no cumple el contrato de Officina.',
    recommendation: 'Revisa la respuesta en Codex y añade a las instrucciones del puesto un ejemplo del tipo de resultado que necesitaba este turno.',
    validation: 'Una respuesta del mismo tipo se registra y puede consultarse desde la tarea.',
  };
  project.reviews = [...(project.reviews ?? []), {id: run.id, scope: run.task, at, source: 'monitor',
    report: {kind: 'observation', text, proposals: [{kind: 'process', ...proposal}]}}];
}
