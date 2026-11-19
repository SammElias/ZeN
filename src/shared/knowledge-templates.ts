import {z} from 'zod';

const id = z.uuid();
const timestamp = z.number().int().min(0).max(8640000000000000);
const tag = z.string().trim().min(1).max(48);
const lines = z.array(z.string().trim().min(1).max(240)).max(12);
const sourceUrl = z.string().trim().max(2048).refine(value => {
  if (!value) return true;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;
  } catch { return false; }
}, 'Introduce una URL http o https válida.');

export const referenceBytes = 4 * 1024 * 1024;
export const templateLibraryBytes = 16 * 1024 * 1024;
export const templateLimit = 200;
const base64 = (bytes: number) => z.string().min(4).max(Math.ceil(bytes / 3) * 4).regex(/^[A-Za-z0-9+/]+={0,2}$/);
export const TemplateImage = z.object({
  name: z.string().min(1).max(160),
  mime: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  original: base64(referenceBytes),
  thumbnail: base64(200_000),
}).strict();
export type TemplateImage = z.infer<typeof TemplateImage>;

const DraftFields = z.object({
  name: z.string().trim().max(120),
  description: z.string().max(1200),
  tags: z.array(tag).max(12),
  features: lines,
  useCases: lines,
  prompt: z.string().max(48_000),
  author: z.string().trim().max(120),
  sourceUrl: z.string().max(2048),
}).strict();

export const TemplateFields = DraftFields.extend({
  name: DraftFields.shape.name.min(1),
  description: DraftFields.shape.description.trim().min(1),
  prompt: DraftFields.shape.prompt.trim().min(1),
  sourceUrl,
}).strict();
export type TemplateFields = z.infer<typeof TemplateFields>;
export const TemplateSummary = TemplateFields.pick({name:true, description:true, tags:true}).extend({
  id, favorite: z.boolean(), createdAt: timestamp, updatedAt: timestamp, hasImage: z.boolean(),
}).strict();
export type TemplateSummary = z.infer<typeof TemplateSummary>;
export const TemplateDetail = TemplateSummary.extend(TemplateFields.shape).strict();
export type TemplateDetail = z.infer<typeof TemplateDetail>;
export const TemplateRecord = TemplateDetail.omit({hasImage:true}).extend({image: TemplateImage.optional()}).strict();
export type TemplateRecord = z.infer<typeof TemplateRecord>;

const DraftAction = z.object({
  id: id.optional(),
  expected: timestamp.optional(),
  fields: DraftFields,
  image: TemplateImage.nullable().optional(),
}).strict().refine(value => Boolean(value.id) === (value.expected !== undefined));
export const TemplateDraft = DraftAction;
export type TemplateDraft = z.infer<typeof TemplateDraft>;

const token = /\{\{([A-Za-z_][A-Za-z0-9_]{0,63})\}\}/g;
export const templateVariableLabels: Record<string,string> = {
  nombre_proyecto:'Nombre del proyecto', tipo_aplicacion:'Tipo de aplicación', objetivo:'Objetivo',
  secciones:'Secciones', color_acento:'Color de acento', tecnologia:'Tecnología',
};
export function templateVariables(prompt: string) {
  return [...new Set(Array.from(prompt.matchAll(token), match => match[1]))];
}
export function personalizeTemplate(prompt: string, values: Record<string,string>) {
  return prompt.replace(token, (whole, key) => Object.hasOwn(values, key) && values[key].trim() ? values[key].trim() : whole);
}

export const TemplateRequest = z.discriminatedUnion('type', [
  z.object({type:z.literal('list')}).strict(),
  z.object({type:z.literal('detail'), id}).strict(),
  z.object({type:z.literal('save'), draft:TemplateDraft}).strict(),
  z.object({type:z.literal('draft'), draft:TemplateDraft.nullable()}).strict(),
  z.object({type:z.literal('favorite'), id}).strict(),
  z.object({type:z.literal('delete'), id, expected:timestamp}).strict(),
  z.object({type:z.literal('duplicate'), id}).strict(),
  z.object({type:z.literal('image')}).strict(),
  z.object({type:z.literal('source'), id}).strict(),
  z.object({type:z.literal('copy'), id, values:z.record(z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,63}$/),z.string().max(1024))}).strict(),
]);
export type TemplateRequest = z.infer<typeof TemplateRequest>;
export type TemplateReply =
  | {type:'list'; items:TemplateSummary[]; draft?:TemplateDraft}
  | {type:'detail'; item:TemplateDetail}
  | {type:'image'; image:TemplateImage}
  | {type:'favorite'; favorite:boolean}
  | {type:'done'} | {type:'cancelled'};

export const emptyTemplate = ():TemplateFields => ({
  name:'', description:'', tags:[], features:[], useCases:[], prompt:'', author:'', sourceUrl:'',
});
