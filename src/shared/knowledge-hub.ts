import {z} from 'zod';
import {noteLimits} from './companion-notes';

export const kinds = ['note', 'snippet', 'project', 'resource', 'prompt'] as const;
export const languages = ['PowerShell', 'Bash', 'Python', 'C#', 'JavaScript', 'TypeScript', 'SQL', 'JSON', 'YAML', 'Azure CLI'] as const;
export const kindLabels = {note: 'Apuntes', snippet: 'Comandos', project: 'Proyectos', resource: 'Recursos', prompt: 'Prompts'};
export const singularLabels = {note: 'Apunte', snippet: 'Comando', project: 'Proyecto', resource: 'Recurso', prompt: 'Prompt'};
export const collectionGroups = ['folder', 'technology', 'ai'] as const;
export const collections = {
  folder: ['AI Agents', 'RAG & Vector DB', 'MCP & Tools', 'Azure & Cloud', 'Power Platform', 'Backend Development', 'Architecture', 'DevOps'],
  technology: ['AI Engineering', 'Azure AI', 'Power Platform', 'Dataverse', 'Copilot Studio', 'Python', 'C# / .NET', 'React / TypeScript', 'Git & DevOps'],
  ai: ['LLM Fundamentals', 'Prompt Engineering', 'AI Agents', 'Tool Calling', 'MCP', 'RAG', 'Embeddings', 'Vector Databases', 'Memory & Context', 'AI Security', 'Evaluation & Observability', 'Azure AI', 'OpenAI APIs', 'Multi-agent Architecture'],
};

const id = z.uuid();
const date = z.number().int().min(0).max(8640000000000000);
const short = z.string().max(160);
const detail = z.string().max(4000);
const url = z.url({protocol: /^https?$/});
export const HubImage = z.object({
  id,
  name: short,
  data: z.string().max(730_000).regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/),
}).strict();
export type HubImage = z.infer<typeof HubImage>;

export const HubFolder = z.object({
  id,
  name: z.string().trim().min(1).max(noteLimits.folder),
  group: z.enum(collectionGroups),
}).strict();
export type HubFolder = z.infer<typeof HubFolder>;

export const HubFields = z.object({
  kind: z.enum(kinds),
  folderId: id.nullable(),
  title: z.string().trim().min(1).max(noteLimits.title),
  description: z.string().max(noteLimits.description),
  code: z.string().max(noteLimits.code),
  tags: z.array(z.string().trim().min(1).max(48)).max(16),
  favorite: z.boolean(),
  language: z.enum(languages).or(z.literal('')),
  explanation: detail,
  requirements: detail,
  warnings: detail,
  example: detail,
  url: z.union([z.literal(''), url.max(2048)]),
  model: short,
  technologies: z.array(z.string().trim().min(1).max(48)).max(16),
  status: z.enum(['planned', 'active', 'done', 'paused']),
  related: z.array(id).max(100),
  images: z.array(HubImage).max(4),
}).strict();
export type HubFields = z.infer<typeof HubFields>;

export const HubEntry = HubFields.extend({id, createdAt: date, updatedAt: date, copiedAt: date.optional()}).strict();
export type HubEntry = z.infer<typeof HubEntry>;
export const HubData = z.object({
  version: z.literal(2),
  theme: z.enum(['light', 'dark']),
  folders: z.array(HubFolder).max(150),
  entries: z.array(HubEntry).max(2500),
}).strict();
export type HubData = z.infer<typeof HubData>;
export const HubDraft = z.object({
  id: id.optional(),
  expected: date.optional(),
  fields: HubFields.extend({title: z.string().max(noteLimits.title)}),
}).strict();
export type HubDraft = z.infer<typeof HubDraft>;
export type HubSession = {data: HubData; draft?: HubDraft};

export const HubAction = z.discriminatedUnion('type', [
  z.object({type: z.literal('save'), id: id.optional(), expected: date.optional(), fields: HubFields}).strict(),
  z.object({type: z.literal('duplicate'), id}).strict(),
  z.object({type: z.literal('favorite'), id}).strict(),
  z.object({type: z.literal('remove'), id}).strict(),
  z.object({type: z.literal('folder'), id: id.optional(), name: HubFolder.shape.name, group: HubFolder.shape.group}).strict(),
  z.object({type: z.literal('reorder'), id, direction: z.enum(['up', 'down'])}).strict(),
  z.object({type: z.literal('removeFolder'), id}).strict(),
  z.object({type: z.literal('theme'), theme: HubData.shape.theme}).strict(),
  z.object({type: z.literal('copy'), id, values: z.record(z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,63}$/), z.string().max(1024))}).strict(),
]);
export type HubAction = z.infer<typeof HubAction>;
export type HubResult = {data: HubData; id?: string};
export const HubFileAction = z.discriminatedUnion('type', [
  z.object({type: z.literal('image')}).strict(),
  z.object({type: z.literal('export')}).strict(),
  z.object({type: z.literal('import')}).strict(),
  z.object({type: z.literal('markdown'), id}).strict(),
  z.object({type: z.literal('url'), url: url.max(2048)}).strict(),
]);
export type HubFileAction = z.infer<typeof HubFileAction>;
export type HubFileResult = {type: 'image'; image: HubImage} | {type: 'import'; data: HubData} | {type: 'done'} | {type: 'cancelled'};

export const newFields = (kind: HubFields['kind'], folderId: string | null = null): HubFields => ({
  kind, folderId, title: '', description: '', code: '', tags: [], favorite: false, language: '',
  explanation: '', requirements: '', warnings: '', example: '', url: '', model: '',
  technologies: [], status: 'planned', related: [], images: [],
});

export function variables(text: string) {
  return [...new Set([...text.matchAll(/\{\{([A-Za-z_][A-Za-z0-9_]{0,63})\}\}/g)].map(match => match[1]))];
}

export const technicalTemplate = [
  'Concepto', 'Cómo funciona', 'Arquitectura', 'Implementación', 'Ejemplo de código',
  'Casos de uso', 'Limitaciones', 'Seguridad', 'Enlaces útiles',
].map(title => '## ' + title).join('\n\n') + '\n';
