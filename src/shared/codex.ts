import {z} from 'zod';
export type CodexQuestion={id:string;question:string;secret?:boolean;options:{label:string;description:string}[]};
export type CodexReview={id:string;chatId:string;taskId:string;kind:'command'|'files'|'question'|'permissions';title:string;detail:string;questions?:CodexQuestion[];expiresAt:number};
export type CodexStatus={connected:boolean;account:'chatgpt'|'missing'|'unsupported';reviews:CodexReview[];error?:string};
export const CodexAnswerSchema=z.object({id:z.string().uuid(),decision:z.enum(['accept','decline','cancel']),answers:z.record(z.string().max(200),z.string().max(12000)).optional()}).strict();
export type CodexAnswer=z.infer<typeof CodexAnswerSchema>;
