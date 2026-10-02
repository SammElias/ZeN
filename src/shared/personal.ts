import { z } from 'zod';
export const MemorySchema = z.object({
  id: z.string().uuid(), field: z.enum(['name', 'language', 'professional', 'goals', 'projects', 'communication', 'restrictions']),
  kind: z.enum(['fact', 'preference', 'tentative']), content: z.string().trim().min(1).max(4000),
  source: z.string().trim().min(1).max(300), updatedAt: z.string().datetime()
}).strict();
export type Memory = z.infer<typeof MemorySchema>;
export const ProfileSchema = z.array(MemorySchema).max(100);
export type Profile = z.infer<typeof ProfileSchema>;
export const ModeSchema = z.object({ response: z.enum(['voice', 'text', 'auto']), meeting: z.boolean() }).strict();
export type ResponseMode = z.infer<typeof ModeSchema>;
export function audible(mode: ResponseMode) { return !mode.meeting && mode.response !== 'text'; }
export type ControlIntent = 'silence' | 'cancel' | 'pause' | 'resume' | 'hide' | 'speak' | 'copy' | 'read-result' | 'ambiguous-stop' | null;
export function controlIntent(text: string): ControlIntent {
  const value = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/^[\s,]*(?:oye[, ]+)?(?:zen[, ]+)?/, '').trim();
  if(/^(?:copia(?:me)? (?:la respuesta|el resultado|el texto))[.! ]*$/.test(value))return 'copy';
  if(/^(?:lee(?:me)? (?:la respuesta|el resultado)|leeme el resultado)[.! ]*$/.test(value))return 'read-result';
  if(/^(?:deja de hablar(?:[, ]+sigue trabajando)?|para la voz|silencia la respuesta)[.! ]*$/.test(value))return 'silence';
  if (/^(?:callate|silencio|no hables|silencia(?:te)?|dejame?lo (?:por )?escrito|modo reunion|estoy en (?:una |la )?reunion)\b/.test(value) || /^para\b.*\b(?:reunion|escrito)\b/.test(value)) return 'silence';
  if (/^(?:para (?:la tarea|la busqueda)|cancela(?:r)? (?:la tarea|la busqueda)|deten (?:la tarea|la busqueda))[.! ]*$/.test(value)) return 'cancel';
  if (/^(?:espera|pausa la tarea)[.! ]*$/.test(value)) return 'pause';
  if (/^(?:continua|reanuda)[.! ]*$/.test(value)) return 'resume';
  if (/^(?:ocultate|escondete)[.! ]*$/.test(value)) return 'hide';
  if (/^(?:ya puedes hablar|puedes hablar|activa la voz)[.! ]*$/.test(value)) return 'speak';
  if (/^para[.! ]*$/.test(value)) return 'ambiguous-stop';
  return null;
}
export function relevantMemory(profile: Profile, text: string): Profile {
  const tokens = new Set(text.toLocaleLowerCase('es').match(/[\p{L}\p{N}]{4,}/gu) ?? []);
  return profile.filter(item => item.field === 'language' || item.field === 'communication' || item.field === 'restrictions' || (item.field === 'goals' && /objetiv|perfil|respuest|linkedin/i.test(text)) || item.content.toLocaleLowerCase('es').split(/\W+/).some(word => tokens.has(word))).slice(0, 8);
}
