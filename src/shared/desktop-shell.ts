import {z} from 'zod';
import {wardrobes} from './mascot';
export const ShellActionSchema=z.enum(['home','chat','activity','context','projects','voice','permissions','appearance','microphone','stop','preferences','hide','drag-start','drag-end','close-workspace','attach','region','guide','quick','capsule-menu','capsule-compact']);
export type ShellAction=z.infer<typeof ShellActionSchema>;
export const ShellStatusSchema=z.object({label:z.string().max(90),state:z.enum(['idle','queued','thinking','executing','awaiting_approval','awaiting_input','completed','failed','cancelled','listening']),busy:z.boolean(),sounds:z.boolean().optional(),microphone:z.boolean(),speaking:z.boolean(),attention:z.boolean(),permission:z.boolean().optional(),paused:z.boolean().optional(),external:z.boolean().optional(),contextReady:z.boolean().optional(),reduced:z.boolean(),wardrobe:z.union([z.literal('auto'),z.enum(wardrobes)]).optional(),pet:z.object({size:z.number().min(72).max(128),bubbles:z.boolean(),silent:z.boolean()}).strict().optional(),completion:z.object({id:z.string().max(100),text:z.string().max(120)}).strict().nullable().optional()}).strict();
export type ShellStatus=z.infer<typeof ShellStatusSchema>;
export const initialShellStatus:ShellStatus={label:'Disponible',state:'idle',busy:false,microphone:false,speaking:false,attention:false,reduced:false};
export const portalNames=['activity','context','projects','voice','permissions','notices','appearance'] as const;
export function allowedPortal(url:string,name:string){return url==='about:blank'&&portalNames.some(n=>name==='zen-'+n);}
