import {z} from 'zod';

export const translatorTextLimit = 5000;
export const azureTranslatorKey = z.string().trim().min(16).max(256).regex(/^[a-zA-Z0-9_-]+$/);
const language = z.enum(['es', 'en']);
export type TranslationLanguage = z.infer<typeof language>;
export const oppositeLanguage = (source: TranslationLanguage) => source === 'es' ? 'en' : 'es';

export const TranslatorAction = z.discriminatedUnion('type', [
  z.object({type:z.literal('status')}).strict(),
  z.object({type:z.literal('configure'), key:azureTranslatorKey}).strict(),
  z.object({type:z.literal('disconnect')}).strict(),
  z.object({type:z.literal('leave')}).strict(),
  z.object({type:z.literal('translate'), from:language,
    text:z.string().max(translatorTextLimit).refine(text=>Boolean(text.trim()))}).strict(),
]);
export type TranslatorAction = z.infer<typeof TranslatorAction>;
export type TranslatorReply = {type:'status'; configured:boolean} | {type:'translation'; text:string};
