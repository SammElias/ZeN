import {z} from 'zod';

export const officinaRoles = {
  analyst: {name: 'Analista funcional', brief: 'Investiga fuentes, revisa contenido y convierte el objetivo en hallazgos, requisitos o criterios comprobables.'},
  architect: {name: 'Arquitecto', brief: 'Diseña soluciones, datos, permisos e integraciones cuando el objetivo requiere una decisión técnica.'},
  developer: {name: 'Desarrollador', brief: 'Implementa los cambios autorizados y entrega una versión identificable.'},
  tester: {name: 'Tester', brief: 'Contrasta los resultados con los criterios y registra la evidencia disponible.'},
  alm: {name: 'ALM', brief: 'Revisa dependencias, configuración y preparación para entregar o desplegar cambios.'},
} as const;

export const OfficinaRole = z.enum(Object.keys(officinaRoles) as (keyof typeof officinaRoles)[]);
export type OfficinaRole = z.infer<typeof OfficinaRole>;
export const OfficinaActor = z.enum(['coordinator', ...OfficinaRole.options]);
export type OfficinaActor = z.infer<typeof OfficinaActor>;
export const officinaActorName = (role: OfficinaActor) => role === 'coordinator' ? 'Coordinación' : officinaRoles[role].name;
export const OfficinaId = z.uuid();
const text = (max: number) => z.string().trim().min(1).max(max)
  .refine(value => !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f\uD800-\uDFFF]/u.test(value));
const attachment = z.object({version: text(100), link: text(360), next: text(360)}).strict();
export const OfficinaTaskFields = z.object({
  title: text(120), objective: text(800), criteria: text(800), owner: OfficinaRole,
}).strict();
export const OfficinaTaskStatus = z.enum(['pending', 'active', 'blocked', 'done']);
export const officinaTaskLabels = {pending: 'Pendiente', active: 'En curso', blocked: 'Bloqueada', done: 'Cerrada'} as const;
export type OfficinaTaskStatus = z.infer<typeof OfficinaTaskStatus>;

export const OfficinaContribution = z.discriminatedUnion('kind', [
  z.object({kind: z.literal('progress'), text: text(700)}).strict(),
  z.object({kind: z.literal('decision'), text: text(700), replyTo: OfficinaId.optional()}).strict(),
  z.object({kind: z.literal('blocker'), text: text(700)}).strict(),
  z.object({kind: z.literal('question'), text: text(700), to: OfficinaRole, act: z.boolean()}).strict(),
  z.object({kind: z.literal('answer'), text: text(700), replyTo: OfficinaId}).strict(),
  z.object({kind: z.literal('handoff'), text: text(700), to: OfficinaRole, act: z.boolean(), artifact: attachment}).strict(),
  z.object({kind: z.literal('qa'), text: text(700), replyTo: OfficinaId, passed: z.boolean(), evidence: text(360)}).strict(),
]);
export type OfficinaContribution = z.infer<typeof OfficinaContribution>;
export const OfficinaEvent = z.object({
  id: OfficinaId, task: OfficinaId, from: OfficinaRole, at: z.number(),
  source: z.enum(['user', 'codex']), data: OfficinaContribution,
});
export type OfficinaEvent = z.infer<typeof OfficinaEvent>;

const windowsFolder = text(1024).refine(value => /^(?:[a-z]:[\\/]|\\\\[^\\/]+[\\/][^\\/]+)/i.test(value) && !/[\r\n]/.test(value));
export const OfficinaBinding = z.object({thread: OfficinaId, cwd: windowsFolder, environment: text(120)}).strict();
export type OfficinaBinding = z.infer<typeof OfficinaBinding>;
const destination = OfficinaBinding.extend({projectId: z.string().min(1).max(200).optional()});
export type OfficinaDestination = z.infer<typeof destination>;
const provision = z.object({
  projectId: z.string().min(1).max(200).optional(), cwd: windowsFolder.optional(),
  threads: z.partialRecord(OfficinaActor, OfficinaId),
  pending: z.object({role: OfficinaActor, thread: OfficinaId.optional()}).optional(), issue: text(700).optional(),
});
export type OfficinaTeam = z.infer<typeof provision>;
export const OfficinaStep = z.object({role: OfficinaRole, instruction: text(500)}).strict();
export type OfficinaStep = z.infer<typeof OfficinaStep>;
const goal = z.object({
  task: OfficinaId, request: text(800), steps: z.array(OfficinaStep).max(20), cursor: z.number().int().min(0),
  round: z.number().int().min(0), history: z.array(z.object({from: z.enum(['human', 'codex', 'zen']), text: text(900)})).max(32),
  phase: z.enum(['plan', 'work', 'verify', 'complete']), outcome: z.literal('limited').optional(), question: text(700).optional(),
});
export type OfficinaGoal = z.infer<typeof goal>;
const task = OfficinaTaskFields.extend({id: OfficinaId, status: OfficinaTaskStatus});
export type OfficinaTask = z.infer<typeof task>;

export const officinaRunLabels = {
  waiting: 'En cola local', sending: 'Enviando', sent: 'Enviado a Codex', uncertain: 'Revisar envío en Codex',
  completed: 'Completado', review: 'Revisar respuesta en Codex', released: 'Cola liberada', skipped: 'Omitido por cierre',
} as const;
const run = z.object({
  id: OfficinaId, task: OfficinaId, role: OfficinaActor, event: OfficinaId.optional(), depth: z.number(),
  state: z.enum(Object.keys(officinaRunLabels) as (keyof typeof officinaRunLabels)[]),
  step: z.number().int().nonnegative().optional(), destination: destination.optional(),
  sentAt: z.number().optional(), turn: z.string().max(160).optional(), issue: z.string().optional(),
});
export type OfficinaRun = z.infer<typeof run>;
export type OfficinaRunIdentity = {project: string; task: string; role: OfficinaActor; run: string};
export type OfficinaRunActivity = {run: string; state: 'working' | 'permission' | 'finished' | 'interrupted'; at: number};
export const OfficinaProject = z.object({
  id: OfficinaId, name: text(120), binding: OfficinaBinding.optional(), team: provision.optional(),
  goals: z.array(goal).max(100).optional(),
  tasks: z.array(task).max(150), events: z.array(OfficinaEvent).max(1800), runs: z.array(run).max(450),
});
export type OfficinaProject = z.infer<typeof OfficinaProject>;
export type OfficinaView = {
  projects: Pick<OfficinaProject, 'id' | 'name'>[];
  project?: OfficinaProject;
  activity?: OfficinaRunActivity;
  enabled: boolean;
  dispatchBlock?: string;
};

export const OfficinaAction = z.discriminatedUnion('type', [
  z.object({type: z.literal('read')}).strict(),
  z.object({type: z.literal('select'), project: OfficinaId}).strict(),
  z.object({type: z.literal('project'), name: text(120)}).strict(),
  z.object({type: z.literal('chat'), name: text(120), message: text(800), id: OfficinaId}).strict(),
  z.object({type: z.literal('answer-goal'), project: OfficinaId, task: OfficinaId, message: text(700)}).strict(),
  z.object({type: z.literal('resume-browser-review'), project: OfficinaId, task: OfficinaId}).strict(),
  z.object({type: z.literal('open-team-chat'), project: OfficinaId, role: OfficinaActor}).strict(),
  z.object({type: z.literal('open-team-project'), project: OfficinaId}).strict(),
  z.object({type: z.literal('copy-team-project-path'), project: OfficinaId}).strict(),
  z.object({type: z.literal('bind'), project: OfficinaId, binding: OfficinaBinding}).strict(),
  z.object({type: z.literal('queue'), project: OfficinaId, enabled: z.boolean()}).strict(),
  z.object({type: z.literal('task'), project: OfficinaId, fields: OfficinaTaskFields, dispatch: z.boolean()}).strict(),
  z.object({type: z.literal('edit'), project: OfficinaId, task: OfficinaId, fields: OfficinaTaskFields, status: OfficinaTaskStatus}).strict(),
  z.object({type: z.literal('assign'), project: OfficinaId, task: OfficinaId, role: OfficinaRole}).strict(),
  z.object({type: z.literal('contribute'), project: OfficinaId, task: OfficinaId, role: OfficinaRole, nonce: OfficinaId, data: OfficinaContribution}).strict(),
  z.object({type: z.literal('release'), project: OfficinaId, run: OfficinaId}).strict(),
]);
export type OfficinaAction = z.infer<typeof OfficinaAction>;
export const OfficinaCodexResult = z.object({
  project: OfficinaId, task: OfficinaId, run: OfficinaId, role: OfficinaRole, result: OfficinaContribution,
}).strict();
export const OfficinaCoordinatorResult = z.object({
  project: OfficinaId, task: OfficinaId, run: OfficinaId, role: z.literal('coordinator'),
  result: z.discriminatedUnion('kind', [
    z.object({kind: z.literal('plan'), text: text(700), steps: z.array(OfficinaStep).min(1).max(5)}).strict(),
    z.object({kind: z.literal('complete'), text: text(700)}).strict(),
    z.object({kind: z.literal('limited'), text: text(700)}).strict(),
    z.object({kind: z.literal('question'), text: text(700)}).strict(),
  ]),
}).strict();
export type OfficinaCoordinatorResult = z.infer<typeof OfficinaCoordinatorResult>;

export const officinaEventLabels = {
  progress: 'Avance', decision: 'Resolución', blocker: 'Limitación',
  question: 'Pregunta', answer: 'Respuesta', handoff: 'Traspaso', qa: 'Resultado de QA',
} as const;

export function officinaOpenItems(events: readonly OfficinaEvent[]) {
  const resolved = new Set(events.flatMap(({data}) =>
    (data.kind === 'decision' || data.kind === 'answer') && data.replyTo ? [data.replyTo] : []));
  return events.filter(({id, data}) => (data.kind === 'blocker' || data.kind === 'question') && !resolved.has(id));
}

export function officinaDeliveryQa(events: readonly OfficinaEvent[], taskId: string) {
  const delivery = events.filter(event => event.task === taskId && event.from === 'developer' &&
    event.data.kind === 'handoff' && event.data.to === 'tester').at(-1);
  if (!delivery || delivery.data.kind !== 'handoff') return undefined;
  const result = events.filter(event => event.task === taskId && event.data.kind === 'qa' && event.data.replyTo === delivery.id).at(-1)?.data;
  return {version: delivery.data.artifact.version, passed: result?.kind === 'qa' ? result.passed : undefined};
}

export function officinaQa(events: readonly OfficinaEvent[], taskId: string) {
  const qa = officinaDeliveryQa(events, taskId);
  if (!qa) return 'QA pendiente de una versión de Desarrollo';
  if (qa.passed === undefined) return `QA pendiente para ${qa.version}`;
  return qa.passed ? `QA validó ${qa.version}` : `QA bloqueó ${qa.version}`;
}
