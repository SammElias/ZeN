import {z} from 'zod';

const heading = z.string().trim().min(1).max(140);
const detail = z.string().trim().min(1).max(2400);
const source = z.object({
  path: z.string().trim().min(1).max(400),
  line: z.number().int().positive().max(1_000_000),
  excerpt: z.string().max(1200).optional(),
}).strict();
const item = z.object({title: heading, detail}).strict();
const document = z.object({version: z.literal(1), title: heading, summary: detail});

export const CodexDocumentFormat = z.enum(['report', 'plan', 'comparison']);
export type CodexDocumentFormat = z.infer<typeof CodexDocumentFormat>;
export const CodexReferenceSelection = z.object({id: z.string().uuid(), finding: z.number().int().min(0).max(11), source: z.number().int().min(0).max(4)}).strict();
export type CodexReferenceSelection = z.infer<typeof CodexReferenceSelection>;

const result = z.discriminatedUnion('type', [
  document.extend({type: z.literal('report'), findings: z.array(item.extend({sources: z.array(source).max(5).optional()})).min(1).max(12)}).strict(),
  document.extend({type: z.literal('plan'), steps: z.array(item).min(1).max(16)}).strict(),
  document.extend({type: z.literal('comparison'), columns: z.array(heading).min(2).max(5), rows: z.array(z.array(z.string().trim().min(1).max(600)).min(2).max(5)).min(1).max(16)}).strict(),
]).refine(value => value.type !== 'comparison' || value.rows.every(row => row.length === value.columns.length));

export type CodexResultDocument = z.infer<typeof result>;

export function parseCodexResultDocument(text: string): CodexResultDocument | undefined {
  if (text.length > 64_000) return;
  const input = text.trim();
  const json = /^```(?:json)?\s*\r?\n([\s\S]+)\r?\n```$/i.exec(input)?.[1] ?? input;
  if (!json.startsWith('{')) return;
  try {
    const parsed = result.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

const base = {version: 1, title: 'Título', summary: 'Resumen breve'};
const examples = {
  report: {...base, type: 'report', findings: [{title: 'Hallazgo', detail: 'Explicación', sources: [{path: 'ruta/relativa.ts', line: 1, excerpt: 'Fragmento opcional'}]}]},
  plan: {...base, type: 'plan', steps: [{title: 'Paso', detail: 'Qué hacer y cómo comprobarlo'}]},
  comparison: {...base, type: 'comparison', columns: ['Opción', 'Evaluación'], rows: [['Nombre', 'Detalle']]},
};

export function codexDocumentInstruction(format: CodexDocumentFormat): string {
  return '\nDentro del bloque de resultado escribe solo un objeto JSON válido, sin Markdown, con esta estructura: '+
    JSON.stringify(examples[format])+'. Sustituye los ejemplos por los datos de esta petición. '+
    (format === 'report' ? 'Incluye sources solo cuando hayas comprobado un archivo y su línea. excerpt es opcional. ' : '')+
    'Si necesitas aclaraciones o no puedes completar el resultado, devuelve texto claro dentro del mismo bloque.';
}
