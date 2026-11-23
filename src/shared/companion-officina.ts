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
export const OfficinaParticipant = z.enum(['coordinator', ...OfficinaRole.options]);
export type OfficinaParticipant = z.infer<typeof OfficinaParticipant>;
export const OfficinaActor = z.enum([...OfficinaParticipant.options, 'observer']);
export type OfficinaActor = z.infer<typeof OfficinaActor>;
export const officinaActorName = (role: OfficinaActor, project?: Pick<OfficinaProject, 'profiles'>) =>
  role === 'observer' ? 'ZEN' : project?.profiles?.[role]?.name ?? (role === 'coordinator' ? 'Coordinación' : officinaRoles[role].name);
export const OfficinaId = z.uuid();
const text = (max: number) => z.string().trim().min(1).max(max)
  .refine(value => !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f\uD800-\uDFFF]/u.test(value));
export const officinaRoleNameLimit = 40;
export const officinaRolePromptLimit = 1600;
export const OfficinaRoleProfile = z.object({
  name: text(officinaRoleNameLimit).refine(value => !/[\r\n\t]/u.test(value)),
  prompt: text(officinaRolePromptLimit),
}).strict();
export type OfficinaRoleProfile = z.infer<typeof OfficinaRoleProfile>;
export const officinaReplySummaryLimit = 700;
export const officinaReplyMarkdownLimit = 4000;
export const officinaMessageLimit = 800;
export const officinaPasteLimit = 32_000;
export const officinaMaxImages = 3;
const pastedImage = z.string().max(3_000_000).regex(/^data:image\/jpeg;base64,[a-z0-9+/]+={0,2}$/i);
const pastedText = z.string().min(1).max(officinaPasteLimit)
  .refine(value => !!value.trim() && !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f\uD800-\uDFFF]/u.test(value));
export function officinaPasteTitle(value: string) {
  return value.trimStart().split(/\r?\n/, 1)[0].replace(/^#{1,6}\s+/u, '')
    .slice(0, 120).replace(/[\uD800-\uDBFF]$/u, '').trim() || 'Texto pegado';
}
const replyMarkdown = text(officinaReplyMarkdownLimit).optional();
const response = {text: text(officinaReplySummaryLimit), markdown: replyMarkdown};
export const officinaObserverProposalLimit = 4;
const proposalIndex = z.number().int().min(0).max(officinaObserverProposalLimit - 1);
const proposalFields = {title: text(120), evidence: text(500), validation: text(300)};
const observerProposal = z.discriminatedUnion('kind', [
  z.object({kind: z.literal('prompt'), ...proposalFields, role: OfficinaParticipant, prompt: text(officinaRolePromptLimit)}).strict(),
  z.object({kind: z.literal('process'), ...proposalFields, recommendation: text(800)}).strict(),
]);
const observerReport = z.object({kind: z.literal('observation'), ...response,
  proposals: z.array(observerProposal).max(officinaObserverProposalLimit)}).strict();
const observerFollowupReport = z.object({kind: z.literal('followup'), ...response,
  outcome: z.enum(['done', 'limited'])}).strict();
const observerReview = z.object({
  id: OfficinaId, scope: OfficinaId.optional(), at: z.number(), source: z.literal('monitor').optional(),
  incident: z.enum(['reply-format', 'delivery-check']).optional(),
  baseline: z.partialRecord(OfficinaParticipant, text(officinaRolePromptLimit)).optional(),
  report: observerReport.optional(),
  decisions: z.array(z.object({index: proposalIndex, status: z.enum(['approved', 'rejected']), at: z.number()})).max(officinaObserverProposalLimit).optional(),
});
export type OfficinaObserverReview = z.infer<typeof observerReview>;
const attachment = z.object({version: text(100), link: text(360), next: text(360)}).strict();
export const OfficinaTaskFields = z.object({
  title: text(120), objective: text(800), criteria: text(800), owner: OfficinaRole,
}).strict();
export const OfficinaTaskStatus = z.enum(['pending', 'active', 'blocked', 'done']);
export const officinaTaskLabels = {pending: 'Pendiente', active: 'En curso', blocked: 'Bloqueada', done: 'Cerrada'} as const;
export type OfficinaTaskStatus = z.infer<typeof OfficinaTaskStatus>;

export const OfficinaContribution = z.discriminatedUnion('kind', [
  z.object({kind: z.literal('progress'), ...response}).strict(),
  z.object({kind: z.literal('decision'), ...response, replyTo: OfficinaId.optional()}).strict(),
  z.object({kind: z.literal('blocker'), ...response, replyTo: OfficinaId.optional()}).strict(),
  z.object({kind: z.literal('question'), ...response, to: OfficinaRole, act: z.boolean()}).strict(),
  z.object({kind: z.literal('answer'), ...response, replyTo: OfficinaId}).strict(),
  z.object({kind: z.literal('handoff'), ...response, to: OfficinaRole, act: z.boolean(), artifact: attachment}).strict(),
  z.object({kind: z.literal('qa'), ...response, replyTo: OfficinaId, passed: z.boolean(), evidence: text(360)}).strict(),
]);
export type OfficinaContribution = z.infer<typeof OfficinaContribution>;
export const OfficinaEvent = z.object({
  id: OfficinaId, task: OfficinaId, from: OfficinaRole, at: z.number(),
  source: z.enum(['user', 'codex']), data: OfficinaContribution,
});
export type OfficinaEvent = z.infer<typeof OfficinaEvent>;

const windowsFolder = text(1024).refine(value => /^(?:[a-z]:[\\/]|\\\\[^\\/]+[\\/][^\\/]+)/i.test(value) && !/[\r\n]/.test(value));
export const officinaMaxFiles = 8;
export const OfficinaLocalSource = z.object({id: OfficinaId, name: text(260), path: windowsFolder,
  device: z.string().regex(/^\d+$/), inode: z.string().regex(/^\d+$/), sha256: z.string().regex(/^[a-f0-9]{64}$/).optional()}).strict();
export type OfficinaLocalSource = z.infer<typeof OfficinaLocalSource>;
type SourceLabel = Pick<OfficinaLocalSource, 'id' | 'name' | 'path'>;
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
export const officinaStepInstructionLimit = 800;
export const OfficinaStep = z.object({role: OfficinaRole, instruction: text(officinaStepInstructionLimit)}).strict();
export type OfficinaStep = z.infer<typeof OfficinaStep>;
const goalMessage = z.object({
  from: z.enum(['human', 'codex', 'zen']), text: text(900), markdown: replyMarkdown,
  reply: z.object({run: OfficinaId, kind: z.enum(['plan', 'complete', 'limited', 'question'])}).optional(),
});
export type OfficinaGoalMessage = z.infer<typeof goalMessage>;
const goal = z.object({
  task: OfficinaId, request: text(officinaMessageLimit), steps: z.array(OfficinaStep).max(20), cursor: z.number().int().min(0),
  round: z.number().int().min(0), history: z.array(goalMessage).max(32),
  phase: z.enum(['plan', 'work', 'verify', 'complete']), outcome: z.literal('limited').optional(), question: text(700).optional(),
  recipient: OfficinaRole.optional(),
  improvement: OfficinaId.optional(),
  improvementNoticeDismissed: z.literal(true).optional(),
  files: z.array(OfficinaLocalSource).max(officinaMaxFiles).optional(),
  images: z.array(OfficinaLocalSource.required({sha256: true})).max(officinaMaxImages).optional(),
  pastedText: pastedText.optional(),
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
  sentAt: z.number().optional(), queuedAt: z.number().optional(), turn: z.string().max(160).optional(), issue: z.string().optional(),
  retryAttempt: z.number().int().min(1).max(4).optional(), retryAt: z.number().optional(),
  closureRetried: z.literal(true).optional(),
  followup: z.object({review: OfficinaId, index: proposalIndex, result: observerFollowupReport.optional()}).optional(),
});
export type OfficinaRun = z.infer<typeof run>;
export type OfficinaRunIdentity = {project: string; task: string; role: OfficinaActor; run: string};
export function officinaInputMatches(text: string, identity: OfficinaRunIdentity) {
  if (!text.includes(identity.run)) return false;
  try {
    const recorded = JSON.parse(text.trimEnd().split('\n').at(-1)!).identity;
    return recorded?.run === identity.run && recorded?.task === identity.task &&
      recorded?.project === identity.project && recorded?.role === identity.role;
  } catch { return false; }
}
export type OfficinaRunActivity = {run: string; state: 'working' | 'permission' | 'finished' | 'interrupted'; at: number; turn?: string};
export type OfficinaDirectActivity = {state: OfficinaRunActivity['state']; at: number};
export const OfficinaProject = z.object({
  id: OfficinaId, name: text(120), binding: OfficinaBinding.optional(), team: provision.optional(),
  folder: OfficinaLocalSource.optional(),
  queueEnabled: z.boolean().optional(),
  profiles: z.partialRecord(OfficinaActor, OfficinaRoleProfile).optional(),
  reviews: z.array(observerReview).max(450).optional(),
  autoImprovements: z.object({enabled: z.boolean(), since: z.number()}).optional(),
  goals: z.array(goal).max(100).optional(),
  tasks: z.array(task).max(150), events: z.array(OfficinaEvent).max(1800), runs: z.array(run).max(450),
});
export type OfficinaProject = z.infer<typeof OfficinaProject>;
export type OfficinaView = {
  projects: Pick<OfficinaProject, 'id' | 'name'>[];
  project?: OfficinaProject;
  activity?: OfficinaRunActivity;
  directActivity?: Partial<Record<OfficinaActor, OfficinaDirectActivity>>;
  enabled: boolean;
  observerQueued?: string[];
  dispatchBlock?: string;
  context?: {folder?: SourceLabel; folderProject?: string; files: SourceLabel[]};
};

export const OfficinaAction = z.discriminatedUnion('type', [
  z.object({type: z.literal('read')}).strict(),
  z.object({type: z.literal('select'), project: OfficinaId}).strict(),
  z.object({type: z.literal('project'), name: text(120)}).strict(),
  z.object({type: z.literal('delete-project'), project: OfficinaId}).strict(),
  z.object({type: z.literal('chat'), project: OfficinaId.nullable().optional(), role: OfficinaParticipant.optional(),
    name: text(120), message: text(officinaMessageLimit).optional(), pastedText: pastedText.optional(),
    images: z.array(pastedImage).max(officinaMaxImages).optional(), id: OfficinaId})
    .strict().refine(value => !!(value.message || value.pastedText || value.images?.length)),
  z.object({type: z.literal('pick-context'), kind: z.enum(['folder', 'file'])}).strict(),
  z.object({type: z.literal('remove-context'), id: OfficinaId}).strict(),
  z.object({type: z.literal('answer-goal'), project: OfficinaId, task: OfficinaId, message: text(700)}).strict(),
  z.object({type: z.literal('retry-closure'), project: OfficinaId, task: OfficinaId, run: OfficinaId}).strict(),
  z.object({type: z.literal('retry-send'), project: OfficinaId, task: OfficinaId, run: OfficinaId}).strict(),
  z.object({type: z.literal('resume-browser-review'), project: OfficinaId, task: OfficinaId}).strict(),
  z.object({type: z.literal('open-team-chat'), project: OfficinaId, role: OfficinaActor}).strict(),
  z.object({type: z.literal('role-profile'), project: OfficinaId, role: OfficinaActor, profile: OfficinaRoleProfile.nullable()}).strict(),
  z.object({type: z.literal('observe-team'), project: OfficinaId, id: OfficinaId, task: OfficinaId.optional()}).strict(),
  z.object({type: z.literal('auto-improvements'), project: OfficinaId, enabled: z.boolean()}).strict(),
  z.object({type: z.literal('dismiss-improvement'), project: OfficinaId, task: OfficinaId}).strict(),
  z.object({type: z.literal('decide-observation'), project: OfficinaId, id: OfficinaId, index: proposalIndex,
    decision: z.enum(['approved', 'rejected'])}).strict(),
  z.object({type: z.literal('follow-observation'), project: OfficinaId, id: OfficinaId, index: proposalIndex}).strict(),
  z.object({type: z.literal('open-run-chat'), project: OfficinaId, task: OfficinaId, run: OfficinaId}).strict(),
  z.object({type: z.literal('open-reference'), project: OfficinaId, task: OfficinaId.optional(),
    target: text(2048), mode: z.enum(['browser', 'editor', 'explorer'])}).strict(),
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
    z.object({kind: z.literal('plan'), ...response, steps: z.array(OfficinaStep).min(1).max(5)}).strict(),
    z.object({kind: z.literal('complete'), ...response}).strict(),
    z.object({kind: z.literal('limited'), ...response}).strict(),
    z.object({kind: z.literal('question'), ...response}).strict(),
  ]),
}).strict();
export type OfficinaCoordinatorResult = z.infer<typeof OfficinaCoordinatorResult>;
export const OfficinaObserverResult = z.object({
  project: OfficinaId, task: OfficinaId, run: OfficinaId, role: z.literal('observer'),
  result: z.discriminatedUnion('kind', [observerReport, observerFollowupReport]),
}).strict();
export type OfficinaObserverResult = z.infer<typeof OfficinaObserverResult>;

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
